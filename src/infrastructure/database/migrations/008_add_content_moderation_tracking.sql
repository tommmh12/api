-- =====================================================
-- Add Moderation and Tracking for News & Forum
-- =====================================================

USE nexus_db;

-- Add moderation status to news_articles
ALTER TABLE news_articles 
ADD COLUMN moderation_status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending' AFTER status,
ADD COLUMN moderated_by CHAR(36) NULL AFTER moderation_status,
ADD COLUMN moderated_at TIMESTAMP NULL AFTER moderated_by,
ADD COLUMN moderation_notes TEXT NULL AFTER moderated_at,
ADD COLUMN is_public BOOLEAN DEFAULT TRUE COMMENT 'Public for external viewers' AFTER is_featured,
ADD INDEX idx_news_moderation (moderation_status, is_public);

-- Add moderation status to forum_posts (already has status, but add moderation fields)
ALTER TABLE forum_posts
ADD COLUMN moderated_by CHAR(36) NULL AFTER status,
ADD COLUMN moderated_at TIMESTAMP NULL AFTER moderated_by,
ADD COLUMN moderation_notes TEXT NULL AFTER moderated_at,
ADD INDEX idx_forum_moderation (status, moderated_at);

-- Create news_comments table
CREATE TABLE news_comments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    article_id CHAR(36) NOT NULL,
    user_id CHAR(36) NULL COMMENT 'NULL for anonymous/public comments',
    author_name VARCHAR(255) NOT NULL COMMENT 'Name for anonymous users',
    author_email VARCHAR(255) NULL COMMENT 'Email for anonymous users',
    content TEXT NOT NULL,
    parent_id CHAR(36) NULL COMMENT 'For nested comments',
    moderation_status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    moderated_by CHAR(36) NULL,
    moderated_at TIMESTAMP NULL,
    like_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES news_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_news_comments_article (article_id),
    INDEX idx_news_comments_moderation (moderation_status),
    INDEX idx_news_comments_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create news_likes table
CREATE TABLE news_likes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    article_id CHAR(36) NOT NULL,
    user_id CHAR(36) NULL COMMENT 'NULL for anonymous likes',
    user_ip VARCHAR(45) NULL COMMENT 'Track anonymous likes by IP',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_article_user_like (article_id, user_id),
    UNIQUE KEY unique_article_ip_like (article_id, user_ip),
    INDEX idx_news_likes_article (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create news_views table for tracking views
CREATE TABLE news_views (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    article_id CHAR(36) NOT NULL,
    user_id CHAR(36) NULL COMMENT 'NULL for anonymous views',
    user_ip VARCHAR(45) NULL,
    user_agent TEXT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_news_views_article (article_id),
    INDEX idx_news_views_date (viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create comment_likes table
CREATE TABLE news_comment_likes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    comment_id CHAR(36) NOT NULL,
    user_id CHAR(36) NULL,
    user_ip VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (comment_id) REFERENCES news_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_comment_user_like (comment_id, user_id),
    UNIQUE KEY unique_comment_ip_like (comment_id, user_ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

