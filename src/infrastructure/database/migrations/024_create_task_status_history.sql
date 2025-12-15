-- =====================================================
-- Migration: 024_create_task_status_history
-- Description: Create task_status_history table for tracking task status changes
-- Requirements: 8.5 - WHEN a task status changes THEN the Nexus_System SHALL record 
--               the change with timestamp and actor
-- =====================================================

USE nexus_db;

-- Table: task_status_history
-- Records all status changes for tasks with full audit trail
CREATE TABLE IF NOT EXISTS task_status_history (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    task_id CHAR(36) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by CHAR(36) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    
    -- Foreign keys
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes for efficient querying
    INDEX idx_status_history_task (task_id),
    INDEX idx_status_history_changed_at (changed_at),
    INDEX idx_status_history_changed_by (changed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
