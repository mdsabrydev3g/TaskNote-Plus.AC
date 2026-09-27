'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { events } from '@/db/schema';
import { assertSameOrigin, requireSessionOrThrow } from '@/lib/auth/current';
import { writeAudit } from '@/lib/db/scope';
import { eventSchema } from '@/lib/validation';

export async function createEventAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const parsed = eventSchema.safeParse({
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    startsAt: String(formData.get('startsAt') ?? ''),
    endsAt: String(formData.get('endsAt') ?? ''),
    allDay: formData.get('allDay') === 'on',
    timezone: String(formData.get('timezone') ?? 'UTC'),
  });
  if (!parsed.success) return;

  const [event] = await db()
    .insert(events)
    .values({
      workspaceId: session.workspaceId,
      title: parsed.data.title,
      description: parsed.data.description,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      allDay: parsed.data.allDay,
      timezone: parsed.data.timezone,
    })
    .returning();

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'event.create',
    entityType: 'event',
    entityId: event.id,
  });

  revalidatePath('/app/calendar');
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  await db()
    .delete(events)
    .where(and(eq(events.workspaceId, session.workspaceId), eq(events.id, id)));

  revalidatePath('/app/calendar');
}
