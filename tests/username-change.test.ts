import { describe, expect, it } from 'vitest';
import { checkUsernameChange } from '@/lib/auth/username-change';

const base = {
  currentMatches: true,
  currentUsername: 'old-handle',
  nextUsername: 'new-handle',
};

describe('username change decision logic', () => {
  it('accepts a valid change', () => {
    expect(checkUsernameChange(base)).toBeNull();
  });

  it('refuses without the current password, before anything else', () => {
    expect(checkUsernameChange({ ...base, currentMatches: false, nextUsername: 'x' })).toBe(
      'current_password_incorrect',
    );
  });

  it('refuses the same username, ignoring case and spaces', () => {
    expect(checkUsernameChange({ ...base, nextUsername: 'OLD-HANDLE' })).toBe('username_unchanged');
    expect(checkUsernameChange({ ...base, nextUsername: '  old-handle  ' })).toBe('username_unchanged');
  });

  it('rejects malformed usernames', () => {
    expect(checkUsernameChange({ ...base, nextUsername: 'ab' })).toBe('invalid_username');
    expect(checkUsernameChange({ ...base, nextUsername: '_leading' })).toBe('invalid_username');
    expect(checkUsernameChange({ ...base, nextUsername: 'has space' })).toBe('invalid_username');
    expect(checkUsernameChange({ ...base, nextUsername: 'UPPER@CASE' })).toBe('invalid_username');
    expect(checkUsernameChange({ ...base, nextUsername: 'a'.repeat(31) })).toBe('invalid_username');
  });

  it('accepts dots, underscores and hyphens after the first character', () => {
    expect(checkUsernameChange({ ...base, nextUsername: 'osama.dev_2026' })).toBeNull();
  });

  it('normalises case before comparing, so casing alone is not a change', () => {
    expect(checkUsernameChange({ ...base, nextUsername: 'New-Handle' })).toBeNull();
  });
});
