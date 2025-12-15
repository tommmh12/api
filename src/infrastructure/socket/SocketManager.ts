import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { ChatService } from "../../application/services/ChatService.js";
import jwt from "jsonwebtoken";
import { createLogger } from "../logging/index.js";

const socketLogger = createLogger('socket-manager');

// Heartbeat configuration
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.SOCKET_HEARTBEAT_INTERVAL || '30000', 10); // 30 seconds
const HEARTBEAT_TIMEOUT_MS = parseInt(process.env.SOCKET_HEARTBEAT_TIMEOUT || '60000', 10); // 60 seconds

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  userName?: string;
  lastHeartbeat?: number;
}

// Track active calls
interface ActiveCall {
  callId: string;
  callerId: string;
  callerName: string;
  recipientId: string;
  recipientName: string;
  roomName: string;
  isVideoCall: boolean;
  startTime: Date;
}

export class SocketManager {
  private io: SocketIOServer;
  private chatService: ChatService;
  private userSockets: Map<string, string> = new Map(); // userId -> socketId
  private activeCalls: Map<string, ActiveCall> = new Map(); // callId -> ActiveCall
  private userInCall: Map<string, string> = new Map(); // userId -> callId
  private socketLastActivity: Map<string, number> = new Map(); // socketId -> timestamp
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: [
          process.env.FRONTEND_URL || "http://localhost:3000",
          "http://localhost:5173",
        ],
        credentials: true,
      },
      pingInterval: HEARTBEAT_INTERVAL_MS,
      pingTimeout: HEARTBEAT_TIMEOUT_MS,
    });

    this.chatService = new ChatService();
    this.setupMiddleware();
    this.setupEventHandlers();
    this.startHeartbeatMonitor();
  }

  /**
   * Start the heartbeat monitor that periodically checks for stale connections
   */
  private startHeartbeatMonitor() {
    socketLogger.info("Starting heartbeat monitor", { 
      intervalMs: HEARTBEAT_INTERVAL_MS, 
      timeoutMs: HEARTBEAT_TIMEOUT_MS 
    });

    this.heartbeatInterval = setInterval(() => {
      this.checkStaleConnections();
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop the heartbeat monitor (for cleanup)
   */
  public stopHeartbeatMonitor() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      socketLogger.info("Heartbeat monitor stopped");
    }
  }

  /**
   * Check for stale connections and disconnect them
   */
  private checkStaleConnections() {
    const now = Date.now();
    const staleThreshold = now - HEARTBEAT_TIMEOUT_MS;
    let staleCount = 0;

    for (const [socketId, lastActivity] of this.socketLastActivity.entries()) {
      if (lastActivity < staleThreshold) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socketLogger.warn("Disconnecting stale connection", { 
            socketId, 
            lastActivityMs: now - lastActivity,
            userId: (socket as AuthenticatedSocket).userId 
          });
          socket.disconnect(true);
          staleCount++;
        }
        this.socketLastActivity.delete(socketId);
      }
    }

    if (staleCount > 0) {
      socketLogger.info("Stale connections cleaned up", { count: staleCount });
    }
  }

  /**
   * Update the last activity timestamp for a socket
   */
  private updateSocketActivity(socketId: string) {
    this.socketLastActivity.set(socketId, Date.now());
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET ||
            "nexus_super_secret_key_change_in_production_2024"
        ) as any;
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        socket.userName = decoded.fullName || decoded.full_name || "User";
        next();
      } catch (error) {
        next(new Error("Authentication error: Invalid token"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      socketLogger.info("User connected", { userId: socket.userId, socketId: socket.id });

      // Initialize heartbeat tracking for this socket
      socket.lastHeartbeat = Date.now();
      this.updateSocketActivity(socket.id);

      if (socket.userId) {
        this.userSockets.set(socket.userId, socket.id);
        this.handleUserOnline(socket);
      }

      // Heartbeat events - client sends pong in response to server ping
      socket.on("heartbeat:pong", () => {
        socket.lastHeartbeat = Date.now();
        this.updateSocketActivity(socket.id);
        socketLogger.debug("Heartbeat pong received", { userId: socket.userId, socketId: socket.id });
      });

      // Client can also send heartbeat:ping to keep connection alive
      socket.on("heartbeat:ping", () => {
        socket.lastHeartbeat = Date.now();
        this.updateSocketActivity(socket.id);
        socket.emit("heartbeat:pong", { timestamp: Date.now() });
        socketLogger.debug("Heartbeat ping received, pong sent", { userId: socket.userId, socketId: socket.id });
      });

      // Chat events - update activity on each event
      socket.on("join:conversation", (data) => {
        this.updateSocketActivity(socket.id);
        this.handleJoinConversation(socket, data);
      });
      socket.on("leave:conversation", (data) => {
        this.updateSocketActivity(socket.id);
        this.handleLeaveConversation(socket, data);
      });
      socket.on("send:message", (data) => {
        this.updateSocketActivity(socket.id);
        this.handleSendMessage(socket, data);
      });
      socket.on("typing:start", (data) => {
        this.updateSocketActivity(socket.id);
        this.handleTypingStart(socket, data);
      });
      socket.on("typing:stop", (data) => {
        this.updateSocketActivity(socket.id);
        this.handleTypingStop(socket, data);
      });
      socket.on("message:read", (data) => {
        this.updateSocketActivity(socket.id);
        this.handleMarkAsRead(socket, data);
      });
      socket.on("message:delete", (data) => {
        this.updateSocketActivity(socket.id);
        this.handleDeleteMessage(socket, data);
      });

      // Call events - update activity on each event
      socket.on("call:start", (data) => {
        this.updateSocketActivity(socket.id);
        this.handleCallStart(socket, data);
      });
      socket.on("call:accept", (data) => {
        this.updateSocketActivity(socket.id);
        this.handleCallAccept(socket, data);
      });
      socket.on("call:decline", (data) => {
        this.updateSocketActivity(socket.id);
        this.handleCallDecline(socket, data);
      });
      socket.on("call:end", (data) => {
        this.updateSocketActivity(socket.id);
        this.handleCallEnd(socket, data);
      });

      // Disconnect - clean up activity tracking
      socket.on("disconnect", () => {
        this.socketLastActivity.delete(socket.id);
        this.handleDisconnect(socket);
      });
    });
  }

  // ==================== EVENT HANDLERS ====================

  private async handleUserOnline(socket: AuthenticatedSocket) {
    if (!socket.userId) return;

    try {
      await this.chatService.updateUserStatus(
        socket.userId,
        "online",
        socket.id
      );

      // Notify all users about online status
      this.io.emit("user:online", {
        userId: socket.userId,
        status: "online",
        timestamp: new Date().toISOString(),
      });

      // Send current online users list to the newly connected user
      const onlineUserIds = Array.from(this.userSockets.keys());
      socket.emit("users:online_list", {
        userIds: onlineUserIds,
        timestamp: new Date().toISOString(),
      });

      socketLogger.info("User is now online", { userId: socket.userId, onlineCount: onlineUserIds.length });
    } catch (error) {
      socketLogger.error("Error updating user status", error as Error, { userId: socket.userId });
    }
  }

  private async handleJoinConversation(
    socket: AuthenticatedSocket,
    data: { conversationId: string }
  ) {
    const { conversationId } = data;

    socket.join(`conversation:${conversationId}`);
    socketLogger.debug("User joined conversation", { userId: socket.userId, conversationId });

    // Mark messages as read
    if (socket.userId) {
      await this.chatService.markMessagesAsRead(conversationId, socket.userId);

      // Notify other participant
      socket.to(`conversation:${conversationId}`).emit("messages:read", {
        conversationId,
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleLeaveConversation(
    socket: AuthenticatedSocket,
    data: { conversationId: string }
  ) {
    const { conversationId } = data;
    socket.leave(`conversation:${conversationId}`);
    socketLogger.debug("User left conversation", { userId: socket.userId, conversationId });
  }

  private async handleSendMessage(socket: AuthenticatedSocket, data: any) {
    if (!socket.userId) return;

    try {
      const message = await this.chatService.sendMessage({
        conversationId: data.conversationId,
        senderId: socket.userId,
        recipientId: data.recipientId,
        messageText: data.messageText,
        messageType: data.messageType || "text",
      });

      // Emit to conversation room (including sender)
      this.io.to(`conversation:${data.conversationId}`).emit("message:new", {
        message,
        conversationId: data.conversationId,
      });

      // Also emit to both users directly (in case they're not in the conversation room yet)
      if (data.recipientId) {
        const recipientSocketId = this.userSockets.get(data.recipientId);
        if (recipientSocketId) {
          this.io.to(recipientSocketId).emit("message:new", {
            message,
            conversationId: data.conversationId,
          });
        }
      }

      socketLogger.debug("Message sent", { conversationId: data.conversationId, senderId: socket.userId });
    } catch (error) {
      socketLogger.error("Error sending message", error as Error, { conversationId: data.conversationId });
      socket.emit("error", { message: "Failed to send message" });
    }
  }

  private async handleTypingStart(
    socket: AuthenticatedSocket,
    data: { conversationId: string }
  ) {
    if (!socket.userId) return;

    try {
      await this.chatService.setTypingStatus(
        data.conversationId,
        socket.userId,
        true
      );

      socket.to(`conversation:${data.conversationId}`).emit("typing:start", {
        conversationId: data.conversationId,
        userId: socket.userId,
      });
    } catch (error) {
      socketLogger.error("Error setting typing status", error as Error);
    }
  }

  private async handleTypingStop(
    socket: AuthenticatedSocket,
    data: { conversationId: string }
  ) {
    if (!socket.userId) return;

    try {
      await this.chatService.setTypingStatus(
        data.conversationId,
        socket.userId,
        false
      );

      socket.to(`conversation:${data.conversationId}`).emit("typing:stop", {
        conversationId: data.conversationId,
        userId: socket.userId,
      });
    } catch (error) {
      socketLogger.error("Error clearing typing status", error as Error);
    }
  }

  private async handleMarkAsRead(
    socket: AuthenticatedSocket,
    data: { conversationId: string }
  ) {
    if (!socket.userId) return;

    try {
      await this.chatService.markMessagesAsRead(
        data.conversationId,
        socket.userId
      );

      socket.to(`conversation:${data.conversationId}`).emit("messages:read", {
        conversationId: data.conversationId,
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      socketLogger.error("Error marking messages as read", error as Error);
    }
  }

  private async handleDeleteMessage(
    socket: AuthenticatedSocket,
    data: { messageId: string; conversationId: string }
  ) {
    if (!socket.userId) return;

    try {
      const deleted = await this.chatService.deleteMessage(
        data.messageId,
        socket.userId
      );

      if (deleted) {
        this.io
          .to(`conversation:${data.conversationId}`)
          .emit("message:deleted", {
            messageId: data.messageId,
            conversationId: data.conversationId,
          });
      }
    } catch (error) {
      socketLogger.error("Error deleting message", error as Error, { messageId: data.messageId });
    }
  }

  private async handleDisconnect(socket: AuthenticatedSocket) {
    if (!socket.userId) return;

    try {
      // End any active calls for this user
      const activeCallId = this.userInCall.get(socket.userId);
      if (activeCallId) {
        const call = this.activeCalls.get(activeCallId);
        if (call) {
          // Notify the other party that the call ended
          const otherUserId =
            call.callerId === socket.userId ? call.recipientId : call.callerId;
          const otherSocketId = this.userSockets.get(otherUserId);
          if (otherSocketId) {
            this.io
              .to(otherSocketId)
              .emit("call:ended", { callId: activeCallId });
          }
          this.activeCalls.delete(activeCallId);
          this.userInCall.delete(call.callerId);
          this.userInCall.delete(call.recipientId);
        }
      }

      this.userSockets.delete(socket.userId);
      await this.chatService.updateUserStatus(socket.userId, "offline");

      this.io.emit("user:offline", {
        userId: socket.userId,
        status: "offline",
        timestamp: new Date().toISOString(),
      });

      socketLogger.info("User disconnected", { userId: socket.userId });
    } catch (error) {
      socketLogger.error("Error handling disconnect", error as Error, { userId: socket.userId });
    }
  }

  // ==================== CALL EVENT HANDLERS ====================

  private async handleCallStart(
    socket: AuthenticatedSocket,
    data: {
      callId: string;
      recipientId: string;
      recipientName: string;
      roomName: string;
      isVideoCall: boolean;
    }
  ) {
    if (!socket.userId) return;

    const { callId, recipientId, recipientName, roomName, isVideoCall } = data;

    socketLogger.info("Call started", { 
      callerId: socket.userId, 
      recipientId, 
      callType: isVideoCall ? "video" : "audio",
      callId 
    });

    // Check if recipient is online
    const recipientSocketId = this.userSockets.get(recipientId);
    if (!recipientSocketId) {
      socket.emit("call:error", {
        callId,
        error: "user_offline",
        message: "Người dùng không trực tuyến",
      });
      return;
    }

    // Check if recipient is already in a call
    if (this.userInCall.has(recipientId)) {
      socket.emit("call:busy", { callId, recipientId });
      return;
    }

    // Check if caller is already in a call
    if (this.userInCall.has(socket.userId)) {
      socket.emit("call:error", {
        callId,
        error: "already_in_call",
        message: "Bạn đang trong một cuộc gọi khác",
      });
      return;
    }

    // Create call record
    const call: ActiveCall = {
      callId,
      callerId: socket.userId,
      callerName: socket.userName || "User",
      recipientId,
      recipientName,
      roomName,
      isVideoCall,
      startTime: new Date(),
    };

    this.activeCalls.set(callId, call);
    this.userInCall.set(socket.userId, callId);

    // Send incoming call notification to recipient
    this.io.to(recipientSocketId).emit("call:incoming", {
      callId,
      callerId: socket.userId,
      callerName: socket.userName || "User",
      roomName,
      isVideoCall,
    });

    socketLogger.debug("Incoming call notification sent", { recipientId, callId });
  }

  private async handleCallAccept(
    socket: AuthenticatedSocket,
    data: { callId: string }
  ) {
    if (!socket.userId) return;

    const { callId } = data;
    const call = this.activeCalls.get(callId);

    if (!call) {
      socket.emit("call:error", { callId, error: "call_not_found" });
      return;
    }

    // Mark recipient as in call
    this.userInCall.set(socket.userId, callId);

    // Notify caller that call was accepted
    const callerSocketId = this.userSockets.get(call.callerId);
    if (callerSocketId) {
      this.io.to(callerSocketId).emit("call:accepted", {
        callId,
        recipientId: socket.userId,
        roomName: call.roomName,
      });
    }

    socketLogger.info("Call accepted", { callId, acceptedBy: socket.userId });
  }

  private async handleCallDecline(
    socket: AuthenticatedSocket,
    data: { callId: string; callerId: string }
  ) {
    if (!socket.userId) return;

    const { callId, callerId } = data;
    const call = this.activeCalls.get(callId);

    if (call) {
      // Notify caller that call was declined
      const callerSocketId = this.userSockets.get(callerId);
      if (callerSocketId) {
        this.io.to(callerSocketId).emit("call:declined", {
          callId,
          recipientId: socket.userId,
        });
      }

      // Clean up call data
      this.activeCalls.delete(callId);
      this.userInCall.delete(call.callerId);
    }

    socketLogger.info("Call declined", { callId, declinedBy: socket.userId });
  }

  private async handleCallEnd(
    socket: AuthenticatedSocket,
    data: { callId: string; recipientId: string }
  ) {
    if (!socket.userId) return;

    const { callId, recipientId } = data;
    const call = this.activeCalls.get(callId);

    if (call) {
      // Notify the other party
      const recipientSocketId = this.userSockets.get(recipientId);
      if (recipientSocketId) {
        this.io.to(recipientSocketId).emit("call:ended", { callId });
      }

      // Clean up call data
      this.activeCalls.delete(callId);
      this.userInCall.delete(call.callerId);
      this.userInCall.delete(call.recipientId);
    }

    socketLogger.info("Call ended", { callId, endedBy: socket.userId });
  }

  // ==================== UTILITY METHODS ====================

  public emitToUser(userId: string, event: string, data: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  public getIO() {
    return this.io;
  }

  /**
   * Send heartbeat ping to all connected clients
   * This can be called manually or scheduled externally
   */
  public sendHeartbeatPing() {
    this.io.emit("heartbeat:ping", { timestamp: Date.now() });
    socketLogger.debug("Heartbeat ping sent to all clients", { 
      connectedClients: this.socketLastActivity.size 
    });
  }

  /**
   * Get connection statistics for monitoring
   */
  public getConnectionStats() {
    const now = Date.now();
    const activeConnections = this.socketLastActivity.size;
    const onlineUsers = this.userSockets.size;
    const activeCalls = this.activeCalls.size;

    // Calculate average last activity age
    let totalAge = 0;
    for (const lastActivity of this.socketLastActivity.values()) {
      totalAge += now - lastActivity;
    }
    const avgActivityAgeMs = activeConnections > 0 ? totalAge / activeConnections : 0;

    return {
      activeConnections,
      onlineUsers,
      activeCalls,
      avgActivityAgeMs,
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      heartbeatTimeoutMs: HEARTBEAT_TIMEOUT_MS,
    };
  }
}
