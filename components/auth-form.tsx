'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { signInAction, signUpAction, type AuthState } from '@/app/actions/auth';
import type { Dict } from '@/lib/i18n/dictionaries';

const initialState: AuthState = {};

export function AuthForm({ mode, dict }: { mode: 'signin' | 'signup'; dict: Dict }) {
  const router = useRouter();
  const action = mode === 'signup' ? signUpAction : signInAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) router.replace('/app/home');
  }, [state.ok, router]);

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <h1 className="text-lg font-semibold">
        {mode === 'signup' ? dict.createAccount : dict.signIn}
      </h1>

      {mode === 'signup' && (
        <>
          <div>
            <label className="label" htmlFor="name">
              {dict.name}
            </label>
            <input id="name" name="name" className="input" required autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="workspaceName">
              {dict.workspaceName}
            </label>
            <input
              id="workspaceName"
              name="workspaceName"
              className="input"
              autoComplete="organization"
            />
          </div>
        </>
      )}

      <div>
        <label className="label" htmlFor={mode === 'signup' ? 'username' : 'identifier'}>
          {dict.username}
        </label>
        <input
          id={mode === 'signup' ? 'username' : 'identifier'}
          name={mode === 'signup' ? 'username' : 'identifier'}
          className="input"
          required
          minLength={mode === 'signup' ? 3 : 1}
          maxLength={mode === 'signup' ? 30 : 254}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          dir="ltr"
        />
        {mode === 'signup' && <p className="mt-1 text-[11px] text-muted">{dict.usernameHint}</p>}
        {mode === 'signin' && <p className="mt-1 text-[11px] text-muted">{dict.usernameNote}</p>}
      </div>

      <div>
        <label className="label" htmlFor="password">
          {dict.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          required
          minLength={mode === 'signup' ? 10 : 1}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {dict[state.error as keyof Dict] ?? dict.genericError}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={isPending}>
        {isPending ? '…' : mode === 'signup' ? dict.createAccount : dict.signIn}
      </button>

      <p className="text-center text-xs text-muted">
        {mode === 'signup' ? dict.haveAccount : dict.noAccount}{' '}
        <Link
          href={mode === 'signup' ? '/login' : '/signup'}
          className="font-medium text-brand-600 hover:underline"
        >
          {mode === 'signup' ? dict.signIn : dict.signUp}
        </Link>
      </p>
    </form>
  );
}
