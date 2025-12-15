-- =====================================================
-- Migration: Unified Comment System
-- Tables: comments, comment_edit_history, 
--         comment_reactions, comment_mentions
-- =====================================================

USE nexus_db;

-- Table: comments (Polymorphic - dùng cho cả forum_post và task)
CREATE TABLE comments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Polymorphic relationship
    commentable_type ENUM('forum_post', 'task') NOT NULL,
    commentable_id CHAR(36) NOT NULL,
    
    -- Nested comments (NULL = root comment, có giá trị = reply)
    parent_id CHAR(36) NULL,
    
    -- Author
    author_id CHAR(36) NOT NULL,
    
    -- Content
    content TEXT NOT NULL,
    original_content TEXT NULL,  -- Lưu nội dung gốc khi edit (for audit)
    
    -- Status flags
    is_edited BOOLEAN DEFAULT FALSE,
    is_retracted BOOLEAN DEFAULT FALSE,
    
    -- Counters (denormalized for performance)
    reply_count INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    retracted_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL,
    
    -- Foreign Keys
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_comments_commentable (commentable_type, commentable_id, deleted_at),
    INDEX idx_comments_parent (parent_id),
    INDEX idx_comments_author (author_id),
    INDEX idx_comments_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: comment_edit_history (Lịch sử chỉnh sửa)
CREATE TABLE comment_edit_history (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    comment_id CHAR(36) NOT NULL,
    old_content TEXT NOT NULL,
    edited_by CHAR(36) NOT NULL,
    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_edit_history_comment (comment_id, edited_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: comment_reactions (Reactions: 👍❤️😂😮😢😡)
CREATE TABLE comment_reactions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    comment_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    reaction_type ENUM('like', 'love', 'laugh', 'wow', 'sad', 'angry') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Mỗi user chỉ react 1 lần cho 1 comment
    UNIQUE KEY unique_user_comment_reaction (user_id, comment_id),
    INDEX idx_reactions_comment (comment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: comment_mentions (Mentions: @username)
CREATE TABLE comment_mentions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    comment_id CHAR(36) NOT NULL,
    mentioned_user_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_mentions_user (mentioned_user_id),
    INDEX idx_mentions_comment (comment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
