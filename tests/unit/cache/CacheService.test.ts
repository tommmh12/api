/**
 * Unit tests for CacheService
 * 
 * Tests the cache-aside pattern implementation
 * Requirements: 6.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService, CacheKeys, CacheTTL } from '../../../src/infrastructure/cache/CacheService.js';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    // Reset singleton and create fresh instance for each test
    CacheService.resetInstance();
    cache = CacheService.getInstance({
      defaultTTLMs: 1000, // 1 second for faster tests
      maxEntries: 10,
      cleanupIntervalMs: 60000, // Don't run cleanup during tests
    });
  });

  afterEach(() => {
    CacheService.resetInstance();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('test-key', { name: 'test' });
      const result = cache.get<{ name: string }>('test-key');
      
      expect(result).toEqual({ name: 'test' });
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      
      expect(result).toBeNull();
    });

    it('should delete keys', () => {
      cache.set('test-key', 'value');
      const deleted = cache.delete('test-key');
      
      expect(deleted).toBe(true);
      expect(cache.get('test-key')).toBeNull();
    });

    it('should return false when deleting non-existent key', () => {
      const deleted = cache.delete('non-existent');
      
      expect(deleted).toBe(false);
    });

    it('should check if key exists', () => {
      cache.set('test-key', 'value');
      
      expect(cache.has('test-key')).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      cache.set('expiring-key', 'value', 50); // 50ms TTL
      
      expect(cache.get('expiring-key')).toBe('value');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(cache.get('expiring-key')).toBeNull();
    });

    it('should use custom TTL when provided', async () => {
      cache.set('short-ttl', 'value', 50);
      cache.set('long-ttl', 'value', 500);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(cache.get('short-ttl')).toBeNull();
      expect(cache.get('long-ttl')).toBe('value');
    });
  });

  describe('Pattern-Based Deletion', () => {
    it('should delete keys by pattern', () => {
      cache.set('departments:all', ['dept1', 'dept2']);
      cache.set('departments:123', { id: '123' });
      cache.set('users:456', { id: '456' });
      
      const deleted = cache.deleteByPattern('departments:');
      
      expect(deleted).toBe(2);
      expect(cache.get('departments:all')).toBeNull();
      expect(cache.get('departments:123')).toBeNull();
      expect(cache.get('users:456')).toEqual({ id: '456' });
    });
  });

  describe('getOrSet Pattern', () => {
    it('should return cached value on hit', async () => {
      cache.set('cached-key', 'cached-value');
      const fetchFn = vi.fn().mockResolvedValue('fresh-value');
      
      const result = await cache.getOrSet('cached-key', fetchFn);
      
      expect(result).toBe('cached-value');
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache on miss', async () => {
      const fetchFn = vi.fn().mockResolvedValue('fresh-value');
      
      const result = await cache.getOrSet('new-key', fetchFn);
      
      expect(result).toBe('fresh-value');
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(cache.get('new-key')).toBe('fresh-value');
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key', 'value');
      
      cache.get('key'); // hit
      cache.get('key'); // hit
      cache.get('missing'); // miss
      
      const stats = cache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.67, 1);
    });

    it('should track cache size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(2);
    });
  });

  describe('Eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      // Cache has maxEntries: 10
      for (let i = 0; i < 10; i++) {
        cache.set(`key-${i}`, `value-${i}`);
      }
      
      // Add one more, should evict key-0 (oldest)
      cache.set('key-10', 'value-10');
      
      expect(cache.get('key-0')).toBeNull();
      expect(cache.get('key-10')).toBe('value-10');
      
      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });
});

describe('CacheKeys', () => {
  it('should generate correct department keys', () => {
    expect(CacheKeys.departments.all()).toBe('departments:all');
    expect(CacheKeys.departments.byId('123')).toBe('departments:123');
    expect(CacheKeys.departments.pattern()).toBe('departments:');
  });

  it('should generate correct settings keys', () => {
    expect(CacheKeys.settings.priorities()).toBe('settings:priorities');
    expect(CacheKeys.settings.tags()).toBe('settings:tags');
    expect(CacheKeys.settings.statuses()).toBe('settings:statuses');
    expect(CacheKeys.settings.taskSettings()).toBe('settings:task');
  });

  it('should generate correct user keys', () => {
    expect(CacheKeys.users.byId('user-123')).toBe('users:user-123');
    expect(CacheKeys.users.byEmail('test@example.com')).toBe('users:email:test@example.com');
    expect(CacheKeys.users.all()).toBe('users:all');
  });

  it('should generate correct dashboard keys', () => {
    expect(CacheKeys.dashboard.overview()).toBe('dashboard:overview');
    expect(CacheKeys.dashboard.stats()).toBe('dashboard:stats');
    expect(CacheKeys.dashboard.personal('user-123')).toBe('dashboard:personal:user-123');
  });
});

describe('CacheTTL', () => {
  it('should have appropriate TTL values', () => {
    // Long TTL for stable data
    expect(CacheTTL.DEPARTMENTS).toBeGreaterThanOrEqual(5 * 60 * 1000);
    expect(CacheTTL.PRIORITIES).toBeGreaterThanOrEqual(15 * 60 * 1000);
    
    // Short TTL for volatile data
    expect(CacheTTL.DASHBOARD_OVERVIEW).toBeLessThanOrEqual(2 * 60 * 1000);
    expect(CacheTTL.DASHBOARD_PERSONAL).toBeLessThanOrEqual(60 * 1000);
  });
});
