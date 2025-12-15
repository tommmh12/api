import { ChatRepository } from "../../infrastructure/repositories/ChatRepository.js";
import { sanitize } from "../validators/htmlSanitizer.js";

export class ChatService {
  private chatRepo = new ChatRepository();

  async getOrCreateConversation(user1Id: string, user2Id: string) {
    return await this.chatRepo.getOrCreateConversation(user1Id, user2Id);
  }

  async getUserConversations(userId: string) {
    return await this.chatRepo.getUserConversations(userId);
  }

  async sendMessage(messageData: {
    conversationId?: string;
    senderId: string;
    recipientId?: string;
    messageText?: string;
    messageType?: string;
  }) {
    let conversationId = messageData.conversationId;

    // If no conversation ID, create or get conversation with recipient
    if (!conversationId && messageData.recipientId) {
      const conversation = await this.chatRepo.getOrCreateConversation(
        messageData.senderId,
        messageData.recipientId
      );
      conversationId = conversation.id;
    }

    if (!conversationId) {
      throw new Error("No conversation ID or recipient ID provided");
    }

    // Sanitize HTML content in message text to prevent XSS attacks (Requirements: 2.2)
    const sanitizedMessageText = messageData.messageText
      ? sanitize(messageData.messageText)
      : messageData.messageText;

    await this.chatRepo.createMessage({
      conversationId,
      senderId: messageData.senderId,
      messageText: sanitizedMessageText,
      messageType: messageData.messageType || "text",
    });

    // Get the created message with full details
    const messages = await this.chatRepo.getConversationMessages(
      conversationId,
      1
    );
    return messages[0];
  }

  async getConversationMessages(
    conversationId: string,
    limit?: number,
    offset?: number
  ) {
    return await this.chatRepo.getConversationMessages(
      conversationId,
      limit,
      offset
    );
  }

  async markMessagesAsRead(conversationId: string, userId: string) {
    await this.chatRepo.markMessagesAsRead(conversationId, userId);
  }

  async deleteMessage(messageId: string, userId: string) {
    return await this.chatRepo.deleteMessage(messageId, userId);
  }

  async updateUserStatus(userId: string, status: string, socketId?: string) {
    await this.chatRepo.updateUserStatus(userId, status, socketId);
  }

  async getUserStatus(userId: string) {
    return await this.chatRepo.getUserStatus(userId);
  }

  async getOnlineUsers() {
    return await this.chatRepo.getOnlineUsers();
  }

  async setTypingStatus(
    conversationId: string,
    userId: string,
    isTyping: boolean
  ) {
    await this.chatRepo.setTypingStatus(conversationId, userId, isTyping);
  }

  async getTypingUsers(conversationId: string) {
    return await this.chatRepo.getTypingUsers(conversationId);
  }

  async searchMessages(userId: string, searchTerm: string) {
    return await this.chatRepo.searchMessages(userId, searchTerm);
  }

  async createAttachment(attachmentData: {
    messageId: string;
    fileName: string;
    filePath: string;
    fileType?: string;
    fileSize?: number;
    mimeType?: string;
  }) {
    return await this.chatRepo.createAttachment(attachmentData);
  }

  async getMessageAttachments(messageId: string) {
    return await this.chatRepo.getMessageAttachments(messageId);
  }
}
