-- ⚠️ HƯỚNG DẪN CHẠY MIGRATION
-- File này cần được chạy trong MySQL client hoặc MySQL Workbench

-- Cách 1: Sử dụng MySQL Workbench
-- 1. Mở MySQL Workbench
-- 2. Connect to localhost (root/123456)
-- 3. File → Open SQL Script → chọn file 016_create_online_meetings.sql
-- 4. Click Execute (⚡ icon hoặc Ctrl+Shift+Enter)

-- Cách 2: Sử dụng command line (nếu MySQL đã add vào PATH)
-- mysql -u root -p123456 -D nexus_db < 016_create_online_meetings.sql

-- =====================================================
-- Module: Online Meeting System (Jitsi Integration)
-- Tables: online_meetings, online_meeting_participants
-- =====================================================

USE nexus_db;

-- Table: online_meetings
-- Represents online video conference meetings using Jitsi
CREATE TABLE IF NOT EXISTS online_meetings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Meeting details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    jitsi_room_name VARCHAR(255) NOT NULL UNIQUE,  -- Unique Jitsi room identifier
    
    -- Creator and ownership
    creator_id CHAR(36) NOT NULL,
    
    -- Schedule
    scheduled_start DATETIME NOT NULL,
    scheduled_end DATETIME NULL,
    
    -- Access control
    access_mode ENUM('public', 'private') DEFAULT 'private',
    -- public: All company employees can see and join
    -- private: Only invited participants can see and join
    
    -- Meeting status
    status ENUM('scheduled', 'active', 'ended', 'cancelled') DEFAULT 'scheduled',
    
    -- Jitsi configuration
    jitsi_domain VARCHAR(255) DEFAULT 'meet.jit.si',
    
    -- Recording and extras
    recording_url TEXT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_meeting_creator (creator_id),
    INDEX idx_meeting_status (status),
    INDEX idx_meeting_access (access_mode),
    INDEX idx_meeting_schedule (scheduled_start, scheduled_end),
    INDEX idx_meeting_room (jitsi_room_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: online_meeting_participants
-- Many-to-many relationship between meetings and invited users
CREATE TABLE IF NOT EXISTS online_meeting_participants (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    meeting_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    
    -- Invitation tracking
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    invited_by CHAR(36),  -- Who sent the invitation
    
    -- Participation tracking
    joined_at TIMESTAMP NULL,
    left_at TIMESTAMP NULL,
    
    FOREIGN KEY (meeting_id) REFERENCES online_meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_meeting_participant (meeting_id, user_id),
    INDEX idx_participant_meeting (meeting_id),
    INDEX idx_participant_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify tables created
SELECT 'Migration completed successfully!' AS status;
SHOW TABLES LIKE 'online%';
