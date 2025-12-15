import { CommentRepository } from "../../infrastructure/repositories/CommentRepository.js";
import { ProjectRepository } from "../../infrastructure/repositories/ProjectRepository.js";
import { UserRepository } from "../../infrastructure/repositories/UserRepository.js";
import { NotificationService } from "./NotificationService.js";
import { sanitize } from "../validators/htmlSanitizer.js";
import type { Comment, CreateCommentDto, ReactionType } from "../../domain/entities/Comment.js";

export class CommentService {
    private commentRepo = new CommentRepository();
    private projectRepo = new ProjectRepository();
    private userRepo = new UserRepository();
    private notificationService = new NotificationService();

    /**
     * Create a new comment
     */
    async createComment(data: CreateCommentDto, userId: string): Promise<Comment> {
        // Permission check
        const hasAccess = await this.canAccessThread(userId, data.commentable_type, data.commentable_id);
        if (!hasAccess) {
            throw new Error("Bạn không có quyền comment vào thread này");
        }

        // Sanitize HTML content to prevent XSS attacks (Requirements: 2.2)
        const sanitizedContent = sanitize(data.content);

        // Create comment
        const commentId = await this.commentRepo.create({
            ...data,
            content: sanitizedContent,
            author_id: userId,
        });

        // Handle mentions
        const mentionedUserIds = this.extractMentions(data.content);
        for (const mentionedId of mentionedUserIds) {
            await this.commentRepo.addMention(commentId, mentionedId);
        }

        // Send notifications
        await this.notifyCommentActivity(commentId, data);

        // Return created comment
        const comment = await this.commentRepo.findById(commentId);
        if (!comment) throw new Error("Comment not found after creation");

        return comment;
    }

    /**
     * Get comments by thread
     */
    async getCommentsByThread(
        type: 'forum_post' | 'task',
        id: string,
        userId?: string
    ): Promise<Comment[]> {
        // Permission check
        if (userId) {
            const hasAccess = await this.canAccessThread(userId, type, id);
            if (!hasAccess) {
                throw new Error("Bạn không có quyền xem comments của thread này");
            }
        }

        const comments = await this.commentRepo.findByThread(type, id, userId);

        // Build comment tree (nest replies)
        return this.buildCommentTree(comments);
    }

    /**
     * Update comment content
     */
    async updateComment(commentId: string, content: string, userId: string): Promise<Comment> {
        // Permission check
        const canEdit = await this.canEditComment(userId, commentId);
        if (!canEdit) {
            throw new Error("Bạn không có quyền chỉnh sửa comment này");
        }

        // Sanitize HTML content to prevent XSS attacks (Requirements: 2.2)
        const sanitizedContent = sanitize(content);

        await this.commentRepo.update(commentId, sanitizedContent, userId);

        const comment = await this.commentRepo.findById(commentId);
        if (!comment) throw new Error("Comment not found");

        return comment;
    }

    /**
     * Soft retract comment
     */
    async retractComment(commentId: string, userId: string): Promise<void> {
        // Permission check: only author can retract
        const comment = await this.commentRepo.findById(commentId);
        if (!comment) throw new Error("Comment not found");

        if (comment.author_id !== userId) {
            throw new Error("Chỉ tác giả mới có thể thu hồi comment");
        }

        if (comment.is_retracted) {
            throw new Error("Comment đã được thu hồi rồi");
        }

        await this.commentRepo.softRetract(commentId);
    }

    /**
     * Delete comment (soft delete)
     */
    async deleteComment(commentId: string, userId: string): Promise<void> {
        // Permission check: author or admin/manager
        const comment = await this.commentRepo.findById(commentId);
        if (!comment) throw new Error("Comment not found");

        const user = await this.userRepo.findById(userId);
        const isAuthor = comment.author_id === userId;
        const isAdminOrManager = user && ['Admin', 'Manager'].includes(user.role);

        if (!isAuthor && !isAdminOrManager) {
            throw new Error("Bạn không có quyền xóa comment này");
        }

        await this.commentRepo.softDelete(commentId);
    }

    /**
     * Get edit history
     */
    async getEditHistory(commentId: string, userId: string) {
        // Permission check: author or admin/manager
        const comment = await this.commentRepo.findById(commentId);
        if (!comment) throw new Error("Comment not found");

        const user = await this.userRepo.findById(userId);
        const isAuthor = comment.author_id === userId;
        const isAdminOrManager = user && ['Admin', 'Manager'].includes(user.role);

        if (!isAuthor && !isAdminOrManager) {
            throw new Error("Bạn không có quyền xem lịch sử chỉnh sửa");
        }

        return await this.commentRepo.getEditHistory(commentId);
    }

