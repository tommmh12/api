export interface Comment {
    id: string;
    commentable_type: 'forum_post' | 'task';
    commentable_id: string;
    parent_id: string | null;
    author_id: string;
    content: string;
    original_content: string | null;
    is_edited: boolean;
    is_retracted: boolean;
    reply_count?: number; // Optional - not always returned
    created_at: Date;
    updated_at: Date;
    retracted_at: Date | null;
    deleted_at: Date | null;

    // Populated fields (joins)
    author?: {
        id: string;
        full_name: string;
        avatar_url: string;
    };
    replies?: Comment[];
    reactions?: ReactionSummary;
    user_reaction?: string | null;
}

export interface ReactionSummary {
    like: number;
    love: number;
    laugh: number;
    wow: number;
    sad: number;
    angry: number;
}

export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';

export interface CommentEditHistory {
    id: string;
    comment_id: string;
    old_content: string;
    edited_by: string;
    edited_at: Date;
    editor?: {
        full_name: string;
    };
}

export interface CreateCommentDto {
    commentable_type: 'forum_post' | 'task';
    commentable_id: string;
    parent_id?: string;
    content: string;
}
