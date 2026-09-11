/** OneJarc frontend snapshot from company-tool-hub/lib/workspace-services.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** Shared workflow boundary. Local receipts explicitly distinguish device saves
 * from preview-only incidents. API receipts are accepted only after server success. */
import { ApiError, newRequestKey, type ApiClient } from './api-client';
import { pathId } from './catalog-api-service';
import { saveSuggestion, scopedHubStorage } from './hub-storage';
import type { AuthUser } from './auth-service';
import { requirePermission } from './permissions';

export type AccessRequestInput = {
  toolId: string;
  reason: string;
  urgency: 'standard' | 'urgent';
};
export type IncidentInput = {
  toolId: string;
  summary: string;
  details: string;
};
export type SubmissionReceipt = {
  delivery: 'api' | 'local' | 'preview';
  reference?: string;
};
export type NotificationRecord = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  toolId?: string;
};
export type SystemStatus = {
  state: 'operational' | 'degraded' | 'unavailable';
  updatedAt: string;
};
export type AccessRules = {
  toolId: string;
  canLaunch: boolean;
  canRequest: boolean;
};
export type AuditRecord = {
  id: string;
  action: string;
  actorId: string;
  toolId?: string;
  occurredAt: string;
};
export interface WorkspaceServices {
  submitAccessRequest(input: AccessRequestInput): Promise<SubmissionReceipt>;
  submitIncident(input: IncidentInput): Promise<SubmissionReceipt>;
  submitSuggestion(text: string): Promise<SubmissionReceipt>;
}

/** Reusable request validation with explicit allowlists; actor/role is never input. */
function required(value: string, field: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new ApiError('VALIDATION_ERROR', 400, undefined, {
      [field]: `Enter between 1 and ${max} characters.`,
    });
  return value.trim();
}
export function validateAccessRequest(
  input: AccessRequestInput,
): AccessRequestInput {
  pathId(input.toolId);
  if (!['standard', 'urgent'].includes(input.urgency))
    throw new ApiError('VALIDATION_ERROR', 400);
  return {
    toolId: input.toolId,
    reason: required(input.reason, 'reason', 2000),
    urgency: input.urgency,
  };
}
export function validateIncident(input: IncidentInput): IncidentInput {
  pathId(input.toolId);
  return {
    toolId: input.toolId,
    summary: required(input.summary, 'summary', 160),
    details: required(input.details, 'details', 5000),
  };
}
function receipt(value: unknown): SubmissionReceipt {
  const result = value as { reference?: unknown };
  if (
    !result ||
    typeof result.reference !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(result.reference)
  )
    throw new Error('Invalid receipt');
  return { delivery: 'api', reference: result.reference };
}
/** One key survives an ambiguous failure of an identical submission. It is not
 * an automatic retry: server-side deduplication is still mandatory. */
