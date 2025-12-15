import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { dbPool } from "../database/connection.js";
import { createLogger } from "../logging/index.js";

const logger = createLogger("NotificationSettingsRepository");

export interface NotificationSettings {
  id: string;
  user_id: string;
  // Kênh thông báo
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  // Loại thông báo
  notify_on_comment: boolean;
  notify_on_mention: boolean;
  notify_on_task_assign: boolean;
  notify_on_task_update: boolean;
  notify_on_task_complete: boolean;
  notify_on_project_update: boolean;
  notify_on_meeting: boolean;
  notify_on_meeting_invite: boolean;
  notify_on_booking_status: boolean;
  notify_on_news: boolean;
  notify_on_forum_reply: boolean;
  notify_on_chat_message: boolean;
  notify_on_system_alert: boolean;
  notify_on_personnel_change: boolean;
  // Do Not Disturb
  dnd_enabled: boolean;
  dnd_start_time: string;
  dnd_end_time: string;
  dnd_weekends_only: boolean;
  // Email digest
  email_digest_enabled: boolean;
  email_digest_frequency: "daily" | "weekly" | "never";
  created_at: Date;
  updated_at: Date;
}

export interface NotificationSettingsUpdate {
  email_enabled?: boolean;
  push_enabled?: boolean;
  sms_enabled?: boolean;
  in_app_enabled?: boolean;
  notify_on_comment?: boolean;
  notify_on_mention?: boolean;
  notify_on_task_assign?: boolean;
  notify_on_task_update?: boolean;
  notify_on_task_complete?: boolean;
  notify_on_project_update?: boolean;
  notify_on_meeting?: boolean;
  notify_on_meeting_invite?: boolean;
  notify_on_booking_status?: boolean;
  notify_on_news?: boolean;
  notify_on_forum_reply?: boolean;
  notify_on_chat_message?: boolean;
  notify_on_system_alert?: boolean;
  notify_on_personnel_change?: boolean;
  dnd_enabled?: boolean;
  dnd_start_time?: string;
  dnd_end_time?: string;
  dnd_weekends_only?: boolean;
  email_digest_enabled?: boolean;
  email_digest_frequency?: "daily" | "weekly" | "never";
}

export class NotificationSettingsRepository {
  private db = dbPool;

