import type { Energy, ParsedQuickAdd } from './nl-types';

export type { Energy, ParsedQuickAdd };

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  الأحد: 0,
  الاثنين: 1,
  الإثنين: 1,
  الثلاثاء: 2,
  الأربعاء: 3,
  الخميس: 4,
  الجمعة: 5,
  السبت: 6,
};

const ENERGY_WORDS: Array<[RegExp, Energy]> = [
  [/\b(deep|focus|deepwork)\b/i, 'deep'],
  [/(تركيز|عميق|ديب)/, 'deep'],
  [/\b(light|quick|easy)\b/i, 'light'],
  [/(خفيف|سريع|بسيط)/, 'light'],
  [/\b(admin|boring|errand)\b/i, 'admin'],
  [/(إداري|اداري|روتين)/, 'admin'],
];

const PRIORITY_WORDS: Array<[RegExp, number]> = [
  [/\b(p0|critical|urgent)\b/i, 3],
  [/(عاجل|حرج|طارئ)/, 3],
  [/\b(p1|high)\b/i, 2],
  [/(مهم|عالي)/, 2],
  [/\b(p2|normal)\b/i, 1],
  [/\b(p3|low)\b/i, 0],
  [/(منخفض)/, 0],
];

const LOWERCASE_DAY = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Unicode-aware whole-word matcher. `\b` is ASCII-only, so it silently fails
 * for Arabic words; lookarounds against letter/number classes work for both.
 */
function wordRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu');
}

function nextWeekday(now: Date, weekday: number): Date {
  const base = LOWERCASE_DAY(now);
  const delta = (weekday - base.getDay() + 7) % 7 || 7;
  base.setDate(base.getDate() + delta);
  return base;
}

function atHour(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Deterministic Arabic + English natural-language quick-add.
 * Runs entirely locally: the AI provider is never required for parsing.
 */
export function parseQuickAdd(input: string, now: Date = new Date()): ParsedQuickAdd {
  let rest = ` ${input} `;
  let dueAt: string | null = null;
  let priority = 1;
  let energy: Energy = 'admin';
  const tags: string[] = [];

  const consume = (match: string) => {
    rest = rest.replace(match, ' ');
  };

  // Explicit ISO date: 2026-03-05
  const iso = rest.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0);
    if (!Number.isNaN(d.getTime())) {
      dueAt = d.toISOString();
      consume(iso[0]);
    }
  }

  // Relative Arabic + English day words
  if (!dueAt) {
    const table: Array<[RegExp, number]> = [
      [/(بعد بكرة|after tomorrow|day after tomorrow)/i, 2],
      [/(غدا|غداً|بكرة|بكره|tomorrow)/i, 1],
      [/(اليوم|today)/i, 0],
    ];
    for (const [re, offset] of table) {
      const m = rest.match(re);
      if (m) {
        const d = LOWERCASE_DAY(now);
        d.setDate(d.getDate() + offset);
        dueAt = atHour(d, 9).toISOString();
        consume(m[0]);
        break;
      }
    }
  }

  if (!dueAt) {
    const week = rest.match(/(next week|الأسبوع الجاي|الأسبوع القادم|الاسبوع الجاي)/i);
    if (week) {
      const d = LOWERCASE_DAY(now);
      d.setDate(d.getDate() + 7);
      dueAt = atHour(d, 9).toISOString();
      consume(week[0]);
    }
  }

  if (!dueAt) {
    for (const [name, weekday] of Object.entries(WEEKDAYS)) {
      const re = wordRegex(name);
      const m = rest.match(re);
      if (m) {
        dueAt = atHour(nextWeekday(now, weekday), 9).toISOString();
        consume(m[0]);
        break;
      }
    }
  }

  // Time of day: "10:30", "5pm", or a worded hour like "الساعة 10" / "at 7".
  if (dueAt) {
    const hhmm = rest.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?![0-9])/);
    const ampm = rest.match(/\b(?:at\s*)?(\d{1,2})\s*(am|pm)(?![a-z])/i);
    const worded = rest.match(/(?:الساعة|الساعه|عند|at)\s*([01]?\d|2[0-3])(?::([0-5]\d))?(?![0-9])/i);
    const base = new Date(dueAt);
    if (hhmm) {
      base.setHours(Number(hhmm[1]), Number(hhmm[2]), 0, 0);
      dueAt = base.toISOString();
      consume(hhmm[0]);
    } else if (ampm) {
      let hour = Number(ampm[1]) % 12;
      if (ampm[2].toLowerCase() === 'pm') hour += 12;
      base.setHours(hour, 0, 0, 0);
      dueAt = base.toISOString();
      consume(ampm[0]);
    } else if (worded) {
      base.setHours(Number(worded[1]), Number(worded[2] ?? 0), 0, 0);
      dueAt = base.toISOString();
      consume(worded[0]);
    }
  }

  // Bang priorities: !!! > !! > !
  const bangs = rest.match(/(!{1,3})/);
  if (bangs) {
    priority = Math.min(3, bangs[1].length);
    consume(bangs[0]);
  }

  for (const [re, level] of PRIORITY_WORDS) {
    const m = rest.match(re);
    if (m) {
      priority = level;
      consume(m[0]);
      break;
    }
  }

  for (const [re, level] of ENERGY_WORDS) {
    const m = rest.match(re);
    if (m) {
      energy = level;
      consume(m[0]);
      break;
    }
  }

  let project: string | null = null;
  const projectMatch = rest.match(/(?:@|لمشروع\s+|project:)\s*([\p{L}\p{N}_-]{2,40})/u);
  if (projectMatch) {
    project = projectMatch[1];
    consume(projectMatch[0]);
  } else {
    const arProject = rest.match(/(?:في|ضمن)\s+مشروع\s+([\p{L}\p{N}_-]{2,40})/u);
    if (arProject) {
      project = arProject[1];
      consume(arProject[0]);
    }
  }

  const tagRe = /#([\p{L}\p{N}_-]{1,30})/gu;
  for (const m of rest.matchAll(tagRe)) {
    tags.push(m[1]);
    consume(m[0]);
  }

  const title = rest.replace(/\s+/g, ' ').trim();

  return { title, dueAt, priority, energy, tags, project };
}
