import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { UserRepository } from "../../infrastructure/repositories/UserRepository.js";
import {
  LoginCredentials,
  AuthResponse,
  User,
} from "../../domain/entities/User.js";
import { validatePassword } from "../validators/passwordValidator.js";
import { tokenBlacklistService } from "./TokenBlacklistService.js";
import { withTransaction } from "../../infrastructure/database/connection.js";

/**
 * Session metadata for tracking login context
 * Implements Requirements 1.4
 */
export interface SessionMetadata {
  ipAddress: string;
  userAgent: string;
}

// Minimum required length for JWT secret (32 characters for security)
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Validates the JWT_SECRET environment variable at startup.
 * Throws an error if the secret is missing or too short.
 */
function validateJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is not set. ' +
      'Please set a cryptographically secure random string of at least 32 characters. ' +
      'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
  }
  
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `FATAL: JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long. ` +
      `Current length: ${secret.length}. ` +
      'Generate a secure secret using: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
  }
  
  return secret;
}

export class AuthService {
  private userRepository: UserRepository;
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private jwtRefreshExpiresIn: string;

  constructor() {
    this.userRepository = new UserRepository();
    this.jwtSecret = validateJwtSecret();
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
  }

  /**
   * Authenticate user and create session with metadata
   * 
   * Implements Requirements 1.4:
   * - Store session metadata (IP, User-Agent) on login
   * 
   * Requirements: 12.3 - Database operations with transaction rollback
   * Uses transaction to ensure atomicity when updating last login and creating session.
   * If session creation fails, last login update is rolled back.
   * 
   * @param credentials - Login credentials
   * @param sessionMetadata - Optional session metadata (IP, User-Agent)
   */
  async login(credentials: LoginCredentials, sessionMetadata?: SessionMetadata): Promise<AuthResponse> {
    const { email, password, rememberMe } = credentials;

    console.log("[AuthService] Finding user by email:", email);

    // Find user by email
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      console.log("[AuthService] User not found for email:", email);
      throw new Error("Email hoặc mật khẩu không đúng");
    }

    console.log("[AuthService] User found:", { id: user.id, status: user.status, hasPasswordHash: !!user.password_hash });

    // Check if user is active
    if (user.status !== "Active") {
      console.log("[AuthService] User not active, status:", user.status);
      throw new Error("Tài khoản đã bị khóa hoặc vô hiệu hóa");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    console.log("[AuthService] Password valid:", isPasswordValid);

    if (!isPasswordValid) {
      throw new Error("Email hoặc mật khẩu không đúng");
    }

    // Generate tokens
    const expiresIn = rememberMe ? this.jwtRefreshExpiresIn : this.jwtExpiresIn;
    const accessToken = this.generateToken(user, expiresIn);
    const refreshToken = this.generateToken(user, this.jwtRefreshExpiresIn);

    // Use transaction to ensure atomicity of login operations
    // If session creation fails, last login update is rolled back
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    await withTransaction(async (ctx) => {
      // Update last login within transaction
      await ctx.query(
        "UPDATE users SET last_login_at = NOW() WHERE id = ?",
        [user.id]
      );

      // Store refresh token in database with session metadata (Requirements 1.4)
      const sessionId = crypto.randomUUID();
      await ctx.query(
        `INSERT INTO user_sessions (id, user_id, token, expires_at, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, user.id, refreshToken, expiresAt, sessionMetadata?.ipAddress || null, sessionMetadata?.userAgent || null]
      );
    });

    // Remove sensitive data
    const { password_hash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };
      const user = await this.userRepository.findById(decoded.userId);

      if (!user || user.status !== "Active") {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Logout user and invalidate their token
   * 
   * Implements Requirements 1.3:
   * - Token invalidation mechanism for logout scenarios
   * 
   * Property 3: Token Invalidation on Logout
   * After logout, subsequent requests using the token should be rejected with HTTP 401
   * 
   * @param token - The JWT token to invalidate
   * @param userId - Optional user ID (extracted from token if not provided)
   */
  async logout(token: string, userId?: string): Promise<void> {
    // Delete the session from database
    await this.userRepository.deleteSession(token);
    
    // Add token to blacklist (Requirements 1.3)
    // This ensures the token cannot be used even if it hasn't expired
    const tokenUserId = userId || this.extractUserIdFromToken(token);
    if (tokenUserId) {
      await tokenBlacklistService.invalidateOnLogout(token, tokenUserId);
    }
  }

  /**
   * Extract user ID from a JWT token without verification
   * Used for token invalidation when we need the user ID but token may be expired
   */
  private extractUserIdFromToken(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as { userId?: string } | null;
      return decoded?.userId || null;
    } catch {
      return null;
    }
  }

  private generateToken(user: User, expiresIn: string): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      this.jwtSecret,
      { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
    );
  }

  /**
   * Change user password and invalidate current token
   * 
   * Implements Requirements 1.3:
   * - Token invalidation mechanism for password change scenarios
   * 
   * Property 4: Token Invalidation on Password Change
   * After password change, subsequent requests using the old token should be rejected with HTTP 401
   * 
   * @param userId - The user ID
   * @param currentPassword - The current password for verification
   * @param newPassword - The new password to set
   * @param currentToken - Optional current token to invalidate
   */
  async changePassword(
    userId: string, 
    currentPassword: string, 
    newPassword: string,
    currentToken?: string
  ): Promise<void> {
    // Find user by ID
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isCurrentPasswordValid) {
      throw new Error("Mật khẩu hiện tại không đúng");
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      throw new Error("Mật khẩu mới phải khác mật khẩu hiện tại");
    }

    // Validate new password complexity (Requirements 1.5)
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Mật khẩu không đủ mạnh: ${passwordValidation.errors.join('; ')}`);
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    await this.userRepository.updatePassword(userId, newPasswordHash);

    // Invalidate current token if provided (Requirements 1.3)
    // This ensures the user must re-authenticate with the new password
    if (currentToken) {
      await tokenBlacklistService.invalidateOnPasswordChange(currentToken, userId);
    }
  }
}
