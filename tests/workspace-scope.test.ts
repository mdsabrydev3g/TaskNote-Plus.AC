import { describe, expect, it } from 'vitest';
import { assertWorkspaceId, scopedWhere } from '@/lib/db/scope';
import { tasks } from '@/db/schema';

describe('workspace scoping guard', () => {
  it('rejects a missing workspace id', () => {
    expect(() => assertWorkspaceId(undefined)).toThrow(/WORKSPACE_SCOPE_VIOLATION/);
  });

  it('rejects an empty or placeholder workspace id', () => {
    expect(() => assertWorkspaceId('')).toThrow(/WORKSPACE_SCOPE_VIOLATION/);
    expect(() => assertWorkspaceId('abc')).toThrow(/WORKSPACE_SCOPE_VIOLATION/);
    expect(() => assertWorkspaceId(123)).toThrow(/WORKSPACE_SCOPE_VIOLATION/);
  });

  it('accepts a realistic workspace id', () => {
    const id = '8f1c2f90-6c1a-4a55-9f0d-3b2f4c5d6e7a';
    expect(assertWorkspaceId(id)).toBe(id);
  });

  it('never builds an unscoped predicate', () => {
    const id = '8f1c2f90-6c1a-4f55-9f0d-3b2f4c5d6e7a';
    expect(() => scopedWhere(tasks, id)).not.toThrow();
    expect(() => scopedWhere(tasks, '')).toThrow(/WORKSPACE_SCOPE_VIOLATION/);
  });
});
