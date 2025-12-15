/**
 * File Validator with Magic Byte Content Inspection
 * 
 * This module provides file validation based on actual file content (magic bytes)
 * rather than relying solely on file extensions or MIME types from headers.
 * 
 * **Validates: Requirements 2.4**
 */

import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';
import fs from 'fs/promises';

/**
 * Supported file type categories with their allowed MIME types and magic byte signatures
 */
export interface FileTypeConfig {
  readonly mimeTypes: readonly string[];
  readonly extensions: readonly string[];
  readonly maxSizeBytes: number;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  detectedMimeType: string | null;
  detectedExtension: string | null;
  errors: string[];
  warnings: string[];
}

/**
 * Predefined file type configurations
 */
export const FILE_TYPE_CONFIGS = {
  images: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
  },
  avatars: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    extensions: ['jpg', 'jpeg', 'png', 'webp'],
    maxSizeBytes: 2 * 1024 * 1024, // 2MB
  },
  documents: {
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
  },
  chatAttachments: {
    mimeTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
  },
} as const;

export type FileTypeCategory = keyof typeof FILE_TYPE_CONFIGS;


/**
 * Validates a file buffer using magic byte inspection
 * 
 * @param buffer - The file buffer to validate
 * @param config - The file type configuration to validate against
 * @param declaredMimeType - Optional MIME type declared by the client
 * @param fileSize - Optional file size in bytes
 * @returns FileValidationResult with validation details
 */
export async function validateFileBuffer(
  buffer: Buffer,
  config: FileTypeConfig,
  declaredMimeType?: string,
  fileSize?: number
): Promise<FileValidationResult> {
  const result: FileValidationResult = {
    isValid: true,
    detectedMimeType: null,
    detectedExtension: null,
    errors: [],
    warnings: [],
  };

  // Check file size if provided
  if (fileSize !== undefined && fileSize > config.maxSizeBytes) {
    result.isValid = false;
    result.errors.push(
      `File size (${formatBytes(fileSize)}) exceeds maximum allowed size (${formatBytes(config.maxSizeBytes)})`
    );
  }

  // Check buffer size as fallback
  if (buffer.length > config.maxSizeBytes) {
    result.isValid = false;
    result.errors.push(
      `File size (${formatBytes(buffer.length)}) exceeds maximum allowed size (${formatBytes(config.maxSizeBytes)})`
    );
  }

  // Detect actual file type from magic bytes
  const detectedType = await fileTypeFromBuffer(buffer);

  if (!detectedType) {
    result.isValid = false;
    result.errors.push('Unable to determine file type from content. File may be corrupted or unsupported.');
    return result;
  }

  result.detectedMimeType = detectedType.mime;
  result.detectedExtension = detectedType.ext;

  // Validate detected MIME type against allowed types
  if (!config.mimeTypes.includes(detectedType.mime)) {
    result.isValid = false;
    result.errors.push(
      `File type "${detectedType.mime}" is not allowed. Allowed types: ${config.mimeTypes.join(', ')}`
    );
  }

  // Validate detected extension against allowed extensions
  if (!config.extensions.includes(detectedType.ext)) {
    result.isValid = false;
    result.errors.push(
      `File extension ".${detectedType.ext}" is not allowed. Allowed extensions: ${config.extensions.map(e => `.${e}`).join(', ')}`
    );
  }

  // Check for MIME type mismatch (potential spoofing attempt)
  if (declaredMimeType && declaredMimeType !== detectedType.mime) {
    result.warnings.push(
      `Declared MIME type "${declaredMimeType}" does not match detected type "${detectedType.mime}". Using detected type.`
    );
  }

  return result;
}

/**
 * Validates a file from disk using magic byte inspection
 * 
 * @param filePath - Path to the file to validate
 * @param config - The file type configuration to validate against
 * @param declaredMimeType - Optional MIME type declared by the client
 * @returns FileValidationResult with validation details
 */
export async function validateFilePath(
  filePath: string,
  config: FileTypeConfig,
  declaredMimeType?: string
): Promise<FileValidationResult> {
  const result: FileValidationResult = {
    isValid: true,
    detectedMimeType: null,
    detectedExtension: null,
    errors: [],
    warnings: [],
  };

  try {
    // Get file stats for size check
    const stats = await fs.stat(filePath);
    
    if (stats.size > config.maxSizeBytes) {
      result.isValid = false;
      result.errors.push(
        `File size (${formatBytes(stats.size)}) exceeds maximum allowed size (${formatBytes(config.maxSizeBytes)})`
      );
    }

    // Detect actual file type from magic bytes
    const detectedType = await fileTypeFromFile(filePath);

    if (!detectedType) {
      result.isValid = false;
      result.errors.push('Unable to determine file type from content. File may be corrupted or unsupported.');
      return result;
    }

    result.detectedMimeType = detectedType.mime;
    result.detectedExtension = detectedType.ext;

    // Validate detected MIME type against allowed types
    if (!config.mimeTypes.includes(detectedType.mime)) {
      result.isValid = false;
      result.errors.push(
        `File type "${detectedType.mime}" is not allowed. Allowed types: ${config.mimeTypes.join(', ')}`
      );
    }

    // Validate detected extension against allowed extensions
    if (!config.extensions.includes(detectedType.ext)) {
      result.isValid = false;
      result.errors.push(
        `File extension ".${detectedType.ext}" is not allowed. Allowed extensions: ${config.extensions.map(e => `.${e}`).join(', ')}`
      );
    }

    // Check for MIME type mismatch (potential spoofing attempt)
    if (declaredMimeType && declaredMimeType !== detectedType.mime) {
      result.warnings.push(
        `Declared MIME type "${declaredMimeType}" does not match detected type "${detectedType.mime}". Using detected type.`
      );
    }

  } catch (error: any) {
    result.isValid = false;
    if (error.code === 'ENOENT') {
      result.errors.push('File not found');
    } else {
      result.errors.push(`Error reading file: ${error.message}`);
    }
  }

  return result;
}


