export interface ForumPost {
  id: string;
  categoryId: string;
  categoryName?: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  title: string;
  content: string;
  status: "Pending" | "Approved" | "Rejected";
  moderatedBy?: string;
  moderatedAt?: Date;
  moderationNotes?: string;
  isPinned: boolean;
  viewCount: number;
  upvoteCount: number;
  downvoteCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  tags?: string[];
}

export interface ForumComment {
  id: string;
  postId: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  content: string;
  parentId?: string;
  upvoteCount: number;
  downvoteCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

