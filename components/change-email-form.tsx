'use client';

import { useActionState, useEffect, useRef } from 'react';
import { changeEmailAction, type ChangeEmailState } from '@/app/actions/settings';
import type { Dict } from '@/lib/i18n/dictionaries';

const initialState: ChangeEmailState = {};

const ERROR_KEYS: Record<string, keyof Dict> = {
  current_password_incorrect: 'currentPasswordIncorrect',
  email_unchanged: 'emailUnchanged',
  invalid_email: 'emailInvalid',
  emailInvalid: 'emailInvalid',
  emailTaken: 'emailTaken',
  requiredFields: 'requiredFields',
  genericError: 'genericError',
};

export function ChangeEmailForm({ dict, currentEmail }: { dict: Dict; currentEmail: string }) {
  const [state, formAction, isPending] = useActionState(changeEmailAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const errorKey = state.error ? ERROR_KEYS[state.error] : undefined;

  return (
    <form ref={formRef} action={formAction} className="card flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{dict.changeEmail}</h2>

      <div>
        <span className="label">{dict.currentEmail}</span>
        <p className="rounded-xl border border-line bg-surface px-3 py-2 text-sm" dir="ltr">
          {currentEmail}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="email">
          {dict.newEmail}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          required
          autoComplete="email"
          dir="ltr"
        />
      </div>

      <div>
        <label className="label" htmlFor="currentPassword">
          {dict.currentPasswordForChange}
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          className="input"
          required
          autoComplete="current-password"
        />
      </div>

      <p className="text-[11px] text-muted">{dict.emailNote}</p>

      {errorKey && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {dict[errorKey]}
        </p>
      )}

      <p className="text-xs" role="status" aria-live="polite">
        {state.ok ? (
          <span className="text-emerald-600">
            {dict.emailChanged} <span dir="ltr">{state.email}</span>
          </span>
        ) : (
          ''
        )}
      </p>

      <div>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? '…' : dict.changeEmail}
        </button>
      </div>
    </form>
  );
}
