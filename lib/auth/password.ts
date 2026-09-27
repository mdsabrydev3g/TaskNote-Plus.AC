import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

/** Format: scrypt$N$r$p$saltB64url$keyB64url */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEYLEN, PARAMS);
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltPart, keyPart] = parts;
    const salt = Buffer.from(saltPart, 'base64url');
    const expected = Buffer.from(keyPart, 'base64url');
    if (expected.length === 0) return false;
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: PARAMS.maxmem,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export type PasswordPolicyProblem = 'password_too_short' | 'password_too_weak';

/** zxcvbn-style minimum policy without the dependency: length + character classes. */
export function passwordPolicyError(password: string): PasswordPolicyProblem | null {
  if (password.length < 10) return 'password_too_short';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) return 'password_too_weak';
  return null;
}

export type PasswordChangeProblem =
  | 'current_password_incorrect'
  | 'password_mismatch'
  | PasswordPolicyProblem
  | 'password_unchanged'
  | null;

/**
 * Pure decision logic for a password change.
 *
 * The order matters: proving knowledge of the current password is checked
 * first, so a holder of a stolen session learns nothing about the password
 * policy, and cannot rotate the password at all.
 */
export function checkPasswordChange(input: {
  currentMatches: boolean;
  current: string;
  next: string;
  confirm: string;
}): PasswordChangeProblem {
  if (!input.currentMatches) return 'current_password_incorrect';
  if (input.next !== input.confirm) return 'password_mismatch';
  const policy = passwordPolicyError(input.next);
  if (policy) return policy;
  if (input.next === input.current) return 'password_unchanged';
  return null;
}
