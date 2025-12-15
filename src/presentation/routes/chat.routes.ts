import { Router } from "express";
import { ChatController } from "../controllers/ChatController.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateChatAttachmentUpload } from "../middlewares/fileValidation.middleware.js";
import multer from "multer";
import path from "path";

const router = Router();
const chatController = new ChatController();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/chat/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// All routes require authentication
router.use(authMiddleware);

// Get all conversations
router.get("/conversations", chatController.getConversations);

// Get or create conversation with specific user
router.get(
  "/conversations/with/:otherUserId",
  chatController.getOrCreateConversation
);

// Get messages for conversation
router.get(
  "/conversations/:conversationId/messages",
  chatController.getMessages
);

// Send message (REST backup)
router.post("/messages", chatController.sendMessage);

// Mark messages as read
router.put("/conversations/:conversationId/read", chatController.markAsRead);

// Delete message
router.delete("/messages/:messageId", chatController.deleteMessage);

// Search messages
router.get("/search", chatController.searchMessages);

// Search users to start new chat
router.get("/users", chatController.searchUsers);

// Get online users
router.get("/online-users", chatController.getOnlineUsers);

// Upload attachment with magic byte content validation
router.post("/upload", upload.single("file"), validateChatAttachmentUpload, chatController.uploadAttachment);

// Group chat routes
router.post("/groups", chatController.createGroup);
router.get("/groups", chatController.getGroups);
router.get("/groups/:groupId/members", chatController.getGroupMembers);
router.get("/groups/:groupId/messages", chatController.getGroupMessages);
router.post("/groups/:groupId/messages", chatController.sendGroupMessage);

export default router;
