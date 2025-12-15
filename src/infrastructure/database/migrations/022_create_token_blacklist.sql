-- =====================================================
-- Migration: 022_create_token_blacklist
-- Purpose: Create token blacklist table for token invalidation
-- Requirements: 1.3 - Token invalidation mechanism for logout and password change
-- =====================================================

USE nexus_db;

-- Table: token_blacklist
-- Stores invalidated tokens with their expiry time
-- Tokens are automatically cleaned up after expiry
CREATE TABLE token_blacklist (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    token_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of the token (for security)
    user_id CHAR(36) NOT NULL,
    reason ENUM('logout', 'password_change', 'admin_revoke', 'security_incident') NOT NULL,
    expires_at TIMESTAMP NOT NULL,  -- When the original token would have expired
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Index for fast token lookup during validation
    UNIQUE INDEX idx_token_blacklist_hash (token_hash),
    -- Index for cleanup of expired tokens
    INDEX idx_token_blacklist_expires (expires_at),
    -- Index for user-based queries (e.g., invalidate all user tokens)
    INDEX idx_token_blacklist_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Cleanup of expired tokens should be handled by application code or a cron job
-- Example cleanup query: DELETE FROM token_blacklist WHERE expires_at < NOW();
