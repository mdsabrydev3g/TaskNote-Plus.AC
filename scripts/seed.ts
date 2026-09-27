/**
 * Idempotent demo seed. Re-running it will not create duplicate accounts.
 * Usage: npm run db:seed
 *
 * SAFETY: the seed creates an account with a publicly known password, so it
 * refuses to run against a non-local database unless ALLOW_PROD_SEED=1.
 */
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  events,
  goals,
  inboxItems,
  notes,
  permissionGrants,
  projects,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from '../db/schema';
import { hashPassword } from '../lib/auth/password';
import { contentKey } from '../lib/hash';

const DEMO_EMAIL = 'demo@tasknote.local';
const DEMO_PASSWORD = 'TaskNote-Demo-2026';

loadEnvFiles();

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required. Add it to .env.local or export it.');
    process.exit(1);
  }

  const isLocal = /localhost|127\.0\.0\.1|::1/.test(url);
  if (!isLocal && process.env.ALLOW_PROD_SEED !== '1') {
    console.error(
      'Refusing to seed a non-local database: this creates a demo account with a known password.\n' +
        'If you really mean it, re-run with ALLOW_PROD_SEED=1.',
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);

  const existing = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (existing.length > 0) {
    console.log(`Seed skipped: ${DEMO_EMAIL} already exists.`);
    await pool.end();
    return;
  }

  const [user] = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      passwordHash: hashPassword(DEMO_PASSWORD),
      name: 'Demo User',
      locale: 'ar',
      aiEnabled: false,
    })
    .returning();

  const [workspace] = await db
    .insert(workspaces)
    .values({ ownerId: user.id, name: 'TaskNote Plus Demo' })
    .returning();

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: 'owner',
  });

  await db.insert(permissionGrants).values([
    { workspaceId: workspace.id, scope: 'read:notes', label: 'Read notes', granted: true },
    { workspaceId: workspace.id, scope: 'read:tasks', label: 'Read tasks', granted: true },
    { workspaceId: workspace.id, scope: 'read:calendar', label: 'Read calendar', granted: false },
    { workspaceId: workspace.id, scope: 'write:tasks', label: 'Draft tasks', granted: false },
    { workspaceId: workspace.id, scope: 'write:notes', label: 'Draft notes', granted: false },
    { workspaceId: workspace.id, scope: 'write:calendar', label: 'Propose calendar blocks', granted: false },
  ]);

  const [project] = await db
    .insert(projects)
    .values({
      workspaceId: workspace.id,
      name: 'إطلاق TaskNote Plus',
      description: 'إطلاق النسخة الأولى على الويب والموبايل.',
      color: '#3c60ee',
    })
    .returning();

  const [goal] = await db
    .insert(goals)
    .values({
      workspaceId: workspace.id,
      title: 'إطلاق المنتج في الربع الأول',
      description: 'الوصول إلى 100 مستخدم فعلي.',
    })
    .returning();

  await db.insert(tasks).values([
    {
      workspaceId: workspace.id,
      projectId: project.id,
      goalId: goal.id,
      title: 'ربط قاعدة بيانات Neon',
      status: 'doing',
      priority: 2,
      energy: 'deep',
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    {
      workspaceId: workspace.id,
      projectId: project.id,
      goalId: goal.id,
      title: 'نشر أول إصدار على Vercel',
      status: 'todo',
      priority: 3,
      energy: 'deep',
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      workspaceId: workspace.id,
      projectId: project.id,
      title: 'مراجعة النصوص العربية',
      status: 'done',
      priority: 1,
      energy: 'light',
      completedAt: new Date(),
    },
  ]);

  await db.insert(notes).values({
    workspaceId: workspace.id,
    projectId: project.id,
    title: 'ملاحظات الإطلاق',
    body: 'الهدف: مساحة عمل واحدة تجمع الملاحظات والمهام والمشاريع والأهداف والتقويم.',
    pinned: true,
    aiAccessible: true,
  });

  await db.insert(events).values({
    workspaceId: workspace.id,
    title: 'مراجعة أسبوعية',
    startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
    timezone: 'UTC',
  });

  const captures = ['اتصل بأحمد بكرة الساعة 10 !! #عمل', 'Idea: weekly review template'];
  await db
    .insert(inboxItems)
    .values(
      captures.map((text) => ({
        workspaceId: workspace.id,
        rawText: text,
        contentHash: contentKey(text),
      })),
    )
    .onConflictDoNothing();

  await pool.end();
  console.log(`Seed complete. Sign in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

function loadEnvFiles(): void {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Missing file is expected in CI and on Vercel.
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
