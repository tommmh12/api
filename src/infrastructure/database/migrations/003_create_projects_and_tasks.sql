-- =====================================================
-- Module: Projects & Tasks
-- Tables: workflows, workflow_statuses, projects, project_departments,
--         tasks, task_tags, task_checklist_items, task_comments,
--         task_attachments, project_documents, project_reports
-- =====================================================

USE nexus_db;

-- Table: workflows
CREATE TABLE workflows (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_by CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: workflow_statuses
CREATE TABLE workflow_statuses (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    workflow_id CHAR(36) NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20),
    `order` INT DEFAULT 0,
    
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: projects
CREATE TABLE projects (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_id CHAR(36),
    workflow_id CHAR(36),
    status ENUM('Planning', 'In Progress', 'Review', 'Done') DEFAULT 'Planning',
    priority ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
    progress INT DEFAULT 0,
    budget DECIMAL(15,2),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL,
    
    INDEX idx_projects_code (code),
    INDEX idx_projects_status (status, deleted_at),
    INDEX idx_projects_manager (manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: project_departments (Many-to-Many)
CREATE TABLE project_departments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    project_id CHAR(36) NOT NULL,
    department_id CHAR(36) NOT NULL,
    role VARCHAR(100),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE KEY unique_project_department (project_id, department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: tasks
CREATE TABLE tasks (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    code VARCHAR(50) UNIQUE,
    project_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assignee_department_id CHAR(36),
    status VARCHAR(50) NOT NULL,
    priority ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMP NULL,
    created_by CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_tasks_project (project_id),
    INDEX idx_tasks_assignee_dept (assignee_department_id),
    INDEX idx_tasks_status (status),
    INDEX idx_tasks_due_date (due_date, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: task_tags
CREATE TABLE task_tags (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    task_id CHAR(36) NOT NULL,
    tag_name VARCHAR(50) NOT NULL,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE KEY unique_task_tag (task_id, tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: task_checklist_items
CREATE TABLE task_checklist_items (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    task_id CHAR(36) NOT NULL,
    text VARCHAR(500) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    `order` INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: task_comments
CREATE TABLE task_comments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    task_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: task_attachments
CREATE TABLE task_attachments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    task_id CHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT,
    uploaded_by CHAR(36),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: project_documents
CREATE TABLE project_documents (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    project_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    source ENUM('Project', 'Task', 'Report'),
    uploader_id CHAR(36),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: project_reports
CREATE TABLE project_reports (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    project_id CHAR(36) NOT NULL,
    department_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    submitted_by CHAR(36),
    submitted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    feedback TEXT,
    reviewed_by CHAR(36),
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
