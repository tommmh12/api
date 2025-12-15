import { Request, Response } from "express";
import { TaskService } from "../../application/services/TaskService.js";
import { logger } from "../../infrastructure/logging/index.js";

const taskService = new TaskService();

export const getTasksByProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const tasks = await taskService.getTasksByProject(projectId);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting tasks", error, { projectId: req.params.projectId });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách task",
    });
  }
};

export const getTaskById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await taskService.getTaskById(id);
    res.json({ success: true, data: task });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting task", error, { taskId: req.params.id });
    res.status(404).json({
      success: false,
      message: error.message || "Không tìm thấy task",
    });
  }
};

export const createTask = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const task = await taskService.createTask({
      ...req.body,
      createdBy: userId,
    });
    res.status(201).json({ success: true, data: task });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error creating task", error);
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi tạo task",
    });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    // Pass updatedBy for status history recording (Requirements: 8.5)
    const task = await taskService.updateTask(id, {
      ...req.body,
      updatedBy: userId,
    });
    res.json({ success: true, data: task });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error updating task", error, { taskId: req.params.id });
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật task",
    });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await taskService.deleteTask(id);
    res.json({ success: true, message: "Đã xóa task thành công" });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error deleting task", error, { taskId: req.params.id });
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa task",
    });
  }
};

/**
 * Add a checklist item to a task
 * Requirements: 11.2 - Support mandatory checklist items
 */
export const addChecklistItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text, isMandatory } = req.body;
    const newItemId = await taskService.addChecklistItem(id, text, isMandatory || false);
    res
      .status(201)
      .json({
        success: true,
        data: { id: newItemId, text, isCompleted: false, isMandatory: isMandatory || false },
      });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error adding checklist item", error, { taskId: req.params.id });
    res.status(500).json({ success: false, message: "Lỗi thêm checklist" });
  }
};

/**
 * Update checklist item with audit trail
 * Requirements: 11.1 - Record who completed checklist item and when
 * Requirements: 11.3 - Log changes when item is unchecked after being checked
 */
export const updateChecklistItem = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const userId = (req as any).user?.userId;
    const userName = (req as any).user?.fullName || (req as any).user?.name;
    
    // Pass actor information for audit trail
    await taskService.updateChecklistItem(itemId, {
      ...req.body,
      actorId: userId,
      actorName: userName,
    });
    res.json({ success: true, message: "Cập nhật checklist thành công" });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error updating checklist item", error, { itemId: req.params.itemId });
    res.status(500).json({ success: false, message: "Lỗi cập nhật checklist" });
  }
};

export const deleteChecklistItem = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    await taskService.deleteChecklistItem(itemId);
    res.json({ success: true, message: "Xóa checklist thành công" });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error deleting checklist item", error, { itemId: req.params.itemId });
    res.status(500).json({ success: false, message: "Lỗi xóa checklist" });
  }
};

// --- Checklist State History (Requirements: 11.1, 11.3) ---

/**
 * Get checklist state history for a task
 * Returns all state changes (checked/unchecked) for all checklist items in a task
 * Requirements: 11.1, 11.3
 */
export const getChecklistStateHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await taskService.getChecklistStateHistory(id);
    res.json({ success: true, data: history });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting checklist state history", error, { taskId: req.params.id });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy lịch sử checklist",
    });
  }
};

/**
 * Get state history for a specific checklist item
 * Requirements: 11.1, 11.3
 */
export const getChecklistItemHistory = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const history = await taskService.getChecklistItemHistory(itemId);
    res.json({ success: true, data: history });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting checklist item history", error, { itemId: req.params.itemId });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy lịch sử checklist item",
    });
  }
};

/**
 * Update task status (for workflow drag-drop)
 * Requires admin or project manager permission
 * Records status change in history (Requirements: 8.5)
 */
export const updateTaskStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { statusId, note } = req.body;
    const userId = (req as any).user?.userId;

    if (!statusId) {
      res.status(400).json({
        success: false,
        message: "Thiếu statusId",
      });
      return;
    }

    // Pass changedBy for status history recording (Requirements: 8.5)
    const result = await taskService.updateTaskStatus(id, statusId, userId, note);
    res.json({
      success: true,
      data: result,
      message: `Task đã chuyển sang "${result.statusName}"`,
    });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error updating task status", error, { taskId: req.params.id });
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật trạng thái task",
    });
  }
};

