-- =====================================================
-- Rollback: 022_create_token_blacklist
-- Purpose: Remove token blacklist table
-- =====================================================

USE nexus_db;

-- Drop the cleanup event first
DROP EVENT IF EXISTS cleanup_expired_blacklisted_tokens;

-- Drop the token_blacklist table
DROP TABLE IF EXISTS token_blacklist;
