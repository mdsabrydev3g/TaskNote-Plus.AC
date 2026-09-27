/**
 * Pure decision logic for changing the account email.
 *
 * Requiring the current password is deliberate: the email is the login
 * identity, so a stolen session alone must not be able to move the account to
 * an address the attacker controls.
 *
 * Note the honest limitation: there is no email-verification pipeline in this
 * build, so this proves intent, not ownership of the new address. Uniqueness is
 * enforced by the caller against the database.
 */
export type EmailChangeProblem =
  | 'current_password_incorrect'
  | 'email_unchanged'
  | 'invalid_email'
  | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkEmailChange(input: {
  currentMatches: boolean;
  currentEmail: string;
  nextEmail: string;
}): EmailChangeProblem {
  if (!input.currentMatches) return 'current_password_incorrect';

  const next = input.nextEmail.trim().toLowerCase();
  if (next.length === 0 || next.length > 254 || !EMAIL_PATTERN.test(next)) return 'invalid_email';
  if (next === input.currentEmail.trim().toLowerCase()) return 'email_unchanged';

  return null;
}
