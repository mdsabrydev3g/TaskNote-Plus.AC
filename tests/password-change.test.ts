import { describe, expect, it } from 'vitest';
import { checkPasswordChange } from '@/lib/auth/password';

const base = {
  current: 'Old-Password-2026',
  next: 'New-Password-2026',
  confirm: 'New-Password-2026',
};

describe('password change decision logic', () => {
  it('accepts a valid change', () => {
    expect(checkPasswordChange({ ...base, currentMatches: true })).toBeNull();
  });

  it('refuses when the current password is wrong, before anything else', () => {
    // Even with a mismatched confirmation and a weak new password, the
    // security-critical check must win and reveal nothing else.
    expect(
      checkPasswordChange({
        currentMatches: false,
        current: 'whatever',
        next: 'short',
        confirm: 'different',
      }),
    ).toBe('current_password_incorrect');
  });

  it('refuses mismatched confirmation', () => {
    expect(checkPasswordChange({ ...base, currentMatches: true, confirm: 'Other-2026' })).toBe(
      'password_mismatch',
    );
  });

  it('enforces the length rule', () => {
    expect(
      checkPasswordChange({ currentMatches: true, current: base.current, next: 'Sh0rt!', confirm: 'Sh0rt!' }),
    ).toBe('password_too_short');
  });

  it('enforces the character-class rule', () => {
    expect(
      checkPasswordChange({
        currentMatches: true,
        current: base.current,
        next: 'alllowercaseonly',
        confirm: 'alllowercaseonly',
      }),
    ).toBe('password_too_weak');
  });

  it('refuses reusing the same password', () => {
    expect(
      checkPasswordChange({
        currentMatches: true,
        current: 'Same-Password-2026',
        next: 'Same-Password-2026',
        confirm: 'Same-Password-2026',
      }),
    ).toBe('password_unchanged');
  });
});
