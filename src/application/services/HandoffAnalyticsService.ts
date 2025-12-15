/**
 * HandoffAnalyticsService
 * Business logic for handoff analytics and efficiency metrics
 * Requirements: 9.5 - Track handoff cycle time and rejection rate
 */

import { HandoffRepository } from "../../infrastructure/repositories/HandoffRepository.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const logger = createLogger("HandoffAnalyticsService");

export interface HandoffAnalyticsFilters {
  fromDate?: Date;
  toDate?: Date;
  fromDepartmentId?: string;
  toDepartmentId?: string;
}

export interface CycleTimeAnalytics {
  averageCycleTimeHours: number;
  minCycleTimeHours: number;
  maxCycleTimeHours: number;
  totalCompleted: number;
  cycleTimeByDepartmentPair: Array<{
    fromDepartmentId: string;
    fromDepartmentName: string;
    toDepartmentId: string;
    toDepartmentName: string;
    averageCycleTimeHours: number;
    count: number;
  }>;
}

export interface RejectionRateAnalytics {
  overallRejectionRate: number;
  totalHandoffs: number;
  totalRejected: number;
  totalAccepted: number;
  totalPending: number;
  rejectionRateByDepartmentPair: Array<{
    fromDepartmentId: string;
    fromDepartmentName: string;
    toDepartmentId: string;
    toDepartmentName: string;
    totalHandoffs: number;
    rejectedCount: number;
    acceptedCount: number;
    rejectionRate: number;
  }>;
  topRejectionReasons: Array<{
    reason: string;
    count: number;
  }>;
}

export interface HandoffEfficiencyReport {
  cycleTime: CycleTimeAnalytics;
  rejectionRate: RejectionRateAnalytics;
  summary: {
    healthScore: number;
    recommendations: string[];
  };
}

export class HandoffAnalyticsService {
  private handoffRepository: HandoffRepository;

  constructor(handoffRepository?: HandoffRepository) {
    this.handoffRepository = handoffRepository || new HandoffRepository();
  }

  /**
   * Get handoff cycle time analytics
   * Requirements: 9.5 - Track handoff cycle time
   */
  async getCycleTimeAnalytics(filters?: HandoffAnalyticsFilters): Promise<CycleTimeAnalytics> {
    logger.info("Getting cycle time analytics", { filters });

    try {
      const analytics = await this.handoffRepository.getCycleTimeAnalytics(filters);
      
      logger.info("Cycle time analytics retrieved", {
        averageCycleTimeHours: analytics.averageCycleTimeHours,
        totalCompleted: analytics.totalCompleted,
      });

      return analytics;
    } catch (error) {
      logger.error("Error getting cycle time analytics", error as Error, { filters });
      throw error;
    }
  }

  /**
   * Get rejection rate analytics per department pair
   * Requirements: 9.5 - Track rejection rate
   */
  async getRejectionRateAnalytics(filters?: HandoffAnalyticsFilters): Promise<RejectionRateAnalytics> {
    logger.info("Getting rejection rate analytics", { filters });

    try {
      const analytics = await this.handoffRepository.getRejectionRateAnalytics(filters);
      
      logger.info("Rejection rate analytics retrieved", {
        overallRejectionRate: analytics.overallRejectionRate,
        totalHandoffs: analytics.totalHandoffs,
      });

      return analytics;
    } catch (error) {
      logger.error("Error getting rejection rate analytics", error as Error, { filters });
      throw error;
    }
  }

