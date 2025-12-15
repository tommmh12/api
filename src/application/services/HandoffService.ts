/**
 * HandoffService (HandoffManager)
 * Business logic for cross-department task handoffs
 * Requirements: 9.1 - Cross-department handoff with checklist completion and acceptance
 * Requirements: 9.4 - Handoff rejection with reason requirement
 * Requirements: 12.3 - Database operations with transaction rollback
 */

import { 
  HandoffRepository, 
  HandoffRecordWithDetails,
} from "../../infrastructure/repositories/HandoffRepository.js";
import { TaskRepository } from "../../infrastructure/repositories/TaskRepository.js";
import { UserRepository } from "../../infrastructure/repositories/UserRepository.js";
import { DepartmentRepository } from "../../infrastructure/repositories/DepartmentRepository.js";
import { enhancedNotificationService } from "./EnhancedNotificationService.js";
import { createLogger } from "../../infrastructure/logging/index.js";

// Note: Transaction handling is done at the repository level (HandoffRepository)
// This ensures atomicity and automatic rollback on failure (Requirements: 12.3)

const logger = createLogger("HandoffService");

export interface InitiateHandoffRequest {
  taskId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  checklistCompleted?: boolean;
  notes?: string;
  initiatedBy: string;
}

export interface HandoffResponse {
  handoffId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  acceptedBy?: string;
  rejectionReason?: string;
  timestamp: Date;
}

export interface HandoffValidationResult {
  isValid: boolean;
  errors: string[];
}

export class HandoffService {
  private handoffRepository: HandoffRepository;
  private taskRepository: TaskRepository;
  private userRepository: UserRepository;
  private departmentRepository: DepartmentRepository;

  constructor(
    handoffRepository?: HandoffRepository,
    taskRepository?: TaskRepository,
    userRepository?: UserRepository,
    departmentRepository?: DepartmentRepository
  ) {
    this.handoffRepository = handoffRepository || new HandoffRepository();
    this.taskRepository = taskRepository || new TaskRepository();
    this.userRepository = userRepository || new UserRepository();
    this.departmentRepository = departmentRepository || new DepartmentRepository();
  }

  /**
   * Initiate a handoff for a task to another department
   * Requirements: 9.1 - Cross-department handoff with checklist completion and acceptance
   */
  async initiateHandoff(request: InitiateHandoffRequest): Promise<HandoffResponse> {
    logger.info("Initiating handoff", { 
      taskId: request.taskId, 
      fromDept: request.fromDepartmentId,
      toDept: request.toDepartmentId 
    });

    // Validate the handoff request
    const validation = await this.validateHandoffRequest(request);
    if (!validation.isValid) {
      throw new Error(`Invalid handoff request: ${validation.errors.join(", ")}`);
    }

    // Check if there's already a pending handoff for this task
    const hasPending = await this.handoffRepository.hasPendingHandoff(request.taskId);
    if (hasPending) {
      throw new Error("Task already has a pending handoff");
    }

    // Create the handoff record
    const handoffId = await this.handoffRepository.create({
      taskId: request.taskId,
      fromDepartmentId: request.fromDepartmentId,
      toDepartmentId: request.toDepartmentId,
      checklistCompleted: request.checklistCompleted,
      notes: request.notes,
      initiatedBy: request.initiatedBy,
    });

    logger.info("Handoff initiated successfully", { handoffId, taskId: request.taskId });

    // Send notification to receiving department (Requirements 9.1)
    await this.notifyReceivingDepartment(handoffId, request);

    return {
      handoffId,
      status: 'PENDING',
      timestamp: new Date(),
    };
  }

