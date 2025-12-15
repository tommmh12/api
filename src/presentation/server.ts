import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { compressionMiddleware } from "./middlewares/compression.middleware.js";
import dotenv from "dotenv";
import { createServer } from "http";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "../infrastructure/swagger/swagger.config.js";
import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import projectRoutes from "./routes/project.routes.js";
import taskRoutes from "./routes/task.routes.js";
import reportRoutes from "./routes/report.routes.js";
import workflowRoutes from "./routes/workflow.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import chatRoutes from "./routes/chat.routes.js";
import userRoutes from "./routes/user.routes.js";
import newsRoutes from "./routes/news.routes.js";
import forumRoutes from "./routes/forum.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import floorRoutes from "./routes/floor.routes.js";
import roomRoutes from "./routes/room.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import onlineMeetingRoutes from "./routes/onlineMeeting.routes.js";
import activityLogRoutes from "./routes/activityLog.routes.js";
import alertRuleRoutes from "./routes/alertRule.routes.js";
import handoffRoutes from "./routes/handoff.routes.js";
import decisionRoutes from "./routes/decision.routes.js";
import healthRoutes from "./routes/health.routes.js";
import metricsRoutes from "./routes/metrics.routes.js";
import checklistAnalyticsRoutes from "./routes/checklistAnalytics.routes.js";
import { SocketManager } from "../infrastructure/socket/SocketManager.js";
import { metricsMiddleware } from "./middlewares/metrics.middleware.js";
import { alertSchedulerService } from "../application/services/AlertSchedulerService.js";
import { globalErrorHandler, notFoundHandler } from "./middlewares/errorHandler.middleware.js";
import { correlationIdMiddleware } from "./middlewares/correlationId.middleware.js";
import { logger } from "../infrastructure/logging/index.js";

dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);

// Response compression middleware - applies gzip compression to responses
// Requirements: 7.1 - Apply compression when API responses exceed size thresholds
app.use(compressionMiddleware);

// Correlation ID middleware - generates unique ID for request tracing
// Requirements: 5.1
app.use(correlationIdMiddleware);

// Metrics middleware - records response time and status code metrics
// Requirements: 5.2
app.use(metricsMiddleware);

// HTTP request logging (morgan) - will be replaced by structured logger in production
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan("dev"));
}

// Upload routes MUST be before json body parser to handle multipart/form-data correctly
app.use("/api/upload", uploadRoutes);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check endpoints
// Requirements: 4.4 - Check database connectivity, file storage, return structured health status
// GET /health - Full health check (database + file storage)
// GET /health/database - Database only
// GET /health/storage - File storage only
app.use("/health", healthRoutes);

// API Documentation (Swagger UI)
// Requirements: 14.1 - API documentation
// GET /api-docs - Swagger UI interface
// GET /api-docs.json - OpenAPI specification in JSON format
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Nexus API Documentation",
}));
app.get("/api-docs.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Legacy health check - basic (fast, no external dependencies)
// Kept for backward compatibility
app.get("/ping", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Nexus API is running",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/users", userRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/comments", commentRoutes);
// Note: uploadRoutes is registered earlier (before body parser)
app.use("/api/floors", floorRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/meetings", onlineMeetingRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/alert-rules", alertRuleRoutes);
app.use("/api/handoffs", handoffRoutes);
app.use("/api/decisions", decisionRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/analytics/checklist", checklistAnalyticsRoutes);

// Serve uploaded files with CORS
app.use(
  "/uploads",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  }),
  express.static("uploads")
);

// 404 Handler - Catches undefined routes
app.use(notFoundHandler);

// Global Error Handler - Catches all unhandled exceptions
// Logs full error context server-side, returns sanitized response to client
// Requirements: 12.1
app.use(globalErrorHandler);

// Initialize Socket.IO
const socketManager = new SocketManager(httpServer);

// Start server
httpServer.listen(PORT, () => {
  logger.info('Nexus Backend API started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    apiUrl: `http://localhost:${PORT}`,
    features: ['socket.io', 'realtime-chat'],
  });

  // Start Alert Scheduler (check every 30 minutes)
  alertSchedulerService.start(30 * 60 * 1000);
  logger.info('Alert scheduler started', { intervalMinutes: 30 });
});

export default app;
