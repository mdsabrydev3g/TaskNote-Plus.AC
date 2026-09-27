import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { aiActionLogs, auditLogs } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const rows = await db()
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.workspaceId, session.workspaceId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(60);

  const aiRows = await db()
    .select()
    .from(aiActionLogs)
    .where(eq(aiActionLogs.workspaceId, session.workspaceId))
    .orderBy(desc(aiActionLogs.createdAt))
    .limit(25);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{dict.auditLog}</h1>
        <Link href="/app/settings" className="chip">
          {dict.settings}
        </Link>
      </header>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-semibold">{dict.auditLog}</h2>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">—</p>
        ) : (
          <table className="w-full min-w-[480px] text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 text-start">{dict.dueDate}</th>
                <th className="py-1 text-start">action</th>
                <th className="py-1 text-start">entity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-1.5 whitespace-nowrap">{formatDateTime(row.createdAt, locale)}</td>
                  <td className="py-1.5">{row.action}</td>
                  <td className="py-1.5 text-muted">
                    {row.entityType}
                    {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-semibold">{dict.aiDraft}</h2>
        {aiRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">—</p>
        ) : (
          <table className="w-full min-w-[480px] text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 text-start">{dict.dueDate}</th>
                <th className="py-1 text-start">action</th>
                <th className="py-1 text-start">provider</th>
                <th className="py-1 text-start">scope</th>
              </tr>
            </thead>
            <tbody>
              {aiRows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-1.5 whitespace-nowrap">{formatDateTime(row.createdAt, locale)}</td>
                  <td className="py-1.5">{row.action}</td>
                  <td className="py-1.5 text-muted">{row.provider}</td>
                  <td className="py-1.5 text-muted">{row.permissionScope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
