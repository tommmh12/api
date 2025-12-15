/**
 * Resource Monitor Service
 * 
 * Monitors system resources (CPU, Memory, Disk) and provides metrics for alerting.
 * 
 * Requirements: 5.3 - Resource threshold alerts
 */

import os from 'os';
import fs from 'fs/promises';
import { logger } from '../logging/index.js';

export interface ResourceMetrics {
  cpu: {
    usagePercent: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
    path: string;
  };
  timestamp: Date;
}

export interface ResourceThresholds {
  cpuWarningPercent: number;
  cpuCriticalPercent: number;
  memoryWarningPercent: number;
  memoryCriticalPercent: number;
  diskWarningPercent: number;
  diskCriticalPercent: number;
}

export interface ResourceAlert {
  resource: 'cpu' | 'memory' | 'disk';
  level: 'warning' | 'critical';
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: Date;
}

const DEFAULT_THRESHOLDS: ResourceThresholds = {
  cpuWarningPercent: 70,
  cpuCriticalPercent: 90,
  memoryWarningPercent: 75,
  memoryCriticalPercent: 90,
  diskWarningPercent: 80,
  diskCriticalPercent: 95,
};

/**
 * ResourceMonitorService class
 * 
 * Singleton service that monitors system resources and generates alerts
 * when thresholds are exceeded.
 */
export class ResourceMonitorService {
  private static instance: ResourceMonitorService;
  private thresholds: ResourceThresholds;
  private metricsHistory: ResourceMetrics[] = [];
  private maxHistorySize: number = 100;
  private monitorPath: string;
  private lastCpuInfo: { idle: number; total: number } | null = null;

  private constructor(thresholds: Partial<ResourceThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.monitorPath = process.env.DISK_MONITOR_PATH || process.cwd();
    
    // Load thresholds from environment
    if (process.env.RESOURCE_CPU_WARNING_PERCENT) {
      this.thresholds.cpuWarningPercent = Number(process.env.RESOURCE_CPU_WARNING_PERCENT);
    }
    if (process.env.RESOURCE_CPU_CRITICAL_PERCENT) {
      this.thresholds.cpuCriticalPercent = Number(process.env.RESOURCE_CPU_CRITICAL_PERCENT);
    }
    if (process.env.RESOURCE_MEMORY_WARNING_PERCENT) {
      this.thresholds.memoryWarningPercent = Number(process.env.RESOURCE_MEMORY_WARNING_PERCENT);
    }
    if (process.env.RESOURCE_MEMORY_CRITICAL_PERCENT) {
      this.thresholds.memoryCriticalPercent = Number(process.env.RESOURCE_MEMORY_CRITICAL_PERCENT);
    }
    if (process.env.RESOURCE_DISK_WARNING_PERCENT) {
      this.thresholds.diskWarningPercent = Number(process.env.RESOURCE_DISK_WARNING_PERCENT);
    }
    if (process.env.RESOURCE_DISK_CRITICAL_PERCENT) {
      this.thresholds.diskCriticalPercent = Number(process.env.RESOURCE_DISK_CRITICAL_PERCENT);
    }
  }

  /**
   * Get the singleton instance of ResourceMonitorService
   */
  static getInstance(thresholds?: Partial<ResourceThresholds>): ResourceMonitorService {
    if (!ResourceMonitorService.instance) {
      ResourceMonitorService.instance = new ResourceMonitorService(thresholds);
    }
    return ResourceMonitorService.instance;
  }

  /**
   * Get current CPU usage percentage
   */
  private getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    if (this.lastCpuInfo) {
      const idleDiff = totalIdle - this.lastCpuInfo.idle;
      const totalDiff = totalTick - this.lastCpuInfo.total;
      const usagePercent = totalDiff > 0 ? 100 - (100 * idleDiff / totalDiff) : 0;
      
      this.lastCpuInfo = { idle: totalIdle, total: totalTick };
      return Math.round(usagePercent * 100) / 100;
    }

    this.lastCpuInfo = { idle: totalIdle, total: totalTick };
    // First call - return load average based estimate
    const loadAvg = os.loadavg()[0];
    const cores = cpus.length;
    return Math.min(100, Math.round((loadAvg / cores) * 100 * 100) / 100);
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics(): ResourceMetrics['memory'] {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = Math.round((usedBytes / totalBytes) * 100 * 100) / 100;

    return {
      totalBytes,
      usedBytes,
      freeBytes,
      usagePercent,
    };
  }

