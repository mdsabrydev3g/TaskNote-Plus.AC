'use client';

import { useActionState, useEffect, useRef } from 'react';
import { changePasswordAction, type ChangePasswordState } from '@/app/actions/settings';
import type { Dict } from '@/lib/i18n/dictionaries';

const initialState: ChangePasswordState = {};

/** Maps an error code from the action to a translated message. */
const ERROR_KEYS: Record<string, keyof Dict> = {
  current_password_incorrect: 'currentPasswordIncorrect',
  password_mismatch: 'passwordMismatch',
  password_too_short: 'passwordTooShort',
  password_too_weak: 'weakPassword',
  password_unchanged: 'passwordUnchanged',
  requiredFields: 'requiredFields',
  genericError: 'genericError',
};

export function ChangePasswordForm({ dict }: { dict: Dict }) {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const errorKey = state.error ? ERROR_KEYS[state.error] : undefined;

  return (
    <form ref={formRef} action={formAction} className="card flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{dict.changePassword}</h2>
      <p className="text-[11px] text-muted">{dict.passwordHint}</p>

      <div>
        <label className="label" htmlFor="current">
          {dict.currentPassword}
        </label>
        <input
          id="current"
          name="current"
          type="password"
          className="input"
          required
          autoComplete="current-password"
        />
      </div>

      <div>
        <label className="label" htmlFor="next">
          {dict.newPassword}
        </label>
        <input
          id="next"
          name="next"
          type="password"
          className="input"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="label" htmlFor="confirm">
          {dict.confirmPassword}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          className="input"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </div>

      {errorKey && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {dict[errorKey]}
        </p>
      )}

      <p className="text-xs" role="status" aria-live="polite">
        {state.ok ? <span className="text-emerald-600">{dict.passwordChanged}</span> : ''}
      </p>

      <div>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? '…' : dict.changePassword}
        </button>
      </div>
    </form>
  );
}
