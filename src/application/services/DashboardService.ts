import { StatsRepository } from "../../infrastructure/repositories/StatsRepository.js";
import { CacheService, CacheKeys, CacheTTL } from "../../infrastructure/cache/CacheService.js";

/**
 * Dashboard Service with Cache-Aside Pattern
 * 
 * Implements Requirements 6.4:
 * - Cache expensive aggregation queries
 * - Short TTL for dashboard data (acceptable staleness)
 */
export class DashboardService {
  private statsRepository: StatsRepository;
  private cache: CacheService;

  constructor() {
    this.statsRepository = new StatsRepository();
    this.cache = CacheService.getInstance();
  }

  /**
   * Get dashboard overview with caching
   * Cache key: dashboard:overview
   * TTL: 1 minute (short TTL for frequently changing data)
   */
  async getDashboardOverview() {
    return this.cache.getOrSet(
      CacheKeys.dashboard.overview(),
      async () => {
        const stats = await this.statsRepository.getDashboardStats();
        const recentActivities = await this.statsRepository.getRecentActivities(10);
        const projectsProgress = await this.statsRepository.getProjectsProgress(5);
        const projectsByDepartment =
          await this.statsRepository.getProjectsByDepartment();
        const tasksSummary = await this.statsRepository.getTasksSummary(10);

        return {
          stats,
          recentActivities,
          projectsProgress,
          projectsByDepartment,
          tasksSummary,
        };
      },
      CacheTTL.DASHBOARD_OVERVIEW
    );
  }

  /**
   * Get detailed stats with caching
   * Cache key: dashboard:stats
   * TTL: 1 minute
   */
  async getDetailedStats() {
    return this.cache.getOrSet(
      CacheKeys.dashboard.stats(),
      async () => {
        const userStats = await this.statsRepository.getUserStats();
        const projectStats = await this.statsRepository.getProjectStats();
        const taskStats = await this.statsRepository.getTaskStats();

        return {
          users: userStats,
          projects: projectStats,
          tasks: taskStats,
        };
      },
      CacheTTL.DASHBOARD_OVERVIEW
    );
  }

  /**
   * Get employee personal dashboard with caching
   * Cache key: dashboard:personal:{userId}
   * TTL: 30 seconds (very short for personal data)
   */
  async getEmployeePersonalDashboard(userId: string) {
    return this.cache.getOrSet(
      CacheKeys.dashboard.personal(userId),
      () => this.statsRepository.getEmployeePersonalDashboard(userId),
      CacheTTL.DASHBOARD_PERSONAL
    );
  }

  /**
   * Invalidate dashboard cache
   * Called after significant data changes (project completion, etc.)
   */
  invalidateDashboardCache(): void {
    this.cache.deleteByPattern(CacheKeys.dashboard.pattern());
  }

  /**
   * Invalidate personal dashboard cache for a specific user
   */
  invalidatePersonalDashboard(userId: string): void {
    this.cache.delete(CacheKeys.dashboard.personal(userId));
  }
}
