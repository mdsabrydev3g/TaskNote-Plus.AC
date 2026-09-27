import { describe, expect, it } from 'vitest';
import { checkEmailChange } from '@/lib/auth/email-change';

const base = {
  currentMatches: true,
  currentEmail: 'old@tasknote-plus.app',
  nextEmail: 'new@tasknote-plus.app',
};

describe('email change decision logic', () => {
  it('accepts a valid change', () => {
    expect(checkEmailChange(base)).toBeNull();
  });

  it('refuses without the current password, before anything else', () => {
    expect(checkEmailChange({ ...base, currentMatches: false, nextEmail: 'not-an-email' })).toBe(
      'current_password_incorrect',
    );
  });

  it('refuses the same address, ignoring case and surrounding spaces', () => {
    expect(checkEmailChange({ ...base, nextEmail: 'OLD@tasknote-plus.app' })).toBe('email_unchanged');
    expect(checkEmailChange({ ...base, nextEmail: '  old@tasknote-plus.app  ' })).toBe('email_unchanged');
  });

  it('rejects a malformed address', () => {
    expect(checkEmailChange({ ...base, nextEmail: 'no-at-sign' })).toBe('invalid_email');
    expect(checkEmailChange({ ...base, nextEmail: 'missing@tld' })).toBe('invalid_email');
    expect(checkEmailChange({ ...base, nextEmail: '   ' })).toBe('invalid_email');
  });

  it('rejects an over-long address', () => {
    expect(checkEmailChange({ ...base, nextEmail: `${'a'.repeat(250)}@x.com` })).toBe('invalid_email');
  });

  it('normalises before comparing, so casing alone is not a change', () => {
    expect(checkEmailChange({ ...base, nextEmail: 'New@TaskNote-Plus.App' })).toBeNull();
  });
});
