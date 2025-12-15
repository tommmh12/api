import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";

export class SettingsRepository {
  private db = dbPool;

  async getPriorities() {
    return [
      { name: "Critical", color: "bg-red-600", slaHours: 4 },
      { name: "High", color: "bg-orange-500", slaHours: 24 },
      { name: "Medium", color: "bg-blue-500", slaHours: 48 },
      { name: "Low", color: "bg-green-500", slaHours: 72 },
    ];
  }

  async getTags() {
    const query = `
      SELECT 
        tag_name as name,
        COUNT(*) as usageCount
      FROM task_tags
      GROUP BY tag_name
      ORDER BY usageCount DESC, tag_name ASC
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query);

    // Assign colors based on usage
    const colors = [
      "bg-pink-100 text-pink-800",
      "bg-indigo-100 text-indigo-800",
      "bg-purple-100 text-purple-800",
      "bg-blue-100 text-blue-800",
      "bg-green-100 text-green-800",
      "bg-yellow-100 text-yellow-800",
      "bg-red-100 text-red-800",
    ];

    return rows.map((row: any, index: number) => ({
      name: row.name,
      color: colors[index % colors.length],
      usageCount: row.usageCount,
    }));
  }

  async getStatuses() {
    // Get unique statuses from all workflows
    const query = `
      SELECT DISTINCT name
      FROM workflow_statuses
      ORDER BY name
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query);
    return rows.map((row: any) => row.name);
  }

  async getTaskSettings() {
    const priorities = await this.getPriorities();
    const tags = await this.getTags();
    const statuses = await this.getStatuses();

    return {
      priorities,
      tags,
      statuses,
    };
  }
}
