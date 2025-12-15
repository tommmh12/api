import { dbPool } from "../../infrastructure/database/connection.js";
import { RowDataPacket } from "mysql2";

export class NotificationService {
    private db = dbPool;

    async notifyUser(userId: string, title: string, message: string, type: string, relatedId?: string) {
        const query = `
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES (?, ?, ?, ?, ?)
    `;
        await this.db.query(query, [userId, title, message, type, relatedId || null]);
    }

    async notifyUsers(userIds: string[], title: string, message: string, type: string, relatedId?: string) {
        if (userIds.length === 0) return;

        const values = userIds.map(uid => [uid, title, message, type, relatedId || null]);
        const query = `
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES ?
    `;
        await this.db.query(query, [values]);
    }

    async getUserNotifications(userId: string, limit = 20) {
        // Check if table exists first to avoid crashes during migration gaps
        // (Optional safety check, but assuming migration ran)
        const query = `
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
        const [rows] = await this.db.query<RowDataPacket[]>(query, [userId, limit]);
        return rows;
    }

    async markAsRead(notificationId: string) {
        await this.db.query(`UPDATE notifications SET is_read = TRUE WHERE id = ?`, [notificationId]);
    }

    async markAllAsRead(userId: string) {
        await this.db.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = ?`, [userId]);
    }

}

export const notificationService = new NotificationService();

