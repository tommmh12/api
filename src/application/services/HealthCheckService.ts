import { checkPoolHealth, PoolHealthCheckResult } from '../../infrastructure/database/connection.js';
import { CacheService } from '../../infrastructure/cache/CacheService.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Health Check Service
 * 
 * Monitors system health for deployment and alerting.
 * Requirements: 4.4, 6.4
 */

export interface ComponentHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTimeMs?: number;
  lastError?: string;
}

export interface CacheHealth extends ComponentHealth {
  stats?: {
    hits: number;
    misses: number;
    size: number;
    evictions: number;
    hitRate: number;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: ComponentHealth;
    fileStorage: ComponentHealth;
    cache?: CacheHealth;
  };
}

class HealthCheckService {
  private uploadsPath: string;

  constructor() {
    this.uploadsPath = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');
  }

  /**
   * Perform a full health check on all system components
   */
  async check(): Promise<HealthCheckResult> {
    const [databaseHealth, fileStorageHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkFileStorage(),
    ]);
    
    const cacheHealth = this.checkCache();

    // Determine overall status (cache is not critical)
    const allUp = databaseHealth.status === 'up' && fileStorageHealth.status === 'up';
    const anyDown = databaseHealth.status === 'down' || fileStorageHealth.status === 'down';
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allUp) {
      status = 'healthy';
    } else if (anyDown) {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: databaseHealth,
        fileStorage: fileStorageHealth,
        cache: cacheHealth,
      },
    };
  }


  /**
   * Check database connectivity
   */
  async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const result: PoolHealthCheckResult = await checkPoolHealth();
      const responseTimeMs = Date.now() - startTime;
      
      if (result.healthy) {
        return {
          name: 'database',
          status: 'up',
          responseTimeMs: result.responseTimeMs || responseTimeMs,
        };
      } else {
        return {
          name: 'database',
          status: 'down',
          responseTimeMs: result.responseTimeMs || responseTimeMs,
          lastError: result.error,
        };
      }
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      return {
        name: 'database',
        status: 'down',
        responseTimeMs,
        lastError: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Check file storage accessibility
   */
  async checkFileStorage(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Check if uploads directory exists and is accessible
      await fs.access(this.uploadsPath, fs.constants.R_OK | fs.constants.W_OK);
      
      // Try to read directory contents to verify it's working
      await fs.readdir(this.uploadsPath);
      
      // Try to write and delete a test file to verify write access
      const testFilePath = path.join(this.uploadsPath, `.health-check-${Date.now()}.tmp`);
      await fs.writeFile(testFilePath, 'health-check');
      await fs.unlink(testFilePath);
      
      const responseTimeMs = Date.now() - startTime;
      
      return {
        name: 'fileStorage',
        status: 'up',
        responseTimeMs,
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      return {
        name: 'fileStorage',
        status: 'down',
        responseTimeMs,
        lastError: error instanceof Error ? error.message : 'Unknown file storage error',
      };
    }
  }

  /**
   * Check cache health and statistics
   * 
   * Implements Requirements 6.4:
   * - Monitor cache performance
   */
  checkCache(): CacheHealth {
    try {
      const cache = CacheService.getInstance();
      const stats = cache.getStats();
      
      // Consider cache degraded if hit rate is below 50% (after sufficient samples)
      const totalRequests = stats.hits + stats.misses;
      let status: 'up' | 'down' | 'degraded' = 'up';
      
      if (totalRequests > 100 && stats.hitRate < 0.5) {
        status = 'degraded';
      }
      
      return {
        name: 'cache',
        status,
        stats: {
          hits: stats.hits,
          misses: stats.misses,
          size: stats.size,
          evictions: stats.evictions,
          hitRate: Math.round(stats.hitRate * 100) / 100,
        },
      };
    } catch (error) {
      return {
        name: 'cache',
        status: 'down',
        lastError: error instanceof Error ? error.message : 'Unknown cache error',
      };
    }
  }

  /**
   * Check a specific component by name
   */
  async checkComponent(name: string): Promise<ComponentHealth | CacheHealth> {
    switch (name) {
      case 'database':
        return this.checkDatabase();
      case 'fileStorage':
        return this.checkFileStorage();
      case 'cache':
        return this.checkCache();
      default:
        return {
          name,
          status: 'down',
          lastError: `Unknown component: ${name}`,
        };
    }
  }
}

export const healthCheckService = new HealthCheckService();
