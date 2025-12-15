/**
 * HTML Sanitizer Utility
 * 
 * Sanitizes HTML content to prevent XSS attacks using a whitelist-based approach.
 * - Removes script tags
 * - Removes event handlers (onclick, onerror, etc.)
 * - Removes javascript: URLs
 * - Preserves safe HTML structure
 * 
 * Requirements: 2.2
 */

import DOMPurify from 'isomorphic-dompurify';

export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  removedElements: string[];
}

export interface SanitizationConfig {
  allowedTags?: string[];
  allowedAttributes?: string[];
  allowDataAttributes?: boolean;
  stripAllTags?: boolean;
}

// Default allowed tags - safe HTML elements
const DEFAULT_ALLOWED_TAGS = [
  // Text formatting
  'p', 'br', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'sub', 'sup', 'mark',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Lists
  'ul', 'ol', 'li',
  // Links (href will be validated separately)
  'a',
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  // Other safe elements
  'blockquote', 'pre', 'code',
  'hr',
  // Images (src will be validated)
  'img',
];

// Default allowed attributes
const DEFAULT_ALLOWED_ATTRIBUTES = [
  'href', 'src', 'alt', 'title', 'class', 'id',
  'width', 'height', 'style',
  'target', 'rel',
  'colspan', 'rowspan',
];

// Dangerous patterns to detect
const DANGEROUS_PATTERNS = {
  scriptTags: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  eventHandlers: /\bon\w+\s*=/gi,
  javascriptUrls: /javascript\s*:/gi,
  dataUrls: /data\s*:/gi,
  vbscriptUrls: /vbscript\s*:/gi,
};

/**
 * Sanitizes HTML content using DOMPurify with a whitelist-based approach.
 * Removes script tags, event handlers, and javascript: URLs while preserving safe HTML.
 * 
 * @param html - The HTML string to sanitize
 * @param config - Optional configuration for allowed tags and attributes
 * @returns SanitizationResult with sanitized content and modification info
 */
export function sanitizeHtml(
  html: string,
  config: SanitizationConfig = {}
): SanitizationResult {
  // Handle null/undefined input
  if (html === null || html === undefined) {
    return {
      sanitized: '',
      wasModified: false,
      removedElements: [],
    };
  }

  // Convert to string if not already
  const inputHtml = String(html);
  
  // Track what was removed
  const removedElements: string[] = [];
  
  // Check for dangerous patterns before sanitization
  if (DANGEROUS_PATTERNS.scriptTags.test(inputHtml)) {
    removedElements.push('script tags');
  }
  if (DANGEROUS_PATTERNS.eventHandlers.test(inputHtml)) {
    removedElements.push('event handlers');
  }
  if (DANGEROUS_PATTERNS.javascriptUrls.test(inputHtml)) {
    removedElements.push('javascript: URLs');
  }
  if (DANGEROUS_PATTERNS.vbscriptUrls.test(inputHtml)) {
    removedElements.push('vbscript: URLs');
  }

  // If stripAllTags is true, remove all HTML
  if (config.stripAllTags) {
    const stripped = DOMPurify.sanitize(inputHtml, { ALLOWED_TAGS: [] });
    return {
      sanitized: stripped,
      wasModified: stripped !== inputHtml,
      removedElements: stripped !== inputHtml ? ['all HTML tags'] : [],
    };
  }

  // Configure DOMPurify
  const allowedTags = config.allowedTags || DEFAULT_ALLOWED_TAGS;
  const allowedAttributes = config.allowedAttributes || DEFAULT_ALLOWED_ATTRIBUTES;

  // DOMPurify configuration
  const purifyConfig: DOMPurify.Config = {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_DATA_ATTR: config.allowDataAttributes || false,
    // Forbid dangerous URI schemes
    // eslint-disable-next-line no-useless-escape
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // Remove dangerous elements completely
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet'],
    FORBID_ATTR: [
      'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmousedown',
      'onmouseup', 'onkeydown', 'onkeyup', 'onkeypress', 'onfocus', 'onblur',
      'onchange', 'onsubmit', 'onreset', 'onselect', 'oninput', 'onscroll',
      'ondrag', 'ondrop', 'oncopy', 'oncut', 'onpaste',
    ],
  };

  // Sanitize the HTML
  const sanitized = DOMPurify.sanitize(inputHtml, purifyConfig);

  return {
    sanitized,
    wasModified: sanitized !== inputHtml,
    removedElements,
  };
}

/**
 * Quick sanitization that returns only the sanitized string.
 * Use sanitizeHtml() if you need information about what was removed.
 * 
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitize(html: string): string {
  return sanitizeHtml(html).sanitized;
}

/**
 * Strips all HTML tags and returns plain text.
 * Useful for contexts where no HTML is allowed.
 * 
 * @param html - The HTML string to strip
 * @returns Plain text with all HTML removed
 */
export function stripHtml(html: string): string {
  return sanitizeHtml(html, { stripAllTags: true }).sanitized;
}

/**
 * Checks if HTML content contains potentially dangerous elements.
 * Does not modify the content, only checks for dangerous patterns.
 * 
 * @param html - The HTML string to check
 * @returns true if dangerous content is detected, false otherwise
 */
export function containsDangerousContent(html: string): boolean {
  if (!html || typeof html !== 'string') {
    return false;
  }

  return (
    DANGEROUS_PATTERNS.scriptTags.test(html) ||
    DANGEROUS_PATTERNS.eventHandlers.test(html) ||
    DANGEROUS_PATTERNS.javascriptUrls.test(html) ||
    DANGEROUS_PATTERNS.vbscriptUrls.test(html)
  );
}

/**
 * Sanitizes a URL to prevent javascript: and other dangerous schemes.
 * 
 * @param url - The URL to sanitize
 * @returns Sanitized URL or empty string if dangerous
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url.trim().toLowerCase();
  
  // Block dangerous URL schemes
  if (
    trimmedUrl.startsWith('javascript:') ||
    trimmedUrl.startsWith('vbscript:') ||
    trimmedUrl.startsWith('data:text/html')
  ) {
    return '';
  }

  return url;
}

/**
 * Gets the default allowed tags.
 * Useful for displaying configuration to administrators.
 */
export function getDefaultAllowedTags(): string[] {
  return [...DEFAULT_ALLOWED_TAGS];
}

/**
 * Gets the default allowed attributes.
 * Useful for displaying configuration to administrators.
 */
export function getDefaultAllowedAttributes(): string[] {
  return [...DEFAULT_ALLOWED_ATTRIBUTES];
}
