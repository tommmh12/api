export interface NewsArticle {
  id: string;
  title: string;
  summary?: string;
  content: string;
  coverImage?: string;
  category: "Strategy" | "Event" | "Culture" | "Announcement";
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  status: "Draft" | "Published" | "Archived";
  moderationStatus: "Pending" | "Approved" | "Rejected";
  moderatedBy?: string;
  moderatedAt?: Date;
  moderationNotes?: string;
  isPublic: boolean;
  isFeatured: boolean;
  readTime?: string;
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  tags?: string[];
}

export interface NewsComment {
  id: string;
  articleId: string;
  userId?: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  parentId?: string;
  moderationStatus: "Pending" | "Approved" | "Rejected";
  moderatedBy?: string;
  moderatedAt?: Date;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

