/**
 * Pure decision logic for changing the username.
 *
 * Requiring the current password is deliberate: the username is the login
 * identity, so a stolen session alone must not be able to move the account.
 * Uniqueness is enforced by the caller against the database.
 */
export type UsernameChangeProblem =
  | 'current_password_incorrect'
  | 'invalid_username'
  | 'username_unchanged'
  | null;

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export function checkUsernameChange(input: {
  currentMatches: boolean;
  currentUsername: string;
  nextUsername: string;
}): UsernameChangeProblem {
  if (!input.currentMatches) return 'current_password_incorrect';

  const next = input.nextUsername.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(next)) return 'invalid_username';
  if (next === input.currentUsername.trim().toLowerCase()) return 'username_unchanged';

  return null;
}
