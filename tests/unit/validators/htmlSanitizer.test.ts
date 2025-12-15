import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  sanitize,
  stripHtml,
  containsDangerousContent,
  sanitizeUrl,
  getDefaultAllowedTags,
  getDefaultAllowedAttributes
} from '../../../src/application/validators/htmlSanitizer';

describe('HTML Sanitizer', () => {
  describe('sanitizeHtml', () => {
    it('should preserve safe HTML elements', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeHtml(input);
      expect(result.sanitized).toBe(input);
      expect(result.wasModified).toBe(false);
    });

    it('should remove script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const result = sanitizeHtml(input);
      expect(result.sanitized).not.toContain('<script>');
      expect(result.sanitized).not.toContain('alert');
      expect(result.wasModified).toBe(true);
    });

    it('should remove event handlers', () => {
      const input = '<img src="test.jpg" onerror="alert(1)">';
      const result = sanitizeHtml(input);
      expect(result.sanitized).not.toContain('onerror');
      expect(result.wasModified).toBe(true);
    });

    it('should remove javascript: URLs', () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHtml(input);
      expect(result.sanitized).not.toContain('javascript:');
    });

    it('should handle null input', () => {
      const result = sanitizeHtml(null as unknown as string);
      expect(result.sanitized).toBe('');
      expect(result.wasModified).toBe(false);
    });

    it('should handle undefined input', () => {
      const result = sanitizeHtml(undefined as unknown as string);
      expect(result.sanitized).toBe('');
      expect(result.wasModified).toBe(false);
    });

    it('should strip all tags when configured', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeHtml(input, { stripAllTags: true });
      expect(result.sanitized).toBe('Hello World');
    });

    it('should remove iframe tags', () => {
      const input = '<iframe src="http://evil.com"></iframe>';
      const result = sanitizeHtml(input);
      expect(result.sanitized).not.toContain('<iframe');
    });

    it('should preserve allowed attributes', () => {
      const input = '<a href="https://example.com" title="Example">Link</a>';
      const result = sanitizeHtml(input);
      expect(result.sanitized).toContain('href="https://example.com"');
      expect(result.sanitized).toContain('title="Example"');
    });
  });

  describe('sanitize', () => {
    it('should return sanitized string directly', () => {
      const input = '<p>Safe</p><script>bad</script>';
      const result = sanitize(input);
      expect(result).toContain('<p>Safe</p>');
      expect(result).not.toContain('<script>');
    });
  });

  describe('stripHtml', () => {
    it('should remove all HTML and return plain text', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = stripHtml(input);
      expect(result).toBe('Hello World');
    });
  });

  describe('containsDangerousContent', () => {
    it('should detect script tags', () => {
      expect(containsDangerousContent('<script>alert(1)</script>')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(containsDangerousContent('<img onerror="alert(1)">')).toBe(true);
    });

    it('should detect javascript: URLs', () => {
      expect(containsDangerousContent('<a href="javascript:void(0)">')).toBe(true);
    });

    it('should return false for safe content', () => {
      expect(containsDangerousContent('<p>Safe content</p>')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(containsDangerousContent(null as unknown as string)).toBe(false);
      expect(containsDangerousContent(undefined as unknown as string)).toBe(false);
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow safe URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
      expect(sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
    });

    it('should block javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    });

    it('should block vbscript: URLs', () => {
      expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('');
    });

    it('should handle empty input', () => {
      expect(sanitizeUrl('')).toBe('');
      expect(sanitizeUrl(null as unknown as string)).toBe('');
    });
  });

  describe('getDefaultAllowedTags', () => {
    it('should return array of allowed tags', () => {
      const tags = getDefaultAllowedTags();
      expect(Array.isArray(tags)).toBe(true);
      expect(tags).toContain('p');
      expect(tags).toContain('a');
      expect(tags).toContain('img');
    });
  });

  describe('getDefaultAllowedAttributes', () => {
    it('should return array of allowed attributes', () => {
      const attrs = getDefaultAllowedAttributes();
      expect(Array.isArray(attrs)).toBe(true);
      expect(attrs).toContain('href');
      expect(attrs).toContain('src');
      expect(attrs).toContain('class');
    });
  });
});
