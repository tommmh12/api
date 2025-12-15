/**
 * HandoffController
 * HTTP handlers for cross-department task handoff operations
 * Requirements: 9.1 - Cross-department handoff with checklist completion and acceptance
 * Requirements: 9.4 - Handoff rejection with reason requirement
 * Requirements: 9.5 - Track handoff cycle time and rejection rate
 */

import { Request, Response } from "express";
import { HandoffService } from "../../application/services/HandoffService.js";
import { HandoffAnalyticsService } from "../../application/services/HandoffAnalyticsService.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const logger = createLogger("HandoffController");
const handoffService = new HandoffService();
const handoffAnalyticsService = new HandoffAnalyticsService();

/**
 * Helper to get user ID from authenticated request
 */
function getUserId(req: Request): string {
  return (req as any).user?.id || (req as any).user?.userId;
}

/**
 * Helper to get user's department ID from authenticated request
 */
function getUserDepartmentId(req: Request): string | null {
  return (req as any).user?.departmentId || null;
}

/**
 * Initiate a handoff for a task
 * POST /api/tasks/:id/handoff
 * Requirements: 9.1
 */
export async function initiateHandoff(req: Request, res: Response) {
  try {
    const taskId = req.params.id;
    const { toDepartmentId, checklistCompleted, notes } = req.body;
    const userId = getUserId(req);
    const fromDepartmentId = getUserDepartmentId(req);

    if (!fromDepartmentId) {
      res.status(400).json({
        success: false,
        message: "User must belong to a department to initiate a handoff",
      });
      return;
    }

    const result = await handoffService.initiateHandoff({
      taskId,
      fromDepartmentId,
      toDepartmentId,
      checklistCompleted,
      notes,
      initiatedBy: userId,
    });

    logger.info("Handoff initiated", { 
      handoffId: result.handoffId, 
      taskId, 
      userId 
    });

    res.status(201).json({
      success: true,
      data: result,
      message: "Handoff initiated successfully",
    });
  } catch (error: any) {
    logger.error("Error initiating handoff", error, { 
      taskId: req.params.id 
    });
    
    res.status(400).json({
      success: false,
      message: error.message || "Failed to initiate handoff",
    });
  }
}

/**
 * Accept a pending handoff
 * POST /api/handoffs/:id/accept
 * Requirements: 9.1
 */
export async function acceptHandoff(req: Request, res: Response) {
  try {
    const handoffId = req.params.id;
    const userId = getUserId(req);

    await handoffService.acceptHandoff(handoffId, userId);

    logger.info("Handoff accepted", { handoffId, userId });

    res.json({
      success: true,
      message: "Handoff accepted successfully",
    });
  } catch (error: any) {
    logger.error("Error accepting handoff", error, { 
      handoffId: req.params.id 
    });
    
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to accept handoff",
    });
  }
}

/**
 * Reject a pending handoff with reason
 * POST /api/handoffs/:id/reject
 * Requirements: 9.4 - Rejection reason is required
 */
export async function rejectHandoff(req: Request, res: Response) {
  try {
    const handoffId = req.params.id;
    const { rejectionReason } = req.body;
    const userId = getUserId(req);

    await handoffService.rejectHandoff(handoffId, userId, rejectionReason);

    logger.info("Handoff rejected", { handoffId, userId, rejectionReason });

    res.json({
      success: true,
      message: "Handoff rejected successfully",
    });
  } catch (error: any) {
    logger.error("Error rejecting handoff", error, { 
      handoffId: req.params.id 
    });
    
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to reject handoff",
    });
  }
}

/**
 * Get handoff by ID
 * GET /api/handoffs/:id
 */
export async function getHandoffById(req: Request, res: Response) {
  try {
    const handoffId = req.params.id;
    const handoff = await handoffService.getHandoffById(handoffId);

    if (!handoff) {
      res.status(404).json({
        success: false,
        message: "Handoff not found",
      });
      return;
    }

    res.json({
      success: true,
      data: handoff,
    });
  } catch (error: any) {
    logger.error("Error getting handoff", error, { 
      handoffId: req.params.id 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get handoff",
    });
  }
}

/**
 * Get handoff history for a task
 * GET /api/tasks/:id/handoffs
 * Requirements: 9.2 - Preserve all relevant context with the task
 */
export async function getHandoffsByTask(req: Request, res: Response) {
  try {
    const taskId = req.params.id;
    const handoffs = await handoffService.getHandoffHistory(taskId);

    res.json({
      success: true,
      data: handoffs,
    });
  } catch (error: any) {
    logger.error("Error getting task handoffs", error, { 
      taskId: req.params.id 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get task handoffs",
    });
  }
}

