import { ActivityLogService } from "../application/services/ActivityLogService.js";
import { ActivityLogRepository } from "../infrastructure/repositories/ActivityLogRepository.js";
import { createLogger } from "../infrastructure/logging/index.js";

const activityLogRepository = new ActivityLogRepository();
const activityLogService = new ActivityLogService(activityLogRepository);
const auditLoggerInstance = createLogger('audit-logger');

export interface AuditLogData {
  userId?: string | null;
  type: string;
  content: string;
  target?: string;
  ipAddress?: string;
  meta?: {
    action?: string;
    entity?: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    [key: string]: any;
  };
}

/**
 * Helper function to log audit activities
 * Usage: await auditLogger.log({ userId, type: 'personnel_change', content: '...', ... })
 */
export const auditLogger = {
  log: async (data: AuditLogData): Promise<void> => {
    try {
      await activityLogService.logActivity({
        user_id: data.userId || null,
        type: data.type,
        content: data.content,
        target: data.target,
        ip_address: data.ipAddress,
        meta: data.meta,
      });
    } catch (error) {
      // Don't throw error if logging fails, just log to structured logger
      auditLoggerInstance.error("Failed to write audit log", error as Error, { type: data.type });
    }
  },

  // Convenience methods for common actions
  logUserCreate: async (
    userId: string | null,
    targetUserId: string,
    userName: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "personnel_change",
      content: `Tạo nhân viên mới: ${userName}`,
      target: userName,
      ipAddress,
      meta: {
        action: "create",
        entity: "user",
        entityId: targetUserId,
      },
    });
  },

  logUserUpdate: async (
    userId: string | null,
    targetUserId: string,
    userName: string,
    changes: any,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "personnel_change",
      content: `Cập nhật thông tin nhân viên: ${userName}`,
      target: userName,
      ipAddress,
      meta: {
        action: "update",
        entity: "user",
        entityId: targetUserId,
        changes,
      },
    });
  },

  logUserDelete: async (
    userId: string | null,
    targetUserId: string,
    userName: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "personnel_change",
      content: `Xóa nhân viên: ${userName}`,
      target: userName,
      ipAddress,
      meta: {
        action: "delete",
        entity: "user",
        entityId: targetUserId,
      },
    });
  },

  logDepartmentCreate: async (
    userId: string | null,
    deptId: string,
    deptName: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "system",
      content: `Tạo phòng ban mới: ${deptName}`,
      target: deptName,
      ipAddress,
      meta: {
        action: "create",
        entity: "department",
        entityId: deptId,
      },
    });
  },

  logDepartmentUpdate: async (
    userId: string | null,
    deptId: string,
    deptName: string,
    changes: any,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "system",
      content: `Cập nhật phòng ban: ${deptName}`,
      target: deptName,
      ipAddress,
      meta: {
        action: "update",
        entity: "department",
        entityId: deptId,
        changes,
      },
    });
  },

  logDepartmentDelete: async (
    userId: string | null,
    deptId: string,
    deptName: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "system",
      content: `Xóa phòng ban: ${deptName}`,
      target: deptName,
      ipAddress,
      meta: {
        action: "delete",
        entity: "department",
        entityId: deptId,
      },
    });
  },

  // === LOGIN & AUTH ===
  logLogin: async (
    userId: string,
    userName: string,
    ipAddress?: string,
    userAgent?: string,
    success: boolean = true
  ) => {
    await auditLogger.log({
      userId,
      type: success ? "login" : "login_failed",
      content: success
        ? `Đăng nhập thành công: ${userName}`
        : `Đăng nhập thất bại: ${userName}`,
      target: userName,
      ipAddress,
      meta: {
        action: success ? "login" : "login_failed",
        userAgent,
        success,
      },
    });
  },

  logLogout: async (userId: string, userName: string, ipAddress?: string) => {
    await auditLogger.log({
      userId,
      type: "logout",
      content: `Đăng xuất: ${userName}`,
      target: userName,
      ipAddress,
      meta: { action: "logout" },
    });
  },

  logPasswordChange: async (
    userId: string,
    userName: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "password_change",
      content: `Đổi mật khẩu: ${userName}`,
      target: userName,
      ipAddress,
      meta: { action: "password_change" },
    });
  },

  // === PROJECTS ===
  logProjectCreate: async (
    userId: string | null,
    projectId: string,
    projectName: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "project_create",
      content: `Tạo dự án mới: ${projectName}`,
      target: projectName,
      ipAddress,
      meta: { action: "create", entity: "project", entityId: projectId },
    });
  },

  logProjectUpdate: async (
    userId: string | null,
    projectId: string,
    projectName: string,
    changes: any,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "project_update",
      content: `Cập nhật dự án: ${projectName}`,
      target: projectName,
      ipAddress,
      meta: {
        action: "update",
        entity: "project",
        entityId: projectId,
        changes,
      },
    });
  },

  logProjectDelete: async (
    userId: string | null,
    projectId: string,
    projectName: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "project_delete",
      content: `Xóa dự án: ${projectName}`,
      target: projectName,
      ipAddress,
      meta: { action: "delete", entity: "project", entityId: projectId },
    });
  },

  // === TASKS ===
  logTaskCreate: async (
    userId: string | null,
    taskId: string,
    taskTitle: string,
    projectName: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "task_create",
      content: `Tạo task: ${taskTitle} (${projectName})`,
      target: taskTitle,
      ipAddress,
      meta: {
        action: "create",
        entity: "task",
        entityId: taskId,
        project: projectName,
      },
    });
  },

  logTaskUpdate: async (
    userId: string | null,
    taskId: string,
    taskTitle: string,
    changes: any,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "task_update",
      content: `Cập nhật task: ${taskTitle}`,
      target: taskTitle,
      ipAddress,
      meta: { action: "update", entity: "task", entityId: taskId, changes },
    });
  },

  logTaskComplete: async (
    userId: string | null,
    taskId: string,
    taskTitle: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "task_complete",
      content: `Hoàn thành task: ${taskTitle}`,
      target: taskTitle,
      ipAddress,
      meta: { action: "complete", entity: "task", entityId: taskId },
    });
  },

  // === BOOKING ===
  logBookingCreate: async (
    userId: string | null,
    bookingId: string,
    roomName: string,
    date: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "booking_create",
      content: `Đặt phòng: ${roomName} ngày ${date}`,
      target: roomName,
      ipAddress,
      meta: { action: "create", entity: "booking", entityId: bookingId, date },
    });
  },

  logBookingApprove: async (
    userId: string | null,
    bookingId: string,
    roomName: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "booking_approve",
      content: `Duyệt đặt phòng: ${roomName}`,
      target: roomName,
      ipAddress,
      meta: { action: "approve", entity: "booking", entityId: bookingId },
    });
  },

  logBookingReject: async (
    userId: string | null,
    bookingId: string,
    roomName: string,
    reason?: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "booking_reject",
      content: `Từ chối đặt phòng: ${roomName}`,
      target: roomName,
      ipAddress,
      meta: {
        action: "reject",
        entity: "booking",
        entityId: bookingId,
        reason,
      },
    });
  },

  logBookingCancel: async (
    userId: string | null,
    bookingId: string,
    roomName: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "booking_cancel",
      content: `Hủy đặt phòng: ${roomName}`,
      target: roomName,
      ipAddress,
      meta: { action: "cancel", entity: "booking", entityId: bookingId },
    });
  },

  // === NEWS ===
  logNewsCreate: async (
    userId: string | null,
    newsId: string,
    title: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "news_create",
      content: `Tạo bài viết: ${title}`,
      target: title,
      ipAddress,
      meta: { action: "create", entity: "news", entityId: newsId },
    });
  },

  logNewsPublish: async (
    userId: string | null,
    newsId: string,
    title: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "news_publish",
      content: `Xuất bản bài viết: ${title}`,
      target: title,
      ipAddress,
      meta: { action: "publish", entity: "news", entityId: newsId },
    });
  },

  // === FORUM ===
  logForumPost: async (
    userId: string | null,
    postId: string,
    title: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "forum_post",
      content: `Đăng bài diễn đàn: ${title}`,
      target: title,
      ipAddress,
      meta: { action: "create", entity: "forum_post", entityId: postId },
    });
  },

  logForumModerate: async (
    userId: string | null,
    postId: string,
    title: string,
    action: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "forum_moderate",
      content: `Kiểm duyệt bài viết: ${title} - ${action}`,
      target: title,
      ipAddress,
      meta: { action, entity: "forum_post", entityId: postId },
    });
  },

  // === MEETINGS ===
  logMeetingCreate: async (
    userId: string | null,
    meetingId: string,
    title: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "meeting_create",
      content: `Tạo cuộc họp: ${title}`,
      target: title,
      ipAddress,
      meta: { action: "create", entity: "meeting", entityId: meetingId },
    });
  },

  logMeetingJoin: async (
    userId: string | null,
    meetingId: string,
    title: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "meeting_join",
      content: `Tham gia cuộc họp: ${title}`,
      target: title,
      ipAddress,
      meta: { action: "join", entity: "meeting", entityId: meetingId },
    });
  },

  // === FILES ===
  logFileUpload: async (
    userId: string | null,
    fileName: string,
    fileSize: number,
    context: string,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "file_upload",
      content: `Tải lên file: ${fileName}`,
      target: fileName,
      ipAddress,
      meta: { action: "upload", entity: "file", fileName, fileSize, context },
    });
  },

  // === SETTINGS ===
  logSettingsChange: async (
    userId: string | null,
    settingKey: string,
    oldValue: any,
    newValue: any,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "settings_change",
      content: `Thay đổi cài đặt: ${settingKey}`,
      target: settingKey,
      ipAddress,
      meta: {
        action: "update",
        entity: "settings",
        settingKey,
        oldValue,
        newValue,
      },
    });
  },

  // === SECURITY ===
  logSecurityAlert: async (
    userId: string | null,
    alertType: string,
    description: string,
    ipAddress?: string,
    meta?: any
  ) => {
    await auditLogger.log({
      userId,
      type: "security_alert",
      content: `Cảnh báo bảo mật: ${alertType} - ${description}`,
      target: alertType,
      ipAddress,
      meta: { action: "alert", entity: "security", alertType, ...meta },
    });
  },

  // === PROFILE ===
  logProfileUpdate: async (
    userId: string,
    userName: string,
    changes: any,
    ipAddress?: string
  ) => {
    await auditLogger.log({
      userId,
      type: "profile_update",
      content: `Cập nhật hồ sơ: ${userName}`,
      target: userName,
      ipAddress,
      meta: { action: "update", entity: "profile", changes },
    });
  },
};
