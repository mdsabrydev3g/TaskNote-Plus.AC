'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { notes, tasks } from '@/db/schema';
import { assertSameOrigin, requireSessionOrThrow } from '@/lib/auth/current';
import { runNoteAI } from '@/lib/ai/service';
import { getAIGateway } from '@/lib/ai/gateway';
import { getLocale } from '@/lib/i18n';
import { writeAudit } from '@/lib/db/scope';

export type DraftResult = {
  ok: boolean;
  allowed: boolean;
  provider: string;
  model: string;
  output: string;
  reason?: string;
  mode: 'cloud' | 'local';
};

/**
 * Read-only AI step. Produces a draft; it never writes to the user's data.
 */
export async function requestDraftAction(input: {
  noteId: string;
  task: 'summarize' | 'extract-actions';
}): Promise<DraftResult> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();
  const locale = await getLocale();
  const gateway = getAIGateway();

  const result = await runNoteAI({
    workspaceId: session.workspaceId,
    userId: session.userId,
    noteId: input.noteId,
    task: input.task,
    locale,
  });

  return {
    ok: result.ok,
    allowed: result.allowed,
    provider: result.provider,
    model: result.model,
    output: result.output,
    reason: result.reason,
    mode: gateway.mode,
  };
}

/**
 * Write step. Only reached after the user explicitly confirms a draft in the UI.
 */
export async function applyDraftAction(input: {
  noteId: string;
  kind: 'summary' | 'tasks';
  summary?: string;
  items?: Array<{ title: string; priority?: number; energy?: 'deep' | 'light' | 'admin' }>;
}): Promise<{ ok: boolean; created: number }> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const owned = await db()
    .select({ id: notes.id, body: notes.body })
    .from(notes)
    .where(and(eq(notes.workspaceId, session.workspaceId), eq(notes.id, input.noteId)))
    .limit(1);

  const note = owned[0];
  if (!note) return { ok: false, created: 0 };

  if (input.kind === 'summary' && input.summary) {
    const separator = note.body.trim().length > 0 ? '\n\n---\n' : '';
    await db()
      .update(notes)
      .set({ body: `${note.body}${separator}${input.summary}`.slice(0, 200000), updatedAt: new Date() })
      .where(and(eq(notes.workspaceId, session.workspaceId), eq(notes.id, input.noteId)));

    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'ai.apply.summary',
      entityType: 'note',
      entityId: input.noteId,
    });

    revalidatePath(`/app/notes/${input.noteId}`);
    return { ok: true, created: 0 };
  }

  const items = (input.items ?? []).slice(0, 20).filter((i) => i.title?.trim());
  if (items.length === 0) return { ok: false, created: 0 };

  await db().insert(tasks).values(
    items.map((item) => ({
      workspaceId: session.workspaceId,
      title: item.title.trim().slice(0, 500),
      description: '',
      priority: Math.min(3, Math.max(0, item.priority ?? 1)),
      energy: item.energy ?? 'admin',
      status: 'todo',
      aiAccessible: false,
    })),
  );

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'ai.apply.tasks',
    entityType: 'note',
    entityId: input.noteId,
    metadata: { count: items.length },
  });

  revalidatePath('/app/tasks');
  revalidatePath('/app/home');
  return { ok: true, created: items.length };
}
