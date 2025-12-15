-- =====================================================
-- Module: Projects & Tasks (Enhancement)
-- Tables: project_members
-- =====================================================

USE nexus_db;

-- Table: project_members (Many-to-Many between projects and users)
CREATE TABLE project_members (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    project_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    role ENUM('Manager', 'Member', 'Viewer') DEFAULT 'Member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_project_member (project_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for faster lookup
CREATE INDEX idx_project_members_user ON project_members(user_id);
