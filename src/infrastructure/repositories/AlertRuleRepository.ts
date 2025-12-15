import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { dbPool } from "../database/connection.js";

export interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  category: "HR" | "System" | "Security";
  threshold: number;
  unit: "days" | "percent" | "count";
  notify_roles: string[];
  notify_departments: string[];
  notify_users: string[];
  created_by: string | null;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export class AlertRuleRepository {
  private db = dbPool;

  // Helper to parse JSON arrays - handles JSON array, comma-separated string, or already-parsed array
  private parseJsonArray(value: unknown): string[] {
    if (!value) return [];
    // Already an array
    if (Array.isArray(value)) return value;
    // Not a string, return empty
    if (typeof value !== "string") return [];
    // Try JSON parse first
    if (value.startsWith("[")) {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    // Otherwise treat as comma-separated string
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private mapRow(row: RowDataPacket): AlertRule {
    return {
      ...row,
      notify_roles: this.parseJsonArray(row.notify_roles),
      notify_departments: this.parseJsonArray(row.notify_departments),
      notify_users: this.parseJsonArray(row.notify_users),
      is_enabled: Boolean(row.is_enabled),
    } as AlertRule;
  }

  async findAll(): Promise<AlertRule[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM alert_rules ORDER BY category, name`
    );
    return rows.map((row) => this.mapRow(row));
  }

  // Tìm rules áp dụng cho user cụ thể (theo role, department, hoặc được chỉ định trực tiếp)
  async findForUser(
    userId: string,
    userRole: string,
    departmentId: string | null
  ): Promise<AlertRule[]> {
    // Make role matching case-insensitive
    const roleVariants = [
      userRole,
      userRole.toLowerCase(),
      userRole.charAt(0).toUpperCase() + userRole.slice(1).toLowerCase(),
    ];

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT DISTINCT ar.* FROM alert_rules ar
       WHERE ar.is_enabled = TRUE
         AND (
           -- Match by role (case-insensitive)
           LOWER(ar.notify_roles) LIKE CONCAT('%', LOWER(?), '%')
           -- Match by department (if user has a department)
           OR (? IS NOT NULL AND LOWER(ar.notify_departments) LIKE CONCAT('%', LOWER(?), '%'))
           -- Match by specific user
           OR LOWER(ar.notify_users) LIKE CONCAT('%', LOWER(?), '%')
         )
       ORDER BY ar.category, ar.name`,
      [userRole, departmentId, departmentId, userId]
    );
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id: string): Promise<AlertRule | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM alert_rules WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  async create(data: {
    name: string;
    description?: string;
    category: "HR" | "System" | "Security";
    threshold: number;
    unit: "days" | "percent" | "count";
    notify_roles: string[];
    notify_departments?: string[];
    notify_users?: string[];
    created_by?: string;
    is_enabled?: boolean;
  }): Promise<AlertRule> {
    const id = crypto.randomUUID();
    await this.db.query<ResultSetHeader>(
      `INSERT INTO alert_rules (id, name, description, category, threshold, unit, notify_roles, notify_departments, notify_users, created_by, is_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || null,
        data.category,
        data.threshold,
        data.unit,
        JSON.stringify(data.notify_roles),
        JSON.stringify(data.notify_departments || []),
        JSON.stringify(data.notify_users || []),
        data.created_by || null,
        data.is_enabled !== false,
      ]
    );
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    data: {
      threshold?: number;
      notify_roles?: string[];
      notify_departments?: string[];
      notify_users?: string[];
      is_enabled?: boolean;
      description?: string;
    }
  ): Promise<AlertRule | null> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.threshold !== undefined) {
      updates.push("threshold = ?");
      values.push(data.threshold);
    }
    if (data.notify_roles !== undefined) {
      updates.push("notify_roles = ?");
      values.push(JSON.stringify(data.notify_roles));
    }
    if (data.notify_departments !== undefined) {
      updates.push("notify_departments = ?");
      values.push(JSON.stringify(data.notify_departments));
    }
    if (data.notify_users !== undefined) {
      updates.push("notify_users = ?");
      values.push(JSON.stringify(data.notify_users));
    }
    if (data.is_enabled !== undefined) {
      updates.push("is_enabled = ?");
      values.push(data.is_enabled);
    }
    if (data.description !== undefined) {
      updates.push("description = ?");
      values.push(data.description);
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    await this.db.query<ResultSetHeader>(
      `UPDATE alert_rules SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  async toggleEnabled(id: string): Promise<AlertRule | null> {
    await this.db.query<ResultSetHeader>(
      `UPDATE alert_rules SET is_enabled = NOT is_enabled WHERE id = ?`,
      [id]
    );
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE FROM alert_rules WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }

  async seedDefaultRules(): Promise<void> {
    const [existing] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM alert_rules`
    );

    if (existing[0].count > 0) return;

    const defaultRules = [
      // HR Category
      {
        name: "Hợp đồng sắp hết hạn",
        description:
          "Cảnh báo khi hợp đồng lao động sắp hết hạn trong vòng số ngày thiết lập",
        category: "HR",
        threshold: 30,
        unit: "days",
        notify_roles: ["Admin", "Manager"],
      },
      {
        name: "Sinh nhật nhân viên",
        description:
          "Thông báo sinh nhật nhân viên trong tuần để chuẩn bị quà chúc mừng",
        category: "HR",
        threshold: 7,
        unit: "days",
        notify_roles: ["Admin", "Manager", "Employee"],
      },
      {
        name: "Nhân viên nghỉ phép dài",
        description:
          "Thông báo khi nhân viên nghỉ phép liên tục quá số ngày quy định",
        category: "HR",
        threshold: 5,
        unit: "days",
        notify_roles: ["Admin", "Manager"],
      },
      {
        name: "Nhân viên mới chưa hoàn thành onboarding",
        description:
          "Cảnh báo khi nhân viên mới chưa hoàn thành các bước onboarding",
        category: "HR",
        threshold: 14,
        unit: "days",
        notify_roles: ["Admin", "Manager"],
      },
      {
        name: "Đánh giá KPI định kỳ",
        description: "Nhắc nhở thời hạn đánh giá KPI hàng quý/năm",
        category: "HR",
        threshold: 7,
        unit: "days",
        notify_roles: ["Admin", "Manager"],
      },
      // System Category
      {
        name: "Task quá hạn",
        description:
          "Cảnh báo khi có task đã quá hạn deadline mà chưa hoàn thành",
        category: "System",
        threshold: 0,
        unit: "days",
        notify_roles: ["Manager"],
      },
      {
        name: "Dự án chậm tiến độ",
        description:
          "Cảnh báo khi tiến độ thực tế thấp hơn kế hoạch theo phần trăm",
        category: "System",
        threshold: 20,
        unit: "percent",
        notify_roles: ["Admin", "Manager"],
      },
      {
        name: "Sao lưu dữ liệu định kỳ",
        description: "Nhắc nhở sao lưu dữ liệu hệ thống định kỳ",
        category: "System",
        threshold: 7,
        unit: "days",
        notify_roles: ["Admin"],
      },
      {
        name: "Phòng họp chưa được xác nhận",
        description:
          "Cảnh báo khi có đặt phòng họp chưa được xác nhận gần thời gian",
        category: "System",
        threshold: 1,
        unit: "days",
        notify_roles: ["Admin", "Manager"],
      },
      {
        name: "Dự án sắp đến deadline",
        description:
          "Thông báo khi dự án sắp đến deadline trong số ngày thiết lập",
        category: "System",
        threshold: 3,
        unit: "days",
        notify_roles: ["Admin", "Manager"],
      },
      // Security Category
      {
        name: "Đăng nhập thất bại nhiều lần",
        description:
          "Cảnh báo khi có nhiều lần đăng nhập thất bại từ một tài khoản/IP",
        category: "Security",
        threshold: 5,
        unit: "count",
        notify_roles: ["Admin"],
      },
      {
        name: "Phiên đăng nhập bất thường",
        description:
          "Cảnh báo khi phát hiện đăng nhập từ thiết bị hoặc vị trí lạ",
        category: "Security",
        threshold: 1,
        unit: "count",
        notify_roles: ["Admin"],
      },
      {
        name: "Thay đổi quyền người dùng",
        description: "Thông báo khi có thay đổi về quyền hạn của người dùng",
        category: "Security",
        threshold: 1,
        unit: "count",
        notify_roles: ["Admin"],
      },
      {
        name: "Xóa dữ liệu hàng loạt",
        description: "Cảnh báo khi có hành động xóa nhiều dữ liệu cùng lúc",
        category: "Security",
        threshold: 10,
        unit: "count",
        notify_roles: ["Admin"],
      },
      {
        name: "Truy cập ngoài giờ làm việc",
        description:
          "Ghi nhận khi có truy cập hệ thống ngoài giờ làm việc bình thường",
        category: "Security",
        threshold: 1,
        unit: "count",
        notify_roles: ["Admin"],
      },
    ];

    for (const rule of defaultRules) {
      await this.create(rule as any);
    }
  }
}
