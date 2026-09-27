import { describe, expect, it } from 'vitest';
import { hashPassword, passwordPolicyError, verifyPassword } from '@/lib/auth/password';

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', () => {
    const stored = hashPassword('Correct-Horse-2026');
    expect(verifyPassword('Correct-Horse-2026', stored)).toBe(true);
    expect(verifyPassword('wrong-password', stored)).toBe(false);
  });

  it('produces salted, unique hashes for the same password', () => {
    const a = hashPassword('Same-Password-2026');
    const b = hashPassword('Same-Password-2026');
    expect(a).not.toEqual(b);
    expect(verifyPassword('Same-Password-2026', a)).toBe(true);
    expect(verifyPassword('Same-Password-2026', b)).toBe(true);
  });

  it('returns false for malformed stored values instead of throwing', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', '')).toBe(false);
  });

  it('enforces the password policy', () => {
    expect(passwordPolicyError('short')).toBe('password_too_short');
    expect(passwordPolicyError('alllowercaseonly')).toBe('password_too_weak');
    expect(passwordPolicyError('Good-Password-2026')).toBeNull();
  });
});
