import { TaskRepository } from "../../infrastructure/repositories/TaskRepository.js";

import { ProjectRepository } from "../../infrastructure/repositories/ProjectRepository.js";

import { TaskStatusHistoryRepository } from "../../infrastructure/repositories/TaskStatusHistoryRepository.js";

import { ChecklistStateHistoryRepository, ChecklistAction } from "../../infrastructure/repositories/ChecklistStateHistoryRepository.js";

import { NotificationService } from "./NotificationService.js";

import { EnhancedNotificationService } from "./EnhancedNotificationService.js";

import { sanitize } from "../validators/htmlSanitizer.js";

import { TaskOwnershipEnforcerService } from "./TaskOwnershipEnforcerService.js";

import { TaskDependencyService, CycleDetectionResult, DependencyValidationResult } from "./TaskDependencyService.js";

import { DependencyType, TaskDependencyWithDetails } from "../../infrastructure/repositories/TaskDependencyRepository.js";

import { MandatoryChecklistValidatorService, MandatoryChecklistValidationResult, validateMandatoryChecklist } from "./MandatoryChecklistValidatorService.js";

import { createLogger } from "../../infrastructure/logging/index.js";

// Note: Transaction handling is done at the repository level (TaskRepository, ProjectRepository)
// The repositories use withTransaction for multi-step operations like createTask, updateTask
// This ensures atomicity and automatic rollback on failure (Requirements: 12.3)

const logger = createLogger("TaskService");

/**
 * Validation result for task blocking
 * Requirements: 8.4
 */
export interface BlockingValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string; code: string }>;
}

/**
 * Validates that a blocking reason is provided when status changes to Blocked
 * Requirements: 8.4 - Task blocking reason requirement
 */