  /**
   * Send notification to receiving department on handoff initiation
   * Requirements: 9.1 - Send notification to receiving department on handoff initiation
   */
  private async notifyReceivingDepartment(handoffId: string, request: InitiateHandoffRequest): Promise<void> {
    try {
      // Get task details
      const task = await this.taskRepository.getTaskById(request.taskId);
      const taskTitle = task?.title || "Unknown Task";
      const taskCode = task?.code || "";

      // Get department names
      const fromDept = await this.departmentRepository.findById(request.fromDepartmentId);
      const toDept = await this.departmentRepository.findById(request.toDepartmentId);
      const fromDeptName = fromDept?.name || "Unknown Department";
      const toDeptName = toDept?.name || "Unknown Department";

      // Get initiator name
      const initiator = await this.userRepository.findById(request.initiatedBy);
      const initiatorName = initiator?.full_name || "Unknown User";

      // Get managers/admins in the receiving department to notify
      const recipientIds = await this.userRepository.findManagersByDepartmentId(request.toDepartmentId);

      if (recipientIds.length === 0) {
        // If no managers, notify all department members
        const allMembers = await this.userRepository.findByDepartmentId(request.toDepartmentId);
        if (allMembers.length > 0) {
          recipientIds.push(...allMembers);
        }
      }

      if (recipientIds.length === 0) {
        logger.warn("No recipients found for handoff notification", { 
          handoffId, 
          toDepartmentId: request.toDepartmentId 
        });
        return;
      }

      // Send notifications
      const notificationCount = await enhancedNotificationService.notifyUsers(
        recipientIds,
        {
          title: "New Task Handoff Request",
          message: `${initiatorName} from ${fromDeptName} has initiated a handoff for task "${taskCode ? `[${taskCode}] ` : ""}${taskTitle}" to ${toDeptName}. Please review and accept or reject the handoff.`,
          type: "handoff_initiated",
          relatedId: handoffId,
          category: "workflow",
          priority: "high",
          link: `/tasks/${request.taskId}/handoffs`,
          actorId: request.initiatedBy,
        }
      );

      logger.info("Handoff initiation notifications sent", { 
        handoffId, 
        recipientCount: notificationCount,
        toDepartmentId: request.toDepartmentId 
      });
    } catch (error) {
      // Log error but don't fail the handoff creation
      logger.error("Failed to send handoff initiation notifications", error as Error, { handoffId });
    }
  }

  /**
   * Accept a pending handoff
   * Requirements: 9.1 - Request acceptance from the receiving department
   */
  async acceptHandoff(handoffId: string, acceptedBy: string): Promise<void> {
    logger.info("Accepting handoff", { handoffId, acceptedBy });

    // Get the handoff record
    const handoff = await this.handoffRepository.findById(handoffId);
    if (!handoff) {
      throw new Error("Handoff not found");
    }

    if (handoff.status !== 'PENDING') {
      throw new Error(`Handoff is already ${handoff.status.toLowerCase()}`);
    }

    // Accept the handoff
    await this.handoffRepository.accept(handoffId, acceptedBy);

    logger.info("Handoff accepted successfully", { handoffId, acceptedBy });
  }

  /**
   * Reject a pending handoff with a reason
   * Requirements: 9.4 - Handoff rejection with reason requirement
   */
  async rejectHandoff(handoffId: string, rejectedBy: string, rejectionReason: string): Promise<void> {
    logger.info("Rejecting handoff", { handoffId, rejectedBy });

    // Validate rejection reason is provided
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error("Rejection reason is required");
    }

    // Get the handoff record
    const handoff = await this.handoffRepository.findById(handoffId);
    if (!handoff) {
      throw new Error("Handoff not found");
    }

    if (handoff.status !== 'PENDING') {
      throw new Error(`Handoff is already ${handoff.status.toLowerCase()}`);
    }

    // Reject the handoff
    await this.handoffRepository.reject(handoffId, rejectedBy, rejectionReason.trim());

    logger.info("Handoff rejected successfully", { handoffId, rejectedBy, rejectionReason });

