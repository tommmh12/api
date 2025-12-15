import jwt from "jsonwebtoken";
import { 
  tokenBlacklistRepository, 
  TokenInvalidationReason 
} from "../../infrastructure/repositories/TokenBlacklistRepository.js";
import { createLogger } from "../../infrastructure/logging/StructuredLogger.js";

const logger = createLogger("TokenBlacklistService");

/**
 * Service for managing token invalidation
 * 
 * Implements Requirements 1.3:
 * - Token invalidation mechanism for logout and password change scenarios
 * 
 * Properties validated:
 * - Property 3: Token Invalidation on Logout
 * - Property 4: Token Invalidation on Password Change
 */
export class TokenBlacklistService {

  /**
   * Extract expiration time from a JWT token
   * Returns the exp claim as a Date, or a default expiry if not found
   */
  private getTokenExpiry(token: string): Date {
    try {
      // Decode without verification to get expiry
      const decoded = jwt.decode(token) as { exp?: number } | null;
      
      if (decoded?.exp) {
        return new Date(decoded.exp * 1000);
      }
    } catch (error) {
      logger.warn("Failed to decode token for expiry extraction", { error });
    }

    // Default to 7 days from now if we can't determine expiry
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 7);
    return defaultExpiry;
  }

  /**
   * Extract user ID from a JWT token
   */
  private getUserIdFromToken(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as { userId?: string } | null;
      return decoded?.userId || null;
    } catch (error) {
      logger.warn("Failed to decode token for userId extraction", { error });
      return null;
    }
  }

  /**
   * Invalidate a token (add to blacklist)
   * 
   * @param token - The JWT token to invalidate
   * @param userId - The user ID (optional, will be extracted from token if not provided)
   * @param reason - Why the token is being invalidated
   */
  async invalidateToken(
    token: string,
    userId: string | null,
    reason: TokenInvalidationReason
  ): Promise<void> {
    const tokenUserId = userId || this.getUserIdFromToken(token);
    
    if (!tokenUserId) {
      logger.warn("Cannot invalidate token: unable to determine user ID");
      return;
    }

    const expiresAt = this.getTokenExpiry(token);

    await tokenBlacklistRepository.addToBlacklist(
      token,
      tokenUserId,
      reason,
      expiresAt
    );

    logger.info("Token invalidated", {
      userId: tokenUserId,
      reason,
      expiresAt: expiresAt.toISOString(),
    });
  }

  /**
   * Invalidate token on logout
   * Implements Property 3: Token Invalidation on Logout
   * 
   * @param token - The JWT token to invalidate
   * @param userId - The user ID
   */
  async invalidateOnLogout(token: string, userId: string): Promise<void> {
    await this.invalidateToken(token, userId, "logout");
  }

  /**
   * Invalidate token on password change
   * Implements Property 4: Token Invalidation on Password Change
   * 
   * @param token - The current JWT token to invalidate
   * @param userId - The user ID
   */
  async invalidateOnPasswordChange(token: string, userId: string): Promise<void> {
    await this.invalidateToken(token, userId, "password_change");
  }

  /**
   * Invalidate token due to admin action
   * 
   * @param token - The JWT token to invalidate
   * @param userId - The user ID
   */
  async invalidateByAdmin(token: string, userId: string): Promise<void> {
    await this.invalidateToken(token, userId, "admin_revoke");
  }

  /**
   * Invalidate token due to security incident
   * 
   * @param token - The JWT token to invalidate
   * @param userId - The user ID
   */
  async invalidateForSecurity(token: string, userId: string): Promise<void> {
    await this.invalidateToken(token, userId, "security_incident");
  }

  /**
   * Check if a token is blacklisted
   * 
   * @param token - The JWT token to check
   * @returns true if the token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    return tokenBlacklistRepository.isBlacklisted(token);
  }

  /**
   * Verify a token is valid and not blacklisted
   * 
   * @param token - The JWT token to verify
   * @returns The decoded token payload if valid, null otherwise
   */
  async verifyTokenNotBlacklisted(token: string): Promise<boolean> {
    // First check if token is blacklisted
    const isBlacklisted = await this.isTokenBlacklisted(token);
    
    if (isBlacklisted) {
      logger.debug("Token is blacklisted", {
        tokenPrefix: token.substring(0, 20) + "...",
      });
      return false;
    }

    return true;
  }

  /**
   * Cleanup expired tokens from the blacklist
   * Should be called periodically (e.g., via cron job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const count = await tokenBlacklistRepository.cleanupExpiredTokens();
    
    if (count > 0) {
      logger.info("Cleaned up expired blacklisted tokens", { count });
    }
    
    return count;
  }
}

// Export singleton instance
export const tokenBlacklistService = new TokenBlacklistService();
