import { Request, Response } from "express";
import { CommentService } from "../../application/services/CommentService.js";

const commentService = new CommentService();

/**
 * GET /api/comments/:type/:id
 * Get all comments for a thread (forum_post or task)
 */
export const getCommentsByThread = async (req: Request, res: Response) => {
    try {
        const { type, id } = req.params;
        const userId = (req as any).user?.userId;

        if (!['forum_post', 'task'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid type. Must be 'forum_post' or 'task'"
            });
        }

        const comments = await commentService.getCommentsByThread(
            type as 'forum_post' | 'task',
            id,
            userId
        );

        res.json({ success: true, data: comments });
    } catch (error: any) {
        console.error("Error getting comments:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Lỗi khi lấy comments"
        });
    }
};

/**
 * POST /api/comments
 * Create a new comment
 */
export const createComment = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        const { commentable_type, commentable_id, parent_id, content } = req.body;

        if (!commentable_type || !commentable_id || !content) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        const comment = await commentService.createComment(
            { commentable_type, commentable_id, parent_id, content },
            userId
        );

        res.status(201).json({ success: true, data: comment });
    } catch (error: any) {
        console.error("Error creating comment:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Lỗi khi tạo comment"
        });
    }
};

/**
 * PUT /api/comments/:id
 * Update comment content
 */
export const updateComment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = (req as any).user?.userId;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: "Content is required"
            });
        }

        const comment = await commentService.updateComment(id, content, userId);
        res.json({ success: true, data: comment });
    } catch (error: any) {
        console.error("Error updating comment:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Lỗi khi cập nhật comment"
        });
    }
};

/**
 * POST /api/comments/:id/retract
 * Soft retract comment
 */
export const retractComment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId;

        await commentService.retractComment(id, userId);
        res.json({ success: true, message: "Comment đã được thu hồi" });
    } catch (error: any) {
        console.error("Error retracting comment:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Lỗi khi thu hồi comment"
        });
    }
};

/**
 * DELETE /api/comments/:id
 * Soft delete comment
 */
export const deleteComment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId;

        await commentService.deleteComment(id, userId);
        res.json({ success: true, message: "Comment đã được xóa" });
    } catch (error: any) {
        console.error("Error deleting comment:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Lỗi khi xóa comment"
        });
    }
};

/**
 * POST /api/comments/:id/reactions
 * Toggle reaction on comment
 */
export const toggleReaction = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reaction_type } = req.body;
        const userId = (req as any).user?.userId;

        const validReactions = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];
        if (!validReactions.includes(reaction_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid reaction type"
            });
        }

        await commentService.toggleReaction(id, userId, reaction_type);
        res.json({ success: true, message: "Reaction updated" });
    } catch (error: any) {
        console.error("Error toggling reaction:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Lỗi khi react"
        });
    }
};

/**
 * GET /api/comments/:id/history
 * Get edit history
 */
export const getEditHistory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId;

        const history = await commentService.getEditHistory(id, userId);
        res.json({ success: true, data: history });
    } catch (error: any) {
        console.error("Error getting edit history:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Lỗi khi lấy lịch sử chỉnh sửa"
        });
    }
};
