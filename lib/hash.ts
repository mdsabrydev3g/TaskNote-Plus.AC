import { createHash } from 'node:crypto';

/** Stable content hash used for capture idempotency and prompt auditing. */
export function contentHash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Normalizes captured text before hashing so trivial whitespace never duplicates. */
export function normalizeForHash(input: string): string {
  return input.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function contentKey(input: string): string {
  return contentHash(normalizeForHash(input));
}