/**
 * Validates a file using a predefined category configuration
 * 
 * @param buffer - The file buffer to validate
 * @param category - The predefined file type category
 * @param declaredMimeType - Optional MIME type declared by the client
 * @param fileSize - Optional file size in bytes
 * @returns FileValidationResult with validation details
 */
export async function validateFileByCategory(
  buffer: Buffer,
  category: FileTypeCategory,
  declaredMimeType?: string,
  fileSize?: number
): Promise<FileValidationResult> {
  const config = FILE_TYPE_CONFIGS[category];
  return validateFileBuffer(buffer, config, declaredMimeType, fileSize);
}

/**
 * Validates a file path using a predefined category configuration
 * 
 * @param filePath - Path to the file to validate
 * @param category - The predefined file type category
 * @param declaredMimeType - Optional MIME type declared by the client
 * @returns FileValidationResult with validation details
 */
export async function validateFilePathByCategory(
  filePath: string,
  category: FileTypeCategory,
  declaredMimeType?: string
): Promise<FileValidationResult> {
  const config = FILE_TYPE_CONFIGS[category];
  return validateFilePath(filePath, config, declaredMimeType);
}

/**
 * Quick check if a buffer represents an allowed file type
 * 
 * @param buffer - The file buffer to check
 * @param allowedMimeTypes - Array of allowed MIME types
 * @returns true if the file type is allowed, false otherwise
 */
export async function isAllowedFileType(
  buffer: Buffer,
  allowedMimeTypes: string[]
): Promise<boolean> {
  const detectedType = await fileTypeFromBuffer(buffer);
  if (!detectedType) {
    return false;
  }
  return allowedMimeTypes.includes(detectedType.mime);
}

/**
 * Detects the actual file type from a buffer
 * 
 * @param buffer - The file buffer to analyze
 * @returns Object with mime type and extension, or null if undetectable
 */
export async function detectFileType(
  buffer: Buffer
): Promise<{ mime: string; ext: string } | null> {
  const result = await fileTypeFromBuffer(buffer);
  return result ? { mime: result.mime, ext: result.ext } : null;
}

/**
 * Detects the actual file type from a file path
 * 
 * @param filePath - Path to the file to analyze
 * @returns Object with mime type and extension, or null if undetectable
 */
export async function detectFileTypeFromPath(
  filePath: string
): Promise<{ mime: string; ext: string } | null> {
  const result = await fileTypeFromFile(filePath);
  return result ? { mime: result.mime, ext: result.ext } : null;
}

/**
 * Checks if a file extension matches its actual content type
 * 
 * @param buffer - The file buffer to check
 * @param declaredExtension - The declared file extension (without dot)
 * @returns true if extension matches content, false otherwise
 */
export async function extensionMatchesContent(
  buffer: Buffer,
  declaredExtension: string
): Promise<boolean> {
  const detectedType = await fileTypeFromBuffer(buffer);
  if (!detectedType) {
    return false;
  }
  
  // Normalize extension (remove leading dot if present)
  const normalizedExt = declaredExtension.replace(/^\./, '').toLowerCase();
  
  // Handle common extension aliases
  const extensionAliases: Record<string, string[]> = {
    jpg: ['jpg', 'jpeg'],
    jpeg: ['jpg', 'jpeg'],
  };
  
  const detectedExt = detectedType.ext.toLowerCase();
  const aliases = extensionAliases[detectedExt] || [detectedExt];
  
  return aliases.includes(normalizedExt);
}

/**
 * Formats bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Creates a custom file type configuration
 * 
 * @param mimeTypes - Array of allowed MIME types
 * @param extensions - Array of allowed extensions (without dots)
 * @param maxSizeBytes - Maximum file size in bytes
 * @returns FileTypeConfig object
 */
export function createFileTypeConfig(
  mimeTypes: string[],
  extensions: string[],
  maxSizeBytes: number
): FileTypeConfig {
  return {
    mimeTypes,
    extensions: extensions.map(e => e.replace(/^\./, '').toLowerCase()),
    maxSizeBytes,
  };
}
