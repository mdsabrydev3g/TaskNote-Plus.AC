'use client';

import { useActionState, useEffect, useRef } from 'react';
import { changeUsernameAction, type ChangeUsernameState } from '@/app/actions/settings';
import type { Dict } from '@/lib/i18n/dictionaries';

const initialState: ChangeUsernameState = {};

const ERROR_KEYS: Record<string, keyof Dict> = {
  current_password_incorrect: 'currentPasswordIncorrect',
  username_unchanged: 'usernameUnchanged',
  invalid_username: 'invalidUsername',
  invalidUsername: 'invalidUsername',
  usernameTaken: 'usernameTaken',
  requiredFields: 'requiredFields',
  genericError: 'genericError',
};

export function ChangeUsernameForm({ dict, currentUsername }: { dict: Dict; currentUsername: string }) {
  const [state, formAction, isPending] = useActionState(changeUsernameAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const errorKey = state.error ? ERROR_KEYS[state.error] : undefined;

  return (
    <form ref={formRef} action={formAction} className="card flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{dict.changeUsername}</h2>
      <p className="text-[11px] text-muted">{dict.usernameHint}</p>

      <div>
        <span className="label">{dict.currentUsername}</span>
        <p className="rounded-xl border border-line bg-surface px-3 py-2 text-sm" dir="ltr">
          {currentUsername}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="username">
          {dict.newUsername}
        </label>
        <input
          id="username"
          name="username"
          className="input"
          required
          minLength={3}
          maxLength={30}
          autoComplete="username"
          dir="ltr"
          spellCheck={false}
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

      <p className="text-[11px] text-muted">{dict.usernameNote}</p>

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
            {dict.usernameChanged} <span dir="ltr">{state.username}</span>
          </span>
        ) : (
          ''
        )}
      </p>

      <div>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? '…' : dict.changeUsername}
        </button>
      </div>
    </form>
  );
}
