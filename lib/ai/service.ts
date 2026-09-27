import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { aiActionLogs, notes, permissionGrants, type Note } from '@/db/schema';
import { getAIGateway } from './gateway';
import type { AIResult } from './providers';

export type AIRunOutcome = AIResult & { allowed: boolean; permissionScope: string };

const TASK_SCOPE: Record<'summarize' | 'extract-actions', string> = {
  summarize: 'read:notes',
  'extract-actions': 'read:notes',
};

export async function isScopeGranted(workspaceId: string, scope: string): Promise<boolean> {
  const rows = await db()
    .select()
    .from(permissionGrants)
    .where(and(eq(permissionGrants.workspaceId, workspaceId), eq(permissionGrants.scope, scope)))
    .limit(1);
  const grant = rows[0];
  return Boolean(grant?.granted) && !grant?.revokedAt;
}

/**
 * Runs a note-bound AI task. The grant check happens before any content leaves
 * the process, and every call is written to AIActionLog.
 */
export async function runNoteAI(input: {
  workspaceId: string;
  userId: string;
  noteId: string;
  task: 'summarize' | 'extract-actions';
  locale: 'ar' | 'en';
}): Promise<AIRunOutcome> {
  const scope = TASK_SCOPE[input.task];
  const allowed = await isScopeGranted(input.workspaceId, scope);
  const gateway = getAIGateway();

  if (!allowed) {
    const denied: AIRunOutcome = {
      ok: false,
      allowed: false,
      provider: gateway.provider.kind,
      model: gateway.provider.model,
      output: '',
      promptHash: '',
      usedTokens: 0,
      reason: 'permission_denied',
      permissionScope: scope,
    };
    await logAIAction(input, denied);
    return denied;
  }

  const rows = await db()
    .select()
    .from(notes)
    .where(and(eq(notes.workspaceId, input.workspaceId), eq(notes.id, input.noteId)))
    .limit(1);
  const note: Note | undefined = rows[0];

  if (!note) {
    const missing: AIRunOutcome = {
      ok: false,
      allowed: true,
      provider: gateway.provider.kind,
      model: gateway.provider.model,
      output: '',
      promptHash: '',
      usedTokens: 0,
      reason: 'note_not_found',
      permissionScope: scope,
    };
    await logAIAction(input, missing);
    return missing;
  }

  const content = `${note.title}\n\n${note.body}`.trim();
  let result = await gateway.provider.run({ task: input.task, text: content, locale: input.locale });
  if (!result.ok && gateway.provider !== gateway.fallback) {
    result = await gateway.fallback.run({ task: input.task, text: content, locale: input.locale });
  }

  const outcome: AIRunOutcome = { ...result, allowed: true, permissionScope: scope };
  await logAIAction(input, outcome);
  return outcome;
}

async function logAIAction(
  input: { workspaceId: string; userId: string; noteId: string; task: string },
  outcome: AIRunOutcome,
): Promise<void> {
  try {
    await db()
      .insert(aiActionLogs)
      .values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        action: input.task,
        provider: outcome.provider,
        model: outcome.model,
        promptHash: outcome.promptHash,
        inputRefs: [{ type: 'note', id: input.noteId }],
        output: outcome.output.slice(0, 8000),
        permissionScope: outcome.permissionScope,
        reversibleUntil: new Date(Date.now() + 72 * 60 * 60 * 1000),
      });
  } catch {
    // Audit write failure must never break the user's request path.
  }
}
