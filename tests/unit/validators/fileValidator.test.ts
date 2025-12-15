/**
 * Unit tests for File Validator with Magic Byte Content Inspection
 * 
 * **Validates: Requirements 2.4**
 */

import { describe, it, expect } from 'vitest';
import {
  validateFileBuffer,
  validateFileByCategory,
  isAllowedFileType,
  detectFileType,
  extensionMatchesContent,
  createFileTypeConfig,
  FILE_TYPE_CONFIGS,
} from '../../../src/application/validators/fileValidator.js';

// Test file magic bytes (first few bytes that identify file type)
// These are real magic byte signatures for common file types
// Note: file-type library needs sufficient bytes to detect file types properly
const MAGIC_BYTES = {
  // JPEG: FF D8 FF E0 (JFIF marker) + JFIF header
  jpeg: Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00
  ]),
  // PNG: Full PNG header with IHDR chunk (minimum valid PNG structure)
  png: Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length (13 bytes)
    0x49, 0x48, 0x44, 0x52, // IHDR chunk type
    0x00, 0x00, 0x00, 0x01, // Width: 1
    0x00, 0x00, 0x00, 0x01, // Height: 1
    0x08, 0x02, // Bit depth: 8, Color type: 2 (RGB)
    0x00, 0x00, 0x00, // Compression, Filter, Interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
  ]),
  // GIF: GIF89a header with logical screen descriptor
  gif: Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
    0x01, 0x00, 0x01, 0x00, // Width: 1, Height: 1
    0x00, 0x00, 0x00 // Global color table flag, etc.
  ]),
  // WebP: RIFF header with WEBP signature
  webp: Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00, // File size (placeholder)
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x20, // VP8 chunk
    0x18, 0x00, 0x00, 0x00, // Chunk size
    0x30, 0x01, 0x00, 0x9D, 0x01, 0x2A, // VP8 bitstream
    0x01, 0x00, 0x01, 0x00, // Width/Height
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]),
  // PDF: %PDF-1.4 header
  pdf: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]),
  // ZIP (used by docx, xlsx): PK header
  zip: Buffer.from([0x50, 0x4B, 0x03, 0x04]),
  // Plain text (no magic bytes - should fail detection)
  text: Buffer.from('Hello, this is plain text content'),
  // Random bytes (should fail detection)
  random: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]),
};

