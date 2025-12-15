import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";
import crypto from "crypto";

export class ReportRepository {
  private db = dbPool;

  async getReportsByProjectId(projectId: string) {
    const query = `
      SELECT 
        r.*,
        d.name as departmentName,
        u1.full_name as submittedByName,
        u2.full_name as reviewedByName
      FROM project_reports r
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN users u1 ON r.submitted_by = u1.id
      LEFT JOIN users u2 ON r.reviewed_by = u2.id
      WHERE r.project_id = ?
      ORDER BY r.submitted_date DESC
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query, [projectId]);
    return rows;
  }

  async getReportById(id: string) {
    const query = `
      SELECT 
        r.*,
        d.name as departmentName,
        u1.full_name as submittedByName,
        u2.full_name as reviewedByName
      FROM project_reports r
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN users u1 ON r.submitted_by = u1.id
      LEFT JOIN users u2 ON r.reviewed_by = u2.id
      WHERE r.id = ?
    `;

    const [rows] = await this.db.query<RowDataPacket[]>(query, [id]);
    return rows[0] || null;
  }

  async createReport(reportData: any) {
    const reportId = crypto.randomUUID();

    const query = `
      INSERT INTO project_reports (
        id, project_id, department_id, title, content, submitted_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    await this.db.query(query, [
      reportId,
      reportData.projectId,
      reportData.departmentId,
      reportData.title,
      reportData.content,
      reportData.submittedBy || null,
    ]);

    return reportId;
  }

  async reviewReport(
    id: string,
    status: string,
    feedback: string,
    reviewedBy: string
  ) {
    const query = `
      UPDATE project_reports 
      SET 
        status = ?,
        feedback = ?,
        reviewed_by = ?,
        reviewed_at = NOW()
      WHERE id = ?
    `;

    await this.db.query(query, [status, feedback, reviewedBy, id]);
  }

  async deleteReport(id: string) {
    await this.db.query("DELETE FROM project_reports WHERE id = ?", [id]);
  }
}