export const getMyTasks = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const tasks = await taskService.getTasksByUserId(userId);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting my tasks", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách task của bạn",
    });
  }
};

// --- Task Ownership Settings (Requirements: 8.1, 16.1, 16.6) ---

/**
 * Get all ownership settings for departments
 * Requires admin permission
 */
export const getOwnershipSettings = async (req: Request, res: Response) => {
  try {
    const settings = await taskService.getAllOwnershipSettings();
    res.json({ success: true, data: settings });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting ownership settings", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy cài đặt ownership",
    });
  }
};

/**
 * Get enforcement mode for a specific department
 */
export const getOwnershipEnforcementMode = async (req: Request, res: Response) => {
  try {
    const { departmentId } = req.params;
    const mode = await taskService.getOwnershipEnforcementMode(departmentId);
    res.json({ success: true, data: { departmentId, enforcementMode: mode } });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting enforcement mode", error, { departmentId: req.params.departmentId });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chế độ enforcement",
    });
  }
};

/**
 * Set enforcement mode for a specific department
 * Requires admin permission
 */
export const setOwnershipEnforcementMode = async (req: Request, res: Response) => {
  try {
    const { departmentId } = req.params;
    const { mode } = req.body;

    if (!mode || !['warn', 'block'].includes(mode)) {
      res.status(400).json({
        success: false,
        message: "Mode phải là 'warn' hoặc 'block'",
      });
      return;
    }

    await taskService.setOwnershipEnforcementMode(departmentId, mode);
    res.json({ 
      success: true, 
      message: `Đã cập nhật enforcement mode thành '${mode}' cho department`,
      data: { departmentId, enforcementMode: mode }
    });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error setting enforcement mode", error, { departmentId: req.params.departmentId });
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật chế độ enforcement",
    });
  }
};

/**
 * Validate task ownership (pre-validation endpoint)
 */
export const validateTaskOwnership = async (req: Request, res: Response) => {
  try {
    const { ownerId, departmentId } = req.body;
    const result = await taskService.validateTaskOwnership(ownerId, departmentId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error validating task ownership", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi validate ownership",
    });
  }
};

// --- Task Status History (Requirements: 8.5) ---

/**
 * Get status history for a specific task
 */
export const getTaskStatusHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await taskService.getTaskStatusHistory(id);
    res.json({ success: true, data: history });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting task status history", error, { taskId: req.params.id });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy lịch sử trạng thái task",
    });
  }
};

/**
 * Get task with status history included
 */
export const getTaskWithHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await taskService.getTaskById(id, true);
    res.json({ success: true, data: task });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting task with history", error, { taskId: req.params.id });
    res.status(404).json({
      success: false,
      message: error.message || "Không tìm thấy task",
    });
  }
};

/**
 * Get status history for current user's changes
 */
export const getMyStatusChanges = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await taskService.getStatusHistoryByUser(userId, limit);
    res.json({ success: true, data: history });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting user status changes", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy lịch sử thay đổi trạng thái",
    });
  }
};

// --- Task Blocking (Requirements: 8.4) ---

/**
 * Block a task with a reason
 * Requires a blocking reason to be provided
 */
export const blockTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { blockedReason } = req.body;
    const userId = (req as any).user?.userId;

    if (!blockedReason || blockedReason.trim() === '') {
      res.status(400).json({
        success: false,
        message: "Lý do chặn task là bắt buộc",
        errors: [{
          field: 'blockedReason',
          message: 'Blocked reason is required when blocking a task',
          code: 'BLOCKED_REASON_REQUIRED'
        }]
      });
      return;
    }

    const task = await taskService.blockTask(id, blockedReason, userId);
    res.json({
      success: true,
      data: task,
      message: "Task đã được chặn thành công"
    });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error blocking task", error, { taskId: req.params.id });
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi chặn task",
    });
  }
};

/**
 * Unblock a task
 * Changes status from Blocked to a specified status
 */
