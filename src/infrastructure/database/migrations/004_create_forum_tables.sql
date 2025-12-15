-- =====================================================
-- Module: Forum & Communication
-- Tables: forum_categories, forum_posts, forum_post_tags,
--         forum_comments, forum_votes, forum_polls,
--         forum_poll_options, forum_poll_votes,
--         forum_saved_posts, forum_subscriptions
-- =====================================================

USE nexus_db;

-- Table: forum_categories
CREATE TABLE forum_categories (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    color_class VARCHAR(50),
    `order` INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: forum_posts
CREATE TABLE forum_posts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    category_id CHAR(36) NOT NULL,
    author_id CHAR(36) NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    is_pinned BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    upvote_count INT DEFAULT 0,
    downvote_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (category_id) REFERENCES forum_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_forum_posts_category (category_id),
    INDEX idx_forum_posts_author (author_id),
    INDEX idx_forum_posts_status (status, deleted_at),
    INDEX idx_forum_posts_pinned (is_pinned, created_at),
    FULLTEXT INDEX idx_forum_posts_search (title, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: forum_post_tags
CREATE TABLE forum_post_tags (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    post_id CHAR(36) NOT NULL,
    tag_name VARCHAR(50) NOT NULL,
    
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_post_tag (post_id, tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: forum_comments
CREATE TABLE forum_comments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    post_id CHAR(36) NOT NULL,
    author_id CHAR(36) NOT NULL,
    parent_id CHAR(36),
    content TEXT NOT NULL,
    upvote_count INT DEFAULT 0,
    downvote_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES forum_comments(id) ON DELETE CASCADE,
    
    INDEX idx_forum_comments_post (post_id),
    INDEX idx_forum_comments_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: forum_votes
CREATE TABLE forum_votes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    votable_type ENUM('post', 'comment') NOT NULL,
    votable_id CHAR(36) NOT NULL,
    vote_type INT NOT NULL CHECK (vote_type IN (1, -1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_vote (user_id, votable_type, votable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: forum_polls
CREATE TABLE forum_polls (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    post_id CHAR(36) NOT NULL,
    question VARCHAR(500) NOT NULL,
    end_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: forum_poll_options
CREATE TABLE forum_poll_options (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    poll_id CHAR(36) NOT NULL,
    text VARCHAR(255) NOT NULL,
    vote_count INT DEFAULT 0,
    `order` INT DEFAULT 0,
    
    FOREIGN KEY (poll_id) REFERENCES forum_polls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: forum_poll_votes
CREATE TABLE forum_poll_votes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    poll_id CHAR(36) NOT NULL,
    option_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (poll_id) REFERENCES forum_polls(id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES forum_poll_options(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_poll_user (poll_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: forum_saved_posts
CREATE TABLE forum_saved_posts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    post_id CHAR(36) NOT NULL,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_saved_post (user_id, post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: forum_subscriptions
CREATE TABLE forum_subscriptions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    post_id CHAR(36) NOT NULL,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_subscription (user_id, post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