describe('File Validator', () => {
  describe('detectFileType', () => {
    it('should detect JPEG files from magic bytes', async () => {
      const result = await detectFileType(MAGIC_BYTES.jpeg);
      expect(result).not.toBeNull();
      expect(result?.mime).toBe('image/jpeg');
      expect(result?.ext).toBe('jpg');
    });

    it('should detect PNG files from magic bytes', async () => {
      const result = await detectFileType(MAGIC_BYTES.png);
      expect(result).not.toBeNull();
      expect(result?.mime).toBe('image/png');
      expect(result?.ext).toBe('png');
    });


    it('should detect GIF files from magic bytes', async () => {
      const result = await detectFileType(MAGIC_BYTES.gif);
      expect(result).not.toBeNull();
      expect(result?.mime).toBe('image/gif');
      expect(result?.ext).toBe('gif');
    });

    it('should detect PDF files from magic bytes', async () => {
      const result = await detectFileType(MAGIC_BYTES.pdf);
      expect(result).not.toBeNull();
      expect(result?.mime).toBe('application/pdf');
      expect(result?.ext).toBe('pdf');
    });

    it('should return null for plain text (no magic bytes)', async () => {
      const result = await detectFileType(MAGIC_BYTES.text);
      expect(result).toBeNull();
    });

    it('should return null for random bytes', async () => {
      const result = await detectFileType(MAGIC_BYTES.random);
      expect(result).toBeNull();
    });
  });

  describe('validateFileBuffer', () => {
    it('should validate a valid JPEG file against image config', async () => {
      const result = await validateFileBuffer(
        MAGIC_BYTES.jpeg,
        FILE_TYPE_CONFIGS.images,
        'image/jpeg'
      );
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/jpeg');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a valid PNG file against image config', async () => {
      const result = await validateFileBuffer(
        MAGIC_BYTES.png,
        FILE_TYPE_CONFIGS.images,
        'image/png'
      );
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/png');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject a PDF file when validating against image config', async () => {
      const result = await validateFileBuffer(
        MAGIC_BYTES.pdf,
        FILE_TYPE_CONFIGS.images,
        'application/pdf'
      );
      expect(result.isValid).toBe(false);
      expect(result.detectedMimeType).toBe('application/pdf');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('not allowed'))).toBe(true);
    });

    it('should reject files that exceed size limit', async () => {
      const smallConfig = createFileTypeConfig(
        ['image/jpeg'],
        ['jpg'],
        10 // 10 bytes max
      );
      const result = await validateFileBuffer(
        MAGIC_BYTES.jpeg,
        smallConfig,
        'image/jpeg'
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
    });

    it('should reject files with undetectable type', async () => {
      const result = await validateFileBuffer(
        MAGIC_BYTES.text,
        FILE_TYPE_CONFIGS.images
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unable to determine'))).toBe(true);
    });

    it('should warn when declared MIME type does not match detected type', async () => {
      const result = await validateFileBuffer(
        MAGIC_BYTES.jpeg,
        FILE_TYPE_CONFIGS.images,
        'image/png' // Wrong declared type
      );
      expect(result.isValid).toBe(true); // Still valid because actual type is allowed
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('does not match'))).toBe(true);
    });
  });


  describe('validateFileByCategory', () => {
    it('should validate images using the images category', async () => {
      const result = await validateFileByCategory(
        MAGIC_BYTES.jpeg,
        'images',
        'image/jpeg'
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate avatars using the avatars category', async () => {
      const result = await validateFileByCategory(
        MAGIC_BYTES.png,
        'avatars',
        'image/png'
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate documents using the documents category', async () => {
      const result = await validateFileByCategory(
        MAGIC_BYTES.pdf,
        'documents',
        'application/pdf'
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate chat attachments (images and documents)', async () => {
      // Test with image
      const imageResult = await validateFileByCategory(
        MAGIC_BYTES.jpeg,
        'chatAttachments',
        'image/jpeg'
      );
      expect(imageResult.isValid).toBe(true);

      // Test with PDF
      const pdfResult = await validateFileByCategory(
        MAGIC_BYTES.pdf,
        'chatAttachments',
        'application/pdf'
      );
      expect(pdfResult.isValid).toBe(true);
    });

    it('should reject GIF in avatars category (not allowed)', async () => {
      const result = await validateFileByCategory(
        MAGIC_BYTES.gif,
        'avatars',
        'image/gif'
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('not allowed'))).toBe(true);
    });
  });

  describe('isAllowedFileType', () => {
    it('should return true for allowed MIME types', async () => {
      const result = await isAllowedFileType(
        MAGIC_BYTES.jpeg,
        ['image/jpeg', 'image/png']
      );
      expect(result).toBe(true);
    });

    it('should return false for disallowed MIME types', async () => {
      const result = await isAllowedFileType(
        MAGIC_BYTES.pdf,
        ['image/jpeg', 'image/png']
      );
      expect(result).toBe(false);
    });

    it('should return false for undetectable files', async () => {
      const result = await isAllowedFileType(
        MAGIC_BYTES.text,
        ['text/plain']
      );
      expect(result).toBe(false);
    });
  });

  describe('extensionMatchesContent', () => {
    it('should return true when extension matches content', async () => {
      const result = await extensionMatchesContent(MAGIC_BYTES.jpeg, 'jpg');
      expect(result).toBe(true);
    });

    it('should handle jpeg/jpg alias', async () => {
      const result = await extensionMatchesContent(MAGIC_BYTES.jpeg, 'jpeg');
      expect(result).toBe(true);
    });

    it('should return false when extension does not match content', async () => {
      const result = await extensionMatchesContent(MAGIC_BYTES.jpeg, 'png');
      expect(result).toBe(false);
    });

    it('should handle extension with leading dot', async () => {
      const result = await extensionMatchesContent(MAGIC_BYTES.png, '.png');
      expect(result).toBe(true);
    });

    it('should return false for undetectable files', async () => {
      const result = await extensionMatchesContent(MAGIC_BYTES.text, 'txt');
      expect(result).toBe(false);
    });
  });

  describe('createFileTypeConfig', () => {
    it('should create a valid config object', () => {
      const config = createFileTypeConfig(
        ['image/jpeg', 'image/png'],
        ['jpg', 'png'],
        5 * 1024 * 1024
      );
      expect(config.mimeTypes).toEqual(['image/jpeg', 'image/png']);
      expect(config.extensions).toEqual(['jpg', 'png']);
      expect(config.maxSizeBytes).toBe(5 * 1024 * 1024);
    });

    it('should normalize extensions by removing leading dots', () => {
      const config = createFileTypeConfig(
        ['image/jpeg'],
        ['.jpg', '.jpeg'],
        1024
      );
      expect(config.extensions).toEqual(['jpg', 'jpeg']);
    });
  });

  describe('FILE_TYPE_CONFIGS', () => {
    it('should have images config with correct MIME types', () => {
      expect(FILE_TYPE_CONFIGS.images.mimeTypes).toContain('image/jpeg');
      expect(FILE_TYPE_CONFIGS.images.mimeTypes).toContain('image/png');
      expect(FILE_TYPE_CONFIGS.images.mimeTypes).toContain('image/gif');
      expect(FILE_TYPE_CONFIGS.images.mimeTypes).toContain('image/webp');
    });

    it('should have avatars config with stricter MIME types (no GIF)', () => {
      expect(FILE_TYPE_CONFIGS.avatars.mimeTypes).toContain('image/jpeg');
      expect(FILE_TYPE_CONFIGS.avatars.mimeTypes).toContain('image/png');
      expect(FILE_TYPE_CONFIGS.avatars.mimeTypes).not.toContain('image/gif');
    });

    it('should have documents config with office and PDF types', () => {
      expect(FILE_TYPE_CONFIGS.documents.mimeTypes).toContain('application/pdf');
      expect(FILE_TYPE_CONFIGS.documents.mimeTypes).toContain('application/msword');
    });

    it('should have chatAttachments config with both images and documents', () => {
      expect(FILE_TYPE_CONFIGS.chatAttachments.mimeTypes).toContain('image/jpeg');
      expect(FILE_TYPE_CONFIGS.chatAttachments.mimeTypes).toContain('application/pdf');
    });
  });

  describe('Security: Spoofing Detection', () => {
    it('should detect when a file claims to be JPEG but is actually PNG', async () => {
      const result = await validateFileBuffer(
        MAGIC_BYTES.png,
        FILE_TYPE_CONFIGS.images,
        'image/jpeg' // Spoofed MIME type
      );
      expect(result.isValid).toBe(true); // PNG is still allowed
      expect(result.detectedMimeType).toBe('image/png'); // Detected actual type
      expect(result.warnings.some(w => w.includes('does not match'))).toBe(true);
    });

    it('should reject a text file disguised as an image', async () => {
      const result = await validateFileBuffer(
        MAGIC_BYTES.text,
        FILE_TYPE_CONFIGS.images,
        'image/jpeg' // Spoofed MIME type
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unable to determine'))).toBe(true);
    });

    it('should reject a PDF disguised as an image', async () => {
      const result = await validateFileBuffer(
        MAGIC_BYTES.pdf,
        FILE_TYPE_CONFIGS.images,
        'image/jpeg' // Spoofed MIME type
      );
      expect(result.isValid).toBe(false);
      expect(result.detectedMimeType).toBe('application/pdf');
    });
  });
});
