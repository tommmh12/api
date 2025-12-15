/**
 * DecisionRecordController
 * HTTP handlers for decision record operations
 * Requirements: 10.1 - Decision Record with fields for context, decision made, and rationale
 * Requirements: 10.5 - Decision revision with history preservation
 */

import { Request, Response } from "express";
import { DecisionRecordService } from "../../application/services/DecisionRecordService.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const logger = createLogger("DecisionRecordController");
const decisionService = new DecisionRecordService();

/**
 * Helper to get user ID from authenticated request
 */
function getUserId(req: Request): string {
  return (req as any).user?.id || (req as any).user?.userId;
}

/**
 * Create a new decision record
 * POST /api/decisions
 * Requirements: 10.1
 */
export async function createDecision(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const { projectId, taskId, title, context, optionsConsidered, decision, rationale, consequences } = req.body;

    const result = await decisionService.create({
      projectId: projectId || undefined,
      taskId: taskId || undefined,
      title,
      context,
      optionsConsidered: optionsConsidered || undefined,
      decision,
      rationale,
      consequences: consequences || undefined,
      createdBy: userId,
    });

    logger.info("Decision record created", { 
      decisionId: result.id, 
      title: result.title,
      userId 
    });

    res.status(201).json({
      success: true,
      data: result,
      message: "Decision record created successfully",
    });
  } catch (error: any) {
    logger.error("Error creating decision record", error, { 
      userId: getUserId(req) 
    });
    
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create decision record",
    });
  }
}

/**
 * Get decision record by ID
 * GET /api/decisions/:id
 */
export async function getDecisionById(req: Request, res: Response) {
  try {
    const decisionId = req.params.id;
    const decision = await decisionService.getById(decisionId);

    if (!decision) {
      res.status(404).json({
        success: false,
        message: "Decision record not found",
      });
      return;
    }

    res.json({
      success: true,
      data: decision,
    });
  } catch (error: any) {
    logger.error("Error getting decision record", error, { 
      decisionId: req.params.id 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get decision record",
    });
  }
}

/**
 * Update a decision record (only DRAFT status)
 * PUT /api/decisions/:id
 */
export async function updateDecision(req: Request, res: Response) {
  try {
    const decisionId = req.params.id;
    const { title, context, optionsConsidered, decision, rationale, consequences } = req.body;

    const result = await decisionService.update(decisionId, {
      title,
      context,
      optionsConsidered,
      decision,
      rationale,
      consequences,
    });

    logger.info("Decision record updated", { decisionId });

    res.json({
      success: true,
      data: result,
      message: "Decision record updated successfully",
    });
  } catch (error: any) {
    logger.error("Error updating decision record", error, { 
      decisionId: req.params.id 
    });
    
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update decision record",
    });
  }
}

/**
 * Revise a decision record (creates new version)
 * POST /api/decisions/:id/revise
 * Requirements: 10.5
 */
export async function reviseDecision(req: Request, res: Response) {
  try {
    const decisionId = req.params.id;
    const userId = getUserId(req);
    const { title, context, optionsConsidered, decision, rationale, consequences } = req.body;

    const result = await decisionService.revise(decisionId, {
      title,
      context,
      optionsConsidered: optionsConsidered || undefined,
      decision,
      rationale,
      consequences: consequences || undefined,
      createdBy: userId,
    });

    logger.info("Decision record revised", { 
      originalId: decisionId, 
      newId: result.id,
      userId 
    });

    res.status(201).json({
      success: true,
      data: result,
      message: "Decision record revised successfully",
    });
  } catch (error: any) {
    logger.error("Error revising decision record", error, { 
      decisionId: req.params.id 
    });
    
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to revise decision record",
    });
  }
}

/**
 * Approve a decision record
 * POST /api/decisions/:id/approve
 * Requirements: 10.2
 */
export async function approveDecision(req: Request, res: Response) {
  try {
    const decisionId = req.params.id;
    const userId = getUserId(req);

    await decisionService.approve(decisionId, userId);

    logger.info("Decision record approved", { decisionId, userId });

    res.json({
      success: true,
      message: "Decision record approved successfully",
    });
  } catch (error: any) {
    logger.error("Error approving decision record", error, { 
      decisionId: req.params.id 
    });
    
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to approve decision record",
    });
  }
}

/**
 * Submit a decision for approval
 * POST /api/decisions/:id/submit
 */
export async function submitDecisionForApproval(req: Request, res: Response) {
  try {
    const decisionId = req.params.id;

    await decisionService.submitForApproval(decisionId);

    logger.info("Decision record submitted for approval", { decisionId });

    res.json({
      success: true,
      message: "Decision record submitted for approval successfully",
    });
  } catch (error: any) {
    logger.error("Error submitting decision for approval", error, { 
      decisionId: req.params.id 
    });
    
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to submit decision for approval",
    });
  }
}

