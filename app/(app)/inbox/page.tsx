import { desc, eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { inboxItems } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { CaptureForm } from '@/components/capture-form';
import {
  convertInboxToNoteAction,
  convertInboxToTaskAction,
  discardInboxAction,
} from '@/app/actions/capture';
import { parseQuickAdd } from '@/lib/nl-quickadd';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const items = await db()
    .select()
    .from(inboxItems)
    .where(and(eq(inboxItems.workspaceId, session.workspaceId), eq(inboxItems.status, 'new')))
    .orderBy(desc(inboxItems.createdAt));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold">{dict.inbox}</h1>
        <p className="text-xs text-muted">{dict.capture} → {dict.process}</p>
      </header>

      <CaptureForm dict={dict} />

      <section className="card">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{dict.inboxEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {items.map((item) => {
              const preview = parseQuickAdd(item.rawText, new Date());
              return (
                <li key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-sm">{item.rawText}</p>
                    {preview.dueAt && (
                      <p className="mt-1 text-[11px] text-muted">
                        {dict.dueDate}: {new Date(preview.dueAt).toISOString().slice(0, 16).replace('T', ' ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <form action={convertInboxToTaskAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
                        {dict.convertToTask}
                      </button>
                    </form>
                    <form action={convertInboxToNoteAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                        {dict.convertToNote}
                      </button>
                    </form>
                    <form action={discardInboxAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                        {dict.discard}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
