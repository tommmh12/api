-- =====================================================
-- Migration: 028_add_checklist_audit_fields
-- Description: Add audit fields to task_checklist_items table
--              and create checklist_state_history table
-- Requirements: 11.1 - Record who completed checklist item and when
-- Requirements: 11.3 - Log changes when item is unchecked after being checked
-- =====================================================

USE nexus_db;

-- Add audit fields to task_checklist_items table
ALTER TABLE task_checklist_items
    ADD COLUMN completed_by CHAR(36) NULL AFTER is_completed,
    ADD COLUMN completed_at TIMESTAMP NULL AFTER completed_by,
    ADD COLUMN unchecked_by CHAR(36) NULL AFTER completed_at,
    ADD COLUMN unchecked_at TIMESTAMP NULL AFTER unchecked_by,
    ADD COLUMN unchecked_reason VARCHAR(500) NULL AFTER unchecked_at,
    ADD CONSTRAINT fk_checklist_completed_by 
        FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_checklist_unchecked_by 
        FOREIGN KEY (unchecked_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create checklist_state_history table for complete audit trail
CREATE TABLE IF NOT EXISTS checklist_state_history (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    checklist_item_id CHAR(36) NOT NULL,
    task_id CHAR(36) NOT NULL,
    action ENUM('CHECKED', 'UNCHECKED') NOT NULL,
    actor_id CHAR(36) NOT NULL,
    actor_name VARCHAR(255) NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (checklist_item_id) REFERENCES task_checklist_items(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_checklist_history_item (checklist_item_id),
    INDEX idx_checklist_history_task (task_id),
    INDEX idx_checklist_history_actor (actor_id),
    INDEX idx_checklist_history_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add index for querying by completion status
ALTER TABLE task_checklist_items
    ADD INDEX idx_checklist_completed (is_completed, completed_at);
