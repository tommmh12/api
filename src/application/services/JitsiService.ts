import jwt from "jsonwebtoken";

export interface JitsiTokenPayload {
    context: {
        user: {
            name: string;
            email: string;
            avatar?: string;
        };
    };
    moderator: boolean;
    room: string;
}

export interface JitsiJoinConfig {
    jwt: string;
    roomName: string;
    domain: string;
    userInfo: {
        displayName: string;
        email: string;
        avatarUrl?: string;
    };
}

export class JitsiService {
    private jitsiDomain: string;
    private appId: string;
    private privateKey: string;

    constructor() {
        this.jitsiDomain = process.env.JITSI_DOMAIN || "meet.jit.si";
        this.appId = process.env.JITSI_APP_ID || "nexus-app";

        // For now, using a simple secret. In production, use RSA private key
        this.privateKey = process.env.JITSI_PRIVATE_KEY || process.env.JWT_SECRET || "nexus_secret";
    }

    /**
     * Generate Jitsi JWT token for a user to join a room
     * @param userId User ID
     * @param userName User's display name
     * @param userEmail User's email
     * @param roomName Jitsi room name
     * @param isModerator Whether user is moderator (creator)
     * @param avatarUrl User's avatar URL
     * @returns JWT token string
     */
    generateJitsiToken(
        userId: string,
        userName: string,
        userEmail: string,
        roomName: string,
        isModerator: boolean = false,
        avatarUrl?: string
    ): string {
        const now = Math.floor(Date.now() / 1000);

        const payload = {
            // Standard JWT claims
            iss: this.appId,
            sub: this.jitsiDomain,
            aud: this.appId,
            exp: now + 7200, // Token expires in 2 hours
            nbf: now - 10, // Not before (allow 10 seconds clock skew)

            // Jitsi-specific claims
            room: roomName,
            context: {
                user: {
                    id: userId,
                    name: userName,
                    email: userEmail,
                    avatar: avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
                },
            },
            moderator: isModerator,
        };

        // Sign the token
        const token = jwt.sign(payload, this.privateKey, {
            algorithm: "HS256", // Use HS256 for simplicity. In production, use RS256 with RSA keys
        });

        return token;
    }

    /**
     * Generate full join configuration for frontend
     */
    generateJoinConfig(
        userId: string,
        userName: string,
        userEmail: string,
        roomName: string,
        isModerator: boolean = false,
        avatarUrl?: string
    ): JitsiJoinConfig {
        const token = this.generateJitsiToken(
            userId,
            userName,
            userEmail,
            roomName,
            isModerator,
            avatarUrl
        );

        return {
            jwt: token,
            roomName,
            domain: this.jitsiDomain,
            userInfo: {
                displayName: userName,
                email: userEmail,
                avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
            },
        };
    }

    /**
     * Validate if a JWT token is still valid
     */
    validateToken(token: string): boolean {
        try {
            jwt.verify(token, this.privateKey);
            return true;
        } catch (error) {
            return false;
        }
    }
}

export const jitsiService = new JitsiService();