export function validateBlockingReason(
  newStatus: string | undefined,
  blockedReason: string | null | undefined,
  currentStatus?: string
): BlockingValidationResult {
  const errors: Array<{ field: string; message: string; code: string }> = [];

  // Check if status is changing to "Blocked"
  const isChangingToBlocked = 
    newStatus?.toLowerCase() === 'blocked' && 
    currentStatus?.toLowerCase() !== 'blocked';

  if (isChangingToBlocked) {
    // Validate that blocked_reason is provided and not empty
    if (!blockedReason || blockedReason.trim() === '') {
      errors.push({
        field: 'blockedReason',
        message: 'Blocked reason is required when changing task status to Blocked',
        code: 'BLOCKED_REASON_REQUIRED'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export class TaskService {
  private taskRepo = new TaskRepository();
  private projectRepo = new ProjectRepository();
  private statusHistoryRepo = new TaskStatusHistoryRepository();
  private checklistHistoryRepo = new ChecklistStateHistoryRepository();
  private notificationService = new NotificationService();
  private enhancedNotificationService = new EnhancedNotificationService();
  private ownershipEnforcer = new TaskOwnershipEnforcerService();
  private dependencyService = new TaskDependencyService();
  private mandatoryChecklistValidator = new MandatoryChecklistValidatorService();

  async getTasksByProject(projectId: string) {
    return await this.taskRepo.getTasksByProjectId(projectId);
  }

  async getTaskById(id: string, includeStatusHistory: boolean = false) {
    const task = await this.taskRepo.getTaskById(id);
    if (!task) {
      throw new Error("Không tìm thấy task");
    }
    const checklist = await this.taskRepo.getTaskChecklist(id);
    
    // Optionally include status history (Requirements: 8.5)
    if (includeStatusHistory) {
      const statusHistory = await this.statusHistoryRepo.getHistoryByTaskId(id);
      return { ...task, checklist, statusHistory };
    }
    
    return { ...task, checklist };
  }

  async createTask(taskData: any) {
    if (!taskData.projectId || !taskData.title) {
      throw new Error("Thiếu thông tin bắt buộc: projectId và title");
    }

    // Sanitize HTML content in description to prevent XSS attacks (Requirements: 2.2)
    const sanitizedDescription = taskData.description 
      ? sanitize(taskData.description) 
      : taskData.description;

    // Convert projectId to string if needed
    const taskDataWithStringId = {
      ...taskData,
      projectId: String(taskData.projectId),
      description: sanitizedDescription,
    };

    // Validate task ownership requirements (Requirements: 8.1, 16.1, 16.6)
    const ownershipValidation = await this.ownershipEnforcer.validate(
      { ownerId: taskData.ownerId },
      taskData.departmentId
    );

    // If enforcement mode is 'block' and validation failed, throw error
    if (!ownershipValidation.isValid) {
      const errorMessages = ownershipValidation.errors.map(e => e.message).join('; ');
      throw new Error(`Task ownership validation failed: ${errorMessages}`);
    }

    // Log warnings if any (warn mode)
    if (ownershipValidation.warnings.length > 0) {
      logger.warn("Task ownership warnings", {
        warnings: ownershipValidation.warnings,
        taskTitle: taskData.title,
        projectId: taskData.projectId
      });
    }

    const taskId = await this.taskRepo.createTask(taskDataWithStringId);

    // Record initial status in history (Requirements: 8.5)
    const initialStatus = taskData.status || "To Do";
    if (taskData.createdBy) {
      await this.statusHistoryRepo.recordStatusChange({
        taskId,
        fromStatus: null,
        toStatus: initialStatus,
        changedBy: taskData.createdBy,
        note: "Task created"
      });
    }

    // Add checklist items if provided
    if (taskData.checklist && Array.isArray(taskData.checklist)) {
      for (const item of taskData.checklist) {
        await this.taskRepo.addChecklistItem(taskId, item.text || item);
      }
    }

    // Recalculate project progress
    await this.projectRepo.recalculateProgress(taskDataWithStringId.projectId);

    // Notify assignees
    if (taskData.assigneeIds && taskData.assigneeIds.length > 0) {
      await this.notificationService.notifyUsers(
        taskData.assigneeIds,
        "Bạn được giao task mới",
        `Bạn đã được giao task "${taskData.title}"`,
        "task_assigned",
        taskId
      );
    }

    return await this.getTaskById(taskId);
  }

  async updateTask(id: string, taskData: any) {
    const currentTask = await this.taskRepo.getTaskById(id);

    // Sanitize HTML content in description if provided to prevent XSS attacks (Requirements: 2.2)
    const sanitizedTaskData = taskData.description 
      ? { ...taskData, description: sanitize(taskData.description) }
      : taskData;

    // Validate task ownership if ownerId is being updated (Requirements: 8.1, 16.1, 16.6)
    if (sanitizedTaskData.ownerId !== undefined) {
      const ownershipValidation = await this.ownershipEnforcer.validate(
        { ownerId: sanitizedTaskData.ownerId },
        taskData.departmentId
      );

      // If enforcement mode is 'block' and validation failed, throw error
      if (!ownershipValidation.isValid) {
        const errorMessages = ownershipValidation.errors.map(e => e.message).join('; ');
        throw new Error(`Task ownership validation failed: ${errorMessages}`);
      }

      // Log warnings if any (warn mode)
      if (ownershipValidation.warnings.length > 0) {
        logger.warn("Task ownership warnings on update", {
          warnings: ownershipValidation.warnings,
          taskId: id,
          newOwnerId: sanitizedTaskData.ownerId
        });
      }
    }

    // Validate blocking reason if status is changing to Blocked (Requirements: 8.4)
    const blockingValidation = validateBlockingReason(
      sanitizedTaskData.status,
      sanitizedTaskData.blockedReason,
      currentTask.status
    );

    if (!blockingValidation.isValid) {
      const errorMessages = blockingValidation.errors.map(e => e.message).join('; ');
      throw new Error(`Task blocking validation failed: ${errorMessages}`);
    }

    // Handle blocking fields when status changes to/from Blocked (Requirements: 8.4)
    if (sanitizedTaskData.status?.toLowerCase() === 'blocked' && currentTask.status?.toLowerCase() !== 'blocked') {
      // Task is being blocked - set blocking fields
      sanitizedTaskData.blockedAt = new Date();
      sanitizedTaskData.blockedBy = taskData.updatedBy || null;
    } else if (sanitizedTaskData.status && sanitizedTaskData.status.toLowerCase() !== 'blocked' && currentTask.status?.toLowerCase() === 'blocked') {
      // Task is being unblocked - clear blocking fields
      sanitizedTaskData.blockedReason = null;
      sanitizedTaskData.blockedAt = null;
      sanitizedTaskData.blockedBy = null;
    }

    // Check if status is changing and record history (Requirements: 8.5)
    const statusChanged = sanitizedTaskData.status !== undefined && 
                          sanitizedTaskData.status !== currentTask.status;

    if (sanitizedTaskData.status === "Done" && currentTask.status !== "Done") {
      // Validate mandatory checklist items before completing task (Requirements: 11.2)
      const checklistValidation = await this.mandatoryChecklistValidator.validateForTaskCompletion(
        id,
        taskData.departmentId
      );

      // If enforcement mode is 'block' and validation failed, throw error
      if (!checklistValidation.isValid) {
        const errorMessages = checklistValidation.errors.map(e => e.message).join('; ');
        throw new Error(`Task completion validation failed: ${errorMessages}`);
      }

      // Log warnings if any (warn mode)
      if (checklistValidation.warnings.length > 0) {
        logger.warn("Mandatory checklist warnings on task completion", {
          warnings: checklistValidation.warnings,
          taskId: id,
          uncompletedItems: checklistValidation.uncompletedMandatoryItems.map(i => i.text)
        });
      }

      // Task completed, update progress
      await this.taskRepo.updateTask(id, sanitizedTaskData);
      await this.projectRepo.recalculateProgress(currentTask.project_id);

      // Record status change in history (Requirements: 8.5)
      if (taskData.updatedBy) {
        await this.statusHistoryRepo.recordStatusChange({
          taskId: id,
          fromStatus: currentTask.status,
          toStatus: sanitizedTaskData.status,
          changedBy: taskData.updatedBy,
          note: taskData.statusChangeNote || null
        });
      }
    } else if (sanitizedTaskData.status !== "Done" && currentTask.status === "Done") {
      // Task reopened, update progress
      await this.taskRepo.updateTask(id, sanitizedTaskData);
      await this.projectRepo.recalculateProgress(currentTask.project_id);

      // Record status change in history (Requirements: 8.5)
      if (taskData.updatedBy) {
        await this.statusHistoryRepo.recordStatusChange({
          taskId: id,
          fromStatus: currentTask.status,
          toStatus: sanitizedTaskData.status,
          changedBy: taskData.updatedBy,
          note: taskData.statusChangeNote || null
        });
      }
    } else {
      await this.taskRepo.updateTask(id, sanitizedTaskData);

      // Record status change in history if status changed (Requirements: 8.5)
      if (statusChanged && taskData.updatedBy) {
        await this.statusHistoryRepo.recordStatusChange({
          taskId: id,
          fromStatus: currentTask.status,
          toStatus: sanitizedTaskData.status,
          changedBy: taskData.updatedBy,
          note: taskData.statusChangeNote || null
        });
      }
    }

    // Check for new assignees to notify (simple logic: just notify all current assignees of update, or diffing)
    // For simplicity, let's notify if explicitly assigned (which usually happens on create or distinct update)
    if (taskData.assigneeIds && taskData.assigneeIds.length > 0) {
      // Ideally we check diff, but for now notifying is safer/simpler
      // await this.notificationService.notifyUsers(taskData.assigneeIds, "Task Updated", ...);
    }

    // Notify task owner when task is blocked (Requirements: 8.4)
    if (sanitizedTaskData.status?.toLowerCase() === 'blocked' && currentTask.status?.toLowerCase() !== 'blocked') {
      await this.notifyBlockedTaskOwner(id, currentTask, sanitizedTaskData.blockedReason, taskData.updatedBy);
    }

    return await this.getTaskById(id);
  }

  /**
   * Notify task owner when task is blocked (Requirements: 8.4)
   */
  private async notifyBlockedTaskOwner(
    taskId: string,
    task: any,
    blockedReason: string,
    blockedBy: string | null
  ) {
    // Notify the task owner if they exist
    if (task.owner_id) {
      try {
        await this.enhancedNotificationService.notifyUser({
          userId: task.owner_id,
          title: 'Task bị chặn',
          message: `Task "${task.title}" đã bị chặn. Lý do: ${blockedReason}`,
          type: 'task_blocked',
          relatedId: taskId,
          category: 'task',
          priority: 'high',
          actorId: blockedBy || undefined,
          link: `/projects/${task.project_id}/tasks/${taskId}`
        });
        
        logger.info("Sent blocked task notification to owner", {
          taskId,
          ownerId: task.owner_id,
          blockedReason
        });
      } catch (error) {
        logger.error("Failed to send blocked task notification", error as Error, {
          taskId,
          ownerId: task.owner_id
        });
      }
    }

    // Also notify assignees
    if (task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0) {
      const assigneeIds = task.assignees
        .map((a: any) => a.id)
        .filter((id: string) => id !== task.owner_id); // Don't double-notify owner

      if (assigneeIds.length > 0) {
        try {
          await this.enhancedNotificationService.notifyUsers(assigneeIds, {
            title: 'Task bị chặn',
            message: `Task "${task.title}" đã bị chặn. Lý do: ${blockedReason}`,
            type: 'task_blocked',
            relatedId: taskId,
            category: 'task',
            priority: 'high',
            actorId: blockedBy || undefined,
            link: `/projects/${task.project_id}/tasks/${taskId}`
          });
        } catch (error) {
          logger.error("Failed to send blocked task notification to assignees", error as Error, {
            taskId,
            assigneeIds
          });
        }
      }
    }
  }

  async deleteTask(id: string) {
    const task = await this.taskRepo.getTaskById(id);
    if (!task) return;

    await this.taskRepo.deleteTask(id);
    await this.projectRepo.recalculateProgress(task.project_id);
  }

  // --- Checklist ---
  // Requirements: 11.1 - Record who completed checklist item and when
  // Requirements: 11.3 - Log changes when item is unchecked after being checked

  /**
   * Add a checklist item to a task
   * Requirements: 11.2 - Support mandatory checklist items
   * 
   * @param taskId - The task ID
   * @param text - The checklist item text
   * @param isMandatory - Whether this item is mandatory for task completion (default: false)
   */
  async addChecklistItem(taskId: string, text: string, isMandatory: boolean = false) {
    const id = await this.taskRepo.addChecklistItem(taskId, text, isMandatory);
    const task = await this.taskRepo.getTaskById(taskId);
    await this.projectRepo.recalculateProgress(task.project_id);
    return id;
  }

  /**
   * Update checklist item with audit trail
   * Requirements: 11.1 - Record who completed checklist item and when
   * Requirements: 11.2 - Support mandatory checklist items
   * Requirements: 11.3 - Log changes when item is unchecked after being checked
   * 
   * @param id - Checklist item ID
   * @param updates - Updates to apply (text, isCompleted, isMandatory, actorId, actorName, uncheckedReason)
   */
  async updateChecklistItem(id: string, updates: {
    text?: string;
    isCompleted?: boolean;
    isMandatory?: boolean;
    actorId?: string;
    actorName?: string;
    uncheckedReason?: string;
  }) {
    // Get current state before update for audit trail
    const currentItem = await this.taskRepo.getChecklistItemById(id);
    const task = await this.taskRepo.getTaskByChecklistId(id);
    
    if (!task) {
      throw new Error("Checklist item not found or task not found");
    }

    // Prepare update data with audit fields
    const updateData: any = {};
    
    if (updates.text !== undefined) {
      updateData.text = updates.text;
    }

    // Requirements: 11.2 - Support mandatory field update
    if (updates.isMandatory !== undefined) {
      updateData.isMandatory = updates.isMandatory;
    }
    
    if (updates.isCompleted !== undefined) {
      updateData.isCompleted = updates.isCompleted;
      
      if (updates.isCompleted) {
        // Item is being checked
        updateData.completedBy = updates.actorId || null;
      } else {
        // Item is being unchecked
        updateData.uncheckedBy = updates.actorId || null;
        updateData.uncheckedReason = updates.uncheckedReason || null;
      }
    }

    // Update the checklist item
    await this.taskRepo.updateChecklistItem(id, updateData);

    // Record state change in history if completion status changed
    if (updates.isCompleted !== undefined && updates.actorId) {
      const wasCompleted = currentItem?.isCompleted || false;
      const isNowCompleted = updates.isCompleted;
      
      // Only record if state actually changed
      if (wasCompleted !== isNowCompleted) {
        const action: ChecklistAction = isNowCompleted ? 'CHECKED' : 'UNCHECKED';
        
        await this.checklistHistoryRepo.recordStateChange({
          checklistItemId: id,
          taskId: task.id,
          action,
          actorId: updates.actorId,
          actorName: updates.actorName,
          reason: !isNowCompleted ? updates.uncheckedReason : undefined
        });

        logger.info("Recorded checklist state change", {
          checklistItemId: id,
          taskId: task.id,
          action,
          actorId: updates.actorId,
          previousState: wasCompleted,
          newState: isNowCompleted
        });
      }
    }

    // Recalculate project progress if completion status changed
    if (updates.isCompleted !== undefined) {
      await this.projectRepo.recalculateProgress(task.project_id);
    }
  }

  async deleteChecklistItem(id: string) {
    const task = await this.taskRepo.getTaskByChecklistId(id);
    await this.taskRepo.deleteChecklistItem(id);
    if (task) {
      await this.projectRepo.recalculateProgress(task.project_id);
    }
  }

  /**
   * Get checklist state history for a task
   * Requirements: 11.1, 11.3
   */
  async getChecklistStateHistory(taskId: string) {
    return await this.checklistHistoryRepo.getHistoryByTaskId(taskId);
  }

  /**
   * Get checklist state history for a specific item
   * Requirements: 11.1, 11.3
   */
  async getChecklistItemHistory(checklistItemId: string) {
    return await this.checklistHistoryRepo.getHistoryByChecklistItemId(checklistItemId);
  }

  /**
   * Update task status using workflow status_id
   * Used for drag-drop in task board
   * 
   * @param taskId - The task ID
   * @param statusId - The new status ID or status name
   * @param changedBy - The user ID who made the change (required for history)
   * @param note - Optional note for the status change
   */
  async updateTaskStatus(taskId: string, statusId: string, changedBy?: string, note?: string) {
    const task = await this.taskRepo.getTaskById(taskId);
    if (!task) {
      throw new Error("Không tìm thấy task");
    }

    const previousStatus = task.status;
    const result = await this.taskRepo.updateTaskStatusById(taskId, statusId);

    // Record status change in history (Requirements: 8.5)
    if (changedBy && result.statusName !== previousStatus) {
      await this.statusHistoryRepo.recordStatusChange({
        taskId,
        fromStatus: previousStatus,
        toStatus: result.statusName,
        changedBy,
        note: note || null
      });
    }

    // Recalculate project progress
    await this.projectRepo.recalculateProgress(task.project_id);

    return result;
  }

  async getTasksByUserId(userId: string) {
    return await this.taskRepo.getTasksByUserId(userId);
  }

  // --- Task Ownership Settings (Requirements: 8.1, 16.1, 16.6) ---

  /**
   * Get enforcement mode for a department
   */
  async getOwnershipEnforcementMode(departmentId: string): Promise<'warn' | 'block'> {
    return await this.ownershipEnforcer.getEnforcementMode(departmentId);
  }

  /**
   * Set enforcement mode for a department
   */
  async setOwnershipEnforcementMode(departmentId: string, mode: 'warn' | 'block'): Promise<void> {
    await this.ownershipEnforcer.setEnforcementMode(departmentId, mode);
  }

  /**
   * Get all ownership settings
   */
  async getAllOwnershipSettings() {
    return await this.ownershipEnforcer.getAllSettings();
  }

  /**
   * Validate task ownership (can be called externally for pre-validation)
   */
  async validateTaskOwnership(ownerId: string | null | undefined, departmentId?: string) {
    return await this.ownershipEnforcer.validate({ ownerId }, departmentId);
  }

  // --- Task Status History (Requirements: 8.5) ---

  /**
   * Get the status history for a specific task
   */
  async getTaskStatusHistory(taskId: string) {
    return await this.statusHistoryRepo.getHistoryByTaskId(taskId);
  }

  /**
   * Get the most recent status change for a task
   */
  async getLatestTaskStatusChange(taskId: string) {
    return await this.statusHistoryRepo.getLatestStatusChange(taskId);
  }

  /**
   * Get status history entries by user (who made the changes)
   */
  async getStatusHistoryByUser(userId: string, limit: number = 50) {
    return await this.statusHistoryRepo.getHistoryByUserId(userId, limit);
  }

  // --- Task Blocking (Requirements: 8.4) ---

  /**
   * Block a task with a reason
   * Validates that a reason is provided and notifies the task owner
   */
  async blockTask(taskId: string, blockedReason: string, blockedBy: string) {
    const task = await this.taskRepo.getTaskById(taskId);
    if (!task) {
      throw new Error("Không tìm thấy task");
    }

    // Validate blocking reason
    const validation = validateBlockingReason('Blocked', blockedReason, task.status);
    if (!validation.isValid) {
      const errorMessages = validation.errors.map(e => e.message).join('; ');
      throw new Error(`Task blocking validation failed: ${errorMessages}`);
    }

    // Update task status to Blocked with reason
    await this.taskRepo.updateTask(taskId, {
      status: 'Blocked',
      blockedReason,
      blockedAt: new Date(),
      blockedBy
    });

    // Record status change in history
    await this.statusHistoryRepo.recordStatusChange({
      taskId,
      fromStatus: task.status,
      toStatus: 'Blocked',
      changedBy: blockedBy,
      note: `Blocked: ${blockedReason}`
    });

    // Notify task owner
    await this.notifyBlockedTaskOwner(taskId, task, blockedReason, blockedBy);

    return await this.getTaskById(taskId);
  }

  /**
   * Unblock a task
   * Clears blocking fields and changes status to a specified status
   */
  async unblockTask(taskId: string, newStatus: string, unblockBy: string, note?: string) {
    const task = await this.taskRepo.getTaskById(taskId);
    if (!task) {
      throw new Error("Không tìm thấy task");
    }

    if (task.status?.toLowerCase() !== 'blocked') {
      throw new Error("Task is not currently blocked");
    }

    // Clear blocking fields and update status
    await this.taskRepo.updateTask(taskId, {
      status: newStatus,
      blockedReason: null,
      blockedAt: null,
      blockedBy: null
    });

    // Record status change in history
    await this.statusHistoryRepo.recordStatusChange({
      taskId,
      fromStatus: 'Blocked',
      toStatus: newStatus,
      changedBy: unblockBy,
      note: note || 'Task unblocked'
    });

    return await this.getTaskById(taskId);
  }

  /**
   * Get all blocked tasks for a project
   */
  async getBlockedTasksByProject(projectId: string) {
    return await this.taskRepo.getBlockedTasksByProjectId(projectId);
  }

  /**
   * Validate blocking reason (can be called externally for pre-validation)
   */
  validateBlockingReason(newStatus: string, blockedReason: string | null | undefined, currentStatus?: string) {
    return validateBlockingReason(newStatus, blockedReason, currentStatus);
  }

  // --- Task Dependencies (Requirements: 8.3) ---

  /**
   * Get all dependencies for a task
   * Returns tasks that this task depends on
   */
  async getTaskDependencies(taskId: string): Promise<TaskDependencyWithDetails[]> {
    return await this.dependencyService.getTaskDependencies(taskId);
  }

  /**
   * Get all tasks that depend on a specific task
   * Returns tasks that are blocked by this task
   */
  async getTaskDependents(taskId: string): Promise<TaskDependencyWithDetails[]> {
    return await this.dependencyService.getTaskDependents(taskId);
  }

  /**
   * Get all dependencies for a project
   */
  async getProjectDependencies(projectId: string): Promise<TaskDependencyWithDetails[]> {
    return await this.dependencyService.getProjectDependencies(projectId);
  }

  /**
   * Add a dependency between tasks
   * Validates and checks for circular dependencies before adding
   * Requirements: 8.3 - Detect cycles before adding new dependency
   * 
   * @param taskId - The task that will have the dependency
   * @param dependsOnTaskId - The task that taskId will depend on
   * @param dependencyType - Type of dependency (BLOCKS or RELATES_TO)
   * @param createdBy - User ID who created this dependency
   */
  async addTaskDependency(
    taskId: string,
    dependsOnTaskId: string,
    dependencyType: DependencyType = 'BLOCKS',
    createdBy: string | null = null
  ): Promise<{ id: string; warnings: Array<{ field: string; message: string; code: string }> }> {
    return await this.dependencyService.addDependency(taskId, dependsOnTaskId, dependencyType, createdBy);
  }

  /**
   * Remove a dependency by ID
   */
  async removeTaskDependency(id: string): Promise<void> {
    await this.dependencyService.removeDependency(id);
  }

  /**
   * Remove a dependency by task IDs
   */
  async removeTaskDependencyByTasks(taskId: string, dependsOnTaskId: string): Promise<void> {
    await this.dependencyService.removeDependencyByTasks(taskId, dependsOnTaskId);
  }

  /**
   * Validate adding a dependency (can be called externally for pre-validation)
   * Checks for cycles, self-reference, and task existence
   * Requirements: 8.3 - Detect cycles before adding new dependency
   */
  async validateTaskDependency(taskId: string, dependsOnTaskId: string): Promise<DependencyValidationResult> {
    return await this.dependencyService.validateDependency(taskId, dependsOnTaskId);
  }

  /**
   * Detect if adding a dependency would create a circular dependency
   * Requirements: 8.3 - Detect cycles before adding new dependency
   */
  async detectCircularDependency(taskId: string, dependsOnTaskId: string): Promise<CycleDetectionResult> {
    return await this.dependencyService.detectCircularDependency(taskId, dependsOnTaskId);
  }

  /**
   * Check if a task has any blocking dependencies that are not completed
   * Useful for determining if a task can be started
   */
  async hasUncompletedBlockingDependencies(taskId: string): Promise<{
    hasBlocking: boolean;
    blockingTasks: TaskDependencyWithDetails[];
  }> {
    return await this.dependencyService.hasUncompletedBlockingDependencies(taskId);
  }

  /**
   * Get dependency graph for visualization
   * Returns nodes and edges for a project's task dependencies
   */
  async getDependencyGraph(projectId: string): Promise<{
    nodes: Array<{ id: string; code: string; title: string; status: string }>;
    edges: Array<{ from: string; to: string; type: DependencyType }>;
  }> {
    return await this.dependencyService.getDependencyGraph(projectId);
  }

  // --- Mandatory Checklist Validation (Requirements: 11.2) ---

  /**
   * Validate mandatory checklist items for task completion
   * Requirements: 11.2 - Warn before task completion if mandatory items unchecked
   * 
   * @param taskId - Task ID to validate
   * @param departmentId - Optional department ID for enforcement mode lookup
   * @returns Validation result with errors/warnings based on enforcement mode
   */
  async validateMandatoryChecklist(taskId: string, departmentId?: string): Promise<MandatoryChecklistValidationResult> {
    return await this.mandatoryChecklistValidator.validateForTaskCompletion(taskId, departmentId);
  }

  /**
   * Get mandatory checklist enforcement mode
   * Requirements: 11.2
   * 
   * @param departmentId - Optional department ID for department-specific mode
   * @returns 'warn' or 'block'
   */
  getMandatoryChecklistEnforcementMode(departmentId?: string): 'warn' | 'block' {
    return this.mandatoryChecklistValidator.getEnforcementMode(departmentId);
  }

  /**
   * Set mandatory checklist enforcement mode
   * Requirements: 11.2
   * 
   * @param mode - 'warn' or 'block'
   * @param departmentId - Optional department ID (global if not provided)
   */
  setMandatoryChecklistEnforcementMode(mode: 'warn' | 'block', departmentId?: string): void {
    this.mandatoryChecklistValidator.setEnforcementMode(mode, departmentId);
  }

  /**
   * Get uncompleted mandatory checklist items for a task
   * Requirements: 11.2
   * 
   * @param taskId - Task ID
   * @returns Array of uncompleted mandatory checklist items
   */
  async getUncompletedMandatoryItems(taskId: string) {
    return await this.taskRepo.getUncompletedMandatoryItems(taskId);
  }

  /**
   * Pure function validation for mandatory checklist (useful for client-side validation)
   * Requirements: 11.2
   */
  validateMandatoryChecklistPure = validateMandatoryChecklist;
}
