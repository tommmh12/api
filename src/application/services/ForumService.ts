import { ForumRepository } from "../../infrastructure/repositories/ForumRepository.js";
import { ForumPost, ForumComment } from "../../domain/entities/ForumPost.js";
import { sanitize } from "../validators/htmlSanitizer.js";

export class ForumService {
  constructor(private forumRepository: ForumRepository) { }

  async getAllPosts(options?: {
    status?: string;
    categoryId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ForumPost[]> {
    return await this.forumRepository.findAll(options);
  }

  async getPostById(id: string, recordView = false, _userId?: string): Promise<ForumPost | null> {
    const post = await this.forumRepository.findById(id);
    if (post && recordView) {
      await this.forumRepository.incrementViewCount(id);
      // Reload to get updated view count
      return await this.forumRepository.findById(id);
    }
    return post;
  }

  async createPost(postData: Partial<ForumPost>): Promise<ForumPost> {
    if (!postData.title || !postData.content || !postData.authorId || !postData.categoryId) {
      throw new Error("Title, content, authorId, and categoryId are required");
    }

    // Sanitize HTML content to prevent XSS attacks (Requirements: 2.2)
    const sanitizedContent = sanitize(postData.content);

    return await this.forumRepository.create({
      ...postData,
      content: sanitizedContent,
      status: postData.status || "Pending",
    });
  }

  async updatePost(id: string, postData: Partial<ForumPost>): Promise<ForumPost> {
    const existing = await this.forumRepository.findById(id);
    if (!existing) {
      throw new Error("Post not found");
    }

    // Sanitize HTML content if provided to prevent XSS attacks (Requirements: 2.2)
    const sanitizedData = postData.content
      ? { ...postData, content: sanitize(postData.content) }
      : postData;

    await this.forumRepository.update(id, sanitizedData);
    const updated = await this.forumRepository.findById(id);
    if (!updated) throw new Error("Failed to update post");
    return updated;
  }

  async moderatePost(
    id: string,
    status: "Approved" | "Rejected",
    moderatedBy: string,
    notes?: string
  ): Promise<ForumPost> {
    const post = await this.forumRepository.findById(id);
    if (!post) {
      throw new Error("Post not found");
    }

    await this.forumRepository.update(id, {
      status,
      moderatedBy,
      moderatedAt: new Date(),
      moderationNotes: notes,
    });

    const updated = await this.forumRepository.findById(id);
    if (!updated) throw new Error("Failed to moderate post");
    return updated;
  }

  async deletePost(id: string): Promise<void> {
    const post = await this.forumRepository.findById(id);
    if (!post) {
      throw new Error("Post not found");
    }
    await this.forumRepository.delete(id);
  }

  async toggleVote(postId: string, userId: string, voteType: 1 | -1): Promise<{ voted: boolean; upvoteCount: number; downvoteCount: number }> {
    return await this.forumRepository.toggleVote(postId, userId, voteType);
  }

  // Comments
  async getComments(postId: string): Promise<ForumComment[]> {
    return await this.forumRepository.findComments(postId);
  }

  async createComment(commentData: Partial<ForumComment>): Promise<ForumComment> {
    if (!commentData.postId || !commentData.content || !commentData.authorId) {
      throw new Error("PostId, content, and authorId are required");
    }

    // Sanitize HTML content to prevent XSS attacks (Requirements: 2.2)
    const sanitizedContent = sanitize(commentData.content);

    return await this.forumRepository.createComment({
      ...commentData,
      content: sanitizedContent,
    });
  }
}

