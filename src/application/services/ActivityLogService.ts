import { ActivityLogRepository } from "../../infrastructure/repositories/ActivityLogRepository.js";

export class ActivityLogService {
  constructor(private activityLogRepository: ActivityLogRepository) {}

  async logActivity(data: {
    user_id?: string | null;
    type: string;
    content: string;
    target?: string;
    ip_address?: string;
    meta?: any;
  }): Promise<void> {
    await this.activityLogRepository.create(data);
  }

  async getAllLogs(limit: number = 100, offset: number = 0) {
    return await this.activityLogRepository.findAll(limit, offset);
  }

  async getLogsByType(type: string, limit: number = 100) {
    return await this.activityLogRepository.findByType(type, limit);
  }

  async getLogsByUserId(userId: string, limit: number = 100) {
    return await this.activityLogRepository.findByUserId(userId, limit);
  }
}

