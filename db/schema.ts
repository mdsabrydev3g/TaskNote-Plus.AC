import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * TaskNote Plus - canonical schema.
 *
 * Every content-bearing table carries `workspaceId`. All reads/writes must go
 * through lib/db/scope.ts so a tenant can never reach another tenant's rows.
 */

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull().default(''),
    locale: text('locale').notNull().default('ar'),
    theme: text('theme').notNull().default('system'),
    aiEnabled: boolean('ai_enabled').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email)],
);

export const workspaces = pgTable('workspaces', {
  id: id(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('My workspace'),
  region: text('region').notNull().default('default'),
  aiMode: text('ai_mode').notNull().default('off'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('owner'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('workspace_members_uq').on(t.workspaceId, t.userId)],
);

export const deviceRegistry = pgTable(
  'device_registry',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    name: text('name').notNull().default('Unknown device'),
    platform: text('platform').notNull().default('web'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('device_registry_uq').on(t.workspaceId, t.deviceId)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull().default('web'),
    ip: text('ip').notNull().default(''),
    userAgent: text('user_agent').notNull().default(''),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const projects = pgTable(
  'projects',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('active'),
    color: text('color').notNull().default('#3c60ee'),
    aiAccessible: boolean('ai_accessible').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('projects_ws_idx').on(t.workspaceId)],
);

export const milestones = pgTable(
  'milestones',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    done: boolean('done').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('milestones_project_idx').on(t.projectId)],
);

export const goals = pgTable(
  'goals',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('active'),
    targetAt: timestamp('target_at', { withTimezone: true }),
    aiAccessible: boolean('ai_accessible').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('goals_ws_idx').on(t.workspaceId)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('todo'),
    priority: smallint('priority').notNull().default(1),
    energy: text('energy').notNull().default('admin'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    deferAt: timestamp('defer_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    aiAccessible: boolean('ai_accessible').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('tasks_ws_idx').on(t.workspaceId),
    index('tasks_project_idx').on(t.projectId),
    index('tasks_goal_idx').on(t.goalId),
  ],
);

export const notes = pgTable(
  'notes',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    title: text('title').notNull().default(''),
    body: text('body').notNull().default(''),
    pinned: boolean('pinned').notNull().default(false),
    aiAccessible: boolean('ai_accessible').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('notes_ws_idx').on(t.workspaceId)],
);

export const events = pgTable(
  'events',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    timezone: text('timezone').notNull().default('UTC'),
    aiAccessible: boolean('ai_accessible').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('events_ws_idx').on(t.workspaceId)],
);

export const inboxItems = pgTable(
  'inbox_items',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    rawText: text('raw_text').notNull(),
    contentHash: text('content_hash').notNull(),
    source: text('source').notNull().default('text'),
    status: text('status').notNull().default('new'),
    processedEntityType: text('processed_entity_type'),
    processedEntityId: uuid('processed_entity_id'),
    aiAccessible: boolean('ai_accessible').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('inbox_ws_idx').on(t.workspaceId),
    uniqueIndex('inbox_idempotency_uq').on(t.workspaceId, t.contentHash),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6287fb'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('tags_ws_name_uq').on(t.workspaceId, t.name)],
);

export const entityTags = pgTable(
  'entity_tags',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.tagId, t.entityType, t.entityId] })],
);

export const links = pgTable(
  'links',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    fromType: text('from_type').notNull(),
    fromId: uuid('from_id').notNull(),
    toType: text('to_type').notNull(),
    toId: uuid('to_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('links_from_idx').on(t.workspaceId, t.fromType, t.fromId)],
);

export const goalLinks = pgTable(
  'goal_links',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('goal_links_uq').on(t.goalId, t.entityType, t.entityId)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull().default(''),
    entityId: text('entity_id').notNull().default(''),
    metadata: jsonb('metadata').notNull().default({}),
    ip: text('ip').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [index('audit_ws_idx').on(t.workspaceId, t.createdAt)],
);

export const aiActionLogs = pgTable(
  'ai_action_logs',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id'),
    action: text('action').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull().default(''),
    promptHash: text('prompt_hash').notNull().default(''),
    inputRefs: jsonb('input_refs').notNull().default([]),
    output: text('output').notNull().default(''),
    permissionScope: text('permission_scope').notNull().default(''),
    reversibleUntil: timestamp('reversible_until', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('ai_logs_ws_idx').on(t.workspaceId, t.createdAt)],
);

export const permissionGrants = pgTable(
  'permission_grants',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    label: text('label').notNull().default(''),
    granted: boolean('granted').notNull().default(false),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('permission_grants_uq').on(t.workspaceId, t.scope)],
);

export const notificationLogs = pgTable('notification_logs', {
  id: id(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id'),
  category: text('category').notNull().default('system'),
  channel: text('channel').notNull().default('in_app'),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  readAt: timestamp('read_at', { withTimezone: true }),
  actionTaken: boolean('action_taken').notNull().default(false),
  createdAt: createdAt(),
});

export const consentRecords = pgTable('consent_records', {
  id: id(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  version: text('version').notNull().default('1'),
  granted: boolean('granted').notNull().default(false),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type CalendarEvent = typeof events.$inferSelect;
export type InboxItem = typeof inboxItems.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
