-- =====================================================
-- Migration: 026_create_task_dependencies
-- Description: Create task_dependencies table for tracking task dependencies
-- Requirements: 8.3 - Task dependency relationships and conflict warnings
-- =====================================================

USE nexus_db;

-- Table: task_dependencies
-- Stores dependency relationships between tasks
-- A task can depend on multiple other tasks (depends_on_task_id)
-- Types: BLOCKS (hard dependency), RELATES_TO (soft reference)
CREATE TABLE IF NOT EXISTS task_dependencies (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    task_id CHAR(36) NOT NULL COMMENT 'The task that has the dependency',
    depends_on_task_id CHAR(36) NOT NULL COMMENT 'The task that must be completed first',
    dependency_type ENUM('BLOCKS', 'RELATES_TO') NOT NULL DEFAULT 'BLOCKS' COMMENT 'Type of dependency relationship',
    created_by CHAR(36) COMMENT 'User who created this dependency',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Prevent duplicate dependencies
    UNIQUE KEY unique_task_dependency (task_id, depends_on_task_id),
    
    -- Prevent self-referencing dependencies
    CONSTRAINT chk_no_self_dependency CHECK (task_id != depends_on_task_id),
    
    -- Indexes for efficient queries
    INDEX idx_task_dependencies_task (task_id),
    INDEX idx_task_dependencies_depends_on (depends_on_task_id),
    INDEX idx_task_dependencies_type (dependency_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
