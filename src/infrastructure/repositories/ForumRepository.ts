import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { dbPool } from "../database/connection.js";
import { ForumPost, ForumComment } from "../../domain/entities/ForumPost.js";
import crypto from "crypto";

export class ForumRepository {
  private db = dbPool;

  async findAll(options?: {
    status?: string;
    categoryId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ForumPost[]> {
    let query = `
      SELECT 
        fp.*,
        fc.name as categoryName,
        u.full_name as authorName,
        u.avatar_url as authorAvatar,
        GROUP_CONCAT(DISTINCT fpt.tag_name) as tags
      FROM forum_posts fp
      LEFT JOIN forum_categories fc ON fp.category_id = fc.id
      LEFT JOIN users u ON fp.author_id = u.id
      LEFT JOIN forum_post_tags fpt ON fp.id = fpt.post_id
      WHERE fp.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (options?.status) {
      query += ` AND fp.status = ?`;
      params.push(options.status);
    }

    if (options?.categoryId) {
      query += ` AND fp.category_id = ?`;
      params.push(options.categoryId);
    }

    query += ` GROUP BY fp.id ORDER BY fp.is_pinned DESC, fp.created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
      if (options.offset) {
        query += ` OFFSET ?`;
        params.push(options.offset);
      }
    }

    const [rows] = await this.db.query<RowDataPacket[]>(query, params);
    return rows.map(this.mapRowToPost);
  }

  async findById(id: string): Promise<ForumPost | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `
      SELECT 
        fp.*,
        fc.name as categoryName,
        u.full_name as authorName,
        u.avatar_url as authorAvatar,
        GROUP_CONCAT(DISTINCT fpt.tag_name) as tags
      FROM forum_posts fp
      LEFT JOIN forum_categories fc ON fp.category_id = fc.id
      LEFT JOIN users u ON fp.author_id = u.id
      LEFT JOIN forum_post_tags fpt ON fp.id = fpt.post_id
      WHERE fp.id = ? AND fp.deleted_at IS NULL
      GROUP BY fp.id
    `,
      [id]
    );
    return rows.length > 0 ? this.mapRowToPost(rows[0]) : null;
  }

  /**
   * Create a new forum post with tags
   * 
   * Requirements: 6.5 - Refactored to use batch INSERT for tags (N+1 fix)
   */
  async create(post: Partial<ForumPost>): Promise<ForumPost> {
    const postId = crypto.randomUUID();
    await this.db.query<ResultSetHeader>(
      `INSERT INTO forum_posts (
        id, category_id, author_id, title, content, status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        postId,
        post.categoryId,
        post.authorId,
        post.title,
        post.content,
        post.status || "Pending",
      ]
    );

    // Insert tags using batch INSERT (N+1 optimization)
    if (post.tags && post.tags.length > 0) {
      const tagValues = post.tags.map(tag => [crypto.randomUUID(), postId, tag]);
      await this.db.query(
        `INSERT INTO forum_post_tags (id, post_id, tag_name) VALUES ?`,
        [tagValues]
      );
    }

    const created = await this.findById(postId);
    if (!created) throw new Error("Failed to create post");
    return created;
  }

  async update(id: string, post: Partial<ForumPost>): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (post.title !== undefined) {
      updates.push("title = ?");
      params.push(post.title);
    }
    if (post.content !== undefined) {
      updates.push("content = ?");
      params.push(post.content);
    }
    if (post.status !== undefined) {
      updates.push("status = ?");
      params.push(post.status);
    }
    if (post.moderatedBy !== undefined) {
      updates.push("moderated_by = ?");
      params.push(post.moderatedBy);
    }
    if (post.moderatedAt !== undefined) {
      updates.push("moderated_at = ?");
      params.push(post.moderatedAt);
    }
    if (post.moderationNotes !== undefined) {
      updates.push("moderation_notes = ?");
      params.push(post.moderationNotes);
    }
    if (post.isPinned !== undefined) {
      updates.push("is_pinned = ?");
      params.push(post.isPinned);
    }

    if (updates.length === 0) return;

    params.push(id);
    await this.db.query(
      `UPDATE forum_posts SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    // Update tags using batch INSERT (N+1 optimization - Requirements: 6.5)
    if (post.tags !== undefined) {
      await this.db.query(`DELETE FROM forum_post_tags WHERE post_id = ?`, [id]);
      if (post.tags.length > 0) {
        const tagValues = post.tags.map(tag => [crypto.randomUUID(), id, tag]);
        await this.db.query(
          `INSERT INTO forum_post_tags (id, post_id, tag_name) VALUES ?`,
          [tagValues]
        );
      }
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.query(
      `UPDATE forum_posts SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.db.query(
      `UPDATE forum_posts SET view_count = view_count + 1 WHERE id = ?`,
      [id]
    );
  }

  async toggleVote(
    postId: string,
    userId: string,
    voteType: 1 | -1
  ): Promise<{ voted: boolean; upvoteCount: number; downvoteCount: number }> {
    // Check if already voted
    const [existing] = await this.db.query<RowDataPacket[]>(
      `SELECT id, vote_type FROM forum_votes WHERE user_id = ? AND votable_type = 'post' AND votable_id = ?`,
      [userId, postId]
    );

    if (existing.length > 0) {
      const existingVote = existing[0].vote_type;
      if (existingVote === voteType) {
        // Remove vote
        await this.db.query(
          `DELETE FROM forum_votes WHERE user_id = ? AND votable_type = 'post' AND votable_id = ?`,
          [userId, postId]
        );
      } else {
        // Update vote
        await this.db.query(
          `UPDATE forum_votes SET vote_type = ? WHERE user_id = ? AND votable_type = 'post' AND votable_id = ?`,
          [voteType, userId, postId]
        );
      }
    } else {
      // Create vote
      await this.db.query(
        `INSERT INTO forum_votes (id, user_id, votable_type, votable_id, vote_type) VALUES (?, ?, 'post', ?, ?)`,
        [crypto.randomUUID(), userId, postId, voteType]
      );
    }

    // Get updated counts
    const [upvotes] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM forum_votes WHERE votable_type = 'post' AND votable_id = ? AND vote_type = 1`,
      [postId]
    );
    const [downvotes] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM forum_votes WHERE votable_type = 'post' AND votable_id = ? AND vote_type = -1`,
      [postId]
    );

    // Update post counts
    await this.db.query(
      `UPDATE forum_posts SET upvote_count = ?, downvote_count = ? WHERE id = ?`,
      [upvotes[0].count, downvotes[0].count, postId]
    );

    return {
      voted: existing.length === 0 || existing[0].vote_type !== voteType,
      upvoteCount: upvotes[0].count,
      downvoteCount: downvotes[0].count,
    };
  }

  // Comments
  async findComments(postId: string): Promise<ForumComment[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `
      SELECT 
        fc.*,
        u.full_name as authorName,
        u.avatar_url as authorAvatar
      FROM forum_comments fc
      LEFT JOIN users u ON fc.author_id = u.id
      WHERE fc.post_id = ? AND fc.deleted_at IS NULL
      ORDER BY fc.created_at ASC
    `,
      [postId]
    );
    return rows.map(this.mapRowToComment);
  }

  async createComment(comment: Partial<ForumComment>): Promise<ForumComment> {
    const commentId = crypto.randomUUID();
    await this.db.query(
      `INSERT INTO forum_comments (
        id, post_id, author_id, content, parent_id
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        commentId,
        comment.postId,
        comment.authorId,
        comment.content,
        comment.parentId || null,
      ]
    );

    // Update comment count
    await this.db.query(
      `UPDATE forum_posts SET comment_count = comment_count + 1 WHERE id = ?`,
      [comment.postId]
    );

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        fc.*,
        u.full_name as authorName,
        u.avatar_url as authorAvatar
      FROM forum_comments fc
      LEFT JOIN users u ON fc.author_id = u.id
      WHERE fc.id = ?`,
      [commentId]
    );
    return this.mapRowToComment(rows[0]);
  }

  private mapRowToPost(row: RowDataPacket): ForumPost {
    return {
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.categoryName,
      authorId: row.author_id,
      authorName: row.authorName,
      authorAvatar: row.authorAvatar,
      title: row.title,
      content: row.content,
      status: row.status,
      moderatedBy: row.moderated_by,
      moderatedAt: row.moderated_at ? new Date(row.moderated_at) : undefined,
      moderationNotes: row.moderation_notes,
      isPinned: row.is_pinned,
      viewCount: row.view_count,
      upvoteCount: row.upvote_count,
      downvoteCount: row.downvote_count,
      commentCount: row.comment_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
      tags: row.tags ? row.tags.split(",") : [],
    };
  }

  private mapRowToComment(row: RowDataPacket): ForumComment {
    return {
      id: row.id,
      postId: row.post_id,
      authorId: row.author_id,
      authorName: row.authorName,
      authorAvatar: row.authorAvatar,
      content: row.content,
      parentId: row.parent_id,
      upvoteCount: row.upvote_count || 0,
      downvoteCount: row.downvote_count || 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }

  // ==================== REACTIONS ====================

  async toggleReaction(
    userId: string,
    targetType: "post" | "comment",
    targetId: string,
    reactionType: string
  ): Promise<{ reacted: boolean; reactions: Record<string, number> }> {
    // Check if user already reacted
    const [existing] = await this.db.query<RowDataPacket[]>(
      `SELECT id, reaction_type FROM forum_reactions WHERE user_id = ? AND target_type = ? AND target_id = ?`,
      [userId, targetType, targetId]
    );

    if (existing.length > 0) {
      if (existing[0].reaction_type === reactionType) {
        // Remove reaction
        await this.db.query(
          `DELETE FROM forum_reactions WHERE user_id = ? AND target_type = ? AND target_id = ?`,
          [userId, targetType, targetId]
        );
      } else {
        // Update reaction
        await this.db.query(
          `UPDATE forum_reactions SET reaction_type = ? WHERE user_id = ? AND target_type = ? AND target_id = ?`,
          [reactionType, userId, targetType, targetId]
        );
      }
    } else {
      // Create reaction
      await this.db.query(
        `INSERT INTO forum_reactions (id, user_id, target_type, target_id, reaction_type) VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), userId, targetType, targetId, reactionType]
      );
    }

    // Get updated reaction counts
    const reactions = await this.getReactionCounts(targetType, targetId);

    return {
      reacted:
        existing.length === 0 || existing[0].reaction_type !== reactionType,
      reactions,
    };
  }

  async getReactionCounts(
    targetType: "post" | "comment",
    targetId: string
  ): Promise<Record<string, number>> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT reaction_type, COUNT(*) as count FROM forum_reactions 
       WHERE target_type = ? AND target_id = ? GROUP BY reaction_type`,
      [targetType, targetId]
    );

    const reactions: Record<string, number> = {
      like: 0,
      love: 0,
      laugh: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    };

    rows.forEach((row) => {
      reactions[row.reaction_type] = row.count;
    });

    return reactions;
  }

  async getUserReaction(
    userId: string,
    targetType: "post" | "comment",
    targetId: string
  ): Promise<string | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT reaction_type FROM forum_reactions WHERE user_id = ? AND target_type = ? AND target_id = ?`,
      [userId, targetType, targetId]
    );
    return rows.length > 0 ? rows[0].reaction_type : null;
  }

  // ==================== ATTACHMENTS ====================

  async addAttachment(attachment: {
    postId: string;
    fileName: string;
    filePath: string;
    fileType: string;
    fileSize: number;
    mimeType: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.query(
      `INSERT INTO forum_attachments (id, post_id, file_name, file_path, file_type, file_size, mime_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        attachment.postId,
        attachment.fileName,
        attachment.filePath,
        attachment.fileType,
        attachment.fileSize,
        attachment.mimeType,
      ]
    );
    return id;
  }

  async getPostAttachments(postId: string): Promise<any[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM forum_attachments WHERE post_id = ? ORDER BY created_at`,
      [postId]
    );
    return rows;
  }

  async deleteAttachment(id: string): Promise<void> {
    await this.db.query(`DELETE FROM forum_attachments WHERE id = ?`, [id]);
  }

  // ==================== TRENDING / HOT TOPICS ====================

  async getHotTopics(limit: number = 5): Promise<ForumPost[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        fp.*,
        fc.name as categoryName,
        u.full_name as authorName,
        u.avatar_url as authorAvatar,
        GROUP_CONCAT(DISTINCT fpt.tag_name) as tags,
        (fp.upvote_count * 2 + fp.comment_count + fp.view_count * 0.1) as hot_score
      FROM forum_posts fp
      LEFT JOIN forum_categories fc ON fp.category_id = fc.id
      LEFT JOIN users u ON fp.author_id = u.id
      LEFT JOIN forum_post_tags fpt ON fp.id = fpt.post_id
      WHERE fp.deleted_at IS NULL 
        AND fp.status = 'Approved'
        AND fp.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY fp.id
      ORDER BY hot_score DESC, fp.created_at DESC
      LIMIT ?`,
      [limit]
    );
    return rows.map(this.mapRowToPost);
  }

  // ==================== USER STATS ====================

  async getUserForumStats(userId: string): Promise<{
    postCount: number;
    commentCount: number;
    karmaPoints: number;
    joinDate: Date | null;
  }> {
    const [postCount] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM forum_posts WHERE author_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    const [commentCount] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM forum_comments WHERE author_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    const [userInfo] = await this.db.query<RowDataPacket[]>(
      `SELECT karma_points, created_at as joinDate FROM users WHERE id = ?`,
      [userId]
    );

    return {
      postCount: postCount[0]?.count || 0,
      commentCount: commentCount[0]?.count || 0,
      karmaPoints: userInfo[0]?.karma_points || 0,
      joinDate: userInfo[0]?.joinDate ? new Date(userInfo[0].joinDate) : null,
    };
  }
}
