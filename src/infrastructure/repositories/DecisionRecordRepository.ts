/**
 * DecisionRecordRepository
 * Data access layer for decision_records table
 * Requirements: 10.1 - Decision Record with fields for context, decision made, and rationale
 * Requirements: 10.5 - Decision revision with history preservation
 * Requirements: 12.3 - Database operations with transaction rollback
 */

import { RowDataPacket } from "mysql2";
import { dbPool, withTransaction } from "../database/connection.js";
import crypto from "crypto";
import { createLogger } from "../logging/index.js";

const logger = createLogger("DecisionRecordRepository");

export type DecisionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SUPERSEDED';

export interface DecisionOption {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  isSelected: boolean;
}

export interface DecisionRecord {
  id: string;
  projectId: string | null;
  taskId: string | null;
  title: string;
  context: string;
  optionsConsidered: DecisionOption[] | null;
  decision: string;
  rationale: string;
  consequences: string | null;
  status: DecisionStatus;
  createdBy: string;
  createdAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  version: number;
  previousVersionId: string | null;
  supersededBy: string | null;
  updatedAt: Date;
}

export interface DecisionRecordWithDetails extends DecisionRecord {
  projectName?: string;
  taskTitle?: string;
  taskCode?: string;
  createdByName?: string;
  approvedByName?: string;
}

export interface CreateDecisionData {
  projectId?: string;
  taskId?: string;
  title: string;
  context: string;
  optionsConsidered?: DecisionOption[];
  decision: string;
  rationale: string;
  consequences?: string;
  createdBy: string;
  status?: DecisionStatus;
}

export interface UpdateDecisionData {
  title?: string;
  context?: string;
  optionsConsidered?: DecisionOption[];
  decision?: string;
  rationale?: string;
  consequences?: string;
  status?: DecisionStatus;
}

export interface DecisionSearchFilters {
  projectId?: string;
  taskId?: string;
  status?: DecisionStatus;
  createdBy?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export class DecisionRecordRepository {
  private db = dbPool;

  /**
   * Create a new decision record
   */
  async create(data: CreateDecisionData): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();

    const query = `
      INSERT INTO decision_records (
        id, project_id, task_id, title, context, options_considered,
        decision, rationale, consequences, status, created_by, created_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    try {
      await this.db.query(query, [
        id,
        data.projectId || null,
        data.taskId || null,
        data.title,
        data.context,
        data.optionsConsidered ? JSON.stringify(data.optionsConsidered) : null,
        data.decision,
        data.rationale,
        data.consequences || null,
        data.status || 'DRAFT',
        data.createdBy,
        now,
      ]);

      logger.info("Decision record created", { decisionId: id, title: data.title });
      return id;
    } catch (error) {
      logger.error("Error creating decision record", error as Error, { data });
      throw error;
    }
  }

  /**
   * Get decision record by ID
   */
  async findById(id: string): Promise<DecisionRecordWithDetails | null> {
    const query = `
      SELECT 
        d.*,
        p.name as project_name,
        t.title as task_title,
        t.code as task_code,
        uc.full_name as created_by_name,
        ua.full_name as approved_by_name
      FROM decision_records d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN tasks t ON d.task_id = t.id
      LEFT JOIN users uc ON d.created_by = uc.id
      LEFT JOIN users ua ON d.approved_by = ua.id
      WHERE d.id = ?
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [id]);
      if (rows.length === 0) return null;

