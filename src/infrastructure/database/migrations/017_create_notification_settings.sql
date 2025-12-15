-- =====================================================
-- Module: User Notification Settings
-- Description: Cho phép người dùng tùy chỉnh loại thông báo muốn nhận
-- =====================================================

USE nexus_db;

-- Table: user_notification_settings - Cài đặt thông báo theo người dùng
CREATE TABLE IF NOT EXISTS user_notification_settings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL UNIQUE,
    
    -- Kênh nhận thông báo
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    
    -- Các loại thông báo muốn nhận
    notify_on_comment BOOLEAN DEFAULT TRUE,         -- Khi có người bình luận
    notify_on_mention BOOLEAN DEFAULT TRUE,         -- Khi được @mention
    notify_on_task_assign BOOLEAN DEFAULT TRUE,     -- Khi được giao task mới
    notify_on_task_update BOOLEAN DEFAULT TRUE,     -- Khi task được cập nhật
    notify_on_task_complete BOOLEAN DEFAULT TRUE,   -- Khi task hoàn thành
    notify_on_project_update BOOLEAN DEFAULT TRUE,  -- Khi dự án có thay đổi
    notify_on_meeting BOOLEAN DEFAULT TRUE,         -- Cuộc họp sắp diễn ra
    notify_on_meeting_invite BOOLEAN DEFAULT TRUE,  -- Được mời vào cuộc họp
    notify_on_booking_status BOOLEAN DEFAULT TRUE,  -- Trạng thái đặt phòng
    notify_on_news BOOLEAN DEFAULT TRUE,            -- Tin tức mới
    notify_on_forum_reply BOOLEAN DEFAULT TRUE,     -- Trả lời bài đăng forum
    notify_on_chat_message BOOLEAN DEFAULT TRUE,    -- Tin nhắn mới
    notify_on_system_alert BOOLEAN DEFAULT TRUE,    -- Cảnh báo hệ thống
    notify_on_personnel_change BOOLEAN DEFAULT TRUE, -- Thay đổi nhân sự phòng ban
    
    -- Lịch không làm phiền (Do Not Disturb)
    dnd_enabled BOOLEAN DEFAULT FALSE,
    dnd_start_time TIME DEFAULT '22:00:00',
    dnd_end_time TIME DEFAULT '07:00:00',
    dnd_weekends_only BOOLEAN DEFAULT FALSE,
    
    -- Digest/Tổng hợp thông báo
    email_digest_enabled BOOLEAN DEFAULT FALSE,
    email_digest_frequency ENUM('daily', 'weekly', 'never') DEFAULT 'never',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_notification_settings_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm cột related_id vào notifications nếu chưa có
-- Đã có trong 007_create_system_tables.sql

-- Cập nhật bảng notifications để hỗ trợ thêm nhiều loại
ALTER TABLE notifications 
    MODIFY COLUMN type ENUM(
        'comment', 'upvote', 'mention', 'system',
        'task_assign', 'task_update', 'task_complete',
        'project_update', 'meeting', 'meeting_invite',
        'booking_status', 'news', 'forum_reply', 
        'chat_message', 'personnel_change', 'alert'
    ) NOT NULL;

-- Thêm trường category cho dễ filter
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL;

-- Index cho performance
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(user_id, category, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(user_id, priority, created_at);

-- Cập nhật activity_logs để có thêm nhiều loại
ALTER TABLE activity_logs 
    MODIFY COLUMN type ENUM(
        'post_create', 'post_update', 'post_delete',
        'comment', 'comment_delete',
        'task_create', 'task_update', 'task_complete', 'task_delete',
        'project_create', 'project_update', 'project_delete',
        'login', 'logout', 'login_failed',
        'profile_update', 'password_change',
        'system', 'settings_change',
        'personnel_change', 'user_create', 'user_update', 'user_delete',
        'department_create', 'department_update', 'department_delete',
        'data_backup', 'data_restore',
        'booking_create', 'booking_update', 'booking_cancel', 'booking_approve', 'booking_reject',
        'meeting_create', 'meeting_join', 'meeting_end',
        'news_create', 'news_update', 'news_delete', 'news_publish',
        'forum_post', 'forum_moderate',
        'chat_create', 'file_upload', 'file_delete',
        'security_alert', 'permission_change'
    ) NOT NULL;

-- Thêm trường để track session và device
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS device_info JSON;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS duration_ms INT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS status ENUM('success', 'failed', 'pending') DEFAULT 'success';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Index cho tìm kiếm
CREATE INDEX IF NOT EXISTS idx_activity_logs_session ON activity_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs(status, created_at);

