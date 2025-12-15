import { Request, Response } from "express";
import { ChatService } from "../../application/services/ChatService.js";
import { UserRepository } from "../../infrastructure/repositories/UserRepository.js";
import { GroupChatRepository } from "../../infrastructure/repositories/GroupChatRepository.js";

export class ChatController {
  private chatService = new ChatService();
  private userRepo = new UserRepository();
  private groupRepo = new GroupChatRepository();

  // Get all conversations for current user
  getConversations = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const conversations = await this.chatService.getUserConversations(userId);

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error: any) {
      console.error("Error getting conversations:", error);

      res.status(500).json({
        success: false,
        message: "Không thể tải danh sách hội thoại",
      });
    }
  };

  // Get or create conversation with a specific user
  getOrCreateConversation = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { otherUserId } = req.params;

      const conversation = await this.chatService.getOrCreateConversation(
        userId,
        otherUserId
      );

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      console.error("Error getting conversation:", error);
      res.status(500).json({
        success: false,
        message: "Không thể tạo hội thoại",
      });
    }
  };

  // Get messages for a conversation
  getMessages = async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const messages = await this.chatService.getConversationMessages(
        conversationId,
        limit,
        offset
      );

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      console.error("Error getting messages:", error);
      res.status(500).json({
        success: false,
        message: "Không thể tải tin nhắn",
      });
    }
  };

  // Send message (REST API - backup for socket.io)
  sendMessage = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { conversationId, recipientId, messageText, messageType } =
        req.body;

      const message = await this.chatService.sendMessage({
        conversationId,
        senderId: userId,
        recipientId,
        messageText,
        messageType,
      });

      res.json({
        success: true,
        data: message,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({
        success: false,
        message: "Không thể gửi tin nhắn",
      });
    }
  };

  // Mark messages as read
  markAsRead = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { conversationId } = req.params;

      await this.chatService.markMessagesAsRead(conversationId, userId);

      res.json({
        success: true,
        message: "Đã đánh dấu tin nhắn là đã đọc",
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({
        success: false,
        message: "Không thể đánh dấu tin nhắn",
      });
    }
  };

  // Delete message
  deleteMessage = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { messageId } = req.params;

      const deleted = await this.chatService.deleteMessage(messageId, userId);

      if (deleted) {
        res.json({
          success: true,
          message: "Đã xóa tin nhắn",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Không tìm thấy tin nhắn hoặc bạn không có quyền xóa",
        });
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({
        success: false,
        message: "Không thể xóa tin nhắn",
      });
    }
  };

  // Search messages
  searchMessages = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập từ khóa tìm kiếm",
        });
      }

      const messages = await this.chatService.searchMessages(userId, q);

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      console.error("Error searching messages:", error);
      res.status(500).json({
        success: false,
        message: "Không thể tìm kiếm tin nhắn",
      });
    }
  };

  // Get online users
  getOnlineUsers = async (req: Request, res: Response) => {
    try {
      const users = await this.chatService.getOnlineUsers();

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      console.error("Error getting online users:", error);
      res.status(500).json({
        success: false,
        message: "Không thể tải danh sách người dùng online",
      });
    }
  };

  // Upload attachment
  uploadAttachment = async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Không có file được tải lên",
        });
      }

      const userId = (req as any).user.userId;
      const { conversationId, messageText } = req.body;
      const file = req.file;

      // Create message with file
      const message = await this.chatService.sendMessage({
        conversationId,
        senderId: userId,
        messageText: messageText || null, // Allow empty text for image-only messages
        messageType: file.mimetype.startsWith("image/") ? "image" : "file",
      });

      // Create attachment
      const attachmentId = await this.chatService.createAttachment({
        messageId: message.id,
        fileName: file.originalname,
        filePath: file.path,
        fileType: file.mimetype.split("/")[0],
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      res.json({
        success: true,
        data: {
          id: attachmentId,
          messageId: message.id,
          fileName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
      });
    } catch (error) {
      console.error("Error uploading attachment:", error);
      res.status(500).json({
        success: false,
        message: "Không thể tải file lên",
      });
    }
  };

  // Search users to start new conversation
  searchUsers = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        // Return all users if no search term
        const users = await this.userRepo.getAllUsers(userId);
        return res.json({
          success: true,
          data: users,
        });
      }

      const users = await this.userRepo.searchUsers(q, userId);

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({
        success: false,
        message: "Không thể tìm kiếm người dùng",
      });
    }
  };

  // Create group conversation
  createGroup = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { name, memberIds } = req.body;

      if (
        !name ||
        !memberIds ||
        !Array.isArray(memberIds) ||
        memberIds.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Tên nhóm và danh sách thành viên là bắt buộc",
        });
      }

      // Create group
      const groupId = await this.groupRepo.createGroupConversation(
        name,
        userId
      );

      // Add creator as admin
      await this.groupRepo.addGroupMembers(groupId, [userId], "admin");

      // Add other members
      await this.groupRepo.addGroupMembers(groupId, memberIds, "member");

      // Send system message
      await this.groupRepo.sendGroupMessage(
        groupId,
        userId,
        `${(req as any).user.full_name || "User"} đã tạo nhóm`,
        "system"
      );

      res.json({
        success: true,
        data: { id: groupId, name },
        message: "Tạo nhóm thành công",
      });
    } catch (error) {
      console.error("Error creating group:", error);
      res.status(500).json({
        success: false,
        message: "Không thể tạo nhóm",
      });
    }
  };

  // Get user's group conversations
  getGroups = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const groups = await this.groupRepo.getUserGroupConversations(userId);

      res.json({
        success: true,
        data: groups,
      });
    } catch (error) {
      console.error("Error getting groups:", error);
      res.status(500).json({
        success: false,
        message: "Không thể tải danh sách nhóm",
      });
    }
  };

  // Get group members
  getGroupMembers = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const members = await this.groupRepo.getGroupMembers(groupId);

      res.json({
        success: true,
        data: members,
      });
    } catch (error) {
      console.error("Error getting group members:", error);
      res.status(500).json({
        success: false,
        message: "Không thể tải danh sách thành viên",
      });
    }
  };

  // Get group messages
  getGroupMessages = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const messages = await this.groupRepo.getGroupMessages(groupId, limit);

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      console.error("Error getting group messages:", error);
      res.status(500).json({
        success: false,
        message: "Không thể tải tin nhắn nhóm",
      });
    }
  };

  // Send group message
  sendGroupMessage = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { groupId } = req.params;
      const { messageText, messageType } = req.body;

      const messageId = await this.groupRepo.sendGroupMessage(
        groupId,
        userId,
        messageText,
        messageType || "text"
      );

      res.json({
        success: true,
        data: { id: messageId },
        message: "Gửi tin nhắn thành công",
      });
    } catch (error) {
      console.error("Error sending group message:", error);
      res.status(500).json({
        success: false,
        message: "Không thể gửi tin nhắn",
      });
    }
  };
}
