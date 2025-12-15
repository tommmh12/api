import { dbPool } from "../database/connection.js";
import crypto from "crypto";

export class ChatRepository {
  private db = dbPool;

  // ==================== CONVERSATIONS ====================

  async getOrCreateConversation(user1Id: string, user2Id: string) {
    // Sort IDs to ensure consistent conversation lookup
    const [p1, p2] = [user1Id, user2Id].sort();

    const query = `
      SELECT * FROM conversations 
      WHERE (participant1_id = ? AND participant2_id = ?)
         OR (participant1_id = ? AND participant2_id = ?)
      LIMIT 1
    `;

    const [rows]: any = await this.db.query(query, [p1, p2, p2, p1]);

    if (rows.length > 0) {
      return rows[0];
    }

    // Create new conversation
    const conversationId = crypto.randomUUID();
    const insertQuery = `
      INSERT INTO conversations (id, participant1_id, participant2_id)
      VALUES (?, ?, ?)
    `;

    await this.db.query(insertQuery, [conversationId, p1, p2]);

    return {
      id: conversationId,
      participant1_id: p1,
      participant2_id: p2,
      created_at: new Date().toISOString(),
    };
  }

  async getUserConversations(userId: string) {
    const query = `
      SELECT 
        c.*,
        CASE 
          WHEN c.participant1_id = ? THEN u2.id
          ELSE u1.id
        END as other_user_id,
        CASE 
          WHEN c.participant1_id = ? THEN u2.full_name
          ELSE u1.full_name
        END as other_user_name,
        CASE 
          WHEN c.participant1_id = ? THEN u2.email
          ELSE u1.email
        END as other_user_email,
        CASE 
          WHEN c.participant1_id = ? THEN u2.avatar_url
          ELSE u1.avatar_url
        END as other_user_avatar,
        COALESCE(status.status, 'offline') as other_user_status,
        status.last_seen as other_user_last_seen,
        lm.message_text as last_message_text,
        lm.created_at as last_message_time,
        lm.sender_id as last_message_sender_id,
        (SELECT COUNT(*) FROM chat_messages 
         WHERE conversation_id = c.id 
           AND sender_id != ? 
           AND is_read = FALSE 
           AND is_deleted = FALSE) as unread_count
      FROM conversations c
      LEFT JOIN users u1 ON c.participant1_id = u1.id
      LEFT JOIN users u2 ON c.participant2_id = u2.id
      LEFT JOIN user_online_status status ON 
        CASE 
          WHEN c.participant1_id = ? THEN status.user_id = u2.id
          ELSE status.user_id = u1.id
        END
      LEFT JOIN chat_messages lm ON c.last_message_id = lm.id
      WHERE c.participant1_id = ? OR c.participant2_id = ?
      ORDER BY c.last_updated DESC
    `;

    const [rows]: any = await this.db.query(query, [
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
    ]);

    return rows;
  }

  async updateConversationLastMessage(
    conversationId: string,
    messageId: string
  ) {
    const query = `
      UPDATE conversations 
      SET last_message_id = ?, last_updated = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await this.db.query(query, [messageId, conversationId]);
  }

  // ==================== MESSAGES ====================

  async createMessage(messageData: {
    conversationId: string;
    senderId: string;
    messageText?: string;
    messageType?: string;
  }) {
    const messageId = crypto.randomUUID();

    const query = `
      INSERT INTO chat_messages (
        id, conversation_id, sender_id, message_text, message_type
      ) VALUES (?, ?, ?, ?, ?)
    `;

    await this.db.query(query, [
      messageId,
      messageData.conversationId,
      messageData.senderId,
      messageData.messageText || null,
      messageData.messageType || "text",
    ]);

    // Update conversation's last message
    await this.updateConversationLastMessage(
      messageData.conversationId,
      messageId
    );

    return messageId;
  }

  async getConversationMessages(
    conversationId: string,
    limit = 50,
    offset = 0
  ) {
    const query = `
      SELECT 
        m.*,
        u.full_name as sender_name,
        u.email as sender_email,
        u.avatar_url as sender_avatar,
        a.id as attachment_id,
        a.file_name,
        a.file_path,
        a.file_type,
        a.file_size,
        a.mime_type
      FROM chat_messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN chat_attachments a ON m.id = a.message_id
      WHERE m.conversation_id = ? AND m.is_deleted = FALSE
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows]: any = await this.db.query(query, [
      conversationId,
      limit,
      offset,
    ]);