/**
 * Get decisions by project
 * GET /api/projects/:projectId/decisions
 */
export async function getDecisionsByProject(req: Request, res: Response) {
  try {
    const projectId = req.params.projectId;
    const decisions = await decisionService.getByProjectId(projectId);

    res.json({
      success: true,
      data: decisions,
    });
  } catch (error: any) {
    logger.error("Error getting project decisions", error, { 
      projectId: req.params.projectId 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get project decisions",
    });
  }
}

/**
 * Get decisions by task
 * GET /api/tasks/:taskId/decisions
 */
export async function getDecisionsByTask(req: Request, res: Response) {
  try {
    const taskId = req.params.taskId;
    const decisions = await decisionService.getByTaskId(taskId);

    res.json({
      success: true,
      data: decisions,
    });
  } catch (error: any) {
    logger.error("Error getting task decisions", error, { 
      taskId: req.params.taskId 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get task decisions",
    });
  }
}

/**
 * Search decisions
 * GET /api/decisions/search
 * Requirements: 10.3
 */
export async function searchDecisions(req: Request, res: Response) {
  try {
    const { q, projectId, taskId, status, createdBy, page, limit } = req.query;

    const decisions = await decisionService.search(q as string || '', {
      projectId: projectId as string,
      taskId: taskId as string,
      status: status as any,
      createdBy: createdBy as string,
      limit: limit ? parseInt(limit as string) : 20,
      offset: page ? (parseInt(page as string) - 1) * (limit ? parseInt(limit as string) : 20) : 0,
    });

    res.json({
      success: true,
      data: decisions,
    });
  } catch (error: any) {
    logger.error("Error searching decisions", error);
    
    res.status(500).json({
      success: false,
      message: "Failed to search decisions",
    });
  }
}

/**
 * Get decision version history
 * GET /api/decisions/:id/history
 */
export async function getDecisionHistory(req: Request, res: Response) {
  try {
    const decisionId = req.params.id;
    const history = await decisionService.getVersionHistory(decisionId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    logger.error("Error getting decision history", error, { 
      decisionId: req.params.id 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get decision history",
    });
  }
}

/**
 * Link decision to comment
 * POST /api/decisions/:id/link-comment
 * Requirements: 10.4
 */
export async function linkDecisionToComment(req: Request, res: Response) {
  try {
    const decisionId = req.params.id;
    const { commentId } = req.body;

    await decisionService.linkToComment(decisionId, commentId);

    logger.info("Decision linked to comment", { decisionId, commentId });

    res.json({
      success: true,
      message: "Decision linked to comment successfully",
    });
  } catch (error: any) {
    logger.error("Error linking decision to comment", error, { 
      decisionId: req.params.id 
    });
    
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to link decision to comment",
    });
  }
}

/**
 * Unlink decision from comment
 * DELETE /api/decisions/:id/link-comment/:commentId
 */
export async function unlinkDecisionFromComment(req: Request, res: Response) {
  try {
    const { id: decisionId, commentId } = req.params;

    await decisionService.unlinkFromComment(decisionId, commentId);

    logger.info("Decision unlinked from comment", { decisionId, commentId });

    res.json({
      success: true,
      message: "Decision unlinked from comment successfully",
    });
  } catch (error: any) {
    logger.error("Error unlinking decision from comment", error, { 
      decisionId: req.params.id,
      commentId: req.params.commentId 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to unlink decision from comment",
    });
  }
}

/**
 * Get decisions by comment
 * GET /api/comments/:commentId/decisions
 */
export async function getDecisionsByComment(req: Request, res: Response) {
  try {
    const commentId = req.params.commentId;
    const decisions = await decisionService.getByCommentId(commentId);

    res.json({
      success: true,
      data: decisions,
    });
  } catch (error: any) {
    logger.error("Error getting comment decisions", error, { 
      commentId: req.params.commentId 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get comment decisions",
    });
  }
}

/**
 * Delete a decision record (only DRAFT status)
 * DELETE /api/decisions/:id
 */
export async function deleteDecision(req: Request, res: Response) {
  try {
    const decisionId = req.params.id;

    await decisionService.delete(decisionId);

    logger.info("Decision record deleted", { decisionId });

    res.json({
      success: true,
      message: "Decision record deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting decision record", error, { 
      decisionId: req.params.id 
    });
    
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to delete decision record",
    });
  }
}

/**
 * Get linked comment IDs for a decision
 * GET /api/decisions/:id/linked-comments
 */
export async function getLinkedComments(req: Request, res: Response) {
  try {
    const decisionId = req.params.id;
    const commentIds = await decisionService.getLinkedCommentIds(decisionId);

    res.json({
      success: true,
      data: commentIds,
    });
  } catch (error: any) {
    logger.error("Error getting linked comments", error, { 
      decisionId: req.params.id 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get linked comments",
    });
  }
}
