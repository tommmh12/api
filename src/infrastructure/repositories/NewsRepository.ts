import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { dbPool } from "../database/connection.js";
import { NewsArticle, NewsComment } from "../../domain/entities/NewsArticle.js";

export class NewsRepository {
  private db = dbPool;

  async findAll(options?: {
    status?: string;
    moderationStatus?: string;
    isPublic?: boolean;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<NewsArticle[]> {
    let query = `
      SELECT 
        na.*,
        u.full_name as authorName,
        u.avatar_url as authorAvatar,
        (SELECT COUNT(*) FROM news_likes WHERE article_id = na.id) as likeCount,
        (SELECT COUNT(*) FROM news_comments WHERE article_id = na.id AND moderation_status = 'Approved' AND deleted_at IS NULL) as commentCount,
        GROUP_CONCAT(DISTINCT nat.tag_name) as tags
      FROM news_articles na
      LEFT JOIN users u ON na.author_id = u.id
      LEFT JOIN news_article_tags nat ON na.id = nat.article_id
      WHERE na.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (options?.status) {
      query += ` AND na.status = ?`;
      params.push(options.status);
    }

    if (options?.moderationStatus) {
      query += ` AND na.moderation_status = ?`;
      params.push(options.moderationStatus);
    }

    if (options?.isPublic !== undefined) {
      query += ` AND na.is_public = ?`;
      params.push(options.isPublic);
    }

    if (options?.category) {
      query += ` AND na.category = ?`;
      params.push(options.category);
    }

    query += ` GROUP BY na.id ORDER BY na.created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
      if (options.offset) {
        query += ` OFFSET ?`;
        params.push(options.offset);
      }
    }

    const [rows] = await this.db.query<RowDataPacket[]>(query, params);
    return rows.map(this.mapRowToArticle);
  }

  async findById(id: string): Promise<NewsArticle | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `
      SELECT 
        na.*,
        u.full_name as authorName,
        u.avatar_url as authorAvatar,
        (SELECT COUNT(*) FROM news_likes WHERE article_id = na.id) as likeCount,
        (SELECT COUNT(*) FROM news_comments WHERE article_id = na.id AND moderation_status = 'Approved' AND deleted_at IS NULL) as commentCount,
        GROUP_CONCAT(DISTINCT nat.tag_name) as tags
      FROM news_articles na
      LEFT JOIN users u ON na.author_id = u.id
      LEFT JOIN news_article_tags nat ON na.id = nat.article_id
      WHERE na.id = ? AND na.deleted_at IS NULL
      GROUP BY na.id
    `,
      [id]
    );
    return rows.length > 0 ? this.mapRowToArticle(rows[0]) : null;
  }

  async create(article: Partial<NewsArticle>): Promise<NewsArticle> {
    const articleId = crypto.randomUUID();
    await this.db.query<ResultSetHeader>(
      `INSERT INTO news_articles (
        id, title, summary, content, cover_image, category, author_id, 
        status, moderation_status, is_public, is_featured, read_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        articleId,
        article.title,
        article.summary || null,
        article.content,
        article.coverImage || null,
        article.category,
        article.authorId,
        article.status || "Draft",
        article.moderationStatus || "Pending",
        article.isPublic !== undefined ? article.isPublic : true,
        article.isFeatured || false,
        article.readTime || null,
      ]
    );

    // Insert tags using batch INSERT (N+1 optimization - Requirements: 6.5)
    if (article.tags && article.tags.length > 0) {
      const tagValues = article.tags.map(tag => [crypto.randomUUID(), articleId, tag]);
      await this.db.query(
        `INSERT INTO news_article_tags (id, article_id, tag_name) VALUES ?`,
        [tagValues]
      );
    }

    const created = await this.findById(articleId);
    if (!created) throw new Error("Failed to create article");
    return created;
  }

  async update(id: string, article: Partial<NewsArticle>): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (article.title !== undefined) {
      updates.push("title = ?");
      params.push(article.title);
    }
    if (article.summary !== undefined) {
      updates.push("summary = ?");
      params.push(article.summary);
    }
    if (article.content !== undefined) {
      updates.push("content = ?");
      params.push(article.content);
    }
    if (article.coverImage !== undefined) {
      updates.push("cover_image = ?");
      params.push(article.coverImage);
    }
    if (article.category !== undefined) {
      updates.push("category = ?");
      params.push(article.category);
    }
    if (article.status !== undefined) {
      updates.push("status = ?");
      params.push(article.status);
    }
    if (article.moderationStatus !== undefined) {
      updates.push("moderation_status = ?");
      params.push(article.moderationStatus);
    }
    if (article.moderatedBy !== undefined) {
      updates.push("moderated_by = ?");
      params.push(article.moderatedBy);
    }
    if (article.moderatedAt !== undefined) {
      updates.push("moderated_at = ?");
      params.push(article.moderatedAt);
    }
    if (article.moderationNotes !== undefined) {
      updates.push("moderation_notes = ?");
      params.push(article.moderationNotes);
    }
    if (article.isPublic !== undefined) {
      updates.push("is_public = ?");
      params.push(article.isPublic);
    }
    if (article.isFeatured !== undefined) {
      updates.push("is_featured = ?");
      params.push(article.isFeatured);
    }
    if (article.publishedAt !== undefined) {
      updates.push("published_at = ?");
      params.push(article.publishedAt);
    }

    if (updates.length === 0) return;

    params.push(id);
    await this.db.query(
      `UPDATE news_articles SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    // Update tags using batch INSERT (N+1 optimization - Requirements: 6.5)
    if (article.tags !== undefined) {
      await this.db.query(`DELETE FROM news_article_tags WHERE article_id = ?`, [id]);
      if (article.tags.length > 0) {
        const tagValues = article.tags.map(tag => [crypto.randomUUID(), id, tag]);
        await this.db.query(
          `INSERT INTO news_article_tags (id, article_id, tag_name) VALUES ?`,
          [tagValues]
        );
      }
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.query(
      `UPDATE news_articles SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.db.query(
      `UPDATE news_articles SET view_count = view_count + 1 WHERE id = ?`,
      [id]
    );
  }

  async recordView(
    articleId: string,
    userId?: string,
    userIp?: string,
    userAgent?: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO news_views (id, article_id, user_id, user_ip, user_agent) VALUES (?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        articleId,
        userId || null,
        userIp || null,
        userAgent || null,
      ]
    );
  }

  async toggleLike(
    articleId: string,
    userId?: string,
    userIp?: string
  ): Promise<{ liked: boolean; likeCount: number }> {
    // Check if already liked
    const [existing] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM news_likes WHERE article_id = ? AND (user_id = ? OR user_ip = ?)`,
      [articleId, userId || null, userIp || null]
    );

    if (existing.length > 0) {
      // Unlike
      await this.db.query(
        `DELETE FROM news_likes WHERE article_id = ? AND (user_id = ? OR user_ip = ?)`,
        [articleId, userId || null, userIp || null]
      );
    } else {
      // Like
      await this.db.query(
        `INSERT INTO news_likes (id, article_id, user_id, user_ip) VALUES (?, ?, ?, ?)`,
        [crypto.randomUUID(), articleId, userId || null, userIp || null]
      );
    }

    const [count] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM news_likes WHERE article_id = ?`,
      [articleId]
    );

    return {
      liked: existing.length === 0,
      likeCount: count[0].count,
    };
  }

  // Comments
  async findComments(articleId: string): Promise<NewsComment[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `
      SELECT 
        nc.*,
        u.full_name as authorName,
        u.avatar_url as authorAvatar
      FROM news_comments nc
      LEFT JOIN users u ON nc.user_id = u.id
      WHERE nc.article_id = ? AND nc.deleted_at IS NULL AND nc.moderation_status = 'Approved'
      ORDER BY nc.created_at ASC
    `,
      [articleId]
    );
    return rows.map(this.mapRowToComment);
  }

  async createComment(comment: Partial<NewsComment>): Promise<NewsComment> {
    const commentId = crypto.randomUUID();
    await this.db.query(
      `INSERT INTO news_comments (
        id, article_id, user_id, author_name, author_email, content, parent_id, moderation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        commentId,
        comment.articleId,
        comment.userId || null,
        comment.authorName,
        comment.authorEmail || null,
        comment.content,
        comment.parentId || null,
        comment.moderationStatus || "Pending",
      ]
    );

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM news_comments WHERE id = ?`,
      [commentId]
    );
    return this.mapRowToComment(rows[0]);
  }

  async moderateComment(
    commentId: string,
    status: "Approved" | "Rejected",
    moderatedBy: string,
    notes?: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE news_comments SET moderation_status = ?, moderated_by = ?, moderated_at = NOW() WHERE id = ?`,
      [status, moderatedBy, commentId]
    );
  }

  private mapRowToArticle(row: RowDataPacket): NewsArticle {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      content: row.content,
      coverImage: row.cover_image,
      category: row.category,
      authorId: row.author_id,
      authorName: row.authorName,
      authorAvatar: row.authorAvatar,
      status: row.status,
      moderationStatus: row.moderation_status,
      moderatedBy: row.moderated_by,
      moderatedAt: row.moderated_at ? new Date(row.moderated_at) : undefined,
      moderationNotes: row.moderation_notes,
      isPublic: row.is_public,
      isFeatured: row.is_featured,
      readTime: row.read_time,
      viewCount: row.view_count,
      likeCount: row.likeCount || 0,
      commentCount: row.commentCount || 0,
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
      tags: row.tags ? row.tags.split(",") : [],
    };
  }

  private mapRowToComment(row: RowDataPacket): NewsComment {
    return {
      id: row.id,
      articleId: row.article_id,
      userId: row.user_id,
      authorName: row.authorName || row.author_name,
      authorEmail: row.author_email,
      content: row.content,
      parentId: row.parent_id,
      moderationStatus: row.moderation_status,
      moderatedBy: row.moderated_by,
      moderatedAt: row.moderated_at ? new Date(row.moderated_at) : undefined,
      likeCount: row.like_count || 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }

  // ==================== Department Access Management ====================

  async getDepartmentsWithAccess(): Promise<
    Array<{
      id: string;
      departmentId: string;
      departmentName: string;
      departmentCode: string;
      createdAt: Date;
      createdBy: string | null;
    }>
  > {
    const [rows] = await this.db.query<RowDataPacket[]>(`
      SELECT 
        nda.id,
        nda.department_id,
        d.name as department_name,
        d.department_code,
        nda.created_at,
        nda.created_by
      FROM news_department_access nda
      JOIN departments d ON nda.department_id = d.id
      ORDER BY d.name ASC
    `);
    return rows.map((row) => ({
      id: row.id,
      departmentId: row.department_id,
      departmentName: row.department_name,
      departmentCode: row.department_code,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,
    }));
  }

  async addDepartmentAccess(
    departmentId: string,
    createdBy: string
  ): Promise<void> {
    const id = crypto.randomUUID();
    await this.db.query(
      `INSERT IGNORE INTO news_department_access (id, department_id, created_by) VALUES (?, ?, ?)`,
      [id, departmentId, createdBy]
    );
  }

  async removeDepartmentAccess(departmentId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM news_department_access WHERE department_id = ?`,
      [departmentId]
    );
  }

  async checkDepartmentAccess(departmentId: string): Promise<boolean> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM news_department_access WHERE department_id = ?`,
      [departmentId]
    );
    return rows.length > 0;
  }

  async getAllDepartments(): Promise<
    Array<{
      id: string;
      name: string;
      departmentCode: string;
    }>
  > {
    const [rows] = await this.db.query<RowDataPacket[]>(`
      SELECT id, name, department_code
      FROM departments
      WHERE deleted_at IS NULL
      ORDER BY name ASC
    `);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      departmentCode: row.department_code,
    }));
  }
}
