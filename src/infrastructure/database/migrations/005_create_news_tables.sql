-- =====================================================
-- Module: News & Content
-- Tables: news_articles, news_article_tags
-- =====================================================

USE nexus_db;

-- Table: news_articles
CREATE TABLE news_articles (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    cover_image TEXT,
    category ENUM('Strategy', 'Event', 'Culture', 'Announcement') NOT NULL,
    author_id CHAR(36) NOT NULL,
    status ENUM('Draft', 'Published', 'Archived') DEFAULT 'Draft',
    is_featured BOOLEAN DEFAULT FALSE,
    read_time VARCHAR(20),
    view_count INT DEFAULT 0,
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_news_status (status, published_at),
    INDEX idx_news_category (category),
    INDEX idx_news_featured (is_featured, status),
    FULLTEXT INDEX idx_news_search (title, summary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: news_article_tags
CREATE TABLE news_article_tags (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    article_id CHAR(36) NOT NULL,
    tag_name VARCHAR(50) NOT NULL,
    
    FOREIGN KEY (article_id) REFERENCES news_articles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_article_tag (article_id, tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
