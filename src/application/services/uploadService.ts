import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

// Ensure upload directories exist
const COMMENT_UPLOAD_DIR = path.join(process.cwd(), "uploads", "comments");
const AVATAR_UPLOAD_DIR = path.join(process.cwd(), "uploads", "avatars");
const FORUM_UPLOAD_DIR = path.join(process.cwd(), "uploads", "forum");

if (!fs.existsSync(COMMENT_UPLOAD_DIR)) {
  fs.mkdirSync(COMMENT_UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(AVATAR_UPLOAD_DIR)) {
  fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(FORUM_UPLOAD_DIR)) {
  fs.mkdirSync(FORUM_UPLOAD_DIR, { recursive: true });
}

// Configure multer storage for comments
const commentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, COMMENT_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Configure multer storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATAR_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).user?.userId || "unknown";
    const ext = path.extname(file.originalname);
    // Use userId in filename for easy identification
    cb(null, `avatar-${userId}-${Date.now()}${ext}`);
  },
});

// Configure multer storage for forum posts
const forumStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, FORUM_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `forum-${uniqueSuffix}${ext}`);
  },
});

// File filter - only allow images
const imageFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ cho phép upload file ảnh (JPEG, PNG, GIF, WebP)"));
  }
};

// Multer upload configuration for comments
export const commentImageUpload = multer({
  storage: commentStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// Multer upload configuration for avatars
export const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max for avatars
  },
});

// Multer upload configuration for forum posts
export const forumImageUpload = multer({
  storage: forumStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for forum posts
  },
});

// Get public URL for uploaded file
export const getImageUrl = (filename: string): string => {
  return `/uploads/comments/${filename}`;
};

// Get public URL for avatar
export const getAvatarUrl = (filename: string): string => {
  return `/uploads/avatars/${filename}`;
};

// Get public URL for forum image
export const getForumImageUrl = (filename: string): string => {
  return `/uploads/forum/${filename}`;
};
