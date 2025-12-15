-- Chat Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id CHAR(36) PRIMARY KEY,
    participant1_id CHAR(36) NOT NULL,
    participant2_id CHAR(36) NOT NULL,
    last_message_id CHAR(36) NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (participant2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_conversation (participant1_id, participant2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id CHAR(36) PRIMARY KEY,
    conversation_id CHAR(36) NOT NULL,
    sender_id CHAR(36) NOT NULL,
    message_text TEXT,
    message_type ENUM('text', 'image', 'file') DEFAULT 'text',
    is_read BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_conversation (conversation_id, created_at),
    INDEX idx_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat Attachments Table
CREATE TABLE IF NOT EXISTS chat_attachments (
    id CHAR(36) PRIMARY KEY,
    message_id CHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
    INDEX idx_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Online Status Table
CREATE TABLE IF NOT EXISTS user_online_status (
    user_id CHAR(36) PRIMARY KEY,
    status ENUM('online', 'offline', 'busy', 'away') DEFAULT 'offline',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    socket_id VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Typing Indicators Table (for realtime typing status)
CREATE TABLE IF NOT EXISTS typing_indicators (
    id CHAR(36) PRIMARY KEY,
    conversation_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    is_typing BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_typing (conversation_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
