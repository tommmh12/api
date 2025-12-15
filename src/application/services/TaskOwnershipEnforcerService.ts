import { TaskOwnershipSettingsRepository, TaskOwnershipSettings } from "../../infrastructure/repositories/TaskOwnershipSettingsRepository.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const logger = createLogger("TaskOwnershipEnforcerService");

/**
 * Validation result for task ownership
 */
export interface TaskOwnershipValidationResult {
  isValid: boolean;
  enforcementMode: 'warn' | 'block';
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

/**
 * Task data for validation
 */
export interface TaskOwnershipData {
  ownerId?: string | null;
  projectId?: string;
  departmentId?: string;
}

/**
 * TaskOwnershipEnforcer Service
 * 
 * Ensures every task has exactly one owner with clear accountability.
 * Supports warn/block enforcement modes configurable per department.
 * 
 * Requirements: 8.1, 16.1, 16.6
 */
export class TaskOwnershipEnforcerService {
  private settingsRepo = new TaskOwnershipSettingsRepository();
  
  // Cache for settings to avoid repeated DB calls
  private settingsCache: Map<string, { settings: TaskOwnershipSettings; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache

  /**
   * Validate task ownership requirements
   * 
   * @param task - Task data to validate
   * @param departmentId - Department ID for enforcement mode lookup
   * @returns Validation result with errors/warnings based on enforcement mode
   */
  async validate(task: TaskOwnershipData, departmentId?: string): Promise<TaskOwnershipValidationResult> {
    const result: TaskOwnershipValidationResult = {
      isValid: true,
      enforcementMode: 'warn',
      errors: [],
      warnings: []
    };

    // Get enforcement mode for the department
    const enforcementMode = await this.getEnforcementMode(departmentId);
    result.enforcementMode = enforcementMode;

    // Check if owner is required
    const settings = departmentId ? await this.getSettings(departmentId) : null;
    const requireOwner = settings?.requireOwner ?? true;

    if (!requireOwner) {
      // Owner not required for this department
      return result;
    }

    // Validate owner_id
    if (!task.ownerId || task.ownerId.trim() === '') {
      const issue = {
        field: 'ownerId',
        message: 'Task must have exactly one owner assigned',
        code: 'OWNER_REQUIRED'
      };

      if (enforcementMode === 'block') {
        result.isValid = false;
        result.errors.push(issue);
      } else {
        // warn mode - add as warning, still valid
        result.warnings.push(issue);
      }
    }

    // Validate that ownerId is not an array or multiple values
    if (task.ownerId && typeof task.ownerId === 'string' && task.ownerId.includes(',')) {
      const issue = {
        field: 'ownerId',
        message: 'Task can only have one owner, multiple values provided',
        code: 'SINGLE_OWNER_REQUIRED'
      };

      if (enforcementMode === 'block') {
        result.isValid = false;
        result.errors.push(issue);
      } else {
        result.warnings.push(issue);
      }
    }

    logger.debug("Task ownership validation completed", {
      taskOwnerId: task.ownerId,
      departmentId,
      enforcementMode,
      isValid: result.isValid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length
    });

    return result;
  }

  /**
   * Get enforcement mode for a specific department
   * Returns 'warn' as default if no settings found
   * 
   * @param departmentId - Department ID to look up
   * @returns 'warn' or 'block'
   */
  async getEnforcementMode(departmentId?: string): Promise<'warn' | 'block'> {
    if (!departmentId) {
      return 'warn'; // Default to warn mode
    }

    const settings = await this.getSettings(departmentId);
    return settings?.enforcementMode || 'warn';
  }

  /**
   * Set enforcement mode for a specific department
   * 
   * @param departmentId - Department ID to configure
   * @param mode - 'warn' or 'block'
   */
  async setEnforcementMode(departmentId: string, mode: 'warn' | 'block'): Promise<void> {
    await this.settingsRepo.upsert(departmentId, { enforcementMode: mode });
    
    // Invalidate cache
    this.settingsCache.delete(departmentId);
    
    logger.info("Task ownership enforcement mode updated", {
      departmentId,
      mode
    });
  }

  /**
   * Set whether owner is required for a department
   * 
   * @param departmentId - Department ID to configure
   * @param required - Whether owner is required
   */
  async setRequireOwner(departmentId: string, required: boolean): Promise<void> {
    await this.settingsRepo.upsert(departmentId, { requireOwner: required });
    
    // Invalidate cache
    this.settingsCache.delete(departmentId);
    
    logger.info("Task ownership requirement updated", {
      departmentId,
      requireOwner: required
    });
  }

  /**
   * Get all department settings
   */
  async getAllSettings(): Promise<TaskOwnershipSettings[]> {
    return await this.settingsRepo.getAll();
  }

  /**
   * Get settings for a department with caching
   */
  private async getSettings(departmentId: string): Promise<TaskOwnershipSettings | null> {
    const cached = this.settingsCache.get(departmentId);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < this.CACHE_TTL_MS) {
      return cached.settings;
    }

    const settings = await this.settingsRepo.getByDepartmentId(departmentId);
    
    if (settings) {
      this.settingsCache.set(departmentId, { settings, timestamp: now });
    }

    return settings;
  }

  /**
   * Clear the settings cache (useful for testing)
   */
  clearCache(): void {
    this.settingsCache.clear();
  }
}
