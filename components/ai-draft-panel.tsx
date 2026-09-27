'use client';

import { useState, useTransition } from 'react';
import { applyDraftAction, requestDraftAction } from '@/app/actions/ai';
import type { Dict } from '@/lib/i18n/dictionaries';

type Item = { title: string; priority: number; energy: 'deep' | 'light' | 'admin' };

export function AiDraftPanel({ noteId, dict, aiEnabled }: { noteId: string; dict: Dict; aiEnabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<{ kind: 'summary' | 'tasks'; text: string; items: Item[] } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const run = (kind: 'summarize' | 'extract-actions') => {
    setStatus(null);
    startTransition(async () => {
      const result = await requestDraftAction({ noteId, task: kind });
      if (!result.allowed) {
        setStatus(dict.permissionsIntro);
        return;
      }
      if (!result.ok) {
        setStatus(dict.aiDisabled);
        return;
      }
      if (kind === 'summarize') {
        setDraft({ kind: 'summary', text: result.output, items: [] });
      } else {
        setDraft({ kind: 'tasks', text: result.output, items: parseItems(result.output) });
      }
    });
  };

  const apply = () => {
    if (!draft) return;
    startTransition(async () => {
      const result =
        draft.kind === 'summary'
          ? await applyDraftAction({ noteId, kind: 'summary', summary: draft.text })
          : await applyDraftAction({ noteId, kind: 'tasks', items: draft.items });
      setStatus(result.ok ? `${result.created}` : dict.genericError);
      if (result.ok) setDraft(null);
    });
  };

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{dict.aiDraft}</h2>
        <span className="chip">{aiEnabled ? dict.summarize : dict.aiDisabled}</span>
      </div>

      <p className="text-[11px] text-muted">{dict.aiOffline}</p>
      <p className="text-[11px] text-muted">{dict.aiNeedsConfirmation}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => run('summarize')}>
          {dict.summarize}
        </button>
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => run('extract-actions')}>
          {dict.extractActions}
        </button>
      </div>

      {draft && (
        <div className="rounded-xl border border-line bg-surface p-3">
          {draft.kind === 'summary' ? (
            <pre className="whitespace-pre-wrap break-words text-xs">{draft.text}</pre>
          ) : draft.items.length === 0 ? (
            <p className="text-xs text-muted">{dict.noResults}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-xs">
              {draft.items.map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span aria-hidden="true">☐</span>
                  <span>{item.title}</span>
                  {item.priority > 1 && <span className="chip">P{item.priority}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={pending} onClick={apply}>
              {dict.confirmApply}
            </button>
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setDraft(null)}>
              {dict.rejectDraft}
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted" role="status" aria-live="polite">
        {status ?? ''}
      </p>
    </section>
  );
}

function parseItems(output: string): Item[] {
  try {
    const start = output.indexOf('[');
    const end = output.lastIndexOf(']');
    if (start === -1 || end === -1) return [];
    const parsed = JSON.parse(output.slice(start, end + 1)) as Array<Partial<Item>>;
    return parsed
      .filter((item) => typeof item.title === 'string' && item.title.trim().length > 0)
      .map((item) => ({
        title: String(item.title).slice(0, 300),
        priority: Math.min(3, Math.max(0, Number(item.priority ?? 1))),
        energy: (item.energy === 'deep' || item.energy === 'light' ? item.energy : 'admin') as Item['energy'],
      }));
  } catch {
    return [];
  }
}
