import { Request, Response } from "express";
import { AlertRuleRepository } from "../../infrastructure/repositories/AlertRuleRepository.js";
import { alertSchedulerService } from "../../application/services/AlertSchedulerService.js";
import { dbPool } from "../../infrastructure/database/connection.js";
import { RowDataPacket } from "mysql2/promise";

const alertRuleRepository = new AlertRuleRepository();

export const getAlertRules = async (req: Request, res: Response) => {
  try {
    // Seed default rules if empty
    await alertRuleRepository.seedDefaultRules();

    const rules = await alertRuleRepository.findAll();
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error("Error getting alert rules:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách cảnh báo",
    });
  }
};

export const getAlertRuleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await alertRuleRepository.findById(id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy quy tắc cảnh báo",
      });
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    console.error("Error getting alert rule:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy chi tiết cảnh báo",
    });
  }
};

export const createAlertRule = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      category,
      threshold,
      unit,
      notify_roles,
      notify_departments,
      notify_users,
    } = req.body;
    const userId = (req as any).user?.userId;

    if (!name || !category || threshold === undefined || !unit) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc",
      });
    }

    const rule = await alertRuleRepository.create({
      name,
      description,
      category,
      threshold,
      unit,
      notify_roles: notify_roles || [],
      notify_departments: notify_departments || [],
      notify_users: notify_users || [],
      created_by: userId,
    });

    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    console.error("Error creating alert rule:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Tên cảnh báo đã tồn tại",
      });
    }
    res.status(500).json({
      success: false,
      message: "Không thể tạo cảnh báo",
    });
  }
};

export const updateAlertRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      threshold,
      notify_roles,
      notify_departments,
      notify_users,
      is_enabled,
      description,
    } = req.body;

    const rule = await alertRuleRepository.update(id, {
      threshold,
      notify_roles,
      notify_departments,
      notify_users,
      is_enabled,
      description,
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy quy tắc cảnh báo",
      });
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    console.error("Error updating alert rule:", error);
    res.status(500).json({
      success: false,
      message: "Không thể cập nhật cảnh báo",
    });
  }
};

export const toggleAlertRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rule = await alertRuleRepository.toggleEnabled(id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy quy tắc cảnh báo",
      });
    }

    res.json({
      success: true,
      data: rule,
      message: rule.is_enabled ? "Đã bật cảnh báo" : "Đã tắt cảnh báo",
    });
  } catch (error) {
    console.error("Error toggling alert rule:", error);
    res.status(500).json({
      success: false,
      message: "Không thể thay đổi trạng thái cảnh báo",
    });
  }
};

export const deleteAlertRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await alertRuleRepository.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy quy tắc cảnh báo",
      });
    }

    res.json({ success: true, message: "Đã xóa cảnh báo" });
  } catch (error) {
    console.error("Error deleting alert rule:", error);
    res.status(500).json({
      success: false,
      message: "Không thể xóa cảnh báo",
    });
  }
};

// Get alert statistics
export const getAlertStats = async (req: Request, res: Response) => {
  try {
    const rules = await alertRuleRepository.findAll();
    const enabled = rules.filter((r) => r.is_enabled).length;
    const byCategory = {
      HR: rules.filter((r) => r.category === "HR").length,
      System: rules.filter((r) => r.category === "System").length,
      Security: rules.filter((r) => r.category === "Security").length,
    };

    res.json({
      success: true,
      data: {
        total_rules: rules.length,
        enabled_rules: enabled,
        disabled_rules: rules.length - enabled,
        by_category: Object.entries(byCategory).map(([category, count]) => ({
          category,
          count,
        })),
        alerts_triggered_today: 0, // TODO: implement alert history tracking
        alerts_triggered_week: 0,
      },
    });
  } catch (error) {
    console.error("Error getting alert stats:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy thống kê cảnh báo",
    });
  }
};

// Get alert history (placeholder)
export const getAlertHistory = async (req: Request, res: Response) => {
  try {
    // TODO: implement alert history tracking in database
    res.json({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error("Error getting alert history:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy lịch sử cảnh báo",
    });
  }
};

// Test a specific alert rule
export const testAlertRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await alertSchedulerService.testRule(id);

    if (!result) {
      return res.json({
        success: true,
        data: null,
        message:
          "Không có dữ liệu nào thỏa mãn điều kiện cảnh báo này hoặc rule chưa được hỗ trợ",
      });
    }

    res.json({
      success: true,
      data: result,
      message: `Tìm thấy ${result.affectedItems.length} mục cần cảnh báo`,
    });
  } catch (error) {
    console.error("Error testing alert rule:", error);
    res.status(500).json({
      success: false,
      message: "Không thể kiểm tra quy tắc cảnh báo",
    });
  }
};

// Manually trigger alert check for all rules
export const triggerAlertCheck = async (req: Request, res: Response) => {
  try {
    await alertSchedulerService.checkAllRules();
    res.json({
      success: true,
      message: "Đã kích hoạt kiểm tra tất cả cảnh báo",
    });
  } catch (error) {
    console.error("Error triggering alert check:", error);
    res.status(500).json({
      success: false,
      message: "Không thể kích hoạt kiểm tra cảnh báo",
    });
  }
};

// Get alerts applicable to current user
export const getMyAlerts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    console.log("🔔 getMyAlerts - userId:", userId);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get user info
    const [userRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, role, department_id FROM users WHERE id = ?`,
      [userId]
    );

    if (userRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const user = userRows[0];
    console.log("🔔 getMyAlerts - user:", {
      id: user.id,
      role: user.role,
      department_id: user.department_id,
    });

    const rules = await alertRuleRepository.findForUser(
      userId,
      user.role,
      user.department_id
    );
    console.log("🔔 getMyAlerts - found rules:", rules.length);

    // Get unread count from alert_history for this user
    const [unreadRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM alert_history ah
       WHERE JSON_CONTAINS(ah.notified_users, JSON_QUOTE(?))
         AND ah.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND NOT EXISTS (
           SELECT 1 FROM notifications n 
           WHERE n.related_id = ah.rule_id 
             AND n.user_id = ? 
             AND n.is_read = TRUE
         )`,
      [userId, userId]
    );

    res.json({
      success: true,
      data: {
        rules,
        unreadCount: unreadRows[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error("Error getting user alerts:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách cảnh báo",
    });
  }
};

// Get departments list for dropdown
export const getDepartmentsForAlert = async (req: Request, res: Response) => {
  try {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, name, code FROM departments WHERE deleted_at IS NULL ORDER BY name`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error getting departments:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách phòng ban",
    });
  }
};

// Get users list for dropdown
export const getUsersForAlert = async (req: Request, res: Response) => {
  try {
    const { department_id } = req.query;

    let query = `SELECT id, full_name, email, role, department_id 
                 FROM users 
                 WHERE status = 'Active' AND deleted_at IS NULL`;
    const params: any[] = [];

    if (department_id) {
      query += ` AND department_id = ?`;
      params.push(department_id);
    }

    query += ` ORDER BY full_name`;

    const [rows] = await dbPool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách người dùng",
    });
  }
};
