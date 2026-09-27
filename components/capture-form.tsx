'use client';

import { useActionState, useEffect, useRef } from 'react';
import { captureAction, type CaptureState } from '@/app/actions/capture';
import type { Dict } from '@/lib/i18n/dictionaries';

const initialState: CaptureState = {};

export function CaptureForm({ dict }: { dict: Dict }) {
  const [state, formAction, isPending] = useActionState(captureAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'created') formRef.current?.reset();
  }, [state]);

  const message = state.message ? dict[state.message as keyof Dict] : undefined;
  const tone = state.status === 'created' ? 'text-emerald-600' : 'text-muted';

  return (
    <form ref={formRef} action={formAction} className="card flex flex-col gap-3">
      <label className="label" htmlFor="rawText">
        {dict.capture}
      </label>
      <textarea
        id="rawText"
        name="rawText"
        rows={3}
        className="input resize-y"
        placeholder={dict.capturePlaceholder}
        required
      />
      <div className="flex items-center justify-between gap-2">
        <p className={`text-xs ${tone}`} role="status" aria-live="polite">
          {message ?? ''}
        </p>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? '…' : dict.captureButton}
        </button>
      </div>
    </form>
  );
}
