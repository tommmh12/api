import { NewsRepository } from "../../infrastructure/repositories/NewsRepository.js";
import { NewsArticle, NewsComment } from "../../domain/entities/NewsArticle.js";
import { sanitize } from "../validators/htmlSanitizer.js";

export class NewsService {
  constructor(private newsRepository: NewsRepository) {}

  async getAllArticles(options?: {
    status?: string;
    moderationStatus?: string;
    isPublic?: boolean;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<NewsArticle[]> {
    return await this.newsRepository.findAll(options);
  }

  async getArticleById(id: string, recordView = false, userId?: string, userIp?: string, userAgent?: string): Promise<NewsArticle | null> {
    const article = await this.newsRepository.findById(id);
    if (article && recordView) {
      await this.newsRepository.incrementViewCount(id);
      await this.newsRepository.recordView(id, userId, userIp, userAgent);
      // Reload to get updated view count
      return await this.newsRepository.findById(id);
    }
    return article;
  }

  async createArticle(articleData: Partial<NewsArticle>): Promise<NewsArticle> {
    if (!articleData.title || !articleData.content || !articleData.authorId) {
      throw new Error("Title, content, and authorId are required");
    }

    // Sanitize HTML content to prevent XSS attacks (Requirements: 2.2)
    const sanitizedContent = sanitize(articleData.content);

    return await this.newsRepository.create({
      ...articleData,
      content: sanitizedContent,
      moderationStatus: articleData.moderationStatus || "Pending",
      status: articleData.status || "Draft",
    });
  }

  async updateArticle(id: string, articleData: Partial<NewsArticle>): Promise<NewsArticle> {
    const existing = await this.newsRepository.findById(id);
    if (!existing) {
      throw new Error("Article not found");
    }

    // Sanitize HTML content if provided to prevent XSS attacks (Requirements: 2.2)
    const sanitizedData = articleData.content 
      ? { ...articleData, content: sanitize(articleData.content) }
      : articleData;

    await this.newsRepository.update(id, sanitizedData);
    const updated = await this.newsRepository.findById(id);
    if (!updated) throw new Error("Failed to update article");
    return updated;
  }

  async moderateArticle(
    id: string,
    status: "Approved" | "Rejected",
    moderatedBy: string,
    notes?: string
  ): Promise<NewsArticle> {
    const article = await this.newsRepository.findById(id);
    if (!article) {
      throw new Error("Article not found");
    }

    const updateData: Partial<NewsArticle> = {
      moderationStatus: status,
      moderatedBy,
      moderatedAt: new Date(),
      moderationNotes: notes,
    };

    // Auto-publish if approved
    if (status === "Approved" && article.status === "Draft") {
      updateData.status = "Published";
      updateData.publishedAt = new Date();
    }

    await this.newsRepository.update(id, updateData);
    const updated = await this.newsRepository.findById(id);
    if (!updated) throw new Error("Failed to moderate article");
    return updated;
  }

  async deleteArticle(id: string): Promise<void> {
    const article = await this.newsRepository.findById(id);
    if (!article) {
      throw new Error("Article not found");
    }
    await this.newsRepository.delete(id);
  }

  async toggleLike(articleId: string, userId?: string, userIp?: string): Promise<{ liked: boolean; likeCount: number }> {
    return await this.newsRepository.toggleLike(articleId, userId, userIp);
  }

  // Comments
  async getComments(articleId: string): Promise<NewsComment[]> {
    return await this.newsRepository.findComments(articleId);
  }

  async createComment(commentData: Partial<NewsComment>): Promise<NewsComment> {
    if (!commentData.articleId || !commentData.content || !commentData.authorName) {
      throw new Error("ArticleId, content, and authorName are required");
    }

    // Sanitize HTML content to prevent XSS attacks (Requirements: 2.2)
    const sanitizedContent = sanitize(commentData.content);

    return await this.newsRepository.createComment({
      ...commentData,
      content: sanitizedContent,
      moderationStatus: commentData.moderationStatus || "Pending",
    });
  }

  async moderateComment(
    commentId: string,
    status: "Approved" | "Rejected",
    moderatedBy: string,
    notes?: string
  ): Promise<void> {
    await this.newsRepository.moderateComment(commentId, status, moderatedBy);
  }
}