  /**
   * Get notification settings for a user
   * Creates default settings if not exists
   */
  async getByUserId(userId: string): Promise<NotificationSettings> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      "SELECT * FROM user_notification_settings WHERE user_id = ?",
      [userId]
    );

    if (rows.length === 0) {
      // Create default settings
      return await this.createDefault(userId);
    }

    return this.mapRowToSettings(rows[0]);
  }

  /**
   * Create default notification settings for a user
   */
  async createDefault(userId: string): Promise<NotificationSettings> {
    const id = crypto.randomUUID();

    await this.db.query<ResultSetHeader>(
      `INSERT INTO user_notification_settings (id, user_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [id, userId]
    );

    const [rows] = await this.db.query<RowDataPacket[]>(
      "SELECT * FROM user_notification_settings WHERE user_id = ?",
      [userId]
    );

    return this.mapRowToSettings(rows[0]);
  }

  /**
   * Update notification settings
   */
  async update(
    userId: string,
    settings: NotificationSettingsUpdate
  ): Promise<NotificationSettings> {
    // Ensure settings exist
    await this.getByUserId(userId);

    const updateFields: string[] = [];
    const values: any[] = [];

    // Build dynamic update query
    Object.entries(settings).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (updateFields.length > 0) {
      values.push(userId);
      await this.db.query<ResultSetHeader>(
        `UPDATE user_notification_settings 
         SET ${updateFields.join(", ")}, updated_at = NOW()
         WHERE user_id = ?`,
        values
      );
    }

    return await this.getByUserId(userId);
  }

  /**
   * Check if user should receive notification of a specific type
   */
  async shouldNotify(
    userId: string,
    notificationType: string,
    channel: "email" | "push" | "sms" | "in_app" = "in_app"
  ): Promise<boolean> {
    try {
      const settings = await this.getByUserId(userId);

      // Check if channel is enabled
      const channelKey = `${channel}_enabled` as keyof NotificationSettings;
      if (!settings[channelKey]) {
        return false;
      }

      // Check Do Not Disturb
      if (settings.dnd_enabled) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 8);
        const isWeekend = now.getDay() === 0 || now.getDay() === 6;

        if (settings.dnd_weekends_only && !isWeekend) {
          // DND only on weekends, but it's not weekend
        } else {
          // Check time range
          const start = settings.dnd_start_time;
          const end = settings.dnd_end_time;

          if (start > end) {
            // Overnight DND (e.g., 22:00 - 07:00)
            if (currentTime >= start || currentTime <= end) {
              return false;
            }
          } else {
            // Same day DND
            if (currentTime >= start && currentTime <= end) {
              return false;
            }
          }
        }
      }

      // Map notification type to setting key
      const typeToSettingMap: Record<string, keyof NotificationSettings> = {
        comment: "notify_on_comment",
        upvote: "notify_on_comment",
        mention: "notify_on_mention",
        task_assign: "notify_on_task_assign",
        task_update: "notify_on_task_update",
        task_complete: "notify_on_task_complete",
        project_update: "notify_on_project_update",
        meeting: "notify_on_meeting",
        meeting_invite: "notify_on_meeting_invite",
        booking_status: "notify_on_booking_status",
        news: "notify_on_news",
        forum_reply: "notify_on_forum_reply",
        chat_message: "notify_on_chat_message",
        system: "notify_on_system_alert",
        alert: "notify_on_system_alert",
        personnel_change: "notify_on_personnel_change",
      };

      const settingKey = typeToSettingMap[notificationType];
      if (settingKey && settings[settingKey] === false) {
        return false;
      }

      return true;
    } catch (error) {
      // Default to allowing notification if check fails
      logger.error("Error checking notification settings", error as Error, { userId, notificationType, channel });
      return true;
    }
  }

  /**
   * Get users who should receive a specific notification type
   */
  async getUsersToNotify(
    userIds: string[],
    notificationType: string,
    channel: "email" | "push" | "sms" | "in_app" = "in_app"
  ): Promise<string[]> {
    if (userIds.length === 0) return [];

    const channelField = `${channel}_enabled`;
    const typeToSettingMap: Record<string, string> = {
      comment: "notify_on_comment",
      mention: "notify_on_mention",
      task_assign: "notify_on_task_assign",
      task_update: "notify_on_task_update",
      task_complete: "notify_on_task_complete",
      project_update: "notify_on_project_update",
      meeting: "notify_on_meeting",
      meeting_invite: "notify_on_meeting_invite",
      booking_status: "notify_on_booking_status",
      news: "notify_on_news",
      forum_reply: "notify_on_forum_reply",
      chat_message: "notify_on_chat_message",
      system: "notify_on_system_alert",
      alert: "notify_on_system_alert",
      personnel_change: "notify_on_personnel_change",
    };

    const settingField = typeToSettingMap[notificationType] || "in_app_enabled";

    const placeholders = userIds.map(() => "?").join(",");

    // Get users with settings that allow this notification
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT user_id FROM user_notification_settings 
       WHERE user_id IN (${placeholders})
       AND ${channelField} = TRUE
       AND ${settingField} = TRUE`,
      userIds
    );

    const usersWithSettings = rows.map((r) => r.user_id);

    // Users without settings get default (enabled)
    const usersWithoutSettings = userIds.filter(
      (id) => !usersWithSettings.includes(id)
    );

    return [...usersWithSettings, ...usersWithoutSettings];
  }

  /**
   * Delete settings for a user
   */
  async delete(userId: string): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      "DELETE FROM user_notification_settings WHERE user_id = ?",
      [userId]
    );
    return result.affectedRows > 0;
  }

  private mapRowToSettings(row: RowDataPacket): NotificationSettings {
    return {
      id: row.id,
      user_id: row.user_id,
      email_enabled: Boolean(row.email_enabled),
      push_enabled: Boolean(row.push_enabled),
      sms_enabled: Boolean(row.sms_enabled),
      in_app_enabled: Boolean(row.in_app_enabled),
      notify_on_comment: Boolean(row.notify_on_comment),
      notify_on_mention: Boolean(row.notify_on_mention),
      notify_on_task_assign: Boolean(row.notify_on_task_assign),
      notify_on_task_update: Boolean(row.notify_on_task_update),
      notify_on_task_complete: Boolean(row.notify_on_task_complete),
      notify_on_project_update: Boolean(row.notify_on_project_update),
      notify_on_meeting: Boolean(row.notify_on_meeting),
      notify_on_meeting_invite: Boolean(row.notify_on_meeting_invite),
      notify_on_booking_status: Boolean(row.notify_on_booking_status),
      notify_on_news: Boolean(row.notify_on_news),
      notify_on_forum_reply: Boolean(row.notify_on_forum_reply),
      notify_on_chat_message: Boolean(row.notify_on_chat_message),
      notify_on_system_alert: Boolean(row.notify_on_system_alert),
      notify_on_personnel_change: Boolean(row.notify_on_personnel_change),
      dnd_enabled: Boolean(row.dnd_enabled),
      dnd_start_time: row.dnd_start_time || "22:00:00",
      dnd_end_time: row.dnd_end_time || "07:00:00",
      dnd_weekends_only: Boolean(row.dnd_weekends_only),
      email_digest_enabled: Boolean(row.email_digest_enabled),
      email_digest_frequency: row.email_digest_frequency || "never",
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const notificationSettingsRepository =
  new NotificationSettingsRepository();
