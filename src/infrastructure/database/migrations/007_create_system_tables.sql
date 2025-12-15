-- =====================================================
-- Module: System & Settings
-- Tables: notifications, activity_logs, alert_rules,
--         backup_files, system_settings
-- =====================================================

USE nexus_db;

-- Table: notifications
CREATE TABLE notifications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    type ENUM('comment', 'upvote', 'mention', 'system') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    actor_id CHAR(36),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_notifications_user (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: activity_logs
CREATE TABLE activity_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36),
    type ENUM('post_create', 'comment', 'task_complete', 'login', 'profile_update', 'system', 'personnel_change', 'data_backup') NOT NULL,
    content TEXT NOT NULL,
    target VARCHAR(255),
    ip_address VARCHAR(45),
    meta JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_activity_logs_user (user_id, created_at),
    INDEX idx_activity_logs_type (type, created_at),
    INDEX idx_activity_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: alert_rules
CREATE TABLE alert_rules (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category ENUM('HR', 'System', 'Security') NOT NULL,
    threshold DECIMAL(10,2) NOT NULL,
    unit ENUM('days', 'percent', 'count') NOT NULL,
    notify_roles JSON,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: backup_files
CREATE TABLE backup_files (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    type ENUM('Full', 'Incremental') NOT NULL,
    status ENUM('Pending', 'Success', 'Failed') DEFAULT 'Pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: system_settings
CREATE TABLE system_settings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    `key` VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_by CHAR(36),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
