/**
 * ChecklistAnalyticsController
 * HTTP handlers for checklist analytics operations
 * Requirements: 11.5 - Track completion time and frequently skipped items
 */

import { Request, Response } from "express";
import { ChecklistAnalyticsService } from "../../application/services/ChecklistAnalyticsService.js";
import { ChecklistAnalyticsFilters } from "../../infrastructure/repositories/ChecklistAnalyticsRepository.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const logger = createLogger("ChecklistAnalyticsController");
const analyticsService = new ChecklistAnalyticsService();

/**
 * Parse date filters from query parameters
 */
function parseFilters(query: any): ChecklistAnalyticsFilters {
  const filters: ChecklistAnalyticsFilters = {};

  if (query.fromDate) {
    filters.fromDate = new Date(query.fromDate);
  }
  if (query.toDate) {
    filters.toDate = new Date(query.toDate);
  }
  if (query.projectId) {
    filters.projectId = query.projectId;
  }
  if (query.departmentId) {
    filters.departmentId = query.departmentId;
  }
  if (query.taskId) {
    filters.taskId = query.taskId;
  }

  return filters;
}

export class ChecklistAnalyticsController {
  /**
   * Get checklist completion time analytics
   * GET /api/analytics/checklist/completion-time
   * Requirements: 11.5 - Track completion time
   */
  static async getCompletionTimeAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const filters = parseFilters(req.query);
      
      logger.info("Getting completion time analytics", { filters });
      
      const analytics = await analyticsService.getCompletionTimeAnalytics(filters);
      
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error("Error getting completion time analytics", error as Error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve completion time analytics",
      });
    }
  }

  /**
   * Get frequently skipped items analytics
   * GET /api/analytics/checklist/skipped-items
   * Requirements: 11.5 - Track frequently skipped items
   */
  static async getSkippedItemsAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const filters = parseFilters(req.query);
      
      logger.info("Getting skipped items analytics", { filters });
      
      const analytics = await analyticsService.getSkippedItemsAnalytics(filters);
      
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error("Error getting skipped items analytics", error as Error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve skipped items analytics",
      });
    }
  }

  /**
   * Get comprehensive checklist efficiency report
   * GET /api/analytics/checklist/efficiency-report
   * Requirements: 11.5
   */
  static async getEfficiencyReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = parseFilters(req.query);
      
      logger.info("Getting checklist efficiency report", { filters });
      
      const report = await analyticsService.getEfficiencyReport(filters);
      
      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error("Error getting checklist efficiency report", error as Error);
      res.status(500).json({
        success: false,
        message: "Failed to generate checklist efficiency report",
      });
    }
  }
}
