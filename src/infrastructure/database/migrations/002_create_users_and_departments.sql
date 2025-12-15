-- =====================================================
-- Module: User & Organization
-- Tables: departments, users, user_linked_accounts, user_sessions
-- =====================================================

USE nexus_db;

-- Table: departments
CREATE TABLE departments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    manager_id CHAR(36),
    parent_department_id CHAR(36),
    budget DECIMAL(15,2),
    kpi_status ENUM('On Track', 'At Risk', 'Behind'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_departments_parent (parent_department_id),
    INDEX idx_departments_manager (manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: users
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    position VARCHAR(100),
    department_id CHAR(36),
    role ENUM('Admin', 'Manager', 'Employee') NOT NULL,
    status ENUM('Active', 'Blocked', 'Pending') DEFAULT 'Active',
    join_date DATE,
    karma_points INT DEFAULT 0,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    
    INDEX idx_users_email (email),
    INDEX idx_users_employee_id (employee_id),
    INDEX idx_users_department (department_id),
    INDEX idx_users_status (status, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key for manager after users table is created
ALTER TABLE departments
ADD CONSTRAINT fk_departments_manager
FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE departments
ADD CONSTRAINT fk_departments_parent
FOREIGN KEY (parent_department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- Table: user_linked_accounts
CREATE TABLE user_linked_accounts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    provider ENUM('google', 'microsoft', 'slack', 'github') NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP NULL,
    last_synced_at TIMESTAMP NULL,
    is_connected BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_provider (user_id, provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: user_sessions
CREATE TABLE user_sessions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_sessions_user (user_id),
    INDEX idx_sessions_token (token),
    INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
