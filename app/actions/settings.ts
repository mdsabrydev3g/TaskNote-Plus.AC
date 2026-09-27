'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { permissionGrants, users, workspaces } from '@/db/schema';
import { assertSameOrigin, requireSessionOrThrow } from '@/lib/auth/current';
import { writeAudit } from '@/lib/db/scope';
import { permissionScopeSchema } from '@/lib/validation';

export async function setPermissionAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const scope = permissionScopeSchema.safeParse(String(formData.get('scope') ?? ''));
  const granted = String(formData.get('granted') ?? '') === 'true';
  if (!scope.success) return;

  await db()
    .update(permissionGrants)
    .set({ granted, revokedAt: granted ? null : new Date() })
    .where(
      and(
        eq(permissionGrants.workspaceId, session.workspaceId),
        eq(permissionGrants.scope, scope.data),
      ),
    );

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: granted ? 'permission.grant' : 'permission.revoke',
    entityType: 'permission',
    entityId: scope.data,
  });

  revalidatePath('/app/settings/permissions');
}

export async function updateProfileAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  const workspaceName = String(formData.get('workspaceName') ?? '').trim().slice(0, 120);
  const aiEnabled = formData.get('aiEnabled') === 'on';

  if (name) {
    await db()
      .update(users)
      .set({ name, aiEnabled, updatedAt: new Date() })
      .where(eq(users.id, session.userId));
  }
  if (workspaceName) {
    await db()
      .update(workspaces)
      .set({ name: workspaceName, updatedAt: new Date() })
      .where(eq(workspaces.id, session.workspaceId));
  }

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'profile.update',
    entityType: 'user',
    entityId: session.userId,
  });

  revalidatePath('/app/settings');
}