export const unblockTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newStatus, note } = req.body;
    const userId = (req as any).user?.userId;

    if (!newStatus) {
      res.status(400).json({
        success: false,
        message: "Trạng thái mới là bắt buộc khi mở chặn task",
      });
      return;
    }

    const task = await taskService.unblockTask(id, newStatus, userId, note);
    res.json({
      success: true,
      data: task,
      message: `Task đã được mở chặn và chuyển sang "${newStatus}"`
    });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error unblocking task", error, { taskId: req.params.id });
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi mở chặn task",
    });
  }
};

/**
 * Get all blocked tasks for a project
 */
export const getBlockedTasks = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const tasks = await taskService.getBlockedTasksByProject(projectId);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting blocked tasks", error, { projectId: req.params.projectId });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách task bị chặn",
    });
  }
};

/**
 * Validate blocking reason (pre-validation endpoint)
 */
export const validateBlockingReason = async (req: Request, res: Response) => {
  try {
    const { newStatus, blockedReason, currentStatus } = req.body;
    const result = taskService.validateBlockingReason(newStatus, blockedReason, currentStatus);
    res.json({ success: true, data: result });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error validating blocking reason", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi validate lý do chặn",
    });
  }
};

// --- Task Dependencies (Requirements: 8.3) ---

/**
 * Get all dependencies for a task
 * Returns tasks that this task depends on
 */
export const getTaskDependencies = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dependencies = await taskService.getTaskDependencies(id);
    res.json({ success: true, data: dependencies });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting task dependencies", error, { taskId: req.params.id });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách dependencies",
    });
  }
};

/**
 * Get all tasks that depend on a specific task
 * Returns tasks that are blocked by this task
 */
export const getTaskDependents = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dependents = await taskService.getTaskDependents(id);
    res.json({ success: true, data: dependents });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting task dependents", error, { taskId: req.params.id });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách dependents",
    });
  }
};

/**
 * Get all dependencies for a project
 */
export const getProjectDependencies = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const dependencies = await taskService.getProjectDependencies(projectId);
    res.json({ success: true, data: dependencies });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting project dependencies", error, { projectId: req.params.projectId });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách dependencies của project",
    });
  }
};

/**
 * Add a dependency between tasks
 * Validates and checks for circular dependencies before adding
 * Requirements: 8.3 - Detect cycles before adding new dependency
 */
export const addTaskDependency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dependsOnTaskId, dependencyType } = req.body;
    const userId = (req as any).user?.userId;

    if (!dependsOnTaskId) {
      res.status(400).json({
        success: false,
        message: "dependsOnTaskId là bắt buộc",
        errors: [{
          field: 'dependsOnTaskId',
          message: 'dependsOnTaskId is required',
          code: 'DEPENDS_ON_TASK_ID_REQUIRED'
        }]
      });
      return;
    }

    const result = await taskService.addTaskDependency(
      id,
      dependsOnTaskId,
      dependencyType || 'BLOCKS',
      userId
    );

    res.status(201).json({
      success: true,
      data: result,
      message: "Đã thêm dependency thành công",
      warnings: result.warnings
    });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error adding task dependency", error, { 
      taskId: req.params.id,
      dependsOnTaskId: req.body.dependsOnTaskId
    });
    
    // Check if it's a circular dependency error
    if (error.message?.includes('circular') || error.message?.includes('Circular')) {
      res.status(400).json({
        success: false,
        message: error.message,
        errors: [{
          field: 'dependsOnTaskId',
          message: error.message,
          code: 'CIRCULAR_DEPENDENCY'
        }]
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi thêm dependency",
    });
  }
};

/**
 * Remove a dependency by ID
 */
export const removeTaskDependency = async (req: Request, res: Response) => {
  try {
    const { dependencyId } = req.params;
    await taskService.removeTaskDependency(dependencyId);
    res.json({
      success: true,
      message: "Đã xóa dependency thành công"
    });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error removing task dependency", error, { dependencyId: req.params.dependencyId });
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa dependency",
    });
  }
};

/**
 * Remove a dependency by task IDs
 */
export const removeTaskDependencyByTasks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dependsOnTaskId } = req.body;

    if (!dependsOnTaskId) {
      res.status(400).json({
        success: false,
        message: "dependsOnTaskId là bắt buộc",
      });
      return;
    }

    await taskService.removeTaskDependencyByTasks(id, dependsOnTaskId);
    res.json({
      success: true,
      message: "Đã xóa dependency thành công"
    });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error removing task dependency by tasks", error, { 
      taskId: req.params.id,
      dependsOnTaskId: req.body.dependsOnTaskId
    });
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa dependency",
    });
  }
};

