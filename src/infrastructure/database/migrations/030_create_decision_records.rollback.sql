-- Rollback Migration: 030_create_decision_records
-- Description: Drop decision_records and decision_comment_links tables

-- Drop decision_comment_links table first (has foreign key to decision_records)
DROP TABLE IF EXISTS decision_comment_links;

-- Drop decision_records table
DROP TABLE IF EXISTS decision_records;
