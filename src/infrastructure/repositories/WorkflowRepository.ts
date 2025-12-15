import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";
import crypto from "crypto";

export class WorkflowRepository {
  private db = dbPool;

  async getAllWorkflows() {
    const query = `
      SELECT 
        w.*,
        u.full_name as createdByName,
        (SELECT COUNT(*) FROM projects WHERE workflow_id = w.id) as usageCount
      FROM workflows w
      LEFT JOIN users u ON w.created_by = u.id
      ORDER BY w.is_default DESC, w.created_at DESC
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query);
    return rows;
  }

  async getWorkflowById(id: string) {
    const query = `
      SELECT 
        w.*,
        u.full_name as createdByName
      FROM workflows w
      LEFT JOIN users u ON w.created_by = u.id
      WHERE w.id = ?
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query, [id]);
    return rows[0] || null;
  }

  async getWorkflowStatuses(workflowId: string) {
    const query = `
      SELECT *
      FROM workflow_statuses
      WHERE workflow_id = ?
      ORDER BY \`order\` ASC
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query, [workflowId]);
    return rows;
  }

  async createWorkflow(workflowData: any, userId?: string) {
    const workflowId = crypto.randomUUID();

    const query = `
      INSERT INTO workflows (id, name, description, is_default, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;

    await this.db.query(query, [
      workflowId,
      workflowData.name,
      workflowData.description || null,
      workflowData.isDefault || false,
      userId || null,
    ]);

    return workflowId;
  }

  async createWorkflowStatus(workflowId: string, statusData: any) {
    const query = `
      INSERT INTO workflow_statuses (workflow_id, name, color, \`order\`)
      VALUES (?, ?, ?, ?)
    `;

    await this.db.query(query, [
      workflowId,
      statusData.name,
      statusData.color || null,
      statusData.order || 0,
    ]);
  }

  async updateWorkflow(id: string, workflowData: any) {
    const query = `
      UPDATE workflows
      SET name = ?, description = ?, is_default = ?
      WHERE id = ?
    `;

    await this.db.query(query, [
      workflowData.name,
      workflowData.description || null,
      workflowData.isDefault || false,
      id,
    ]);
  }

  async deleteWorkflow(id: string) {
    // Check if workflow is in use
    const [projects] = await this.db.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM projects WHERE workflow_id = ?",
      [id]
    );

    if (projects[0].count > 0) {
      throw new Error("Không thể xóa quy trình đang được sử dụng");
    }

    await this.db.query("DELETE FROM workflows WHERE id = ?", [id]);
  }

  async deleteWorkflowStatuses(workflowId: string) {
    await this.db.query("DELETE FROM workflow_statuses WHERE workflow_id = ?", [
      workflowId,
    ]);
  }
}
