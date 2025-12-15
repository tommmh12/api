-- =====================================================
-- Module: Projects & Tasks (Enhancement 2)
-- Tables: task_assignees, notifications
-- Changes: tasks (deprecate assignee_department_id)
-- =====================================================

USE nexus_db;

-- Table: task_assignees (Many-to-Many between tasks and users)
CREATE TABLE task_assignees (
    task_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (task_id, user_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: notifications
CREATE TABLE notifications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) NOT NULL, -- e.g., 'task_assigned', 'project_invite'
    related_id CHAR(36), -- ID of the related task, project, etc.
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Make assignee_department_id nullable in tasks (if not already)
-- We are keeping it for backward compatibility or department-level assignment if needed, 
-- but primary assignment will be via task_assignees.
ALTER TABLE tasks MODIFY assignee_department_id CHAR(36) NULL;
