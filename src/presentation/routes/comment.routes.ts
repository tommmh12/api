import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  getCommentsByThreadSchema,
  createCommentSchema,
  updateCommentSchema,
  commentIdParamSchema,
  toggleReactionSchema,
  getDecisionsByCommentSchema,
} from "../../application/validators/schemas/index.js";
import * as CommentController from "../controllers/CommentController.js";
import * as DecisionController from "../controllers/DecisionRecordController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get comments by thread (forum_post or task)
router.get("/:type/:id", validate(getCommentsByThreadSchema), CommentController.getCommentsByThread);

// Create comment
router.post("/", validate(createCommentSchema), CommentController.createComment);

// Update comment
router.put("/:id", validate(updateCommentSchema), CommentController.updateComment);

// Retract comment
router.post("/:id/retract", validate(commentIdParamSchema), CommentController.retractComment);

// Delete comment
router.delete("/:id", validate(commentIdParamSchema), CommentController.deleteComment);

// Toggle reaction
router.post("/:id/reactions", validate(toggleReactionSchema), CommentController.toggleReaction);

// Get edit history
router.get("/:id/history", validate(commentIdParamSchema), CommentController.getEditHistory);

// Get decisions linked to a comment (Requirements: 10.4)
router.get("/:commentId/decisions", validate(getDecisionsByCommentSchema), DecisionController.getDecisionsByComment);

export default router;
