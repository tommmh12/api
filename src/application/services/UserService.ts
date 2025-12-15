import { UserRepository } from "../../infrastructure/repositories/UserRepository.js";
import { User, UserWithDepartment } from "../../domain/entities/User.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { emailService } from "../../infrastructure/email/EmailService.js";
import { validatePassword } from "../validators/passwordValidator.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const logger = createLogger("UserService");

export class UserService {
  constructor(private userRepository: UserRepository) {}

  /**
   * Generates a random password that meets complexity requirements.
   * Ensures at least one character from each required category.
   */
  private generateRandomPassword(length: number = 12): string {
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    const special = "!@#$%^&*";
    const allChars = lowercase + uppercase + digits + special;

    // Ensure minimum length of 8 to meet requirements
    const actualLength = Math.max(length, 8);

    // Start with one character from each required category
    let password = "";
    password += lowercase[crypto.randomInt(0, lowercase.length)];
    password += uppercase[crypto.randomInt(0, uppercase.length)];
    password += digits[crypto.randomInt(0, digits.length)];
    password += special[crypto.randomInt(0, special.length)];

    // Fill the rest with random characters from all categories
    for (let i = password.length; i < actualLength; i++) {
      password += allChars[crypto.randomInt(0, allChars.length)];
    }

    // Shuffle the password to avoid predictable patterns
    const passwordArray = password.split("");
    for (let i = passwordArray.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }

    return passwordArray.join("");
  }

  async createUser(userData: {
    employee_id: string;
    email: string;
    password?: string;
    full_name: string;
    phone?: string;
    avatar_url?: string;
    position?: string;
    department_id?: string;
    role: "Admin" | "Manager" | "Employee";
    status: "Active" | "Blocked" | "Pending";
    join_date?: Date;
  }): Promise<{ user: User; password: string }> {
    // Validate required fields
    if (!userData.employee_id || !userData.email || !userData.full_name) {
      throw new Error("Missing required fields");
    }

    // Check if email already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error("Email already exists");
    }

    // Generate random password if not provided
    const plainPassword = userData.password || this.generateRandomPassword();

    // Validate password complexity (Requirements 1.5)
    const passwordValidation = validatePassword(plainPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password does not meet complexity requirements: ${passwordValidation.errors.join('; ')}`);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // Generate default avatar if not provided
    const avatarUrl =
      userData.avatar_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        userData.full_name
      )}`;

    const user = await this.userRepository.create({
      ...userData,
      password_hash: passwordHash,
      avatar_url: avatarUrl,
    });

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(
        userData.email,
        userData.full_name,
        userData.employee_id,
        plainPassword
      );
      logger.info("Welcome email sent", { email: userData.email });
    } catch (error) {
      logger.error("Failed to send welcome email", error as Error, { email: userData.email });
      // Don't throw error - user creation should succeed even if email fails
    }

    return { user, password: plainPassword };
  }

  async getAllUsers(): Promise<UserWithDepartment[]> {
    return await this.userRepository.findAll();
  }

  async getUserById(id: string): Promise<UserWithDepartment | null> {
    return await this.userRepository.findById(id);
  }

  async updateUser(id: string, userData: Partial<User>): Promise<void> {
    await this.userRepository.update(id, userData);
  }

  async deleteUser(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }
}
