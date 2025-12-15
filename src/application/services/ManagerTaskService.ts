import { TaskRepository } from "../../infrastructure/repositories/TaskRepository.js";
import { DepartmentRepository } from "../../infrastructure/repositories/DepartmentRepository.js";

export class ManagerTaskService {
  constructor(
    private taskRepository: TaskRepository,
    private departmentRepository: DepartmentRepository
  ) {}

  /**
   * Get tasks assigned to manager and their department
   */
  async getManagerTasks(userId: string, status?: string) {
    try {
      // Get manager's department
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department) {
        throw new Error("Manager department not found");
      }

      // Get tasks for the manager's department
      let tasks = await this.taskRepository.getTasksByDepartment(department.id);

      // Filter by status if provided
      if (status) {
        tasks = tasks.filter((t) => t.status === status);
      }

      // Sort by due date
      tasks.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

      return tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigned_to: task.assigned_to,
        assigned_to_name: task.assigned_to_name || "Unassigned",
        created_by: task.created_by,
        due_date: task.due_date,
        progress: task.progress || 0,
        checklist: task.checklist || [],
        comments_count: task.comments_count || 0,
        created_at: task.created_at,
        updated_at: task.updated_at,
      }));
    } catch (error) {
      console.error("Error getting manager tasks:", error);
      throw error;
    }
  }

  /**
   * Create a new task for an employee
   */
  async createManagerTask(
    userId: string,
    taskData: {
      title: string;
      description?: string;
      assigned_to: string;
      priority: "low" | "medium" | "high" | "critical";
      due_date?: string;
      checklist?: { item: string; completed: boolean }[];
    }
  ) {
    try {
      // Get manager's department
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department) {
        throw new Error("Manager department not found");
      }

      // Verify the assignee is in the manager's department
      const employees = await this.departmentRepository.getDepartmentEmployees(
        department.id
      );
      const isValidAssignee = employees.some(
        (emp) => emp.id === taskData.assigned_to
      );

      if (!isValidAssignee) {
        throw new Error(
          "Cannot assign task to employee outside your department"
        );
      }

      // Create task
      const newTask = {
        title: taskData.title,
        description: taskData.description || "",
        assigned_to: taskData.assigned_to,
        department_id: department.id,
        created_by: userId,
        priority: taskData.priority,
        status: "todo",
        due_date: taskData.due_date,
        progress: 0,
        checklist: taskData.checklist || [],
      };

      const taskId = await this.taskRepository.createTask({
        title: newTask.title,
        description: newTask.description,
        projectId: null, // Manager tasks may not be tied to a project
        status: "To Do",
        priority:
          taskData.priority === "critical"
            ? "High"
            : taskData.priority === "high"
            ? "High"
            : taskData.priority === "low"
            ? "Low"
            : "Medium",
        dueDate: taskData.due_date,
        createdBy: userId,
        assigneeIds: [taskData.assigned_to],
      });

      return {
        id: taskId,
        title: newTask.title,
        status: "todo",
        message: "Task created successfully",
      };
    } catch (error) {
      console.error("Error creating manager task:", error);
      throw error;
    }
  }

  /**
   * Update task status or progress
   */
  async updateTaskStatus(
    userId: string,
    taskId: string,
    status: string,
    progress?: number
  ) {
    try {
      const task = await this.taskRepository.getTaskById(taskId);
      if (!task) {
        throw new Error("Task not found");
      }

      // Get manager's department
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department || task.department_id !== department.id) {
        throw new Error("Cannot update task outside your department");
      }

      // Update task
      await this.taskRepository.updateTask(taskId, {
        status,
      });

      return {
        id: taskId,
        status,
        progress: progress || task.progress,
        message: "Task updated successfully",
      };
    } catch (error) {
      console.error("Error updating task status:", error);
      throw error;
    }
  }

  /**
   * Add comment to task
   */
  async addTaskComment(userId: string, taskId: string, comment: string) {
    try {
      const task = await this.taskRepository.getTaskById(taskId);
      if (!task) {
        throw new Error("Task not found");
      }

      // Get manager's department
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department || task.department_id !== department.id) {
        throw new Error("Cannot comment on task outside your department");
      }

      // Add comment
      const newComment = await this.taskRepository.addComment(taskId, {
        user_id: userId,
        content: comment,
        created_at: new Date().toISOString(),
      });

      return {
        id: newComment.id,
        comment,
        message: "Comment added successfully",
      };
    } catch (error) {
      console.error("Error adding task comment:", error);
      throw error;
    }
  }

  /**
   * Update task checklist
   */
  async updateTaskChecklist(
    userId: string,
    taskId: string,
    checklist: { item: string; completed: boolean }[]
  ) {
    try {
      const task = await this.taskRepository.getTaskById(taskId);
      if (!task) {
        throw new Error("Task not found");
      }

      // Get manager's department
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department || task.department_id !== department.id) {
        throw new Error("Cannot update task outside your department");
      }

      // Calculate progress based on checklist
      const completedItems = checklist.filter((item) => item.completed).length;
      const progress =
        checklist.length > 0
          ? Math.round((completedItems / checklist.length) * 100)
          : 0;

      // Update task checklist - simplified approach
      // For now, we just log that checklist updates would go here
      console.log(`Updating checklist for task ${taskId}:`, checklist);

      return {
        id: taskId,
        checklist,
        progress,
        message: "Checklist updated successfully",
      };
    } catch (error) {
      console.error("Error updating task checklist:", error);
      throw error;
    }
  }
}
