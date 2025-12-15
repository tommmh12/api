/**
 * File Validation Middleware
 * 
 * Middleware for validating uploaded files using magic byte content inspection.
 * This middleware should be used after multer middleware to validate files
 * that have already been uploaded to disk or memory.
 * 
 * **Validates: Requirements 2.4**
 */

import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import {
  validateFilePath,
  validateFileBuffer,
  FileTypeConfig,
  FILE_TYPE_CONFIGS,
  FileTypeCategory,
} from '../../application/validators/fileValidator.js';
import { logger } from '../../infrastructure/logging/index.js';

/**
 * Options for file validation middleware
 */
export interface FileValidationOptions {
  /** File type category to validate against */
  category?: FileTypeCategory;
  /** Custom file type configuration (overrides category) */
  config?: FileTypeConfig;
  /** Whether to delete invalid files (default: true) */
  deleteInvalid?: boolean;
}

/**
 * Creates a middleware that validates uploaded files using magic byte inspection
 * 
 * @param options - Validation options
 * @returns Express middleware function
 */
export function validateUploadedFile(options: FileValidationOptions = {}) {
  const {
    category = 'images',
    config,
    deleteInvalid = true,
    // fieldName is reserved for future use with req.files[fieldName]
  } = options;

  const fileConfig = config || FILE_TYPE_CONFIGS[category];

  return async (req: Request, res: Response, next: NextFunction) => {
    const reqLogger = req.logger || logger;

    try {
      // Get the uploaded file from multer
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        // No file uploaded, let the route handler decide if this is an error
        return next();
      }

      let validationResult;

      // Validate based on storage type (disk or memory)
      if (file.path) {
        // File stored on disk
        validationResult = await validateFilePath(
          file.path,
          fileConfig,
          file.mimetype
        );
      } else if (file.buffer) {
        // File stored in memory
        validationResult = await validateFileBuffer(
          file.buffer,
          fileConfig,
          file.mimetype,
          file.size
        );
      } else {
        reqLogger.warn('File validation skipped: no path or buffer available', {
          filename: file.originalname,
        });
        return next();
      }

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        reqLogger.warn('File validation warnings', {
          filename: file.originalname,
          warnings: validationResult.warnings,
          detectedMimeType: validationResult.detectedMimeType,
          declaredMimeType: file.mimetype,
        });
      }

      // Handle invalid files
      if (!validationResult.isValid) {
        reqLogger.warn('File validation failed', {
          filename: file.originalname,
          errors: validationResult.errors,
          detectedMimeType: validationResult.detectedMimeType,
          declaredMimeType: file.mimetype,
        });

        // Delete the invalid file if stored on disk
        if (deleteInvalid && file.path) {
          try {
            await fs.unlink(file.path);
            reqLogger.info('Deleted invalid uploaded file', {
              path: file.path,
            });
          } catch (unlinkError: any) {
            reqLogger.error('Failed to delete invalid file', unlinkError, {
              path: file.path,
            });
          }
        }

        return res.status(400).json({
          success: false,
          message: 'File validation failed',
          errors: validationResult.errors,
          code: 'INVALID_FILE_TYPE',
        });
      }

      // Attach validation result to request for downstream use
      (req as any).fileValidation = validationResult;

      // Update file mimetype with detected type for consistency
      if (validationResult.detectedMimeType) {
        file.mimetype = validationResult.detectedMimeType;
      }

      reqLogger.debug('File validation passed', {
        filename: file.originalname,
        detectedMimeType: validationResult.detectedMimeType,
        detectedExtension: validationResult.detectedExtension,
      });

      next();
    } catch (error: any) {
      reqLogger.error('File validation error', error);
      return res.status(500).json({
        success: false,
        message: 'Error validating file',
        code: 'FILE_VALIDATION_ERROR',
      });
    }
  };
}


/**
 * Creates a middleware that validates multiple uploaded files
 * 
 * @param options - Validation options
 * @returns Express middleware function
 */
export function validateUploadedFiles(options: FileValidationOptions = {}) {
  const {
    category = 'images',
    config,
    deleteInvalid = true,
  } = options;

  const fileConfig = config || FILE_TYPE_CONFIGS[category];

  return async (req: Request, res: Response, next: NextFunction) => {
    const reqLogger = req.logger || logger;

    try {
      // Get the uploaded files from multer
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        // No files uploaded, let the route handler decide if this is an error
        return next();
      }

      const validationResults: Array<{
        filename: string;
        isValid: boolean;
        errors: string[];
        warnings: string[];
      }> = [];

      const invalidFiles: Express.Multer.File[] = [];

      for (const file of files) {
        let validationResult;

        if (file.path) {
          validationResult = await validateFilePath(
            file.path,
            fileConfig,
            file.mimetype
          );
        } else if (file.buffer) {
          validationResult = await validateFileBuffer(
            file.buffer,
            fileConfig,
            file.mimetype,
            file.size
          );
        } else {
          continue;
        }

        validationResults.push({
          filename: file.originalname,
          isValid: validationResult.isValid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });

        if (!validationResult.isValid) {
          invalidFiles.push(file);
        } else if (validationResult.detectedMimeType) {
          file.mimetype = validationResult.detectedMimeType;
        }
      }

      // Delete invalid files if configured
      if (deleteInvalid && invalidFiles.length > 0) {
        for (const file of invalidFiles) {
          if (file.path) {
            try {
              await fs.unlink(file.path);
              reqLogger.info('Deleted invalid uploaded file', {
                path: file.path,
              });
            } catch (unlinkError: any) {
              reqLogger.error('Failed to delete invalid file', unlinkError, {
                path: file.path,
              });
            }
          }
        }
      }

      // If any files are invalid, return error
      if (invalidFiles.length > 0) {
        const allErrors = validationResults
          .filter(r => !r.isValid)
          .map(r => ({
            filename: r.filename,
            errors: r.errors,
          }));

        reqLogger.warn('Multiple file validation failed', {
          invalidCount: invalidFiles.length,
          totalCount: files.length,
          errors: allErrors,
        });

        return res.status(400).json({
          success: false,
          message: `${invalidFiles.length} of ${files.length} files failed validation`,
          errors: allErrors,
          code: 'INVALID_FILE_TYPES',
        });
      }

      // Attach validation results to request
      (req as any).filesValidation = validationResults;

      next();
    } catch (error: any) {
      reqLogger.error('Multiple file validation error', error);
      return res.status(500).json({
        success: false,
        message: 'Error validating files',
        code: 'FILE_VALIDATION_ERROR',
      });
    }
  };
}

/**
 * Pre-configured middleware for image uploads
 */
export const validateImageUpload = validateUploadedFile({ category: 'images' });

/**
 * Pre-configured middleware for avatar uploads
 */
export const validateAvatarUpload = validateUploadedFile({ category: 'avatars' });

/**
 * Pre-configured middleware for document uploads
 */
export const validateDocumentUpload = validateUploadedFile({ category: 'documents' });

/**
 * Pre-configured middleware for chat attachment uploads
 */
export const validateChatAttachmentUpload = validateUploadedFile({ category: 'chatAttachments' });
