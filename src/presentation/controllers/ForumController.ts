import { Request, Response } from "express";
import { ForumService } from "../../application/services/ForumService.js";
import { ForumRepository } from "../../infrastructure/repositories/ForumRepository.js";
import { auditLogger } from "../../utils/auditLogger.js";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { dbPool } from "../../infrastructure/database/connection.js";

const forumRepository = new ForumRepository();
const forumService = new ForumService(forumRepository);

const getIpAddress = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

// Get all categories
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, name, description, icon, color_class as colorClass, \`order\` 
       FROM forum_categories 
       ORDER BY \`order\` ASC, name ASC`
    );
    res.json(rows);
  } catch (error: any) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: error.message });
  }
};

// Create category (admin only)
export const createCategory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const ipAddress = getIpAddress(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    // Get max order value
    const [maxOrderRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT MAX(\`order\`) as maxOrder FROM forum_categories`
    );
    const maxOrder = maxOrderRows[0]?.maxOrder || 0;
    const newOrder = maxOrder + 1;

    const [result] = await dbPool.query<ResultSetHeader>(
      `INSERT INTO forum_categories (id, name, description, icon, color_class, \`order\`)
       VALUES (UUID(), ?, ?, ?, ?, ?)`,
      [
        req.body.name.trim(),
        req.body.description?.trim() || null,
        req.body.icon?.trim() || null,
        req.body.colorClass?.trim() || null,
        newOrder,
      ]
    );

    const [newCategory] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, name, description, icon, color_class as colorClass, \`order\`
       FROM forum_categories WHERE id = ?`,
      [result.insertId]
    );

    await auditLogger.log({
      userId,
      type: "content_management",
      content: `Tạo danh mục diễn đàn: ${req.body.name}`,
      target: req.body.name,
      ipAddress,
      meta: {
        action: "create",
        entity: "forum_category",
        entityId: newCategory[0]?.id,
      },
    });

    res.status(201).json(newCategory[0]);
  } catch (error: any) {
    console.error("Error creating category:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Category name already exists" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Update category (admin only)
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const ipAddress = getIpAddress(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if category exists
    const [existing] = await dbPool.query<RowDataPacket[]>(
      `SELECT * FROM forum_categories WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    if (req.body.name && !req.body.name.trim()) {
      return res.status(400).json({ error: "Category name cannot be empty" });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (req.body.name !== undefined) {
      updates.push("name = ?");
      values.push(req.body.name.trim());
    }
    if (req.body.description !== undefined) {
      updates.push("description = ?");
      values.push(req.body.description?.trim() || null);
    }
    if (req.body.icon !== undefined) {
      updates.push("icon = ?");
      values.push(req.body.icon?.trim() || null);
    }
    if (req.body.colorClass !== undefined) {
      updates.push("color_class = ?");
      values.push(req.body.colorClass?.trim() || null);
    }
    if (req.body.order !== undefined) {
      updates.push("`order` = ?");
      values.push(req.body.order);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);

    await dbPool.query(
      `UPDATE forum_categories SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    const [updated] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, name, description, icon, color_class as colorClass, \`order\`
       FROM forum_categories WHERE id = ?`,
      [id]
    );

    await auditLogger.log({
      userId,
      type: "content_management",
      content: `Cập nhật danh mục diễn đàn: ${updated[0]?.name}`,
      target: updated[0]?.name,
      ipAddress,
      meta: {
        action: "update",
        entity: "forum_category",
        entityId: id,
        changes: req.body,
      },
    });

    res.json(updated[0]);
  } catch (error: any) {
    console.error("Error updating category:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Category name already exists" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Delete category (admin only)
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const ipAddress = getIpAddress(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if category exists
    const [existing] = await dbPool.query<RowDataPacket[]>(
      `SELECT * FROM forum_categories WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check if category has posts
    const [posts] = await dbPool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM forum_posts WHERE category_id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (posts[0]?.count > 0) {
      return res.status(400).json({
        error: `Cannot delete category. It has ${posts[0].count} active post(s). Please move or delete posts first.`,
      });
    }

    await dbPool.query(`DELETE FROM forum_categories WHERE id = ?`, [id]);

    await auditLogger.log({
      userId,
      type: "content_management",
      content: `Xóa danh mục diễn đàn: ${existing[0].name}`,
      target: existing[0].name,
      ipAddress,
      meta: {
        action: "delete",
        entity: "forum_category",
        entityId: id,
      },
    });

    res.json({ message: "Category deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: error.message });
  }
};

// Internal routes (require auth - only employees)
export const getAllPosts = async (req: Request, res: Response) => {
  try {
    const posts = await forumService.getAllPosts({
      status: req.query.status as string,
      categoryId: req.query.categoryId as string,
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(posts);
  } catch (error: any) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getPostById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const post = await forumService.getPostById(id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(post);
  } catch (error: any) {
    console.error("Error fetching post:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const ipAddress = getIpAddress(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Validate required fields
    if (!req.body.title || !req.body.content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    if (!req.body.categoryId) {
      return res.status(400).json({ error: "Category is required" });
    }

    const post = await forumService.createPost({
      ...req.body,
      authorId: userId,
    });

    await auditLogger.log({
      userId,
      type: "content_management",
      content: `Tạo bài viết diễn đàn: ${post.title}`,
      target: post.title,
      ipAddress,
      meta: {
        action: "create",
        entity: "forum_post",
        entityId: post.id,
      },
    });

    res.status(201).json(post);
  } catch (error: any) {
    console.error("Error creating post:", error);
    res.status(400).json({ error: error.message });
  }
};

export const updatePost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const ipAddress = getIpAddress(req);
    const { id } = req.params;

    const existing = await forumService.getPostById(id);
    if (!existing) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = await forumService.updatePost(id, req.body);

    await auditLogger.log({
      userId,
      type: "content_management",
      content: `Cập nhật bài viết diễn đàn: ${post.title}`,
      target: post.title,
      ipAddress,
      meta: {
        action: "update",
        entity: "forum_post",
        entityId: post.id,
        changes: req.body,
      },
    });

    res.json(post);
  } catch (error: any) {
    console.error("Error updating post:", error);
    res.status(400).json({ error: error.message });
  }
};

export const deletePost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const ipAddress = getIpAddress(req);
    const { id } = req.params;

    const existing = await forumService.getPostById(id);
    if (!existing) {
      return res.status(404).json({ error: "Post not found" });
    }

    await forumService.deletePost(id);

    await auditLogger.log({
      userId,
      type: "content_management",
      content: `Xóa bài viết diễn đàn: ${existing.title}`,
      target: existing.title,
      ipAddress,
      meta: {
        action: "delete",
        entity: "forum_post",
        entityId: id,
      },
    });

    res.json({ message: "Post deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting post:", error);
    res.status(400).json({ error: error.message });
  }
};

export const moderatePost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const ipAddress = getIpAddress(req);
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status || !["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const post = await forumService.moderatePost(id, status, userId, notes);

    await auditLogger.log({
      userId,
      type: "content_management",
      content: `${
        status === "Approved" ? "Duyệt" : "Từ chối"
      } bài viết diễn đàn: ${post.title}`,
      target: post.title,
      ipAddress,
      meta: {
        action: "moderate",
        entity: "forum_post",
        entityId: post.id,
        status,
        notes,
      },
    });

    res.json(post);
  } catch (error: any) {
    console.error("Error moderating post:", error);
    res.status(400).json({ error: error.message });
  }
};

export const toggleVote = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { voteType } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await forumService.toggleVote(id, userId, voteType);
    res.json(result);
  } catch (error: any) {
    console.error("Error toggling vote:", error);
    res.status(400).json({ error: error.message });
  }
};

export const getComments = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const comments = await forumService.getComments(postId);
    res.json(comments);
  } catch (error: any) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createComment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const ipAddress = getIpAddress(req);
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.body.content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const comment = await forumService.createComment({
      ...req.body,
      postId,
      authorId: userId,
    });

    await auditLogger.log({
      userId,
      type: "content_management",
      content: `Bình luận bài viết diễn đàn`,
      target: postId,
      ipAddress,
      meta: {
        action: "create",
        entity: "forum_comment",
        entityId: comment.id,
      },
    });

    res.status(201).json(comment);
  } catch (error: any) {
    console.error("Error creating comment:", error);
    res.status(400).json({ error: error.message });
  }
};

// ==================== REACTIONS ====================

export const toggleReaction = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { targetType, targetId } = req.params;
    const { reactionType } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!["post", "comment"].includes(targetType)) {
      return res.status(400).json({ error: "Invalid target type" });
    }

    if (
      !["like", "love", "laugh", "wow", "sad", "angry"].includes(reactionType)
    ) {
      return res.status(400).json({ error: "Invalid reaction type" });
    }

    const result = await forumRepository.toggleReaction(
      userId,
      targetType as "post" | "comment",
      targetId,
      reactionType
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error toggling reaction:", error);
    res.status(400).json({ error: error.message });
  }
};

export const getReactions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { targetType, targetId } = req.params;

    if (!["post", "comment"].includes(targetType)) {
      return res.status(400).json({ error: "Invalid target type" });
    }

    const reactions = await forumRepository.getReactionCounts(
      targetType as "post" | "comment",
      targetId
    );

    const userReaction = userId
      ? await forumRepository.getUserReaction(
          userId,
          targetType as "post" | "comment",
          targetId
        )
      : null;

    res.json({ reactions, userReaction });
  } catch (error: any) {
    console.error("Error getting reactions:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== ATTACHMENTS ====================

export const getPostAttachments = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const attachments = await forumRepository.getPostAttachments(postId);
    res.json(attachments);
  } catch (error: any) {
    console.error("Error getting attachments:", error);
    res.status(500).json({ error: error.message });
  }
};

export const addAttachment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { fileName, filePath, fileType, fileSize, mimeType } = req.body;

    if (!fileName || !filePath) {
      return res
        .status(400)
        .json({ error: "fileName and filePath are required" });
    }

    const id = await forumRepository.addAttachment({
      postId,
      fileName,
      filePath,
      fileType: fileType || "file",
      fileSize: fileSize || 0,
      mimeType: mimeType || "application/octet-stream",
    });

    res
      .status(201)
      .json({ id, postId, fileName, filePath, fileType, fileSize, mimeType });
  } catch (error: any) {
    console.error("Error adding attachment:", error);
    res.status(400).json({ error: error.message });
  }
};

export const deleteAttachment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { attachmentId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await forumRepository.deleteAttachment(attachmentId);
    res.json({ message: "Attachment deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting attachment:", error);
    res.status(400).json({ error: error.message });
  }
};

// ==================== HOT TOPICS ====================

export const getHotTopics = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const topics = await forumRepository.getHotTopics(limit);
    res.json(topics);
  } catch (error: any) {
    console.error("Error getting hot topics:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== USER FORUM STATS ====================

export const getUserForumStats = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const stats = await forumRepository.getUserForumStats(userId);
    res.json(stats);
  } catch (error: any) {
    console.error("Error getting user forum stats:", error);
    res.status(500).json({ error: error.message });
  }
};
