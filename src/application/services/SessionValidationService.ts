import { UserRepository } from "../../infrastructure/repositories/UserRepository.js";
import { createLogger } from "../../infrastructure/logging/StructuredLogger.js";

const logger = createLogger("SessionValidationService");

/**
 * Result of session metadata validation
 */
export interface SessionValidationResult {
  isValid: boolean;
  hasMetadataMismatch: boolean;
  mismatchDetails?: {
    ipMismatch: boolean;
    userAgentMismatch: boolean;
    originalIp?: string;
    currentIp?: string;
    originalUserAgent?: string;
    currentUserAgent?: string;
  };
}

/**
 * Service for validating session metadata consistency
 * 
 * Implements Requirements 1.4:
 * - Validate session consistency on subsequent requests
 * - Warn on metadata mismatch (don't block initially)
 */
export class SessionValidationService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Validate session metadata consistency
   * 
   * Compares the current request's IP and User-Agent with the stored
   * session metadata from login. Warns on mismatch but doesn't block.
   * 
   * @param userId - The user ID from the JWT token
   * @param token - The refresh token (stored in session)
   * @param currentIp - The current request's IP address
   * @param currentUserAgent - The current request's User-Agent
   * @returns Validation result with mismatch details
   */
  async validateSessionMetadata(
    userId: string,
    token: string,
    currentIp: string,
    currentUserAgent: string
  ): Promise<SessionValidationResult> {
    try {
      // Find the session by user and token
      const session = await this.userRepository.findSessionByUserAndToken(userId, token);

      if (!session) {
        // Session not found - this is handled by token validation
        return {
          isValid: true,
          hasMetadataMismatch: false,
        };
      }

      const originalIp = session.ip_address;
      const originalUserAgent = session.user_agent;

      // If no metadata was stored, skip validation
      if (!originalIp && !originalUserAgent) {
        return {
          isValid: true,
          hasMetadataMismatch: false,
        };
      }

      // Check for mismatches
      const ipMismatch = originalIp ? this.isIpMismatch(originalIp, currentIp) : false;
      const userAgentMismatch = originalUserAgent ? this.isUserAgentMismatch(originalUserAgent, currentUserAgent) : false;

      const hasMetadataMismatch = ipMismatch || userAgentMismatch;

      if (hasMetadataMismatch) {
        // Log warning but don't block (Requirements 1.4 - warn mode)
        logger.warn("Session metadata mismatch detected", {
          userId,
          ipMismatch,
          userAgentMismatch,
          originalIp: originalIp ? this.maskIp(originalIp) : null,
          currentIp: this.maskIp(currentIp),
          // Don't log full user agents for privacy
          userAgentChanged: userAgentMismatch,
        });
      }

      return {
        isValid: true, // Always valid in warn mode
        hasMetadataMismatch,
        mismatchDetails: hasMetadataMismatch ? {
          ipMismatch,
          userAgentMismatch,
          originalIp: originalIp || undefined,
          currentIp,
          originalUserAgent: originalUserAgent || undefined,
          currentUserAgent,
        } : undefined,
      };
    } catch (error) {
      logger.error("Error validating session metadata", error as Error, { userId });
      // On error, allow the request to proceed
      return {
        isValid: true,
        hasMetadataMismatch: false,
      };
    }
  }

  /**
   * Check if IP addresses are different
   * Handles IPv4/IPv6 normalization
   */
  private isIpMismatch(originalIp: string, currentIp: string): boolean {
    // Normalize IPs (handle ::ffff: prefix for IPv4-mapped IPv6)
    const normalizedOriginal = this.normalizeIp(originalIp);
    const normalizedCurrent = this.normalizeIp(currentIp);
    
    return normalizedOriginal !== normalizedCurrent;
  }

  /**
   * Normalize IP address for comparison
   */
  private normalizeIp(ip: string): string {
    // Remove IPv4-mapped IPv6 prefix
    if (ip.startsWith("::ffff:")) {
      return ip.substring(7);
    }
    return ip;
  }

  /**
   * Mask IP address for logging (privacy)
   */
  private maskIp(ip: string): string {
    const normalized = this.normalizeIp(ip);
    const parts = normalized.split(".");
    if (parts.length === 4) {
      // IPv4: show first two octets
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    // IPv6: show first segment
    const ipv6Parts = normalized.split(":");
    return `${ipv6Parts[0]}:xxxx:xxxx:xxxx`;
  }

  /**
   * Check if User-Agent strings are significantly different
   * Minor version changes are allowed
   */
  private isUserAgentMismatch(originalUA: string, currentUA: string): boolean {
    // Exact match
    if (originalUA === currentUA) {
      return false;
    }

    // Extract browser/OS family for comparison
    const originalFamily = this.extractUserAgentFamily(originalUA);
    const currentFamily = this.extractUserAgentFamily(currentUA);

    // If families are different, it's a mismatch
    return originalFamily !== currentFamily;
  }

  /**
   * Extract browser/OS family from User-Agent
   * This allows minor version updates without triggering warnings
   */
  private extractUserAgentFamily(ua: string): string {
    // Extract key identifiers (browser name, OS)
    const patterns = [
      /Chrome\/\d+/,
      /Firefox\/\d+/,
      /Safari\/\d+/,
      /Edge\/\d+/,
      /MSIE \d+/,
      /Windows NT/,
      /Mac OS X/,
      /Linux/,
      /Android/,
      /iPhone/,
      /iPad/,
    ];

    const matches: string[] = [];
    for (const pattern of patterns) {
      const match = ua.match(pattern);
      if (match) {
        // Remove version numbers for family comparison
        matches.push(match[0].replace(/\/\d+/, "").replace(/ \d+/, ""));
      }
    }

    return matches.sort().join("|") || ua.substring(0, 50);
  }
}

// Export singleton instance
export const sessionValidationService = new SessionValidationService();
