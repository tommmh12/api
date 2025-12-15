import { describe, it, expect } from 'vitest';
import { 
  validatePassword, 
  isPasswordValid, 
  getPasswordRequirements,
  getPasswordRequirementsDescription 
} from '../../../src/application/validators/passwordValidator';

describe('Password Validator', () => {
  describe('validatePassword', () => {
    it('should accept a valid password with all requirements met', () => {
      const result = validatePassword('SecurePass1!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should reject null/undefined password', () => {
      const result = validatePassword(null as unknown as string);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should reject password shorter than minimum length', () => {
      const result = validatePassword('Ab1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePassword('lowercase1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const result = validatePassword('UPPERCASE1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without digit', () => {
      const result = validatePassword('NoDigits!@');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one digit');
    });

    it('should reject password without special character', () => {
      const result = validatePassword('NoSpecial1A');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('special character'))).toBe(true);
    });

    it('should return multiple errors for multiple violations', () => {
      const result = validatePassword('short');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should accept various special characters', () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'];
      specialChars.forEach(char => {
        const result = validatePassword(`Password1${char}`);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('isPasswordValid', () => {
    it('should return true for valid password', () => {
      expect(isPasswordValid('ValidPass1!')).toBe(true);
    });

    it('should return false for invalid password', () => {
      expect(isPasswordValid('weak')).toBe(false);
    });
  });

  describe('getPasswordRequirements', () => {
    it('should return default requirements', () => {
      const requirements = getPasswordRequirements();
      expect(requirements.minLength).toBe(8);
      expect(requirements.requireUppercase).toBe(true);
      expect(requirements.requireLowercase).toBe(true);
      expect(requirements.requireDigit).toBe(true);
      expect(requirements.requireSpecialChar).toBe(true);
    });
  });

  describe('getPasswordRequirementsDescription', () => {
    it('should return array of requirement descriptions', () => {
      const descriptions = getPasswordRequirementsDescription();
      expect(Array.isArray(descriptions)).toBe(true);
      expect(descriptions.length).toBe(5);
    });
  });
});
