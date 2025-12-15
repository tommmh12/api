import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";
import crypto from "crypto";

export class AttendanceRepository {
  private db = dbPool;

  /**
   * Find attendance record by ID
   */
  async findById(id: string): Promise<any | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM attendance WHERE id = ?`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find attendance record by employee and date
   */
  async findByEmployeeAndDate(
    employeeId: string,
    date: string
  ): Promise<any | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM attendance WHERE employee_id = ? AND DATE(date) = ?`,
      [employeeId, date]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get department attendance for a specific date
   */
  async getDepartmentAttendanceByDate(
    departmentId: string,
    date: string
  ): Promise<any[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `
      SELECT 
        a.id,
        a.employee_id,
        u.full_name as employee_name,
        u.avatar_url,
        a.date,
        a.check_in,
        a.check_out,
        a.status,
        a.duration
      FROM attendance a
      JOIN users u ON a.employee_id = u.id
      WHERE u.department_id = ? AND DATE(a.date) = ?
      ORDER BY u.full_name ASC
    `,
      [departmentId, date]
    );
    return rows;
  }

  /**
   * Get department attendance for a date range
   */
  async getDepartmentAttendanceByRange(
    departmentId: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `
      SELECT 
        a.id,
        a.employee_id,
        u.full_name as employee_name,
        u.avatar_url,
        a.date,
        a.check_in,
        a.check_out,
        a.status,
        a.duration
      FROM attendance a
      JOIN users u ON a.employee_id = u.id
      WHERE u.department_id = ? 
        AND DATE(a.date) >= ? 
        AND DATE(a.date) <= ?
      ORDER BY a.date DESC, u.full_name ASC
    `,
      [departmentId, startDate, endDate]
    );
    return rows;
  }

  /**
   * Create a new attendance record
   */
  async create(data: {
    employee_id: string;
    date: string;
    check_in?: string;
    check_out?: string;
    status?: string;
    duration?: number;
  }): Promise<any> {
    const id = crypto.randomUUID();
    await this.db.query(
      `INSERT INTO attendance (id, employee_id, date, check_in, check_out, status, duration, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        data.employee_id,
        data.date,
        data.check_in || null,
        data.check_out || null,
        data.status || "present",
        data.duration || null,
      ]
    );
    return this.findById(id);
  }

  /**
   * Update attendance record
   */
  async update(
    id: string,
    data: Partial<{
      check_in: string;
      check_out: string;
      status: string;
      duration: number;
    }>
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.check_in !== undefined) {
      updates.push("check_in = ?");
      values.push(data.check_in);
    }
    if (data.check_out !== undefined) {
      updates.push("check_out = ?");
      values.push(data.check_out);
    }
    if (data.status !== undefined) {
      updates.push("status = ?");
      values.push(data.status);
    }
    if (data.duration !== undefined) {
      updates.push("duration = ?");
      values.push(data.duration);
    }

    if (updates.length > 0) {
      updates.push("updated_at = NOW()");
      values.push(id);

      await this.db.query(
        `UPDATE attendance SET ${updates.join(", ")} WHERE id = ?`,
        values
      );
    }
  }

  /**
   * Get attendance summary by employee
   */
  async getEmployeeAttendanceSummary(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    present: number;
    absent: number;
    late: number;
    early_leave: number;
    on_leave: number;
    total: number;
  }> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `
      SELECT 
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late,
        COUNT(CASE WHEN status = 'early_leave' THEN 1 END) as early_leave,
        COUNT(CASE WHEN status = 'on_leave' THEN 1 END) as on_leave,
        COUNT(*) as total
      FROM attendance
      WHERE employee_id = ?
        AND DATE(date) >= ?
        AND DATE(date) <= ?
    `,
      [employeeId, startDate, endDate]
    );

    return (
      (rows[0] as any) || {
        present: 0,
        absent: 0,
        late: 0,
        early_leave: 0,
        on_leave: 0,
        total: 0,
      }
    );
  }

  /**
   * Get today's attendance for employee
   */
  async getTodayAttendance(employeeId: string): Promise<any | null> {
    const today = new Date().toISOString().split("T")[0];
    return this.findByEmployeeAndDate(employeeId, today);
  }

  /**
   * Bulk create attendance records
   */
  async bulkCreate(
    records: Array<{
      employee_id: string;
      date: string;
      status: string;
    }>
  ): Promise<void> {
    for (const record of records) {
      const existing = await this.findByEmployeeAndDate(
        record.employee_id,
        record.date
      );
      if (!existing) {
        await this.create(record);
      }
    }
  }
}