      return this.mapRowToDecision(rows[0]);
    } catch (error) {
      logger.error("Error finding decision by ID", error as Error, { id });
      throw error;
    }
  }

  /**
   * Get all decision records for a project
   */
  async findByProjectId(projectId: string): Promise<DecisionRecordWithDetails[]> {
    const query = `
      SELECT 
        d.*,
        p.name as project_name,
        t.title as task_title,
        t.code as task_code,
        uc.full_name as created_by_name,
        ua.full_name as approved_by_name
      FROM decision_records d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN tasks t ON d.task_id = t.id
      LEFT JOIN users uc ON d.created_by = uc.id
      LEFT JOIN users ua ON d.approved_by = ua.id
      WHERE d.project_id = ?
      ORDER BY d.created_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [projectId]);
      return rows.map(row => this.mapRowToDecision(row));
    } catch (error) {
      logger.error("Error finding decisions by project ID", error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Get all decision records for a task
   */
  async findByTaskId(taskId: string): Promise<DecisionRecordWithDetails[]> {
    const query = `
      SELECT 
        d.*,
        p.name as project_name,
        t.title as task_title,
        t.code as task_code,
        uc.full_name as created_by_name,
        ua.full_name as approved_by_name
      FROM decision_records d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN tasks t ON d.task_id = t.id
      LEFT JOIN users uc ON d.created_by = uc.id
      LEFT JOIN users ua ON d.approved_by = ua.id
      WHERE d.task_id = ?
      ORDER BY d.created_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [taskId]);
      return rows.map(row => this.mapRowToDecision(row));
    } catch (error) {
      logger.error("Error finding decisions by task ID", error as Error, { taskId });
      throw error;
    }
  }

  /**
   * Search decision records with filters
   * Requirements: 10.3 - Search across decision records with filtering
   */
  async search(filters: DecisionSearchFilters): Promise<DecisionRecordWithDetails[]> {
    let query = `
      SELECT 
        d.*,
        p.name as project_name,
        t.title as task_title,
        t.code as task_code,
        uc.full_name as created_by_name,
        ua.full_name as approved_by_name
      FROM decision_records d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN tasks t ON d.task_id = t.id
      LEFT JOIN users uc ON d.created_by = uc.id
      LEFT JOIN users ua ON d.approved_by = ua.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters.projectId) {
      query += ` AND d.project_id = ?`;
      params.push(filters.projectId);
    }

    if (filters.taskId) {
      query += ` AND d.task_id = ?`;
      params.push(filters.taskId);
    }

    if (filters.status) {
      query += ` AND d.status = ?`;
      params.push(filters.status);
    }

    if (filters.createdBy) {
      query += ` AND d.created_by = ?`;
      params.push(filters.createdBy);
    }

    if (filters.searchQuery) {
      query += ` AND (d.title LIKE ? OR d.context LIKE ? OR d.decision LIKE ? OR d.rationale LIKE ?)`;
      const searchPattern = `%${filters.searchQuery}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY d.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, params);
      return rows.map(row => this.mapRowToDecision(row));
    } catch (error) {
      logger.error("Error searching decisions", error as Error, { filters });
      throw error;
    }
  }

  /**
   * Update a decision record
   */
  async update(id: string, data: UpdateDecisionData): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.context !== undefined) {
      updates.push('context = ?');
      params.push(data.context);
    }
    if (data.optionsConsidered !== undefined) {
      updates.push('options_considered = ?');
      params.push(JSON.stringify(data.optionsConsidered));
    }
    if (data.decision !== undefined) {
      updates.push('decision = ?');
      params.push(data.decision);
    }
    if (data.rationale !== undefined) {
      updates.push('rationale = ?');
      params.push(data.rationale);
    }
    if (data.consequences !== undefined) {
      updates.push('consequences = ?');
      params.push(data.consequences);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (updates.length === 0) {
      return;
    }

    params.push(id);

    const query = `UPDATE decision_records SET ${updates.join(', ')} WHERE id = ?`;

    try {
      const [result] = await this.db.query(query, params);
      const affectedRows = (result as any).affectedRows;
      
      if (affectedRows === 0) {
        throw new Error("Decision record not found");
      }

      logger.info("Decision record updated", { decisionId: id });
    } catch (error) {
      logger.error("Error updating decision record", error as Error, { id, data });
      throw error;
    }
  }

  /**
   * Approve a decision record
   * Requirements: 10.2 - Approver assignment and timestamp
   */
  async approve(id: string, approvedBy: string): Promise<void> {
    const query = `
      UPDATE decision_records 
      SET status = 'APPROVED', approved_by = ?, approved_at = NOW()
      WHERE id = ? AND status IN ('DRAFT', 'PENDING_APPROVAL')
    `;

    try {
      const [result] = await this.db.query(query, [approvedBy, id]);
      const affectedRows = (result as any).affectedRows;
      
      if (affectedRows === 0) {
        throw new Error("Decision record not found or already approved/superseded");
      }

      logger.info("Decision record approved", { decisionId: id, approvedBy });
    } catch (error) {
      logger.error("Error approving decision record", error as Error, { id, approvedBy });
      throw error;
    }
  }

  /**
   * Create a new version of a decision record (revision)
   * Requirements: 10.5 - Preserve original decision history
   * Requirements: 12.3 - Database operations with transaction rollback
   */
  async createRevision(originalId: string, data: CreateDecisionData): Promise<string> {
    const newId = crypto.randomUUID();
    const now = new Date();

    // Get the original record to get its version
    const original = await this.findById(originalId);
    if (!original) {
      throw new Error("Original decision record not found");
    }

    const newVersion = original.version + 1;

    // Use withTransaction helper for automatic rollback on failure
    await withTransaction(async (ctx) => {
      // Create the new version
      const insertQuery = `
        INSERT INTO decision_records (
          id, project_id, task_id, title, context, options_considered,
          decision, rationale, consequences, status, created_by, created_at,
          version, previous_version_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?)
      `;

      await ctx.query(insertQuery, [
        newId,
        data.projectId || original.projectId,
        data.taskId || original.taskId,
        data.title,
        data.context,
        data.optionsConsidered ? JSON.stringify(data.optionsConsidered) : null,
        data.decision,
        data.rationale,
        data.consequences || null,
        data.createdBy,
        now,
        newVersion,
        originalId,
      ]);

      // Mark the original as superseded
      const updateQuery = `
        UPDATE decision_records 
        SET status = 'SUPERSEDED', superseded_by = ?
        WHERE id = ?
      `;

      await ctx.query(updateQuery, [newId, originalId]);
    });

    logger.info("Decision record revision created", { 
      originalId, 
      newId, 
      version: newVersion 
    });

    return newId;
  }

  /**
   * Get version history for a decision record
   */
  async getVersionHistory(id: string): Promise<DecisionRecordWithDetails[]> {
    // First, find the root of the version chain
    let currentId = id;
    let current = await this.findById(currentId);
    
    while (current?.previousVersionId) {
      currentId = current.previousVersionId;
      current = await this.findById(currentId);
    }

    // Now traverse forward through all versions
    const versions: DecisionRecordWithDetails[] = [];
    let nextId: string | null = currentId;

    while (nextId) {
      const record = await this.findById(nextId);
      if (record) {
        versions.push(record);
        nextId = record.supersededBy;
      } else {
        break;
      }
    }

    return versions;
  }

  /**
   * Link a decision to a comment
   * Requirements: 10.4 - Link between comment and decision record
   */
  async linkToComment(decisionId: string, commentId: string): Promise<void> {
    const id = crypto.randomUUID();

    const query = `
      INSERT INTO decision_comment_links (id, decision_id, comment_id)
      VALUES (?, ?, ?)
    `;

    try {
      await this.db.query(query, [id, decisionId, commentId]);
      logger.info("Decision linked to comment", { decisionId, commentId });
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        logger.info("Decision already linked to comment", { decisionId, commentId });
        return;
      }
      logger.error("Error linking decision to comment", error as Error, { decisionId, commentId });
      throw error;
    }
  }

  /**
   * Unlink a decision from a comment
   */
  async unlinkFromComment(decisionId: string, commentId: string): Promise<void> {
    const query = `
      DELETE FROM decision_comment_links 
      WHERE decision_id = ? AND comment_id = ?
    `;

    try {
      await this.db.query(query, [decisionId, commentId]);
      logger.info("Decision unlinked from comment", { decisionId, commentId });
    } catch (error) {
      logger.error("Error unlinking decision from comment", error as Error, { decisionId, commentId });
      throw error;
    }
  }

  /**
   * Get linked comment IDs for a decision
   */
  async getLinkedCommentIds(decisionId: string): Promise<string[]> {
    const query = `
      SELECT comment_id FROM decision_comment_links WHERE decision_id = ?
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [decisionId]);
      return rows.map(row => row.comment_id);
    } catch (error) {
      logger.error("Error getting linked comments", error as Error, { decisionId });
      throw error;
    }
  }

  /**
   * Get decisions linked to a comment
   */
  async findByCommentId(commentId: string): Promise<DecisionRecordWithDetails[]> {
    const query = `
      SELECT 
        d.*,
        p.name as project_name,
        t.title as task_title,
        t.code as task_code,
        uc.full_name as created_by_name,
        ua.full_name as approved_by_name
      FROM decision_records d
      INNER JOIN decision_comment_links dcl ON d.id = dcl.decision_id
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN tasks t ON d.task_id = t.id
      LEFT JOIN users uc ON d.created_by = uc.id
      LEFT JOIN users ua ON d.approved_by = ua.id
      WHERE dcl.comment_id = ?
      ORDER BY d.created_at DESC
    `;

    try {
      const [rows] = await this.db.query<RowDataPacket[]>(query, [commentId]);
      return rows.map(row => this.mapRowToDecision(row));
    } catch (error) {
      logger.error("Error finding decisions by comment ID", error as Error, { commentId });
      throw error;
    }
  }

  /**
   * Delete a decision record (only if in DRAFT status)
   */
  async delete(id: string): Promise<void> {
    const query = `
      DELETE FROM decision_records WHERE id = ? AND status = 'DRAFT'
    `;

    try {
      const [result] = await this.db.query(query, [id]);
      const affectedRows = (result as any).affectedRows;
      
      if (affectedRows === 0) {
        throw new Error("Decision record not found or cannot be deleted (not in DRAFT status)");
      }

      logger.info("Decision record deleted", { decisionId: id });
    } catch (error) {
      logger.error("Error deleting decision record", error as Error, { id });
      throw error;
    }
  }

  /**
   * Map database row to DecisionRecordWithDetails
   */
  private mapRowToDecision(row: RowDataPacket): DecisionRecordWithDetails {
    let optionsConsidered: DecisionOption[] | null = null;
    
    if (row.options_considered) {
      try {
        optionsConsidered = typeof row.options_considered === 'string' 
          ? JSON.parse(row.options_considered) 
          : row.options_considered;
      } catch {
        optionsConsidered = null;
      }
    }

    return {
      id: row.id,
      projectId: row.project_id,
      taskId: row.task_id,
      title: row.title,
      context: row.context,
      optionsConsidered,
      decision: row.decision,
      rationale: row.rationale,
      consequences: row.consequences,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      version: row.version,
      previousVersionId: row.previous_version_id,
      supersededBy: row.superseded_by,
      updatedAt: row.updated_at,
      projectName: row.project_name,
      taskTitle: row.task_title,
      taskCode: row.task_code,
      createdByName: row.created_by_name,
      approvedByName: row.approved_by_name,
    };
  }
}
