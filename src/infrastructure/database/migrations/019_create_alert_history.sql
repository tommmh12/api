-- Migration 019: Create alert_history table
-- Lưu lịch sử các cảnh báo đã được kích hoạt

CREATE TABLE IF NOT EXISTS alert_history (
    id VARCHAR(36) PRIMARY KEY,
    rule_id VARCHAR(36) NOT NULL,
    message TEXT NOT NULL,
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    affected_count INT DEFAULT 0,
    notified_users JSON,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(36) NULL,
    acknowledged_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_rule_id (rule_id),
    INDEX idx_created_at (created_at),
    INDEX idx_priority (priority)
);
