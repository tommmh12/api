import { 
  TaskDependencyRepository, 
  DependencyType,
  TaskDependencyWithDetails 
} from "../../infrastructure/repositories/TaskDependencyRepository.js";
import { TaskRepository } from "../../infrastructure/repositories/TaskRepository.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const logger = createLogger("TaskDependencyService");

/**
 * Result of circular dependency detection
 * Requirements: 8.3 - Detect cycles before adding new dependency
 */
export interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePath: string[] | null;
  cycleDescription: string | null;
}

/**
 * Validation result for adding a dependency
 */
export interface DependencyValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string; code: string }>;
  warnings: Array<{ field: string; message: string; code: string }>;
  cycleDetection?: CycleDetectionResult;
}

/**
 * Service for managing task dependencies with circular dependency detection
 * Requirements: 8.3 - Task dependency relationships and conflict warnings
 */
export class TaskDependencyService {
  private dependencyRepo = new TaskDependencyRepository();
  private taskRepo = new TaskRepository();

  /**
   * Get all dependencies for a task
   */
  async getTaskDependencies(taskId: string): Promise<TaskDependencyWithDetails[]> {
    return await this.dependencyRepo.getDependenciesByTaskId(taskId);
  }

  /**
   * Get all tasks that depend on a specific task
   */
  async getTaskDependents(taskId: string): Promise<TaskDependencyWithDetails[]> {
    return await this.dependencyRepo.getDependentsByTaskId(taskId);
  }

  /**
   * Get all dependencies for a project
   */
  async getProjectDependencies(projectId: string): Promise<TaskDependencyWithDetails[]> {
    return await this.dependencyRepo.getDependenciesByProjectId(projectId);
  }

  /**
   * Detect if adding a dependency would create a circular dependency
   * Requirements: 8.3 - Detect cycles before adding new dependency
   * 
   * @param taskId - The task that will have the dependency
   * @param dependsOnTaskId - The task that taskId will depend on
   * @returns CycleDetectionResult with cycle information
   */
  async detectCircularDependency(
    taskId: string, 
    dependsOnTaskId: string
  ): Promise<CycleDetectionResult> {
    // Check for self-reference
    if (taskId === dependsOnTaskId) {
      return {
        hasCycle: true,
        cyclePath: [taskId, taskId],
        cycleDescription: 'A task cannot depend on itself'
      };
    }

    // Check if this would create a cycle
    const wouldCycle = await this.dependencyRepo.wouldCreateCycle(taskId, dependsOnTaskId);
    
    if (!wouldCycle) {
      return {
        hasCycle: false,
        cyclePath: null,
        cycleDescription: null
      };
    }

    // Get the cycle path for detailed error message
    const cyclePath = await this.dependencyRepo.detectCyclePath(taskId, dependsOnTaskId);
    
    // Build human-readable description
    let cycleDescription = 'Adding this dependency would create a circular dependency: ';
    if (cyclePath && cyclePath.length > 0) {
      // Get task codes/titles for better readability
      const taskDetails = await this.getTaskDetailsForCycle(cyclePath);
      cycleDescription += taskDetails.join(' → ');
    } else {
      cycleDescription += `${taskId} → ${dependsOnTaskId} → ... → ${taskId}`;
    }

    return {
      hasCycle: true,
      cyclePath,
      cycleDescription
    };
  }

  /**
   * Get task codes/titles for cycle path display
   */
  private async getTaskDetailsForCycle(taskIds: string[]): Promise<string[]> {
    const details: string[] = [];
    for (const taskId of taskIds) {
      try {
        const task = await this.taskRepo.getTaskById(taskId);
        if (task) {
          details.push(task.code || task.title || taskId);
        } else {
          details.push(taskId);
        }
      } catch {
        details.push(taskId);
      }
    }
    return details;
  }

