import { Router } from "express";
import * as ForumController from "../controllers/ForumController.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createForumPostSchema,
  updateForumPostSchema,
  forumPostIdParamSchema,
  moderateForumPostSchema,
  toggleVoteSchema,
  createForumCommentSchema,
  toggleForumReactionSchema,
  createCategorySchema,
  updateCategorySchema,
} from "../../application/validators/schemas/index.js";

const router = Router();

// Public category endpoint (no auth required)
router.get("/categories", ForumController.getCategories);

// All other forum routes require authentication (internal only)
router.use(authMiddleware);

// Category management routes (admin only)
router.post("/categories", validate(createCategorySchema), ForumController.createCategory);
router.put("/categories/:id", validate(updateCategorySchema), ForumController.updateCategory);
router.delete("/categories/:id", ForumController.deleteCategory);

// Hot topics endpoint
router.get("/hot-topics", ForumController.getHotTopics);

// User forum stats endpoint
router.get("/user-stats/:userId", ForumController.getUserForumStats);

router.get("/", ForumController.getAllPosts);
router.get("/:id", validate(forumPostIdParamSchema), ForumController.getPostById);
router.post("/", validate(createForumPostSchema), ForumController.createPost);
router.put("/:id", validate(updateForumPostSchema), ForumController.updatePost);
router.delete("/:id", validate(forumPostIdParamSchema), ForumController.deletePost);
router.post("/:id/moderate", validate(moderateForumPostSchema), ForumController.moderatePost);
router.post("/:id/vote", validate(toggleVoteSchema), ForumController.toggleVote);
router.get("/:postId/comments", ForumController.getComments);
router.post("/:postId/comments", validate(createForumCommentSchema), ForumController.createComment);

// Reaction endpoints
router.post("/:targetType/:targetId/reaction", validate(toggleForumReactionSchema), ForumController.toggleReaction);
router.get("/:targetType/:targetId/reactions", ForumController.getReactions);

// Attachment endpoints
router.get("/:postId/attachments", ForumController.getPostAttachments);
router.post("/:postId/attachments", ForumController.addAttachment);
router.delete("/attachments/:attachmentId", ForumController.deleteAttachment);

export default router;
