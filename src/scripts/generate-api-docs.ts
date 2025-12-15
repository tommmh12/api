/**
 * Generate API Documentation
 * 
 * This script generates static OpenAPI documentation files.
 * Requirements: 14.1 - API documentation
 * 
 * Usage: npx tsx src/scripts/generate-api-docs.ts
 * 
 * Output:
 * - docs/api-docs/openapi.json - OpenAPI 3.0 specification
 * - docs/api-docs/openapi.yaml - OpenAPI 3.0 specification (YAML format)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { swaggerSpec } from '../infrastructure/swagger/swagger.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Output directory (relative to backend folder)
const outputDir = join(__dirname, '..', '..', '..', 'docs', 'api-docs');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Generate JSON format
const jsonPath = join(outputDir, 'openapi.json');
writeFileSync(jsonPath, JSON.stringify(swaggerSpec, null, 2));
console.log(`✓ Generated: ${jsonPath}`);

// Generate YAML format (simple conversion)
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (obj === null || obj === undefined) {
    return 'null';
  }
  
  if (typeof obj === 'string') {
    // Check if string needs quoting
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#') || 
        obj.includes('"') || obj.includes("'") || obj.match(/^\s/) || 
        obj.match(/\s$/) || obj === '' || obj === 'true' || obj === 'false' ||
        !isNaN(Number(obj))) {
      // Use literal block for multiline strings
      if (obj.includes('\n')) {
        const lines = obj.split('\n').map(line => spaces + '  ' + line).join('\n');
        return '|\n' + lines;
      }
      return JSON.stringify(obj);
    }
    return obj;
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => {
      const value = jsonToYaml(item, indent + 1);
      if (typeof item === 'object' && item !== null) {
        return `\n${spaces}- ${value.trim().replace(/^\n/, '').replace(/\n/g, '\n' + spaces + '  ')}`;
      }
      return `\n${spaces}- ${value}`;
    }).join('');
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return entries.map(([key, value]) => {
      const yamlValue = jsonToYaml(value, indent + 1);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return `\n${spaces}${key}:${yamlValue}`;
      }
      if (Array.isArray(value)) {
        return `\n${spaces}${key}:${yamlValue}`;
      }
      return `\n${spaces}${key}: ${yamlValue}`;
    }).join('');
  }
  
  return String(obj);
}

const yamlPath = join(outputDir, 'openapi.yaml');
const yamlContent = `# Nexus Internal Portal API
# OpenAPI 3.0 Specification
# Generated: ${new Date().toISOString()}
# 
# This file is auto-generated. Do not edit manually.
# Run: npx tsx src/scripts/generate-api-docs.ts
${jsonToYaml(swaggerSpec)}
`;
writeFileSync(yamlPath, yamlContent);
console.log(`✓ Generated: ${yamlPath}`);

console.log('\n📚 API Documentation generated successfully!');
console.log('\nTo view the interactive documentation:');
console.log('1. Start the server: npm run dev');
console.log('2. Open: http://localhost:5000/api-docs');
console.log('\nStatic files:');
console.log(`- JSON: ${jsonPath}`);
console.log(`- YAML: ${yamlPath}`);
