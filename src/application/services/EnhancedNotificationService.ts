import { dbPool } from "../../infrastructure/database/connection.js";
import { RowDataPacket } from "mysql2";
import {
  notificationSettingsRepository,
  NotificationSettingsUpdate,
} from "../../infrastructure/repositories/NotificationSettingsRepository.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const notificationLogger = createLogger('notification-service');

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: string;
  relatedId?: string;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  link?: string;
  actorId?: string;
  expiresAt?: Date;
}

export class EnhancedNotificationService {
  private db = dbPool;

  /**
   * Gửi thông báo cho một người dùng với kiểm tra cài đặt
   */
  async notifyUser(data: NotificationData): Promise<boolean> {
    // Kiểm tra xem người dùng có muốn nhận loại thông báo này không
    const shouldNotify = await notificationSettingsRepository.shouldNotify(
      data.userId,
      data.type,
      "in_app"
    );

    if (!shouldNotify) {
      notificationLogger.debug("User has disabled notifications for type", { 
        userId: data.userId, 
        type: data.type 
      });
      return false;
    }

    const query = `
      INSERT INTO notifications (user_id, title, message, type, related_id, category, priority, link, actor_id, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.query(query, [
      data.userId,
      data.title,
      data.message,
      data.type,
      data.relatedId || null,
      data.category || "general",
      data.priority || "normal",
      data.link || null,
      data.actorId || null,
      data.expiresAt || null,
    ]);

    return true;
  }

  /**
   * Gửi thông báo cho nhiều người dùng với kiểm tra cài đặt
   */
  async notifyUsers(
    userIds: string[],
    data: Omit<NotificationData, "userId">
  ): Promise<number> {
    if (userIds.length === 0) return 0;

    // Lọc người dùng theo cài đặt thông báo
    const eligibleUsers = await notificationSettingsRepository.getUsersToNotify(
      userIds,
      data.type,
      "in_app"
    );

    if (eligibleUsers.length === 0) {
      notificationLogger.debug("No users eligible for notification type", { type: data.type });
      return 0;
    }

    const values = eligibleUsers.map((uid) => [
      uid,
      data.title,
      data.message,
      data.type,
      data.relatedId || null,
      data.category || "general",
      data.priority || "normal",
      data.link || null,
      data.actorId || null,
      data.expiresAt || null,
    ]);

    const query = `
      INSERT INTO notifications (user_id, title, message, type, related_id, category, priority, link, actor_id, expires_at)
      VALUES ?
    `;

    await this.db.query(query, [values]);
    return eligibleUsers.length;
  }

  /**
   * Lấy thông báo cho người dùng với phân trang và filter
   */
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      category?: string;
      type?: string;
      search?: string;
    } = {}
  ): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
    const {
      limit = 20,
      offset = 0,
      unreadOnly = false,
      category,
      type,
      search,
    } = options;

    let whereClause = "WHERE n.user_id = ?";
    const params: any[] = [userId];

    if (unreadOnly) {
      whereClause += " AND n.is_read = FALSE";
    }

    if (category) {
      whereClause += " AND n.category = ?";
      params.push(category);
    }

    if (type) {
      whereClause += " AND n.type = ?";
      params.push(type);
    }

    if (search) {
      whereClause += " AND (n.title LIKE ? OR n.message LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    // Filter out expired notifications
    whereClause += " AND (n.expires_at IS NULL OR n.expires_at > NOW())";

    // Get total count
    const [countResult] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM notifications n ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get unread count
    const [unreadResult] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = ? AND is_read = FALSE 
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    );
    const unreadCount = unreadResult[0].count;

    // Get paginated notifications with actor info
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        n.*,
        u.full_name as actor_name,
        u.avatar_url as actor_avatar
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      notifications: rows,
      total,
      unreadCount,
    };
  }

  /**
   * Đánh dấu thông báo đã đọc
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = ?`,
      [notificationId]
    );
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc
   */
  async markAllAsRead(userId: string, category?: string): Promise<number> {
    let query = `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE`;
    const params: any[] = [userId];

    if (category) {
      query += " AND category = ?";
      params.push(category);
    }

    const [result] = await this.db.query<any>(query, params);
    return result.affectedRows || 0;
  }

  /**
   * Xóa thông báo
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await this.db.query(`DELETE FROM notifications WHERE id = ?`, [
      notificationId,
    ]);
  }

  /**
   * Xóa tất cả thông báo đã đọc của user
   */
  async deleteAllRead(userId: string): Promise<number> {
    const [result] = await this.db.query<any>(
      `DELETE FROM notifications WHERE user_id = ? AND is_read = TRUE`,
      [userId]
    );
    return result.affectedRows || 0;
  }

  /**
   * Xóa thông báo cũ (cleanup job)
   */
  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    const [result] = await this.db.query<any>(
      `DELETE FROM notifications 
       WHERE (is_read = TRUE AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY))
       OR (expires_at IS NOT NULL AND expires_at < NOW())`,
      [daysOld]
    );
    return result.affectedRows || 0;
  }

  /**
   * Lấy cài đặt thông báo của người dùng
   */
  async getSettings(userId: string) {
    return await notificationSettingsRepository.getByUserId(userId);
  }

  /**
   * Cập nhật cài đặt thông báo
   */
  async updateSettings(userId: string, settings: NotificationSettingsUpdate) {
    return await notificationSettingsRepository.update(userId, settings);
  }

  /**
   * Thống kê thông báo
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byCategory: { category: string; count: number }[];
    byType: { type: string; count: number }[];
  }> {
    const [totalResult] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM notifications WHERE user_id = ?`,
      [userId]
    );

    const [unreadResult] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );

    const [categoryResult] = await this.db.query<RowDataPacket[]>(
      `SELECT COALESCE(category, 'general') as category, COUNT(*) as count 
       FROM notifications WHERE user_id = ? GROUP BY category`,
      [userId]
    );

    const [typeResult] = await this.db.query<RowDataPacket[]>(
      `SELECT type, COUNT(*) as count 
       FROM notifications WHERE user_id = ? GROUP BY type ORDER BY count DESC`,
      [userId]
    );

    return {
      total: totalResult[0].total,
      unread: unreadResult[0].count,
      byCategory: categoryResult as { category: string; count: number }[],
      byType: typeResult as { type: string; count: number }[],
    };
  }
}

export const enhancedNotificationService = new EnhancedNotificationService();