    /**
     * Toggle reaction
     */
    async toggleReaction(commentId: string, userId: string, reactionType: ReactionType): Promise<void> {
        // Permission check: can access thread
        const comment = await this.commentRepo.findById(commentId);
        if (!comment) throw new Error("Comment not found");

        const hasAccess = await this.canAccessThread(userId, comment.commentable_type, comment.commentable_id);
        if (!hasAccess) {
            throw new Error("Bạn không có quyền react vào comment này");
        }

        await this.commentRepo.toggleReaction(commentId, userId, reactionType);
    }

    // ===================
    // PRIVATE HELPERS
    // ===================

    /**
     * Check if user can access thread (read/write comments)
     */
    private async canAccessThread(userId: string, type: string, id: string): Promise<boolean> {
        if (type === 'forum_post') {
            // Forum: any authenticated user in DB can access
            const user = await this.userRepo.findById(userId);
            return !!user;
        }

        if (type === 'task') {
            // Task: only project members can access
            // Lấy project_id từ task
            const [taskData] = await this.commentRepo['db'].query(
                'SELECT project_id FROM tasks WHERE id = ?',
                [id]
            ) as any;

            if (!taskData || taskData.length === 0) return false; // Task not found

            const projectId = taskData[0].project_id;

            // Check if user is project member OR admin/manager
            const user = await this.userRepo.findById(userId);
            if (user && ['Admin', 'Manager'].includes(user.role)) return true;

            const isMember = await this.projectRepo.isMember(projectId, userId);
            return isMember;
        }

        return false;
    }

    /**
     * Check if user can edit comment
     */
    private async canEditComment(userId: string, commentId: string): Promise<boolean> {
        const comment = await this.commentRepo.findById(commentId);
        if (!comment) return false;

        // Only author can edit
        if (comment.author_id !== userId) return false;

        // Cannot edit retracted comments
        if (comment.is_retracted) return false;

        // TODO: Add time window check (e.g., 15 minutes)
        // const editWindow = 15 * 60 * 1000; // 15 minutes
        // const timeSinceCreation = Date.now() - new Date(comment.created_at).getTime();
        // if (timeSinceCreation > editWindow) return false;

        return true;
    }

    /**
     * Build comment tree (nest replies under parent)
     */
    private buildCommentTree(comments: Comment[]): Comment[] {
        const commentMap = new Map<string, Comment>();
        const rootComments: Comment[] = [];

        // First pass: create map
        comments.forEach(comment => {
            commentMap.set(comment.id, { ...comment, replies: [] });
        });

        // Second pass: build tree
        comments.forEach(comment => {
            const commentWithReplies = commentMap.get(comment.id)!;

            if (comment.parent_id) {
                const parent = commentMap.get(comment.parent_id);
                if (parent) {
                    parent.replies = parent.replies || [];
                    parent.replies.push(commentWithReplies);
                }
            } else {
                rootComments.push(commentWithReplies);
            }
        });

        return rootComments;
    }

    /**
     * Extract @mentions from content
     */
    private extractMentions(content: string): string[] {
        const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
        const mentions: string[] = [];
        let match;

        while ((match = mentionRegex.exec(content)) !== null) {
            mentions.push(match[2]); // capture user ID
        }

        return mentions;
    }

    /**
     * Send notifications for comment activity
     */
    private async notifyCommentActivity(commentId: string, data: CreateCommentDto): Promise<void> {
        const comment = await this.commentRepo.findById(commentId);
        if (!comment) return;

        const recipients = new Set<string>();

        // 1. Notify parent comment author (if reply)
        if (data.parent_id) {
            const parent = await this.commentRepo.findById(data.parent_id);
            if (parent && parent.author_id !== comment.author_id) {
                recipients.add(parent.author_id);
            }
        }

        // 2. Notify mentioned users
        const mentions = await this.commentRepo.getMentions(commentId);
        mentions.forEach(userId => {
            if (userId !== comment.author_id) {
                recipients.add(userId);
            }
        });

        // TODO: 3. Notify thread followers (implement later)

        // Send notifications
        if (recipients.size > 0) {
            await this.notificationService.notifyUsers(
                Array.from(recipients),
                'Bình luận mới',
                `${comment.author?.full_name} đã bình luận`,
                'comment',
                commentId
            );
        }
    }
}
