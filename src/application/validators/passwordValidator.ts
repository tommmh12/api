/**
 * Password Complexity Validator
 * 
 * Validates passwords against security requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 * 
 * Requirements: 1.5
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialChar: boolean;
}

// Default password requirements
const DEFAULT_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecialChar: true,
};

// Special characters allowed in passwords
const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~\\';

/**
 * Validates a password against complexity requirements.
 * Returns specific error messages for each failed criterion.
 * 
 * @param password - The password to validate
 * @param requirements - Optional custom requirements (defaults to standard requirements)
 * @returns PasswordValidationResult with isValid flag and array of error messages
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirements = DEFAULT_REQUIREMENTS
): PasswordValidationResult {
  const errors: string[] = [];

  // Check if password is provided
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['Password is required'],
    };
  }

  // Check minimum length
  if (password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters long`);
  }

  // Check for uppercase letter
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letter
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for digit
  if (requirements.requireDigit && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  // Check for special character
  if (requirements.requireSpecialChar) {
    const hasSpecialChar = SPECIAL_CHARS.split('').some(char => password.includes(char));
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~\\)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Quick check if a password meets all complexity requirements.
 * Use validatePassword() if you need specific error messages.
 * 
 * @param password - The password to check
 * @returns true if password meets all requirements, false otherwise
 */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password).isValid;
}

/**
 * Gets the default password requirements.
 * Useful for displaying requirements to users.
 */
export function getPasswordRequirements(): PasswordRequirements {
  return { ...DEFAULT_REQUIREMENTS };
}

/**
 * Generates a human-readable description of password requirements.
 */
export function getPasswordRequirementsDescription(): string[] {
  return [
    `At least ${DEFAULT_REQUIREMENTS.minLength} characters`,
    'At least one uppercase letter (A-Z)',
    'At least one lowercase letter (a-z)',
    'At least one digit (0-9)',
    'At least one special character (!@#$%^&*...)',
  ];
}
