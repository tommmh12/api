import { Request, Response } from "express";
import { SettingsService } from "../../application/services/SettingsService.js";
import {
  emailService,
  EmailConfig,
} from "../../infrastructure/email/EmailService.js";
import fs from "fs/promises";
import path from "path";
import { createLogger } from "../../infrastructure/logging/index.js";

const settingsService = new SettingsService();
const logger = createLogger("SettingsController");

export const getTaskSettings = async (req: Request, res: Response) => {
  try {
    const settings = await settingsService.getTaskSettings();
    res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error("Error getting task settings", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy cấu hình task",
    });
  }
};

// Get current SMTP configuration
export const getEmailConfig = async (req: Request, res: Response) => {
  try {
    const config = emailService.getConfig();
    const isEnabled = emailService.isEnabled();

    res.json({
      success: true,
      data: {
        config: config
          ? {
              host: config.host,
              port: config.port,
              user: config.user,
              // Don't send password to frontend
            }
          : null,
        isEnabled,
      },
    });
  } catch (error) {
    logger.error("Error getting email config", error as Error);
    res.status(500).json({
      success: false,
      error: "Failed to get email configuration",
    });
  }
};

// Update SMTP configuration
export const updateEmailConfig = async (req: Request, res: Response) => {
  try {
    const { host, port, user, password, enabled } = req.body;

    if (!host || !port || !user) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: host, port, user",
      });
    }

    const config: EmailConfig = {
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      user,
      password: password || process.env.SMTP_PASSWORD || "",
    };

    // Configure email service
    emailService.configure(config);
    emailService.setEnabled(enabled !== false);

    // Update .env file
    const envPath = path.join(process.cwd(), ".env");
    let envContent = await fs.readFile(envPath, "utf-8");

    // Update or add SMTP settings
    const updates: Record<string, string> = {
      SMTP_HOST: host,
      SMTP_PORT: port.toString(),
      SMTP_USER: user,
      SMTP_ENABLED: enabled ? "true" : "false",
    };

    if (password) {
      updates["SMTP_PASSWORD"] = password;
    }

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    await fs.writeFile(envPath, envContent);

    res.json({
      success: true,
      message: "Email configuration updated successfully",
    });
  } catch (error) {
    logger.error("Error updating email config", error as Error);
    res.status(500).json({
      success: false,
      error: "Failed to update email configuration",
    });
  }
};

// Test email sending
export const testEmail = async (req: Request, res: Response) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        error: "Recipient email is required",
      });
    }

    if (!emailService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: "Email service is not enabled",
      });
    }

    await emailService.sendEmail({
      to,
      subject: "Test Email from Nexus",
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from Nexus system.</p>
        <p>If you received this, your SMTP configuration is working correctly!</p>
        <p><small>Sent at: ${new Date().toLocaleString("vi-VN")}</small></p>
      `,
      text: "This is a test email from Nexus system. If you received this, your SMTP configuration is working correctly!",
    });

    res.json({
      success: true,
      message: "Test email sent successfully",
    });
  } catch (error: any) {
    logger.error("Error sending test email", error, { to: req.body.to });
    res.status(500).json({
      success: false,
      error: error.message || "Failed to send test email",
    });
  }
};