/**
 * Validate adding a dependency (pre-validation endpoint)
 * Checks for cycles, self-reference, and task existence
 * Requirements: 8.3 - Detect cycles before adding new dependency
 */
export const validateTaskDependency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dependsOnTaskId } = req.body;

    if (!dependsOnTaskId) {
      res.status(400).json({
        success: false,
        message: "dependsOnTaskId là bắt buộc",
      });
      return;
    }

    const result = await taskService.validateTaskDependency(id, dependsOnTaskId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error validating task dependency", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi validate dependency",
    });
  }
};

/**
 * Detect circular dependency (pre-check endpoint)
 * Requirements: 8.3 - Detect cycles before adding new dependency
 */
export const detectCircularDependency = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dependsOnTaskId } = req.body;

    if (!dependsOnTaskId) {
      res.status(400).json({
        success: false,
        message: "dependsOnTaskId là bắt buộc",
      });
      return;
    }

    const result = await taskService.detectCircularDependency(id, dependsOnTaskId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error detecting circular dependency", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi kiểm tra circular dependency",
    });
  }
};

/**
 * Check if a task has uncompleted blocking dependencies
 */
export const checkBlockingDependencies = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await taskService.hasUncompletedBlockingDependencies(id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error checking blocking dependencies", error, { taskId: req.params.id });
    res.status(500).json({
      success: false,
      message: "Lỗi khi kiểm tra blocking dependencies",
    });
  }
};

/**
 * Get dependency graph for visualization
 * Returns nodes and edges for a project's task dependencies
 */
export const getDependencyGraph = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const graph = await taskService.getDependencyGraph(projectId);
    res.json({ success: true, data: graph });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting dependency graph", error, { projectId: req.params.projectId });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy dependency graph",
    });
  }
};

// --- Mandatory Checklist Validation (Requirements: 11.2) ---

/**
 * Validate mandatory checklist items for task completion
 * Requirements: 11.2 - Warn before task completion if mandatory items unchecked
 */
export const validateMandatoryChecklist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { departmentId } = req.query;
    const result = await taskService.validateMandatoryChecklist(id, departmentId as string);
    res.json({ success: true, data: result });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error validating mandatory checklist", error, { taskId: req.params.id });
    res.status(500).json({
      success: false,
      message: "Lỗi khi validate mandatory checklist",
    });
  }
};

/**
 * Get uncompleted mandatory checklist items for a task
 * Requirements: 11.2
 */
export const getUncompletedMandatoryItems = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const items = await taskService.getUncompletedMandatoryItems(id);
    res.json({ success: true, data: items });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting uncompleted mandatory items", error, { taskId: req.params.id });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách mandatory items chưa hoàn thành",
    });
  }
};

/**
 * Get mandatory checklist enforcement mode
 * Requirements: 11.2
 */
export const getMandatoryChecklistEnforcementMode = async (req: Request, res: Response) => {
  try {
    const { departmentId } = req.query;
    const mode = taskService.getMandatoryChecklistEnforcementMode(departmentId as string);
    res.json({ 
      success: true, 
      data: { 
        departmentId: departmentId || 'global', 
        enforcementMode: mode 
      } 
    });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting mandatory checklist enforcement mode", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chế độ enforcement mandatory checklist",
    });
  }
};

/**
 * Set mandatory checklist enforcement mode
 * Requirements: 11.2
 * Requires admin permission
 */
export const setMandatoryChecklistEnforcementMode = async (req: Request, res: Response) => {
  try {
    const { mode, departmentId } = req.body;

    if (!mode || !['warn', 'block'].includes(mode)) {
      res.status(400).json({
        success: false,
        message: "Mode phải là 'warn' hoặc 'block'",
      });
      return;
    }

    taskService.setMandatoryChecklistEnforcementMode(mode, departmentId);
    res.json({ 
      success: true, 
      message: `Đã cập nhật mandatory checklist enforcement mode thành '${mode}'`,
      data: { 
        departmentId: departmentId || 'global', 
        enforcementMode: mode 
      }
    });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error setting mandatory checklist enforcement mode", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật chế độ enforcement mandatory checklist",
    });
  }
};
