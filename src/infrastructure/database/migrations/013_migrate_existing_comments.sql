-- =====================================================
-- Migration: Migrate Existing Comments to Unified System
-- Migrate data from forum_comments and task_comments
-- to the new unified comments table
-- =====================================================

USE nexus_db;

-- ============================================
-- STEP 1: Migrate forum_comments to comments
-- ============================================

INSERT INTO comments (
    id, 
    commentable_type, 
    commentable_id, 
    parent_id, 
    author_id, 
    content, 
    created_at, 
    updated_at, 
    deleted_at
)
SELECT 
    id, 
    'forum_post' as commentable_type, 
    post_id as commentable_id,
    parent_id,
    author_id,
    content,
    created_at,
    updated_at,
    deleted_at
FROM forum_comments
WHERE id NOT IN (SELECT id FROM comments);  -- Tránh duplicate nếu chạy lại

-- ============================================
-- STEP 2: Migrate task_comments to comments
-- ============================================

INSERT INTO comments (
    id, 
    commentable_type, 
    commentable_id, 
    parent_id,  -- task_comments không có nested replies
    author_id, 
    content, 
    created_at, 
    updated_at, 
    deleted_at
)
SELECT 
    id,
    'task' as commentable_type,
    task_id as commentable_id,
    NULL as parent_id,  -- Task comments hiện tại không có replies
    user_id as author_id,
    content,
    created_at,
    updated_at,
    deleted_at
FROM task_comments
WHERE id NOT IN (SELECT id FROM comments);  -- Tránh duplicate

-- ============================================
-- STEP 3: Migrate forum_votes to comment_reactions
-- ============================================

-- Chuyển upvote/downvote thành like/sad reactions
INSERT INTO comment_reactions (
    id,
    comment_id,
    user_id,
    reaction_type,
    created_at
)
SELECT 
    UUID() as id,
    votable_id as comment_id,
    user_id,
    CASE 
        WHEN vote_type = 1 THEN 'like'
        ELSE 'sad'
    END as reaction_type,
    created_at
FROM forum_votes
WHERE votable_type = 'comment'
  AND votable_id IN (SELECT id FROM comments)  -- Chỉ migrate vote cho comments tồn tại
  AND CONCAT(user_id, '-', votable_id) NOT IN (
      SELECT CONCAT(user_id, '-', comment_id) FROM comment_reactions
  );  -- Tránh duplicate

-- ============================================
-- STEP 4: Update reply_count for parent comments
-- ============================================

UPDATE comments c
SET reply_count = (
    SELECT COUNT(*) 
    FROM comments child 
    WHERE child.parent_id = c.id 
      AND child.deleted_at IS NULL
)
WHERE c.id IN (
    SELECT DISTINCT parent_id 
    FROM comments 
    WHERE parent_id IS NOT NULL
);

-- ============================================
-- NOTE: Không xóa bảng cũ ngay, giữ lại để rollback nếu cần
-- Sau khi verify hoạt động ổn thì mới chạy:
-- DROP TABLE IF EXISTS forum_comments;
-- DROP TABLE IF EXISTS task_comments;
-- ============================================
