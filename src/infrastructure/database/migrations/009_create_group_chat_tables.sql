-- Migration: Create Group Chat Tables
-- Created: 2025-12-09

-- Table: group_conversations
CREATE TABLE IF NOT EXISTS group_conversations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500),
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: group_members
CREATE TABLE IF NOT EXISTS group_members (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  group_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('admin', 'member') DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (group_id) REFERENCES group_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_group_user (group_id, user_id),
  INDEX idx_group_id (group_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: group_messages
CREATE TABLE IF NOT EXISTS group_messages (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  group_id CHAR(36) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  message_text TEXT,
  message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (group_id) REFERENCES group_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_group_id (group_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: group_message_attachments
CREATE TABLE IF NOT EXISTS group_message_attachments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  message_id CHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100),
  file_size BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES group_messages(id) ON DELETE CASCADE,
  INDEX idx_message_id (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: group_message_read_status
CREATE TABLE IF NOT EXISTS group_message_read_status (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  message_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES group_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_message_user (message_id, user_id),
  INDEX idx_message_id (message_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
