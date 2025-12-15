/**
 * ChecklistAnalyticsService
 * Business logic for checklist analytics and efficiency metrics
 * Requirements: 11.5 - Track completion time and frequently skipped items
 */

import { 
  ChecklistAnalyticsRepository, 
  ChecklistCompletionTimeAnalytics, 
  SkippedItemsAnalytics,
  ChecklistAnalyticsFilters 
} from "../../infrastructure/repositories/ChecklistAnalyticsRepository.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const logger = createLogger("ChecklistAnalyticsService");

export interface ChecklistEfficiencyReport {
  completionTime: ChecklistCompletionTimeAnalytics;
  skippedItems: SkippedItemsAnalytics;
  summary: {
    healthScore: number;
    recommendations: string[];
  };
}

export class ChecklistAnalyticsService {
  private analyticsRepository: ChecklistAnalyticsRepository;

  constructor(analyticsRepository?: ChecklistAnalyticsRepository) {
    this.analyticsRepository = analyticsRepository || new ChecklistAnalyticsRepository();
  }

  /**
   * Get checklist completion time analytics
   * Requirements: 11.5 - Track completion time
   */
  async getCompletionTimeAnalytics(filters?: ChecklistAnalyticsFilters): Promise<ChecklistCompletionTimeAnalytics> {
    logger.info("Getting completion time analytics", { filters });

    try {
      const analytics = await this.analyticsRepository.getCompletionTimeAnalytics(filters);
      
      logger.info("Completion time analytics retrieved", {
        averageCompletionTimeHours: analytics.averageCompletionTimeHours,
        totalCompleted: analytics.totalCompleted,
      });

      return analytics;
    } catch (error) {
      logger.error("Error getting completion time analytics", error as Error, { filters });
      throw error;
    }
  }

  /**
   * Get frequently skipped items analytics
   * Requirements: 11.5 - Track frequently skipped items
   */
  async getSkippedItemsAnalytics(filters?: ChecklistAnalyticsFilters): Promise<SkippedItemsAnalytics> {
    logger.info("Getting skipped items analytics", { filters });

    try {
      const analytics = await this.analyticsRepository.getSkippedItemsAnalytics(filters);
      
      logger.info("Skipped items analytics retrieved", {
        totalSkippedItems: analytics.totalSkippedItems,
        skippedRate: analytics.skippedRate,
      });

      return analytics;
    } catch (error) {
      logger.error("Error getting skipped items analytics", error as Error, { filters });
      throw error;
    }
  }

  /**
   * Get comprehensive checklist efficiency report
   * Combines completion time and skipped items analytics with recommendations
   * Requirements: 11.5
   */
  async getEfficiencyReport(filters?: ChecklistAnalyticsFilters): Promise<ChecklistEfficiencyReport> {
    logger.info("Generating checklist efficiency report", { filters });

    try {
      const [completionTime, skippedItems] = await Promise.all([
        this.getCompletionTimeAnalytics(filters),
        this.getSkippedItemsAnalytics(filters),
      ]);

      // Calculate health score (0-100)
      const healthScore = this.calculateHealthScore(completionTime, skippedItems);
      
      // Generate recommendations based on analytics
      const recommendations = this.generateRecommendations(completionTime, skippedItems);

      logger.info("Checklist efficiency report generated", {
        healthScore,
        recommendationCount: recommendations.length,
      });

      return {
        completionTime,
        skippedItems,
        summary: {
          healthScore,
          recommendations,
        },
      };
    } catch (error) {
      logger.error("Error generating efficiency report", error as Error, { filters });
      throw error;
    }
  }

