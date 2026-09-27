/**
 * Typed client for the TaskNote Plus mobile API (v1).
 * The DTOs mirror lib/api/dto.ts on the server so a contract drift shows up
 * as a type error here rather than as a runtime surprise.
 */

export type TaskStatus = 'todo' | 'doing' | 'done';
export type Energy = 'deep' | 'light' | 'admin';

export type UserDto = {
  id: string;
  username: string | null;
  email: string | null;
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

export type TaskDto = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  energy: Energy;
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

export type InboxItemDto = {
  id: string;
  rawText: string;
  source: string;
  status: string;
  createdAt: string;
};

export type PermissionDto = { scope: string; label: string; granted: boolean };

export type AuthSession = {
  token: string;
  deviceId: string;
  user: UserDto;
  workspace: WorkspaceDto;
};

export type MeResponse = {
  user: UserDto;
  workspace: WorkspaceDto;
  deviceId: string;
  permissions: PermissionDto[];
};

export type CaptureResult = {
  status: 'created' | 'duplicate';
  item: InboxItemDto | null;
};

export type QuickAddResult = { task: TaskDto; parsed: unknown };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown };

type Envelope = {
  data?: unknown;
  error?: { code?: string; message?: string };
};

export class TaskNoteApi {
  private readonly baseUrl: string;
  private readonly token: string | null;

  constructor(baseUrl: string, token: string | null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (options.body !== undefined) headers['content-type'] = 'application/json';

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new ApiError(0, 'network_error', 'no connectivity');
    }

    const text = await response.text();
    let payload: Envelope | null = null;
    try {
      payload = text.length > 0 ? (JSON.parse(text) as Envelope) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new ApiError(
        response.status,
        payload?.error?.code ?? 'http_error',
        payload?.error?.message ?? `HTTP ${response.status}`,
      );
    }

    return (payload?.data ?? null) as T;
  }

  login(identifier: string, password: string): Promise<AuthSession> {
    return this.request<AuthSession>('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
  }

  signup(input: {
    name: string;
    username: string;
    password: string;
    workspaceName?: string;
  }): Promise<AuthSession> {
    return this.request<AuthSession>('/api/v1/auth/signup', { method: 'POST', body: input });
  }

  me(): Promise<MeResponse> {
    return this.request<MeResponse>('/api/v1/me');
  }

  async listTasks(filter: 'open' | 'today' | 'done' | 'all' = 'open'): Promise<TaskDto[]> {
    const page = await this.request<{ items: TaskDto[] }>(`/api/v1/tasks?filter=${filter}`);
    return page.items;
  }

  createTask(input: {
    title: string;
    energy?: Energy;
    priority?: number;
    dueAt?: string | null;
  }): Promise<{ task: TaskDto }> {
    return this.request<{ task: TaskDto }>('/api/v1/tasks', { method: 'POST', body: input });
  }

  quickAdd(text: string): Promise<QuickAddResult> {
    return this.request<QuickAddResult>('/api/v1/tasks', { method: 'POST', body: { quick: text } });
  }

  updateTask(id: string, patch: Partial<Pick<TaskDto, 'status' | 'title' | 'energy' | 'priority'>>): Promise<{ task: TaskDto }> {
    return this.request<{ task: TaskDto }>(`/api/v1/tasks/${id}`, { method: 'PATCH', body: patch });
  }

  deleteTask(id: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/api/v1/tasks/${id}`, { method: 'DELETE' });
  }

  async listNotes(): Promise<NoteDto[]> {
    const page = await this.request<{ items: NoteDto[] }>('/api/v1/notes');
    return page.items;
  }

  createNote(input: { title: string; body: string }): Promise<{ note: NoteDto }> {
    return this.request<{ note: NoteDto }>('/api/v1/notes', { method: 'POST', body: input });
  }

  async listInbox(): Promise<InboxItemDto[]> {
    const page = await this.request<{ items: InboxItemDto[] }>('/api/v1/capture?status=new');
    return page.items;
  }

  capture(rawText: string): Promise<CaptureResult> {
    return this.request<CaptureResult>('/api/v1/capture', {
      method: 'POST',
      body: { rawText, source: 'text' },
    });
  }

  convertInbox(id: string, action: 'convert-to-task' | 'convert-to-note' | 'discard'): Promise<unknown> {
    return this.request<unknown>(`/api/v1/capture/${id}`, { method: 'POST', body: { action } });
  }
}
