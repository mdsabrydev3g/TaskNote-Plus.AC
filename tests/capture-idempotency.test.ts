import { describe, expect, it } from 'vitest';
import { contentKey } from '@/lib/hash';

describe('capture idempotency key', () => {
  it('is stable for identical content', () => {
    expect(contentKey('Call Ahmed tomorrow')).toBe(contentKey('Call Ahmed tomorrow'));
  });

  it('ignores casing and whitespace differences', () => {
    expect(contentKey('  Call   Ahmed\nTomorrow ')).toBe(contentKey('call ahmed tomorrow'));
  });

  it('differs for genuinely different content', () => {
    expect(contentKey('Call Ahmed')).not.toBe(contentKey('Call Sara'));
  });
});