export function createIdempotentSubmit<T, R>(
  send: (input: T, key: string) => Promise<R>,
) {
  let fingerprint = '',
    key = '';
  let pending: Promise<R> | null = null;
  return (input: T): Promise<R> => {
    const next = JSON.stringify(input);
    if (pending)
      return next === fingerprint
        ? pending
        : Promise.reject(new ApiError('CONFLICT', 409));
    if (next !== fingerprint || !key) {
      fingerprint = next;
      key = newRequestKey();
    }
    pending = Promise.resolve()
      .then(() => send(input, key))
      .then((result) => {
        key = '';
        return result;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}
export function createApiWorkspaceServices(
  client: ApiClient,
  actor: AuthUser,
): WorkspaceServices {
  const access = createIdempotentSubmit((input: AccessRequestInput, key) =>
    client.post('/access-requests', input, { idempotencyKey: key }, receipt),
  );
  const incident = createIdempotentSubmit((input: IncidentInput, key) =>
    client.post('/incidents', input, { idempotencyKey: key }, receipt),
  );
  const suggestion = createIdempotentSubmit((text: string, key) =>
    client.post('/suggestions', { text }, { idempotencyKey: key }, receipt),
  );
  return {
    submitAccessRequest(input) {
      requirePermission(actor, 'canRequestAccess');
      return access(validateAccessRequest(input));
    },
    submitIncident(input) {
      return incident(validateIncident(input));
    },
    submitSuggestion(text) {
      return suggestion(required(text, 'text', 2000));
    },
  };
}
export function createLocalWorkspaceServices(
  storage: () => Storage,
  actor: AuthUser,
): WorkspaceServices {
  return {
    async submitAccessRequest(input) {
      requirePermission(actor, 'canRequestAccess');
      const value = validateAccessRequest(input);
      try {
        const local = scopedHubStorage(storage(), actor.id);
        const saved: unknown = JSON.parse(
          local.getItem('northstar-access-requests') ?? '[]',
        );
        if (!Array.isArray(saved) || saved.some((id) => typeof id !== 'string'))
          throw new Error();
        local.setItem(
          'northstar-access-requests',
          JSON.stringify([...new Set([value.toolId, ...saved])]),
        );
      } catch {
        throw new Error(
          'Could not save this demo request. Your form is still here; allow browser storage and retry.',
        );
      }
      // Preserve legacy ID-only storage: no business reason or credential is persisted.
      return { delivery: 'local' };
    },
    async submitIncident(input) {
      validateIncident(input);
      return { delivery: 'preview' };
    },
    async submitSuggestion(text) {
      const value = required(text, 'text', 2000);
      try {
        if (saveSuggestion(storage(), value)) return { delivery: 'local' };
      } catch {
        /* Keep form text for retry. */
      }
      throw new Error(
        'Could not save this demo suggestion. Your text is still here; allow browser storage and retry.',
      );
    },
  };
}

// Read-only expansion points. These methods are prepared but not automatically
// polled: wire each screen deliberately when its backend contract is available.
function list<T>(value: unknown, check: (item: T) => boolean): T[] {
  if (
    !Array.isArray(value) ||
    value.length > 1000 ||
    !value.every((item) => item && check(item))
  )
    throw new Error('Invalid list');
  return value;
}
const text = (value: unknown) =>
  typeof value === 'string' && value.length <= 5000;
export function createSharedDataApiService(client: ApiClient) {
  return {
    getNotifications: () =>
      client.get('/notifications', undefined, (v) =>
        list<NotificationRecord>(
          v,
          (n) =>
            text(n.id) && text(n.title) && text(n.message) && text(n.createdAt),
        ),
      ),
    getSystemStatus: () =>
      client.get('/system-status', undefined, (v) => {
        const s = v as SystemStatus;
        if (
          !s ||
          !['operational', 'degraded', 'unavailable'].includes(s.state) ||
          !text(s.updatedAt)
        )
          throw new Error('Invalid status');
        return s;
      }),
    getMe: () =>
      client.get('/me', undefined, (v) => {
        const u = v as AuthUser;
        if (
          !u ||
          !text(u.id) ||
          !text(u.username) ||
          !text(u.displayName) ||
          !['user', 'admin'].includes(u.role)
        )
          throw new Error('Invalid profile');
        return {
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          role: u.role,
        };
      }),
    getAccessRules: () =>
      client.get('/access-rules', undefined, (v) =>
        list<AccessRules>(
          v,
          (r) =>
            text(r.toolId) &&
            typeof r.canLaunch === 'boolean' &&
            typeof r.canRequest === 'boolean',
        ),
      ),
    getAuditHistory: () =>
      client.get('/audit-history', undefined, (v) =>
        list<AuditRecord>(
          v,
          (r) =>
            text(r.id) &&
            text(r.action) &&
            text(r.actorId) &&
            text(r.occurredAt),
        ),
      ),
    getHealth: () =>
      client.get('/health', undefined, (v) => {
        if (
          !v ||
          typeof v !== 'object' ||
          !('status' in v) ||
          v.status !== 'ok'
        )
          throw new Error('Invalid health');
        return { status: 'ok' as const };
      }),
  };
}
