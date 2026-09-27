import Link from 'next/link';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { events, tasks } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { createEventAction, deleteEventAction } from '@/app/actions/events';
import { formatHijri, monthLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

const WEEKDAY_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; hijri?: string }>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const now = new Date();
  const [yearRaw, monthRaw] = (params.month ?? '').split('-').map(Number);
  const year = Number.isFinite(yearRaw) && yearRaw > 1970 ? yearRaw : now.getFullYear();
  const monthIndex = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw - 1 : now.getMonth();

  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const showHijri = params.hijri === '1';

  const monthEvents = await db()
    .select()
    .from(events)
    .where(
      and(
        eq(events.workspaceId, session.workspaceId),
        gte(events.startsAt, monthStart),
        lte(events.startsAt, monthEnd),
      ),
    )
    .orderBy(asc(events.startsAt));

  const monthTasks = await db()
    .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, status: tasks.status })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, session.workspaceId),
        gte(tasks.dueAt, monthStart),
        lte(tasks.dueAt, monthEnd),
      ),
    );

  const daysInMonth = monthEnd.getDate();
  const leading = monthStart.getDay();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, monthIndex, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weekdays = locale === 'ar' ? WEEKDAY_AR : WEEKDAY_EN;
  const prev = new Date(year, monthIndex - 1, 1);
  const next = new Date(year, monthIndex + 1, 1);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{monthLabel(monthStart, locale)}</h1>
        <div className="flex gap-2">
          <Link href={`/app/calendar?month=${key(prev)}`} className="chip">
            ‹
          </Link>
          <Link href={`/app/calendar?month=${key(monthStart)}&hijri=${showHijri ? '0' : '1'}`} className="chip">
            {showHijri ? dict.gregorian : dict.hijri}
          </Link>
          <Link href={`/app/calendar?month=${key(next)}`} className="chip">
            ›
          </Link>
        </div>
      </header>

      <section className="card overflow-x-auto">
        <div className="grid min-w-[560px] grid-cols-7 gap-1">
          {weekdays.map((day) => (
            <div key={day} className="pb-2 text-center text-[11px] font-medium text-muted">
              {day}
            </div>
          ))}
          {cells.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="h-24 rounded-xl bg-surface/40" />;
            const dayEvents = monthEvents.filter((event) => sameDay(new Date(event.startsAt), day));
            const dayTasks = monthTasks.filter((task) => task.dueAt && sameDay(new Date(task.dueAt), day));
            const isToday = sameDay(day, now);
            return (
              <div
                key={day.toISOString()}
                className={`h-24 overflow-hidden rounded-xl border p-1.5 text-[11px] ${
                  isToday ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20' : 'border-line bg-surface'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{day.getDate()}</span>
                  {showHijri && <span className="text-[9px] text-muted">{formatHijri(day, locale).split(' ')[0]}</span>}
                </div>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {dayEvents.slice(0, 2).map((event) => (
                    <li key={event.id} className="truncate rounded bg-brand-600/10 px-1 text-brand-700 dark:text-brand-200">
                      {event.title}
                    </li>
                  ))}
                  {dayTasks.slice(0, 2).map((task) => (
                    <li key={task.id} className={`truncate px-1 ${task.status === 'done' ? 'text-muted line-through' : ''}`}>
                      ☑ {task.title}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {monthEvents.length === 0 && <p className="mt-4 text-center text-xs text-muted">{dict.noEvents}</p>}
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">{dict.newEvent}</h2>
        <form action={createEventAction} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">
              {dict.title}
            </label>
            <input id="title" name="title" className="input" required maxLength={300} />
          </div>
          <div>
            <label className="label" htmlFor="startsAt">
              {dict.dueDate}
            </label>
            <input id="startsAt" name="startsAt" type="datetime-local" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="endsAt">
              {dict.deferDate}
            </label>
            <input id="endsAt" name="endsAt" type="datetime-local" className="input" required />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">
              {dict.create}
            </button>
          </div>
        </form>
      </section>

      {monthEvents.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold">{dict.calendar}</h2>
          <ul className="flex flex-col divide-y divide-line">
            {monthEvents.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate">{event.title}</span>
                <span className="flex items-center gap-2 text-[11px] text-muted">
                  {new Date(event.startsAt).toISOString().slice(0, 16).replace('T', ' ')}
                  <form action={deleteEventAction}>
                    <input type="hidden" name="id" value={event.id} />
                    <button type="submit" className="hover:text-red-600" aria-label={dict.delete}>
                      ✕
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}
