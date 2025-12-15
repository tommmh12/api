-- =====================================================
-- Migration: 023_add_task_owner_fields
-- Purpose: Add owner fields to tasks table for task ownership requirement
-- Requirements: 8.1 - Task Owner Requirement
-- =====================================================

USE nexus_db;

-- Add owner_id and owner_assigned_at columns to tasks table
-- owner_id: The single owner responsible for the task (different from assignees)
-- owner_assigned_at: Timestamp when the owner was assigned

ALTER TABLE tasks
ADD COLUMN owner_id CHAR(36) NULL AFTER created_by,
ADD COLUMN owner_assigned_at TIMESTAMP NULL AFTER owner_id,
ADD COLUMN owner_assigned_by CHAR(36) NULL AFTER owner_assigned_at;

-- Add foreign key constraints
ALTER TABLE tasks
ADD CONSTRAINT fk_tasks_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_tasks_owner_assigned_by FOREIGN KEY (owner_assigned_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for owner lookups
CREATE INDEX idx_tasks_owner ON tasks(owner_id);

-- Create table for department-specific enforcement settings
-- This allows configuring warn/block mode per department
CREATE TABLE IF NOT EXISTS task_ownership_settings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    department_id CHAR(36) NOT NULL UNIQUE,
    enforcement_mode ENUM('warn', 'block') DEFAULT 'warn',
    require_owner BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default settings for all existing departments (warn mode)
INSERT INTO task_ownership_settings (id, department_id, enforcement_mode, require_owner)
SELECT UUID(), id, 'warn', TRUE FROM departments
ON DUPLICATE KEY UPDATE enforcement_mode = enforcement_mode;