  /**
   * Get comprehensive handoff efficiency report
   * Combines cycle time and rejection rate analytics with recommendations
   * Requirements: 9.5
   */
  async getEfficiencyReport(filters?: HandoffAnalyticsFilters): Promise<HandoffEfficiencyReport> {
    logger.info("Generating handoff efficiency report", { filters });

    try {
      const [cycleTime, rejectionRate] = await Promise.all([
        this.getCycleTimeAnalytics(filters),
        this.getRejectionRateAnalytics(filters),
      ]);

      // Calculate health score (0-100)
      const healthScore = this.calculateHealthScore(cycleTime, rejectionRate);
      
      // Generate recommendations based on analytics
      const recommendations = this.generateRecommendations(cycleTime, rejectionRate);

      logger.info("Handoff efficiency report generated", {
        healthScore,
        recommendationCount: recommendations.length,
      });

      return {
        cycleTime,
        rejectionRate,
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
   * Calculate a health score based on cycle time and rejection rate
   * Score ranges from 0 (poor) to 100 (excellent)
   */
  private calculateHealthScore(
    cycleTime: CycleTimeAnalytics,
    rejectionRate: RejectionRateAnalytics
  ): number {
    // If no data, return neutral score
    if (cycleTime.totalCompleted === 0 && rejectionRate.totalHandoffs === 0) {
      return 50;
    }

    let score = 100;

    // Penalize for high rejection rate (target: < 10%)
    // Each percentage point above 10% reduces score by 2 points
    if (rejectionRate.overallRejectionRate > 10) {
      const excessRejection = rejectionRate.overallRejectionRate - 10;
      score -= Math.min(excessRejection * 2, 40); // Max 40 point penalty
    }

    // Penalize for slow cycle time (target: < 24 hours)
    // Each hour above 24 reduces score by 1 point
    if (cycleTime.averageCycleTimeHours > 24) {
      const excessHours = cycleTime.averageCycleTimeHours - 24;
      score -= Math.min(excessHours, 40); // Max 40 point penalty
    }

    // Bonus for very fast cycle time (< 4 hours)
    if (cycleTime.averageCycleTimeHours > 0 && cycleTime.averageCycleTimeHours < 4) {
      score += 5;
    }

    // Bonus for very low rejection rate (< 5%)
    if (rejectionRate.overallRejectionRate < 5 && rejectionRate.totalHandoffs > 0) {
      score += 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate recommendations based on analytics data
   */
  private generateRecommendations(
    cycleTime: CycleTimeAnalytics,
    rejectionRate: RejectionRateAnalytics
  ): string[] {
    const recommendations: string[] = [];

    // Check overall rejection rate
    if (rejectionRate.overallRejectionRate > 20) {
      recommendations.push(
        "High rejection rate detected (>20%). Consider reviewing handoff documentation requirements and improving communication between departments."
      );
    } else if (rejectionRate.overallRejectionRate > 10) {
      recommendations.push(
        "Moderate rejection rate (>10%). Review common rejection reasons and address recurring issues."
      );
    }

    // Check cycle time
    if (cycleTime.averageCycleTimeHours > 48) {
      recommendations.push(
        "Average handoff cycle time exceeds 48 hours. Consider setting up notifications and escalation procedures for pending handoffs."
      );
    } else if (cycleTime.averageCycleTimeHours > 24) {
      recommendations.push(
        "Average handoff cycle time exceeds 24 hours. Review department workloads and response time expectations."
      );
    }

    // Check for problematic department pairs
    const highRejectionPairs = rejectionRate.rejectionRateByDepartmentPair.filter(
      pair => pair.rejectionRate > 30 && pair.totalHandoffs >= 3
    );
    if (highRejectionPairs.length > 0) {
      const pairNames = highRejectionPairs
        .slice(0, 3)
        .map(p => `${p.fromDepartmentName} → ${p.toDepartmentName}`)
        .join(", ");
      recommendations.push(
        `High rejection rates detected for specific department pairs: ${pairNames}. Consider facilitating direct communication between these teams.`
      );
    }

    // Check for slow department pairs
    const slowPairs = cycleTime.cycleTimeByDepartmentPair.filter(
      pair => pair.averageCycleTimeHours > 72 && pair.count >= 3
    );
    if (slowPairs.length > 0) {
      const pairNames = slowPairs
        .slice(0, 3)
        .map(p => `${p.fromDepartmentName} → ${p.toDepartmentName}`)
        .join(", ");
      recommendations.push(
        `Slow handoff processing detected for: ${pairNames}. Review capacity and prioritization in receiving departments.`
      );
    }

    // Check top rejection reasons
    if (rejectionRate.topRejectionReasons.length > 0) {
      const topReason = rejectionRate.topRejectionReasons[0];
      if (topReason.count >= 3) {
        recommendations.push(
          `Most common rejection reason: "${topReason.reason}" (${topReason.count} occurrences). Address this issue to reduce rejections.`
        );
      }
    }

    // If no issues found
    if (recommendations.length === 0) {
      recommendations.push(
        "Handoff processes are performing well. Continue monitoring for any changes in patterns."
      );
    }

    return recommendations;
  }
}