    // Send notification to originating department (Requirements 9.4)
    await this.notifyOriginatingDepartmentOnRejection(handoff, rejectedBy, rejectionReason.trim());
  }

  /**
   * Send notification to originating department on handoff rejection
   * Requirements: 9.4 - Send notification to originating department on rejection
   */
  private async notifyOriginatingDepartmentOnRejection(
    handoff: HandoffRecordWithDetails, 
    rejectedBy: string, 
    rejectionReason: string
  ): Promise<void> {
    try {
      // Get rejector name
      const rejector = await this.userRepository.findById(rejectedBy);
      const rejectorName = rejector?.full_name || "Unknown User";

      // Get department names (may already be in handoff details)
      const fromDeptName = handoff.fromDepartmentName || 
        (await this.departmentRepository.findById(handoff.fromDepartmentId))?.name || 
        "Unknown Department";
      const toDeptName = handoff.toDepartmentName || 
        (await this.departmentRepository.findById(handoff.toDepartmentId))?.name || 
        "Unknown Department";

      // Get task details
      const taskTitle = handoff.taskTitle || "Unknown Task";
      const taskCode = handoff.taskCode || "";

      // Notify the initiator directly
      const recipientIds: string[] = [handoff.initiatedBy];

      // Also notify managers in the originating department
      const managers = await this.userRepository.findManagersByDepartmentId(handoff.fromDepartmentId);
      for (const managerId of managers) {
        if (!recipientIds.includes(managerId)) {
          recipientIds.push(managerId);
        }
      }

      // Send notifications
      const notificationCount = await enhancedNotificationService.notifyUsers(
        recipientIds,
        {
          title: "Task Handoff Rejected",
          message: `${rejectorName} from ${toDeptName} has rejected the handoff request from ${fromDeptName} for task "${taskCode ? `[${taskCode}] ` : ""}${taskTitle}". Reason: ${rejectionReason}`,
          type: "handoff_rejected",
          relatedId: handoff.id,
          category: "workflow",
          priority: "high",
          link: `/tasks/${handoff.taskId}/handoffs`,
          actorId: rejectedBy,
        }
      );

      logger.info("Handoff rejection notifications sent", { 
        handoffId: handoff.id, 
        recipientCount: notificationCount,
        fromDepartmentId: handoff.fromDepartmentId 
      });
    } catch (error) {
      // Log error but don't fail the rejection
      logger.error("Failed to send handoff rejection notifications", error as Error, { handoffId: handoff.id });
    }
  }

  /**
   * Get handoff history for a task
   * Requirements: 9.2 - Preserve all relevant context with the task
   */
  async getHandoffHistory(taskId: string): Promise<HandoffRecordWithDetails[]> {
    return this.handoffRepository.findByTaskId(taskId);
  }

  /**
   * Get a specific handoff by ID
   */
  async getHandoffById(handoffId: string): Promise<HandoffRecordWithDetails | null> {
    return this.handoffRepository.findById(handoffId);
  }

  /**
   * Get pending handoffs for a department (incoming)
   */
  async getPendingHandoffsForDepartment(departmentId: string): Promise<HandoffRecordWithDetails[]> {
    return this.handoffRepository.findPendingByDepartment(departmentId);
  }

  /**
   * Get outgoing handoffs from a department
   */
  async getOutgoingHandoffsFromDepartment(departmentId: string): Promise<HandoffRecordWithDetails[]> {
    return this.handoffRepository.findOutgoingByDepartment(departmentId);
  }

  /**
   * Get the latest handoff for a task
   */
  async getLatestHandoff(taskId: string): Promise<HandoffRecordWithDetails | null> {
    return this.handoffRepository.findLatestByTaskId(taskId);
  }

  /**
   * Check if a task has a pending handoff
   */
  async hasPendingHandoff(taskId: string): Promise<boolean> {
    return this.handoffRepository.hasPendingHandoff(taskId);
  }

  /**
   * Validate a handoff request
   */
  private async validateHandoffRequest(request: InitiateHandoffRequest): Promise<HandoffValidationResult> {
    const errors: string[] = [];

    // Validate task exists
    const task = await this.taskRepository.getTaskById(request.taskId);
    if (!task) {
      errors.push("Task not found");
    }

    // Validate departments are different
    if (request.fromDepartmentId === request.toDepartmentId) {
      errors.push("Cannot handoff to the same department");
    }

    // Validate required fields
    if (!request.taskId) {
      errors.push("Task ID is required");
    }
    if (!request.fromDepartmentId) {
      errors.push("From department ID is required");
    }
    if (!request.toDepartmentId) {
      errors.push("To department ID is required");
    }
    if (!request.initiatedBy) {
      errors.push("Initiator ID is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
