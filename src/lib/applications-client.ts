import type { ApplicationItem, ApplicationStatus } from './applications.ts';
import type { ApplicationInput, UpdateApplicationInput } from './schemas.ts';

export type ApiIssue = { path: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly issues: ApiIssue[];

  constructor(message: string, status: number, issues: ApiIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }
}

function parseIssues(body: unknown): ApiIssue[] {
  if (!body || typeof body !== 'object' || !('issues' in body) || !Array.isArray(body.issues)) return [];
  return body.issues.filter(
    (issue): issue is ApiIssue =>
      !!issue && typeof issue.path === 'string' && typeof issue.message === 'string',
  );
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, { cache: 'no-store', ...init });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('Network error. Check your connection and try again.', 0);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, parseIssues(body));
  }
  return body as T;
}

export async function listApplications(signal?: AbortSignal): Promise<ApplicationItem[]> {
  const data = await request<{ applications?: unknown }>('/api/applications', { signal });
  if (!Array.isArray(data.applications)) throw new ApiError('Unexpected server response', 500);
  return data.applications as ApplicationItem[];
}

export async function createApplication(input: ApplicationInput): Promise<ApplicationItem> {
  const data = await request<{ application?: ApplicationItem }>('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!data.application) throw new ApiError('Unexpected server response', 500);
  return data.application;
}

export async function updateApplication(
  id: string,
  patch: UpdateApplicationInput,
): Promise<ApplicationItem> {
  const data = await request<{ application?: ApplicationItem }>(
    `/api/applications/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  );
  if (!data.application) throw new ApiError('Unexpected server response', 500);
  return data.application;
}

export function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
): Promise<ApplicationItem> {
  return updateApplication(id, { status });
}

export async function deleteApplication(id: string): Promise<void> {
  await request<unknown>(`/api/applications/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
