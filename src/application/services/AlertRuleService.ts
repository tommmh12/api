import {
  AlertRuleRepository,
  AlertRule,
} from "../../infrastructure/repositories/AlertRuleRepository.js";

export class AlertRuleService {
  constructor(private alertRuleRepository: AlertRuleRepository) {}

  async getAllRules(): Promise<AlertRule[]> {
    return await this.alertRuleRepository.findAll();
  }

  async getRuleById(id: string): Promise<AlertRule | null> {
    return await this.alertRuleRepository.findById(id);
  }

  async createRule(data: {
    name: string;
    description?: string;
    category: "HR" | "System" | "Security";
    threshold: number;
    unit: "days" | "percent" | "count";
    notify_roles: string[];
  }): Promise<AlertRule> {
    return await this.alertRuleRepository.create(data);
  }

  async updateRule(
    id: string,
    data: {
      threshold?: number;
      notify_roles?: string[];
      is_enabled?: boolean;
      description?: string;
    }
  ): Promise<AlertRule | null> {
    return await this.alertRuleRepository.update(id, data);
  }

  async toggleRule(id: string): Promise<AlertRule | null> {
    return await this.alertRuleRepository.toggleEnabled(id);
  }

  async deleteRule(id: string): Promise<boolean> {
    return await this.alertRuleRepository.delete(id);
  }

  async seedDefaultRules(): Promise<void> {
    await this.alertRuleRepository.seedDefaultRules();
  }
}
