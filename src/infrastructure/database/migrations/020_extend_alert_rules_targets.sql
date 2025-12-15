-- Migration 020: Extend alert_rules with department and user targets
-- Cho phép admin chọn đối tượng nhận cảnh báo cụ thể

-- Add new columns for target selection
ALTER TABLE alert_rules
ADD COLUMN notify_departments JSON DEFAULT NULL COMMENT 'Danh sách ID phòng ban nhận cảnh báo',
ADD COLUMN notify_users JSON DEFAULT NULL COMMENT 'Danh sách ID người dùng cụ thể nhận cảnh báo',
ADD COLUMN created_by CHAR(36) DEFAULT NULL COMMENT 'Admin tạo rule này';

-- Add foreign key for created_by
ALTER TABLE alert_rules
ADD CONSTRAINT fk_alert_rules_created_by
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_alert_rules_created_by ON alert_rules(created_by);
