import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const signUpSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: z.string().min(10).max(200),
  workspaceName: z.string().trim().max(120).optional(),
  locale: z.enum(['ar', 'en']).default('ar'),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

/**
 * Structural validation only. Business rules (matching, policy, reuse) live in
 * checkPasswordChange so they stay a single, unit-testable source of truth.
 */
export const changePasswordSchema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(1).max(200),
  confirm: z.string().min(1).max(200),
});

export const changeEmailSchema = z.object({
  email: emailSchema,
  currentPassword: z.string().min(1).max(200),
});

export const captureSchema = z.object({
  rawText: z.string().trim().min(1).max(20000),
  source: z.enum(['text', 'voice', 'image', 'email', 'web', 'file']).default('text'),
});

export const taskStatusSchema = z.enum(['todo', 'doing', 'done']);
export const energySchema = z.enum(['deep', 'light', 'admin']);

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(20000).default(''),
  projectId: z.string().uuid().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  status: taskStatusSchema.default('todo'),
  priority: z.coerce.number().int().min(0).max(3).default(1),
  energy: energySchema.default('admin'),
  dueAt: z.string().datetime().nullable().optional(),
  deferAt: z.string().datetime().nullable().optional(),
  aiAccessible: z.boolean().default(false),
});

export const taskUpdateSchema = taskCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export const noteSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().max(300).default(''),
  body: z.string().max(200000).default(''),
  projectId: z.string().uuid().nullable().optional(),
  pinned: z.boolean().default(false),
  aiAccessible: z.boolean().default(false),
});

export const projectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(20000).default(''),
  status: z.enum(['active', 'paused', 'done', 'archived']).default('active'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#3c60ee'),
});

export const goalSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20000).default(''),
  status: z.enum(['active', 'achieved', 'dropped']).default('active'),
  targetAt: z.string().datetime().nullable().optional(),
});

export const eventSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20000).default(''),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  allDay: z.boolean().default(false),
  timezone: z.string().max(64).default('UTC'),
});

export const searchSchema = z.object({
  q: z.string().trim().min(1).max(200),
  types: z.array(z.enum(['note', 'task', 'project', 'goal'])).optional(),
});

export const permissionScopeSchema = z.enum([
  'read:notes',
  'read:tasks',
  'read:calendar',
  'write:tasks',
  'write:notes',
  'write:calendar',
]);

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type NoteInput = z.infer<typeof noteSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