/**
 * Get handoffs for a department
 * GET /api/handoffs/department/:departmentId
 */
export async function getHandoffsByDepartment(req: Request, res: Response) {
  try {
    const departmentId = req.params.departmentId;
    const type = (req.query.type as string) || 'pending';

    let handoffs;
    switch (type) {
      case 'incoming':
      case 'pending':
        handoffs = await handoffService.getPendingHandoffsForDepartment(departmentId);
        break;
      case 'outgoing':
        handoffs = await handoffService.getOutgoingHandoffsFromDepartment(departmentId);
        break;
      default:
        handoffs = await handoffService.getPendingHandoffsForDepartment(departmentId);
    }

    res.json({
      success: true,
      data: handoffs,
    });
  } catch (error: any) {
    logger.error("Error getting department handoffs", error, { 
      departmentId: req.params.departmentId 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get department handoffs",
    });
  }
}

/**
 * Get latest handoff for a task
 * GET /api/tasks/:id/handoff/latest
 */
export async function getLatestHandoff(req: Request, res: Response) {
  try {
    const taskId = req.params.id;
    const handoff = await handoffService.getLatestHandoff(taskId);

    res.json({
      success: true,
      data: handoff,
    });
  } catch (error: any) {
    logger.error("Error getting latest handoff", error, { 
      taskId: req.params.id 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to get latest handoff",
    });
  }
}

/**
 * Check if task has pending handoff
 * GET /api/tasks/:id/handoff/pending
 */
export async function checkPendingHandoff(req: Request, res: Response) {
  try {
    const taskId = req.params.id;
    const hasPending = await handoffService.hasPendingHandoff(taskId);

    res.json({
      success: true,
      data: { hasPendingHandoff: hasPending },
    });
  } catch (error: any) {
    logger.error("Error checking pending handoff", error, { 
      taskId: req.params.id 
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to check pending handoff",
    });
  }
}

/**
 * Get handoff cycle time analytics
 * GET /api/handoffs/analytics/cycle-time
 * Requirements: 9.5 - Track handoff cycle time
 */
export async function getCycleTimeAnalytics(req: Request, res: Response) {
  try {
    const filters = parseAnalyticsFilters(req);
    const analytics = await handoffAnalyticsService.getCycleTimeAnalytics(filters);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error("Error getting cycle time analytics", error);
    
    res.status(500).json({
      success: false,
      message: "Failed to get cycle time analytics",
    });
  }
}

/**
 * Get handoff rejection rate analytics
 * GET /api/handoffs/analytics/rejection-rate
 * Requirements: 9.5 - Track rejection rate per department pair
 */
export async function getRejectionRateAnalytics(req: Request, res: Response) {
  try {
    const filters = parseAnalyticsFilters(req);
    const analytics = await handoffAnalyticsService.getRejectionRateAnalytics(filters);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error("Error getting rejection rate analytics", error);
    
    res.status(500).json({
      success: false,
      message: "Failed to get rejection rate analytics",
    });
  }
}

/**
 * Get comprehensive handoff efficiency report
 * GET /api/handoffs/analytics/efficiency
 * Requirements: 9.5 - Track handoff cycle time and rejection rate
 */
export async function getEfficiencyReport(req: Request, res: Response) {
  try {
    const filters = parseAnalyticsFilters(req);
    const report = await handoffAnalyticsService.getEfficiencyReport(filters);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    logger.error("Error getting efficiency report", error);
    
    res.status(500).json({
      success: false,
      message: "Failed to get efficiency report",
    });
  }
}

/**
 * Helper function to parse analytics filter parameters from request
 */
function parseAnalyticsFilters(req: Request): {
  fromDate?: Date;
  toDate?: Date;
  fromDepartmentId?: string;
  toDepartmentId?: string;
} {
  const filters: {
    fromDate?: Date;
    toDate?: Date;
    fromDepartmentId?: string;
    toDepartmentId?: string;
  } = {};

  if (req.query.fromDate) {
    const date = new Date(req.query.fromDate as string);
    if (!isNaN(date.getTime())) {
      filters.fromDate = date;
    }
  }

  if (req.query.toDate) {
    const date = new Date(req.query.toDate as string);
    if (!isNaN(date.getTime())) {
      filters.toDate = date;
    }
  }

  if (req.query.fromDepartmentId) {
    filters.fromDepartmentId = req.query.fromDepartmentId as string;
  }

  if (req.query.toDepartmentId) {
    filters.toDepartmentId = req.query.toDepartmentId as string;
  }

  return filters;
}
