import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from '@/lib/nl-quickadd';

const NOW = new Date('2026-03-10T08:00:00.000Z'); // Tuesday

describe('natural-language quick add (Arabic + English)', () => {
  it('parses an Arabic due word and a bang priority', () => {
    const parsed = parseQuickAdd('اتصل بأحمد بكرة الساعة 10 !! #عمل', NOW);
    expect(parsed.priority).toBe(2);
    expect(parsed.tags).toContain('عمل');
    expect(parsed.dueAt).toBeTruthy();
    expect(new Date(parsed.dueAt!).getHours()).toBe(10);
    expect(parsed.title).toContain('اتصل بأحمد');
    expect(parsed.title).not.toContain('بكرة');
  });

  it('parses English tomorrow with an energy tag', () => {
    const parsed = parseQuickAdd('Write the launch post tomorrow deep work', NOW);
    expect(parsed.energy).toBe('deep');
    expect(parsed.dueAt).toBeTruthy();
    expect(parsed.title.toLowerCase()).toContain('write the launch post');
  });

  it('parses an explicit ISO date', () => {
    const parsed = parseQuickAdd('Ship v1 2026-04-01', NOW);
    expect(parsed.dueAt?.slice(0, 10)).toBe('2026-04-01');
  });

  it('resolves a relative weekday to the next occurrence', () => {
    const parsed = parseQuickAdd('Weekly review الجمعة', NOW);
    const due = new Date(parsed.dueAt!);
    expect(due.getDay()).toBe(5);
    expect(due.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('extracts a project hint', () => {
    const parsed = parseQuickAdd('Fix login bug @TaskNote', NOW);
    expect(parsed.project).toBe('TaskNote');
    expect(parsed.title).not.toContain('@TaskNote');
  });

  it('keeps plain titles intact when nothing matches', () => {
    const parsed = parseQuickAdd('Buy milk', NOW);
    expect(parsed.title).toBe('Buy milk');
    expect(parsed.dueAt).toBeNull();
    expect(parsed.priority).toBe(1);
  });

  it('marks urgent Arabic tasks as P0', () => {
    expect(parseQuickAdd('عاجل: تجديد الاشتراك', NOW).priority).toBe(3);
  });
});
