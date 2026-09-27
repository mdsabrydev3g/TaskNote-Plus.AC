import type {
  CalendarEvent,
  Goal,
  InboxItem,
  Milestone,
  Note,
  Project,
  Task,
  User,
  Workspace,
} from '@/db/schema';

/**
 * Explicit wire contracts. Keeping the API shape separate from the table shape
 * means a schema change cannot silently alter the mobile contract.
 */

export type TaskDto = {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'doing' | 'done';
  priority: number;
  energy: 'deep' | 'light' | 'admin';
  dueAt: string | null;
  deferAt: string | null;
  completedAt: string | null;
  projectId: string | null;
  goalId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NoteDto = {
  id: string;
  title: string;
  body: string;
  projectId: string | null;
  pinned: boolean;
  aiAccessible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDto = {
  id: string;
  name: string;
  description: string;
  status: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};

export type GoalDto = {
  id: string;
  title: string;
  description: string;
  status: string;
  targetAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InboxItemDto = {
  id: string;
  rawText: string;
  source: string;
  status: string;
  createdAt: string;
};

export type EventDto = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;
};

const iso = (value: Date | string | null): string | null => {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const toTaskDto = (row: Task): TaskDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status as TaskDto['status'],
  priority: row.priority,
  energy: row.energy as TaskDto['energy'],
  dueAt: iso(row.dueAt),
  deferAt: iso(row.deferAt),
  completedAt: iso(row.completedAt),
  projectId: row.projectId,
  goalId: row.goalId,
  createdAt: iso(row.createdAt) as string,
  updatedAt: iso(row.updatedAt) as string,
});

export const toNoteDto = (row: Note): NoteDto => ({
  id: row.id,
  title: row.title,
  body: row.body,
  projectId: row.projectId,
  pinned: row.pinned,
  aiAccessible: row.aiAccessible,
  createdAt: iso(row.createdAt) as string,
  updatedAt: iso(row.updatedAt) as string,
});

export const toProjectDto = (row: Project): ProjectDto => ({
  id: row.id,
  name: row.name,
  description: row.description,
  status: row.status,
  color: row.color,
  createdAt: iso(row.createdAt) as string,
  updatedAt: iso(row.updatedAt) as string,
});

export const toGoalDto = (row: Goal): GoalDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  targetAt: iso(row.targetAt),
  createdAt: iso(row.createdAt) as string,
  updatedAt: iso(row.updatedAt) as string,
});

export const toInboxDto = (row: InboxItem): InboxItemDto => ({
  id: row.id,
  rawText: row.rawText,
  source: row.source,
  status: row.status,
  createdAt: iso(row.createdAt) as string,
});

export const toEventDto = (row: CalendarEvent): EventDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  startsAt: iso(row.startsAt) as string,
  endsAt: iso(row.endsAt) as string,
  allDay: row.allDay,
  timezone: row.timezone,
});

export const toMilestoneDto = (row: Milestone) => ({
  id: row.id,
  projectId: row.projectId,
  title: row.title,
  dueAt: iso(row.dueAt),
  done: row.done,
});

export type UserDto = {
  id: string;
  email: string;
  name: string;
  locale: string;
  aiEnabled: boolean;
};

export type WorkspaceDto = {
  id: string;
  name: string;
  region: string;
  aiMode: string;
};

export const toUserDto = (row: User): UserDto => ({
  id: row.id,
  email: row.email,
  name: row.name,
  locale: row.locale,
  aiEnabled: row.aiEnabled,
});

export const toWorkspaceDto = (row: Workspace): WorkspaceDto => ({
  id: row.id,
  name: row.name,
  region: row.region,
  aiMode: row.aiMode,
});