  /**
   * Calculate a health score based on completion time and skipped items
   * Score ranges from 0 (poor) to 100 (excellent)
   */
  private calculateHealthScore(
    completionTime: ChecklistCompletionTimeAnalytics,
    skippedItems: SkippedItemsAnalytics
  ): number {
    // If no data, return neutral score
    if (completionTime.totalCompleted === 0) {
      return 50;
    }

    let score = 100;

    // Penalize for high skip rate (target: < 5%)
    // Each percentage point above 5% reduces score by 3 points
    if (skippedItems.skippedRate > 5) {
      const excessSkipRate = skippedItems.skippedRate - 5;
      score -= Math.min(excessSkipRate * 3, 30); // Max 30 point penalty
    }

    // Penalize for mandatory items being skipped
    // Each mandatory skip reduces score by 5 points
    if (skippedItems.totalMandatorySkipped > 0) {
      score -= Math.min(skippedItems.totalMandatorySkipped * 5, 25); // Max 25 point penalty
    }

    // Penalize for slow completion time (target: < 48 hours average)
    // Each 12 hours above 48 reduces score by 5 points
    if (completionTime.averageCompletionTimeHours > 48) {
      const excessHours = completionTime.averageCompletionTimeHours - 48;
      score -= Math.min(Math.floor(excessHours / 12) * 5, 25); // Max 25 point penalty
    }

    // Bonus for very fast completion time (< 24 hours)
    if (completionTime.averageCompletionTimeHours > 0 && completionTime.averageCompletionTimeHours < 24) {
      score += 5;
    }

    // Bonus for very low skip rate (< 2%)
    if (skippedItems.skippedRate < 2 && completionTime.totalCompleted > 0) {
      score += 5;
    }

    // Bonus for no mandatory items skipped
    if (skippedItems.totalMandatorySkipped === 0 && completionTime.totalCompleted > 0) {
      score += 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate recommendations based on analytics data
   */
  private generateRecommendations(
    completionTime: ChecklistCompletionTimeAnalytics,
    skippedItems: SkippedItemsAnalytics
  ): string[] {
    const recommendations: string[] = [];

    // Check mandatory items being skipped
    if (skippedItems.totalMandatorySkipped > 0) {
      recommendations.push(
        `${skippedItems.totalMandatorySkipped} mandatory checklist items have been skipped. Review enforcement settings and ensure team understands the importance of mandatory items.`
      );
    }

    // Check overall skip rate
    if (skippedItems.skippedRate > 15) {
      recommendations.push(
        "High skip rate detected (>15%). Consider reviewing checklist items for relevance and clarity. Items that are frequently skipped may need to be revised or removed."
      );
    } else if (skippedItems.skippedRate > 5) {
      recommendations.push(
        "Moderate skip rate (>5%). Review frequently skipped items to determine if they are still necessary or need clarification."
      );
    }

    // Check completion time
    if (completionTime.averageCompletionTimeHours > 72) {
      recommendations.push(
        "Average checklist completion time exceeds 72 hours. Consider breaking down complex checklists into smaller, more manageable items."
      );
    } else if (completionTime.averageCompletionTimeHours > 48) {
      recommendations.push(
        "Average checklist completion time exceeds 48 hours. Review task complexity and resource allocation."
      );
    }

    // Check for frequently skipped items
    const highSkipItems = skippedItems.frequentlySkippedItems.filter(
      item => item.skipCount >= 3
    );
    if (highSkipItems.length > 0) {
      const itemNames = highSkipItems
        .slice(0, 3)
        .map(i => `"${i.itemText.substring(0, 50)}${i.itemText.length > 50 ? '...' : ''}"`)
        .join(", ");
      recommendations.push(
        `Frequently skipped items detected: ${itemNames}. Consider revising or removing these items if they are not essential.`
      );
    }

    // Check for mandatory items being frequently skipped
    const mandatorySkipped = skippedItems.frequentlySkippedItems.filter(
      item => item.isMandatory && item.skipCount >= 2
    );
    if (mandatorySkipped.length > 0) {
      recommendations.push(
        `${mandatorySkipped.length} mandatory items are being frequently skipped. This may indicate process issues or unclear requirements. Consider team training or process review.`
      );
    }

    // Check for slow departments
    const slowDepts = completionTime.completionTimeByDepartment.filter(
      dept => dept.averageCompletionTimeHours > 96 && dept.itemsCompleted >= 5
    );
    if (slowDepts.length > 0) {
      const deptNames = slowDepts
        .slice(0, 3)
        .map(d => d.departmentName)
        .join(", ");
      recommendations.push(
        `Slow checklist completion detected in departments: ${deptNames}. Review workload and resource allocation in these departments.`
      );
    }

    // Check for departments with high skip rates
    const highSkipDepts = skippedItems.skippedByDepartment.filter(
      dept => dept.skippedCount >= 5
    );
    if (highSkipDepts.length > 0) {
      const deptNames = highSkipDepts
        .slice(0, 3)
        .map(d => d.departmentName)
        .join(", ");
      recommendations.push(
        `High skip rates in departments: ${deptNames}. Consider department-specific training or checklist customization.`
      );
    }

    // If no issues found
    if (recommendations.length === 0) {
      recommendations.push(
        "Checklist processes are performing well. Continue monitoring for any changes in patterns."
      );
    }

    return recommendations;
  }
}