  /**
   * Get disk metrics for the monitored path
   * Note: This is a cross-platform implementation
   */
  private async getDiskMetrics(): Promise<ResourceMetrics['disk']> {
    try {
      // For Windows, we'll use a simpler approach
      // For Unix-like systems, we could use statvfs
      const stats = await fs.statfs(this.monitorPath);
      
      const totalBytes = stats.bsize * stats.blocks;
      const freeBytes = stats.bsize * stats.bfree;
      const usedBytes = totalBytes - freeBytes;
      const usagePercent = totalBytes > 0 
        ? Math.round((usedBytes / totalBytes) * 100 * 100) / 100 
        : 0;

      return {
        totalBytes,
        usedBytes,
        freeBytes,
        usagePercent,
        path: this.monitorPath,
      };
    } catch (error) {
      logger.warn('Failed to get disk metrics, using fallback', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        path: this.monitorPath 
      });
      
      // Fallback: return placeholder values
      return {
        totalBytes: 0,
        usedBytes: 0,
        freeBytes: 0,
        usagePercent: 0,
        path: this.monitorPath,
      };
    }
  }

  /**
   * Collect current resource metrics
   */
  async collectMetrics(): Promise<ResourceMetrics> {
    const [diskMetrics] = await Promise.all([
      this.getDiskMetrics(),
    ]);

    const metrics: ResourceMetrics = {
      cpu: {
        usagePercent: this.getCpuUsage(),
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
      },
      memory: this.getMemoryMetrics(),
      disk: diskMetrics,
      timestamp: new Date(),
    };

    // Store in history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }

    return metrics;
  }

  /**
   * Check resource thresholds and return any alerts
   */
  async checkThresholds(): Promise<ResourceAlert[]> {
    const metrics = await this.collectMetrics();
    const alerts: ResourceAlert[] = [];

    // Check CPU
    if (metrics.cpu.usagePercent >= this.thresholds.cpuCriticalPercent) {
      alerts.push({
        resource: 'cpu',
        level: 'critical',
        currentValue: metrics.cpu.usagePercent,
        threshold: this.thresholds.cpuCriticalPercent,
        message: `CPU usage is critically high: ${metrics.cpu.usagePercent}% (threshold: ${this.thresholds.cpuCriticalPercent}%)`,
        timestamp: new Date(),
      });
    } else if (metrics.cpu.usagePercent >= this.thresholds.cpuWarningPercent) {
      alerts.push({
        resource: 'cpu',
        level: 'warning',
        currentValue: metrics.cpu.usagePercent,
        threshold: this.thresholds.cpuWarningPercent,
        message: `CPU usage is high: ${metrics.cpu.usagePercent}% (threshold: ${this.thresholds.cpuWarningPercent}%)`,
        timestamp: new Date(),
      });
    }

    // Check Memory
    if (metrics.memory.usagePercent >= this.thresholds.memoryCriticalPercent) {
      alerts.push({
        resource: 'memory',
        level: 'critical',
        currentValue: metrics.memory.usagePercent,
        threshold: this.thresholds.memoryCriticalPercent,
        message: `Memory usage is critically high: ${metrics.memory.usagePercent}% (threshold: ${this.thresholds.memoryCriticalPercent}%)`,
        timestamp: new Date(),
      });
    } else if (metrics.memory.usagePercent >= this.thresholds.memoryWarningPercent) {
      alerts.push({
        resource: 'memory',
        level: 'warning',
        currentValue: metrics.memory.usagePercent,
        threshold: this.thresholds.memoryWarningPercent,
        message: `Memory usage is high: ${metrics.memory.usagePercent}% (threshold: ${this.thresholds.memoryWarningPercent}%)`,
        timestamp: new Date(),
      });
    }

    // Check Disk
    if (metrics.disk.usagePercent >= this.thresholds.diskCriticalPercent) {
      alerts.push({
        resource: 'disk',
        level: 'critical',
        currentValue: metrics.disk.usagePercent,
        threshold: this.thresholds.diskCriticalPercent,
        message: `Disk usage is critically high: ${metrics.disk.usagePercent}% (threshold: ${this.thresholds.diskCriticalPercent}%) on ${metrics.disk.path}`,
        timestamp: new Date(),
      });
    } else if (metrics.disk.usagePercent >= this.thresholds.diskWarningPercent) {
      alerts.push({
        resource: 'disk',
        level: 'warning',
        currentValue: metrics.disk.usagePercent,
        threshold: this.thresholds.diskWarningPercent,
        message: `Disk usage is high: ${metrics.disk.usagePercent}% (threshold: ${this.thresholds.diskWarningPercent}%) on ${metrics.disk.path}`,
        timestamp: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Get metrics history
   */
  getHistory(limit: number = 100): ResourceMetrics[] {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): ResourceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<ResourceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Format bytes to human readable string
   */
  static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let value = bytes;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Reset metrics history (useful for testing)
   */
  reset(): void {
    this.metricsHistory = [];
    this.lastCpuInfo = null;
  }
}

// Export singleton instance
export const resourceMonitorService = ResourceMonitorService.getInstance();

export default resourceMonitorService;
