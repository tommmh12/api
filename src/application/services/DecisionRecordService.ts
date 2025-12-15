/**
 * DecisionRecordService (DecisionRecordManager)
 * Business logic for decision documentation
 * Requirements: 10.1 - Decision Record with fields for context, decision made, and rationale
 * Requirements: 10.5 - Decision revision with history preservation
 * Requirements: 12.3 - Database operations with transaction rollback
 */

import {
  DecisionRecordRepository,
  DecisionRecordWithDetails,
  UpdateDecisionData,
  DecisionSearchFilters,
  DecisionOption,
} from "../../infrastructure/repositories/DecisionRecordRepository.js";
import { ProjectRepository } from "../../infrastructure/repositories/ProjectRepository.js";
import { TaskRepository } from "../../infrastructure/repositories/TaskRepository.js";
import { createLogger } from "../../infrastructure/logging/index.js";

// Note: Transaction handling is done at the repository level (DecisionRecordRepository)
// The repository uses withTransaction for multi-step operations like createRevision
// This ensures atomicity and automatic rollback on failure (Requirements: 12.3)

const logger = createLogger("DecisionRecordService");

export interface CreateDecisionRequest {
  projectId?: string;
  taskId?: string;
  title: string;
  context: string;
  optionsConsidered?: DecisionOption[];
  decision: string;
  rationale: string;
  consequences?: string;
  createdBy: string;
}

export interface ReviseDecisionRequest {
  title: string;
  context: string;
  optionsConsidered?: DecisionOption[];
  decision: string;
  rationale: string;
  consequences?: string;
  createdBy: string;
}

export interface DecisionValidationResult {
  isValid: boolean;
  errors: string[];
}

export class DecisionRecordService {
  private decisionRepository: DecisionRecordRepository;
  private projectRepository: ProjectRepository;
  private taskRepository: TaskRepository;

  constructor(
    decisionRepository?: DecisionRecordRepository,
    projectRepository?: ProjectRepository,
    taskRepository?: TaskRepository
  ) {
    this.decisionRepository = decisionRepository || new DecisionRecordRepository();
    this.projectRepository = projectRepository || new ProjectRepository();
    this.taskRepository = taskRepository || new TaskRepository();
  }

  /**
   * Create a new decision record
   * Requirements: 10.1 - Decision Record with fields for context, decision made, and rationale
   */
  async create(request: CreateDecisionRequest): Promise<DecisionRecordWithDetails> {
    logger.info("Creating decision record", { 
      title: request.title,
      projectId: request.projectId,
      taskId: request.taskId,
    });

    // Validate the request
    const validation = await this.validateCreateRequest(request);
    if (!validation.isValid) {
      throw new Error(`Invalid decision record: ${validation.errors.join(", ")}`);
    }

    // Create the decision record
    const decisionId = await this.decisionRepository.create({
      projectId: request.projectId,
      taskId: request.taskId,
      title: request.title,
      context: request.context,
      optionsConsidered: request.optionsConsidered,
      decision: request.decision,
      rationale: request.rationale,
      consequences: request.consequences,
      createdBy: request.createdBy,
      status: 'DRAFT',
    });

    logger.info("Decision record created successfully", { decisionId });

    // Return the created record with details
    const record = await this.decisionRepository.findById(decisionId);
    if (!record) {
      throw new Error("Failed to retrieve created decision record");
    }

    return record;
  }

  /**
   * Approve a decision record
   * Requirements: 10.2 - Approver assignment and timestamp
   */
  async approve(decisionId: string, approverId: string): Promise<void> {
    logger.info("Approving decision record", { decisionId, approverId });

    // Get the decision record
    const decision = await this.decisionRepository.findById(decisionId);
    if (!decision) {
      throw new Error("Decision record not found");
    }

    if (decision.status === 'APPROVED') {
      throw new Error("Decision record is already approved");
    }

    if (decision.status === 'SUPERSEDED') {
      throw new Error("Cannot approve a superseded decision record");
    }

    // Approve the decision
    await this.decisionRepository.approve(decisionId, approverId);

    logger.info("Decision record approved successfully", { decisionId, approverId });
  }

  /**
   * Revise a decision record (creates a new version)
   * Requirements: 10.5 - Preserve original decision history
   */
  async revise(decisionId: string, request: ReviseDecisionRequest): Promise<DecisionRecordWithDetails> {
    logger.info("Revising decision record", { decisionId });

    // Get the original decision record
    const original = await this.decisionRepository.findById(decisionId);
    if (!original) {
      throw new Error("Decision record not found");
    }

    // Validate the revision request
    const validation = this.validateRevisionRequest(request);
    if (!validation.isValid) {
      throw new Error(`Invalid revision: ${validation.errors.join(", ")}`);
    }

    // Create the revision
    const newId = await this.decisionRepository.createRevision(decisionId, {
      projectId: original.projectId || undefined,
      taskId: original.taskId || undefined,
      title: request.title,
      context: request.context,
      optionsConsidered: request.optionsConsidered,
      decision: request.decision,
      rationale: request.rationale,
      consequences: request.consequences,
      createdBy: request.createdBy,
    });

    logger.info("Decision record revised successfully", { 
      originalId: decisionId, 
      newId 
    });

    // Return the new version
    const newRecord = await this.decisionRepository.findById(newId);
    if (!newRecord) {
      throw new Error("Failed to retrieve revised decision record");
    }

    return newRecord;
  }

  /**
   * Search decision records
   * Requirements: 10.3 - Search across decision records with filtering
   */
  async search(query: string, filters?: Partial<DecisionSearchFilters>): Promise<DecisionRecordWithDetails[]> {
    return this.decisionRepository.search({
      ...filters,
      searchQuery: query || undefined,
    });
  }

