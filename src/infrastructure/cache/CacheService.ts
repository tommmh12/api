/**
 * In-Memory Cache Service implementing Cache-Aside Pattern
 * 
 * This service provides a simple in-memory caching solution for frequently accessed,
 * rarely changed data. It implements the cache-aside pattern where:
 * 1. Application first checks the cache
 * 2. If cache miss, fetch from database
 * 3. Store result in cache for future requests
 * 
 * Implements Requirements 6.4:
 * - Implement caching with invalidation strategies for frequently accessed, rarely changed data
 * 
 * @module CacheService
 */

import { logger } from '../logging/StructuredLogger.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

interface CacheConfig {
  defaultTTLMs: number;
  maxEntries: number;
  cleanupIntervalMs: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTLMs: 5 * 60 * 1000, // 5 minutes default TTL
  maxEntries: 1000,
  cleanupIntervalMs: 60 * 1000, // Cleanup every minute
};

/**
 * In-memory cache service with TTL support and automatic cleanup
 */
export class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, evictions: 0 };
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private logger = logger;

  private static instance: CacheService | null = null;

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupInterval();
  }

  /**
   * Get singleton instance of CacheService
   */
  static getInstance(config?: Partial<CacheConfig>): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService(config);
    }
    return CacheService.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    if (CacheService.instance) {
      CacheService.instance.shutdown();
      CacheService.instance = null;
    }
  }

  /**
   * Get a value from cache
   * 
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set a value in cache
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Time to live in milliseconds (optional, uses default if not provided)
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data: value,
      expiresAt: now + (ttlMs ?? this.config.defaultTTLMs),
      createdAt: now,
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * Delete a specific key from cache
   * 
   * @param key - Cache key to delete
   * @returns true if key was deleted, false if not found
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  /**
   * Delete all keys matching a pattern (prefix-based)
   * 
   * @param pattern - Key prefix to match
   * @returns Number of keys deleted
   */
  deleteByPattern(pattern: string): number {
    let deleted = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    this.stats.size = this.cache.size;
    
    if (deleted > 0) {
      this.logger.info('Cache keys invalidated by pattern', { pattern, count: deleted });
    }
    
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      return false;
    }
    return true;
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   * 
   * @param key - Cache key
   * @param fetchFn - Function to execute if cache miss
   * @param ttlMs - Time to live in milliseconds
   * @returns Cached or freshly fetched value
   */
  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Evict the oldest entry from cache
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.stats.size = this.cache.size;

    if (cleaned > 0) {
      this.logger.debug('Cache cleanup completed', { entriesRemoved: cleaned, currentSize: this.cache.size });
    }
  }

  /**
   * Start the automatic cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);

    // Ensure cleanup interval doesn't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Shutdown the cache service
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

/**
 * Cache key generators for consistent key naming
 */
export const CacheKeys = {
  // Department cache keys
  departments: {
    all: () => 'departments:all',
    byId: (id: string) => `departments:${id}`,
    pattern: () => 'departments:',
  },

  // Settings cache keys
  settings: {
    priorities: () => 'settings:priorities',
    tags: () => 'settings:tags',
    statuses: () => 'settings:statuses',
    taskSettings: () => 'settings:task',
    pattern: () => 'settings:',
  },

  // User cache keys
  users: {
    byId: (id: string) => `users:${id}`,
    byEmail: (email: string) => `users:email:${email}`,
    all: () => 'users:all',
    pattern: () => 'users:',
  },

  // Dashboard cache keys
  dashboard: {
    overview: () => 'dashboard:overview',
    stats: () => 'dashboard:stats',
    personal: (userId: string) => `dashboard:personal:${userId}`,
    pattern: () => 'dashboard:',
  },
};

/**
 * Cache TTL constants (in milliseconds)
 */
export const CacheTTL = {
  // Long TTL for rarely changed data
  DEPARTMENTS: 10 * 60 * 1000, // 10 minutes
  SETTINGS: 15 * 60 * 1000, // 15 minutes
  PRIORITIES: 30 * 60 * 1000, // 30 minutes (static data)

  // Medium TTL for moderately changed data
  USER_PROFILE: 5 * 60 * 1000, // 5 minutes
  
  // Short TTL for frequently changing data
  DASHBOARD_OVERVIEW: 60 * 1000, // 1 minute
  DASHBOARD_PERSONAL: 30 * 1000, // 30 seconds
  
  // Very short TTL for volatile data
  TAGS: 2 * 60 * 1000, // 2 minutes (changes when tasks are tagged)
};

export default CacheService;
