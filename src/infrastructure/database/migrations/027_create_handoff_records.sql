-- Migration: 027_create_handoff_records
-- Description: Creates handoff_records table for cross-department task transfers
-- Requirements: 9.1 - Cross-department handoff with checklist completion and acceptance
-- Requirements: 9.4 - Handoff rejection with reason requirement

CREATE TABLE IF NOT EXISTS handoff_records (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  from_department_id VARCHAR(36) NOT NULL,
  to_department_id VARCHAR(36) NOT NULL,
  status ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  checklist_completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  initiated_by VARCHAR(36) NOT NULL,
  initiated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_by VARCHAR(36),
  responded_at DATETIME,
  rejection_reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys
  CONSTRAINT fk_handoff_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_handoff_from_dept FOREIGN KEY (from_department_id) REFERENCES departments(id),
  CONSTRAINT fk_handoff_to_dept FOREIGN KEY (to_department_id) REFERENCES departments(id),
  CONSTRAINT fk_handoff_initiator FOREIGN KEY (initiated_by) REFERENCES users(id),
  CONSTRAINT fk_handoff_responder FOREIGN KEY (responded_by) REFERENCES users(id),
  
  -- Indexes for common queries
  INDEX idx_handoff_task (task_id),
  INDEX idx_handoff_status (status),
  INDEX idx_handoff_from_dept (from_department_id),
  INDEX idx_handoff_to_dept (to_department_id),
  INDEX idx_handoff_initiated_at (initiated_at)
);