  /**
   * Get a decision record by ID
   */
  async getById(decisionId: string): Promise<DecisionRecordWithDetails | null> {
    return this.decisionRepository.findById(decisionId);
  }

  /**
   * Get all decision records for a project
   */
  async getByProjectId(projectId: string): Promise<DecisionRecordWithDetails[]> {
    return this.decisionRepository.findByProjectId(projectId);
  }

  /**
   * Get all decision records for a task
   */
  async getByTaskId(taskId: string): Promise<DecisionRecordWithDetails[]> {
    return this.decisionRepository.findByTaskId(taskId);
  }

  /**
   * Get version history for a decision record
   */
  async getVersionHistory(decisionId: string): Promise<DecisionRecordWithDetails[]> {
    return this.decisionRepository.getVersionHistory(decisionId);
  }

  /**
   * Link a decision to a comment
   * Requirements: 10.4 - Link between comment and decision record
   */
  async linkToComment(decisionId: string, commentId: string): Promise<void> {
    logger.info("Linking decision to comment", { decisionId, commentId });

    // Verify decision exists
    const decision = await this.decisionRepository.findById(decisionId);
    if (!decision) {
      throw new Error("Decision record not found");
    }

    await this.decisionRepository.linkToComment(decisionId, commentId);

    logger.info("Decision linked to comment successfully", { decisionId, commentId });
  }

  /**
   * Unlink a decision from a comment
   */
  async unlinkFromComment(decisionId: string, commentId: string): Promise<void> {
    logger.info("Unlinking decision from comment", { decisionId, commentId });
    await this.decisionRepository.unlinkFromComment(decisionId, commentId);
    logger.info("Decision unlinked from comment successfully", { decisionId, commentId });
  }

  /**
   * Get linked comment IDs for a decision
   */
  async getLinkedCommentIds(decisionId: string): Promise<string[]> {
    return this.decisionRepository.getLinkedCommentIds(decisionId);
  }

  /**
   * Get decisions linked to a comment
   */
  async getByCommentId(commentId: string): Promise<DecisionRecordWithDetails[]> {
    return this.decisionRepository.findByCommentId(commentId);
  }

  /**
   * Update a decision record (only for DRAFT status)
   */
  async update(decisionId: string, data: UpdateDecisionData): Promise<DecisionRecordWithDetails> {
    logger.info("Updating decision record", { decisionId });

    // Get the decision record
    const decision = await this.decisionRepository.findById(decisionId);
    if (!decision) {
      throw new Error("Decision record not found");
    }

    if (decision.status !== 'DRAFT') {
      throw new Error("Only DRAFT decision records can be updated. Use revise() for approved records.");
    }

    await this.decisionRepository.update(decisionId, data);

    const updated = await this.decisionRepository.findById(decisionId);
    if (!updated) {
      throw new Error("Failed to retrieve updated decision record");
    }

    logger.info("Decision record updated successfully", { decisionId });
    return updated;
  }

  /**
   * Submit a decision for approval
   */
  async submitForApproval(decisionId: string): Promise<void> {
    logger.info("Submitting decision for approval", { decisionId });

    const decision = await this.decisionRepository.findById(decisionId);
    if (!decision) {
      throw new Error("Decision record not found");
    }

    if (decision.status !== 'DRAFT') {
      throw new Error("Only DRAFT decision records can be submitted for approval");
    }

    await this.decisionRepository.update(decisionId, { status: 'PENDING_APPROVAL' });

    logger.info("Decision submitted for approval successfully", { decisionId });
  }

  /**
   * Delete a decision record (only DRAFT status)
   */
  async delete(decisionId: string): Promise<void> {
    logger.info("Deleting decision record", { decisionId });
    await this.decisionRepository.delete(decisionId);
    logger.info("Decision record deleted successfully", { decisionId });
  }

  /**
   * Validate a create request
   */
  private async validateCreateRequest(request: CreateDecisionRequest): Promise<DecisionValidationResult> {
    const errors: string[] = [];

    // Validate required fields
    if (!request.title || request.title.trim().length === 0) {
      errors.push("Title is required");
    }
    if (!request.context || request.context.trim().length === 0) {
      errors.push("Context is required");
    }
    if (!request.decision || request.decision.trim().length === 0) {
      errors.push("Decision is required");
    }
    if (!request.rationale || request.rationale.trim().length === 0) {
      errors.push("Rationale is required");
    }
    if (!request.createdBy) {
      errors.push("Creator ID is required");
    }

    // Validate project exists if provided
    if (request.projectId) {
      const project = await this.projectRepository.getProjectById(request.projectId);
      if (!project) {
        errors.push("Project not found");
      }
    }

    // Validate task exists if provided
    if (request.taskId) {
      const task = await this.taskRepository.getTaskById(request.taskId);
      if (!task) {
        errors.push("Task not found");
      }
    }

    // Validate options considered structure if provided
    if (request.optionsConsidered) {
      for (let i = 0; i < request.optionsConsidered.length; i++) {
        const option = request.optionsConsidered[i];
        if (!option.title || option.title.trim().length === 0) {
          errors.push(`Option ${i + 1}: Title is required`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a revision request
   */
  private validateRevisionRequest(request: ReviseDecisionRequest): DecisionValidationResult {
    const errors: string[] = [];

    // Validate required fields
    if (!request.title || request.title.trim().length === 0) {
      errors.push("Title is required");
    }
    if (!request.context || request.context.trim().length === 0) {
      errors.push("Context is required");
    }
    if (!request.decision || request.decision.trim().length === 0) {
      errors.push("Decision is required");
    }
    if (!request.rationale || request.rationale.trim().length === 0) {
      errors.push("Rationale is required");
    }
    if (!request.createdBy) {
      errors.push("Creator ID is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
