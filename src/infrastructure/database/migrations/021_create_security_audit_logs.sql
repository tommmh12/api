-- Migration: 021_create_security_audit_logs.sql
-- Description: Create security audit logs table for tracking security-relevant events
-- Requirements: 3.1 - Security event audit logging

-- Create security_audit_logs table (separate from activity_logs for security events)
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  user_id VARCHAR(36),
  user_email VARCHAR(255),
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(36),
  action VARCHAR(100) NOT NULL,
  outcome ENUM('SUCCESS', 'FAILURE') NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  correlation_id VARCHAR(36),
  metadata JSON,
  checksum VARCHAR(64),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_security_audit_timestamp (timestamp),
  INDEX idx_security_audit_user (user_id),
  INDEX idx_security_audit_event_type (event_type),
  INDEX idx_security_audit_outcome (outcome),
  INDEX idx_security_audit_correlation (correlation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment to table
ALTER TABLE security_audit_logs COMMENT = 'Security audit logs for compliance and incident investigation (Requirements 3.1)';
