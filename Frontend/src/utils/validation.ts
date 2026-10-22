/**
 * ===============================================================
 *  FILE: utils/validation.ts
 *  OWNER: Member 1  |  PHASE: 1 (Shared Setup)
 *  WHAT: Small form-checking helpers for Login, Signup and
 *        Forgot Password. Member 2 can reuse isValidEmail()
 *        in ContactForm.
 * ===============================================================
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/** 0 = empty / too short, 1 = weak, 2 = okay, 3 = good, 4 = strong */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < 10) return 0;
  let score = 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score += 1;
  return Math.min(score, 4) as PasswordStrength;
}

export interface LoginErrors {
  email?: string;
  password?: string;
}

export function validateLogin(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {};
  if (!email.trim()) errors.email = 'Enter your email.';
  else if (!isValidEmail(email)) errors.email = 'This email does not look right.';
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

export interface SignupForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}

export type SignupErrors = Partial<Record<keyof SignupForm, string>>;

export function validateSignup(form: SignupForm): SignupErrors {
  const errors: SignupErrors = {};
  if (!form.firstName.trim()) errors.firstName = 'Enter your first name.';
  if (!form.email.trim()) errors.email = 'Enter your email.';
  else if (!isValidEmail(form.email)) errors.email = 'This email does not look right.';
  if (form.password.length < 10) errors.password = 'Use at least 10 characters.';
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';
  if (!form.acceptedTerms) errors.acceptedTerms = 'Please accept the terms to continue.';
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}
