export type Energy = 'deep' | 'light' | 'admin';

export type ParsedQuickAdd = {
  title: string;
  dueAt: string | null;
  priority: number;
  energy: Energy;
  tags: string[];
  project: string | null;
};