    return rows.reverse(); // Return in chronological order
  }

  async markMessagesAsRead(conversationId: string, userId: string) {
    const query = `
      UPDATE chat_messages 
      SET is_read = TRUE
      WHERE conversation_id = ? 
        AND sender_id != ? 
        AND is_read = FALSE
    `;

    await this.db.query(query, [conversationId, userId]);
  }

  async deleteMessage(messageId: string, userId: string) {
    const query = `
      UPDATE chat_messages 
      SET is_deleted = TRUE
      WHERE id = ? AND sender_id = ?
    `;

    const [result]: any = await this.db.query(query, [messageId, userId]);
    return result.affectedRows > 0;
  }

  // ==================== ATTACHMENTS ====================

  async createAttachment(attachmentData: {
    messageId: string;
    fileName: string;
    filePath: string;
    fileType?: string;
    fileSize?: number;
    mimeType?: string;
  }) {
    const attachmentId = crypto.randomUUID();

    const query = `
      INSERT INTO chat_attachments (
        id, message_id, file_name, file_path, file_type, file_size, mime_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.query(query, [
      attachmentId,
      attachmentData.messageId,
      attachmentData.fileName,
      attachmentData.filePath,
      attachmentData.fileType || null,
      attachmentData.fileSize || null,
      attachmentData.mimeType || null,
    ]);

    return attachmentId;
  }

  async getMessageAttachments(messageId: string) {
    const query = `SELECT * FROM chat_attachments WHERE message_id = ?`;
    const [rows]: any = await this.db.query(query, [messageId]);
    return rows;
  }

  // ==================== ONLINE STATUS ====================

  async updateUserStatus(userId: string, status: string, socketId?: string) {
    const query = `
      INSERT INTO user_online_status (user_id, status, socket_id, last_seen)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE 
        status = ?,
        socket_id = ?,
        last_seen = CURRENT_TIMESTAMP
    `;

    await this.db.query(query, [
      userId,
      status,
      socketId || null,
      status,
      socketId || null,
    ]);
  }

  async getUserStatus(userId: string) {
    const query = `SELECT * FROM user_online_status WHERE user_id = ?`;
    const [rows]: any = await this.db.query(query, [userId]);
    return rows[0] || { status: "offline" };
  }

  async getOnlineUsers() {
    const query = `
      SELECT u.id, u.full_name, u.email, s.status, s.last_seen
      FROM user_online_status s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'online'
    `;

    const [rows]: any = await this.db.query(query);
    return rows;
  }

  // ==================== TYPING INDICATORS ====================

  async setTypingStatus(
    conversationId: string,
    userId: string,
    isTyping: boolean
  ) {
    const query = `
      INSERT INTO typing_indicators (id, conversation_id, user_id, is_typing)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        is_typing = ?,
        updated_at = CURRENT_TIMESTAMP
    `;

    const id = crypto.randomUUID();
    await this.db.query(query, [
      id,
      conversationId,
      userId,
      isTyping,
      isTyping,
    ]);
  }

  async getTypingUsers(conversationId: string) {
    const query = `
      SELECT t.*, u.full_name
      FROM typing_indicators t
      JOIN users u ON t.user_id = u.id
      WHERE t.conversation_id = ? AND t.is_typing = TRUE
        AND TIMESTAMPDIFF(SECOND, t.updated_at, NOW()) < 5
    `;

    const [rows]: any = await this.db.query(query, [conversationId]);
    return rows;
  }

  // ==================== SEARCH ====================

  async searchMessages(userId: string, searchTerm: string) {
    const query = `
      SELECT 
        m.*,
        c.participant1_id,
        c.participant2_id,
        u.full_name as sender_name
      FROM chat_messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN users u ON m.sender_id = u.id
      WHERE (c.participant1_id = ? OR c.participant2_id = ?)
        AND m.message_text LIKE ?
        AND m.is_deleted = FALSE
      ORDER BY m.created_at DESC
      LIMIT 50
    `;

    const [rows]: any = await this.db.query(query, [
      userId,
      userId,
      `%${searchTerm}%`,
    ]);

    return rows;
  }
}