  /**
   * Validate adding a new dependency
   * Checks for cycles, self-reference, and task existence
   */
  async validateDependency(
    taskId: string,
    dependsOnTaskId: string
  ): Promise<DependencyValidationResult> {
    const errors: Array<{ field: string; message: string; code: string }> = [];
    const warnings: Array<{ field: string; message: string; code: string }> = [];

    // Check if both tasks exist
    const task = await this.taskRepo.getTaskById(taskId);
    if (!task) {
      errors.push({
        field: 'taskId',
        message: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    const dependsOnTask = await this.taskRepo.getTaskById(dependsOnTaskId);
    if (!dependsOnTask) {
      errors.push({
        field: 'dependsOnTaskId',
        message: 'Dependency task not found',
        code: 'DEPENDS_ON_TASK_NOT_FOUND'
      });
    }

    // If tasks don't exist, return early
    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    // Check if dependency already exists
    const exists = await this.dependencyRepo.dependencyExists(taskId, dependsOnTaskId);
    if (exists) {
      errors.push({
        field: 'dependsOnTaskId',
        message: 'This dependency already exists',
        code: 'DEPENDENCY_EXISTS'
      });
      return { isValid: false, errors, warnings };
    }

    // Check for circular dependency
    const cycleDetection = await this.detectCircularDependency(taskId, dependsOnTaskId);
    if (cycleDetection.hasCycle) {
      errors.push({
        field: 'dependsOnTaskId',
        message: cycleDetection.cycleDescription || 'Circular dependency detected',
        code: 'CIRCULAR_DEPENDENCY'
      });
      return { isValid: false, errors, warnings, cycleDetection };
    }

    // Check if tasks are in the same project (warning only)
    if (task.project_id !== dependsOnTask.project_id) {
      warnings.push({
        field: 'dependsOnTaskId',
        message: 'Tasks are in different projects. Cross-project dependencies may be harder to track.',
        code: 'CROSS_PROJECT_DEPENDENCY'
      });
    }

    // Check if dependency task is already completed (warning only)
    if (dependsOnTask.status?.toLowerCase() === 'done') {
      warnings.push({
        field: 'dependsOnTaskId',
        message: 'The dependency task is already completed',
        code: 'DEPENDENCY_ALREADY_COMPLETED'
      });
    }

    return { isValid: true, errors, warnings, cycleDetection };
  }

  /**
   * Add a new dependency between tasks
   * Validates and checks for cycles before adding
   * Requirements: 8.3 - Detect cycles before adding new dependency
   */
  async addDependency(
    taskId: string,
    dependsOnTaskId: string,
    dependencyType: DependencyType = 'BLOCKS',
    createdBy: string | null = null
  ): Promise<{ id: string; warnings: Array<{ field: string; message: string; code: string }> }> {
    // Validate the dependency
    const validation = await this.validateDependency(taskId, dependsOnTaskId);
    
    if (!validation.isValid) {
      const errorMessages = validation.errors.map(e => e.message).join('; ');
      throw new Error(`Cannot add dependency: ${errorMessages}`);
    }

    // Create the dependency
    const id = await this.dependencyRepo.createDependency(
      taskId,
      dependsOnTaskId,
      dependencyType,
      createdBy
    );

    logger.info("Added task dependency", {
      id,
      taskId,
      dependsOnTaskId,
      dependencyType,
      createdBy,
      warnings: validation.warnings
    });

    return { id, warnings: validation.warnings };
  }

  /**
   * Remove a dependency by ID
   */
  async removeDependency(id: string): Promise<void> {
    await this.dependencyRepo.deleteDependency(id);
    logger.info("Removed task dependency", { id });
  }

  /**
   * Remove a dependency by task IDs
   */
  async removeDependencyByTasks(taskId: string, dependsOnTaskId: string): Promise<void> {
    await this.dependencyRepo.deleteDependencyByTasks(taskId, dependsOnTaskId);
    logger.info("Removed task dependency by tasks", { taskId, dependsOnTaskId });
  }

  /**
   * Check if a task has any blocking dependencies that are not completed
   * Useful for determining if a task can be started
   */
  async hasUncompletedBlockingDependencies(taskId: string): Promise<{
    hasBlocking: boolean;
    blockingTasks: TaskDependencyWithDetails[];
  }> {
    const dependencies = await this.dependencyRepo.getDependenciesByTaskId(taskId);
    
    const blockingTasks = dependencies.filter(dep => 
      dep.dependencyType === 'BLOCKS' && 
      dep.dependsOnTaskStatus?.toLowerCase() !== 'done'
    );

    return {
      hasBlocking: blockingTasks.length > 0,
      blockingTasks
    };
  }

  /**
   * Get dependency graph for visualization
   * Returns nodes and edges for a project's task dependencies
   */
  async getDependencyGraph(projectId: string): Promise<{
    nodes: Array<{ id: string; code: string; title: string; status: string }>;
    edges: Array<{ from: string; to: string; type: DependencyType }>;
  }> {
    const dependencies = await this.dependencyRepo.getDependenciesByProjectId(projectId);
    
    // Collect unique task IDs
    const taskIds = new Set<string>();
    dependencies.forEach(dep => {
      taskIds.add(dep.taskId);
      taskIds.add(dep.dependsOnTaskId);
    });

    // Get task details for nodes
    const nodes: Array<{ id: string; code: string; title: string; status: string }> = [];
    for (const taskId of taskIds) {
      const task = await this.taskRepo.getTaskById(taskId);
      if (task) {
        nodes.push({
          id: task.id,
          code: task.code || '',
          title: task.title,
          status: task.status
        });
      }
    }

    // Build edges
    const edges = dependencies.map(dep => ({
      from: dep.taskId,
      to: dep.dependsOnTaskId,
      type: dep.dependencyType
    }));

    return { nodes, edges };
  }
}
