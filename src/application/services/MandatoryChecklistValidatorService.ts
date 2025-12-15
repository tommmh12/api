import { TaskRepository } from "../../infrastructure/repositories/TaskRepository.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const logger = createLogger("MandatoryChecklistValidatorService");

/**
 * Uncompleted mandatory checklist item
 */
export interface UncompletedMandatoryItem {
  id: string;
  taskId: string;
  text: string;
  isMandatory: boolean;
  isCompleted: boolean;
  order: number;
}

/**
 * Validation result for mandatory checklist items
 * Requirements: 11.2 - Warn before task completion if mandatory items unchecked
 */
export interface MandatoryChecklistValidationResult {
  isValid: boolean;
  enforcementMode: 'warn' | 'block';
  uncompletedMandatoryItems: UncompletedMandatoryItem[];
  errors: Array<{
    field: string;
    message: string;
    code: string;
    items?: UncompletedMandatoryItem[];
  }>;
  warnings: Array<{
    field: string;
    message: string;
    code: string;
    items?: UncompletedMandatoryItem[];
  }>;
}

/**
 * Configuration for mandatory checklist enforcement
 */
export interface MandatoryChecklistConfig {
  enforcementMode: 'warn' | 'block';
}

// Default configuration - starts in warn mode as per adoption strategy
const DEFAULT_CONFIG: MandatoryChecklistConfig = {
  enforcementMode: 'warn'
};

// In-memory configuration store (can be extended to use database)
// Key: departmentId or 'global' for global settings
const configStore: Map<string, MandatoryChecklistConfig> = new Map();

/**
 * MandatoryChecklistValidatorService
 * 
 * Validates that mandatory checklist items are completed before task completion.
 * Supports warn/block enforcement modes.
 * 
 * Requirements: 11.2 - Warn before task completion if mandatory items unchecked
 */
export class MandatoryChecklistValidatorService {
  private taskRepo = new TaskRepository();

  /**
   * Validate mandatory checklist items for task completion
   * 
   * @param taskId - Task ID to validate
   * @param departmentId - Optional department ID for enforcement mode lookup
   * @returns Validation result with errors/warnings based on enforcement mode
   */
  async validateForTaskCompletion(
    taskId: string,
    departmentId?: string
  ): Promise<MandatoryChecklistValidationResult> {
    const result: MandatoryChecklistValidationResult = {
      isValid: true,
      enforcementMode: 'warn',
      uncompletedMandatoryItems: [],
      errors: [],
      warnings: []
    };

    // Get enforcement mode
    const enforcementMode = this.getEnforcementMode(departmentId);
    result.enforcementMode = enforcementMode;

    // Get uncompleted mandatory items
    const uncompletedItems = await this.taskRepo.getUncompletedMandatoryItems(taskId);
    result.uncompletedMandatoryItems = uncompletedItems;

    // If there are uncompleted mandatory items, add error/warning
    if (uncompletedItems.length > 0) {
      const itemTexts = uncompletedItems.map(item => item.text).join(', ');
      const issue = {
        field: 'checklist',
        message: `Cannot complete task: ${uncompletedItems.length} mandatory checklist item(s) are not completed: ${itemTexts}`,
        code: 'MANDATORY_CHECKLIST_INCOMPLETE',
        items: uncompletedItems
      };

      if (enforcementMode === 'block') {
        result.isValid = false;
        result.errors.push(issue);
      } else {
        // warn mode - add as warning, still valid
        result.warnings.push(issue);
      }
    }

    logger.debug("Mandatory checklist validation completed", {
      taskId,
      departmentId,
      enforcementMode,
      isValid: result.isValid,
      uncompletedCount: uncompletedItems.length,
      errorCount: result.errors.length,
      warningCount: result.warnings.length
    });

    return result;
  }

  /**
   * Get enforcement mode for a specific department
   * Returns 'warn' as default if no settings found
   * 
   * @param departmentId - Department ID to look up (optional)
   * @returns 'warn' or 'block'
   */
  getEnforcementMode(departmentId?: string): 'warn' | 'block' {
    // First check department-specific config
    if (departmentId) {
      const deptConfig = configStore.get(departmentId);
      if (deptConfig) {
        return deptConfig.enforcementMode;
      }
    }

    // Fall back to global config
    const globalConfig = configStore.get('global');
    if (globalConfig) {
      return globalConfig.enforcementMode;
    }

    // Default to warn mode
    return DEFAULT_CONFIG.enforcementMode;
  }

  /**
   * Set enforcement mode for a specific department or globally
   * 
   * @param mode - 'warn' or 'block'
   * @param departmentId - Department ID to configure (optional, 'global' if not provided)
   */
  setEnforcementMode(mode: 'warn' | 'block', departmentId?: string): void {
    const key = departmentId || 'global';
    const existingConfig = configStore.get(key) || { ...DEFAULT_CONFIG };
    existingConfig.enforcementMode = mode;
    configStore.set(key, existingConfig);

    logger.info("Mandatory checklist enforcement mode updated", {
      key,
      mode
    });
  }

  /**
   * Get all configuration settings
   */
  getAllSettings(): Map<string, MandatoryChecklistConfig> {
    return new Map(configStore);
  }

  /**
   * Clear all configuration (useful for testing)
   */
  clearConfig(): void {
    configStore.clear();
  }
}

/**
 * Pure function to validate mandatory checklist items
 * Can be used for unit testing without database dependency
 * 
 * Requirements: 11.2 - Warn before task completion if mandatory items unchecked
 * 
 * @param checklistItems - Array of checklist items to validate
 * @param enforcementMode - 'warn' or 'block'
 * @returns Validation result
 */
export function validateMandatoryChecklist(
  checklistItems: Array<{
    id: string;
    text: string;
    isMandatory: boolean;
    isCompleted: boolean;
  }>,
  enforcementMode: 'warn' | 'block' = 'warn'
): MandatoryChecklistValidationResult {
  const result: MandatoryChecklistValidationResult = {
    isValid: true,
    enforcementMode,
    uncompletedMandatoryItems: [],
    errors: [],
    warnings: []
  };

  // Find uncompleted mandatory items
  const uncompletedItems = checklistItems
    .filter(item => item.isMandatory && !item.isCompleted)
    .map(item => ({
      id: item.id,
      taskId: '', // Not available in pure function
      text: item.text,
      isMandatory: item.isMandatory,
      isCompleted: item.isCompleted,
      order: 0 // Not available in pure function
    }));

  result.uncompletedMandatoryItems = uncompletedItems;

  // If there are uncompleted mandatory items, add error/warning
  if (uncompletedItems.length > 0) {
    const itemTexts = uncompletedItems.map(item => item.text).join(', ');
    const issue = {
      field: 'checklist',
      message: `Cannot complete task: ${uncompletedItems.length} mandatory checklist item(s) are not completed: ${itemTexts}`,
      code: 'MANDATORY_CHECKLIST_INCOMPLETE',
      items: uncompletedItems
    };

    if (enforcementMode === 'block') {
      result.isValid = false;
      result.errors.push(issue);
    } else {
      // warn mode - add as warning, still valid
      result.warnings.push(issue);
    }
  }

  return result;
}
