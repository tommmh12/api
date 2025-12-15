import { SettingsRepository } from "../../infrastructure/repositories/SettingsRepository.js";
import { CacheService, CacheKeys, CacheTTL } from "../../infrastructure/cache/CacheService.js";

/**
 * Settings Service with Cache-Aside Pattern
 * 
 * Implements Requirements 6.4:
 * - Cache frequently accessed settings data (priorities, tags, statuses)
 * - Different TTLs based on data volatility
 */
export class SettingsService {
  private settingsRepo = new SettingsRepository();
  private cache = CacheService.getInstance();

  /**
   * Get all task settings with caching
   * Cache key: settings:task
   * TTL: 15 minutes
   */
  async getTaskSettings() {
    return this.cache.getOrSet(
      CacheKeys.settings.taskSettings(),
      () => this.settingsRepo.getTaskSettings(),
      CacheTTL.SETTINGS
    );
  }

  /**
   * Get priorities with caching
   * Cache key: settings:priorities
   * TTL: 30 minutes (static data)
   */
  async getPriorities() {
    return this.cache.getOrSet(
      CacheKeys.settings.priorities(),
      () => this.settingsRepo.getPriorities(),
      CacheTTL.PRIORITIES
    );
  }

  /**
   * Get tags with caching
   * Cache key: settings:tags
   * TTL: 2 minutes (changes when tasks are tagged)
   */
  async getTags() {
    return this.cache.getOrSet(
      CacheKeys.settings.tags(),
      () => this.settingsRepo.getTags(),
      CacheTTL.TAGS
    );
  }

  /**
   * Get statuses with caching
   * Cache key: settings:statuses
   * TTL: 15 minutes
   */
  async getStatuses() {
    return this.cache.getOrSet(
      CacheKeys.settings.statuses(),
      () => this.settingsRepo.getStatuses(),
      CacheTTL.SETTINGS
    );
  }

  /**
   * Invalidate tags cache
   * Called when a task is tagged/untagged
   */
  invalidateTagsCache(): void {
    this.cache.delete(CacheKeys.settings.tags());
    this.cache.delete(CacheKeys.settings.taskSettings());
  }

  /**
   * Invalidate all settings cache
   */
  invalidateAllSettingsCache(): void {
    this.cache.deleteByPattern(CacheKeys.settings.pattern());
  }
}
