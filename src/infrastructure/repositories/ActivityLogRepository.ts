import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { dbPool } from "../database/connection.js";

export interface ActivityLog {
  id: string;
  user_id: string | null;
  type: string;
  content: string;
  target?: string;
  ip_address?: string;
  meta?: any;
  created_at: Date;
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
}

export interface ActivityLogFilters {
  limit?: number;
  offset?: number;
  type?: string;
  userId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export class ActivityLogRepository {
  private db = dbPool;

  // Helper function to safely parse meta field
  private parseMeta(meta: any): any {
    if (!meta) return null;
    if (typeof meta === "object") return meta; // Already parsed
    try {
      return JSON.parse(meta);
    } catch {
      return null;
    }
  }

  async create(logData: {
    user_id?: string | null;
    type: string;
    content: string;
    target?: string;
    ip_address?: string;
    meta?: any;
  }): Promise<ActivityLog> {
    const logId = crypto.randomUUID();

    await this.db.query<ResultSetHeader>(
      `INSERT INTO activity_logs (
        id, user_id, type, content, target, ip_address, meta, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        logId,
        logData.user_id || null,
        logData.type,
        logData.content,
        logData.target || null,
        logData.ip_address || null,
        logData.meta ? JSON.stringify(logData.meta) : null,
      ]
    );

    const [rows] = await this.db.query<RowDataPacket[]>(
      "SELECT * FROM activity_logs WHERE id = ?",
      [logId]
    );

    return rows[0] as ActivityLog;
  }

  async findAll(
    limit: number = 100,
    offset: number = 0
  ): Promise<ActivityLog[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows.map((row) => ({
      ...row,
      meta: this.parseMeta(row.meta),
    })) as ActivityLog[];
  }

  async findAllWithFilters(
    filters: ActivityLogFilters
  ): Promise<{ logs: ActivityLog[]; total: number }> {
    const {
      limit = 50,
      offset = 0,
      type,
      userId,
      search,
      startDate,
      endDate,
    } = filters;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (type && type !== "all") {
      whereClause += " AND al.type = ?";
      params.push(type);
    }

    if (userId) {
      whereClause += " AND al.user_id = ?";
      params.push(userId);
    }

    if (search) {
      whereClause +=
        " AND (al.content LIKE ? OR al.target LIKE ? OR u.full_name LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (startDate) {
      whereClause += " AND al.created_at >= ?";
      params.push(startDate);
    }

    if (endDate) {
      whereClause += " AND al.created_at <= ?";
      params.push(endDate + " 23:59:59");
    }

    // Get total count
    const [countResult] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get paginated data
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar,
        u.department_id
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      logs: rows.map((row) => ({
        ...row,
        meta: this.parseMeta(row.meta),
      })) as ActivityLog[],
      total,
    };
  }

  async findById(id: string): Promise<ActivityLog | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = ?`,
      [id]
    );

    if (rows.length === 0) return null;

    return {
      ...rows[0],
      meta: this.parseMeta(rows[0].meta),
    } as ActivityLog;
  }

  async findByType(type: string, limit: number = 100): Promise<ActivityLog[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        al.*,
        u.full_name as user_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.type = ?
      ORDER BY al.created_at DESC
      LIMIT ?`,
      [type, limit]
    );
    return rows.map((row) => ({
      ...row,
      meta: this.parseMeta(row.meta),
    })) as ActivityLog[];
  }

  async findByUserId(
    userId: string,
    limit: number = 100
  ): Promise<ActivityLog[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        al.*,
        u.full_name as user_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.user_id = ?
      ORDER BY al.created_at DESC
      LIMIT ?`,
      [userId, limit]
    );
    return rows.map((row) => ({
      ...row,
      meta: this.parseMeta(row.meta),
    })) as ActivityLog[];
  }

  async getStats(): Promise<{
    totalLogs: number;
    todayLogs: number;
    logsByType: { type: string; count: number }[];
    recentUsers: { user_id: string; user_name: string; count: number }[];
  }> {
    // Total logs
    const [totalResult] = await this.db.query<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM activity_logs"
    );

    // Today's logs
    const [todayResult] = await this.db.query<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM activity_logs WHERE DATE(created_at) = CURDATE()"
    );

    // Logs by type
    const [typeResult] = await this.db.query<RowDataPacket[]>(
      `SELECT type, COUNT(*) as count FROM activity_logs 
       GROUP BY type ORDER BY count DESC`
    );

    // Most active users today
    const [usersResult] = await this.db.query<RowDataPacket[]>(
      `SELECT al.user_id, u.full_name as user_name, COUNT(*) as count 
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.user_id IS NOT NULL AND DATE(al.created_at) = CURDATE()
       GROUP BY al.user_id, u.full_name
       ORDER BY count DESC
       LIMIT 10`
    );

    return {
      totalLogs: totalResult[0].total,
      todayLogs: todayResult[0].total,
      logsByType: typeResult as { type: string; count: number }[],
      recentUsers: usersResult as {
        user_id: string;
        user_name: string;
        count: number;
      }[],
    };
  }

  async getActivityTypes(): Promise<{ type: string; label: string }[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      "SELECT DISTINCT type FROM activity_logs ORDER BY type"
    );

    const typeLabels: Record<string, string> = {
      login: "Đăng nhập",
      logout: "Đăng xuất",
      post_create: "Tạo bài viết",
      post_update: "Cập nhật bài viết",
      post_delete: "Xóa bài viết",
      comment: "Bình luận",
      task_complete: "Hoàn thành task",
      task_create: "Tạo task",
      task_update: "Cập nhật task",
      profile_update: "Cập nhật hồ sơ",
      password_change: "Đổi mật khẩu",
      system: "Hệ thống",
      personnel_change: "Thay đổi nhân sự",
      data_backup: "Sao lưu dữ liệu",
      project_create: "Tạo dự án",
      project_update: "Cập nhật dự án",
      user_create: "Tạo người dùng",
      user_update: "Cập nhật người dùng",
      settings_change: "Thay đổi cài đặt",
    };

    return rows.map((row) => ({
      type: row.type,
      label: typeLabels[row.type] || row.type,
    }));
  }

  async delete(id: string): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      "DELETE FROM activity_logs WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  async deleteMultiple(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE FROM activity_logs WHERE id IN (${placeholders})`,
      ids
    );
    return result.affectedRows;
  }

  async deleteOlderThan(days: number): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );
    return result.affectedRows;
  }
}
