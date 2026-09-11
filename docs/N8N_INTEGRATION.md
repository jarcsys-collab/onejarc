# OneJarc → n8n integration contract

Prepared 11 September 2026. This is a frontend handoff and proposed backend contract, not a deployed API or an authentication implementation. Local mode is still the default; all API base URLs are blank.

## 1. Architecture and trust boundaries

```text
Existing React screens
  ├─ AuthProvider → demo AuthService (LOCAL ONLY)
  │                or future company-approved SSO adapter (API ONLY)
  └─ BackendProvider
       ├─ CatalogDataSource → local catalog service + localStorage
       │                    or tool catalog API service
       └─ WorkspaceServices → local saves / incident preview
                             or access / incident / suggestion API service
                                  ↓
                           Central API client
                                  ↓ HTTPS + short-lived USER access token
                      Company API gateway / verified-auth API
                                  ↓ trusted internal request
                            n8n workflows
                                  ↓
                    Company datastore + business applications
```

The gateway is a recommended future component, not created in this task. It may map OneJarc routes to any approved workflow paths. Never point the browser at n8n's management API or give employees n8n administrative API keys. A tool's Connections tab remains metadata only and is NOT the global OneJarc API configuration or permission to call arbitrary URLs.

## 2. Research findings and applied decisions

- n8n Webhook nodes expose test and production URLs, accept multiple HTTP verbs, and offer Basic, Header, and JWT authentication. The production route requires a published workflow. OneJarc should use a stable, versioned API façade; a temporary editor test URL is not a deployable backend. A shared Basic/Header secret belongs between trusted servers, never in GitHub Pages JavaScript. [n8n Webhook documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- Use a controlled JSON response with an appropriate HTTP status. A workflow-started acknowledgement is not proof of a saved tool or created incident. Return success after a database commit or after durable acceptance with a real tracking reference. [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/)
- Cross-origin JSON requests with Authorization and custom headers require preflight handling. JavaScript cannot distinguish a blocked CORS response from some network failures. OneJarc therefore uses a friendly network error and redacted diagnostics, not an invented CORS fix in React. [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- Authentication establishes identity; authorization decides whether that identity can perform this action on this record. Every server endpoint must validate identity and independently enforce permissions. Frontend roles are only display controls. HTTPS, endpoint-level access controls, input validation and generic failures inform this contract. [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- Keep workflow credentials server-side, restrict workflow editor access and outbound network destinations, and run security reviews. n8n's own editor SSO does not automatically authenticate OneJarc employees to custom workflows. [n8n security overview](https://docs.n8n.io/deploy/host-n8n/configure-n8n/security)
- Execution logs can contain sensitive request data. Review retention and minimize payload logging. n8n's execution-data redaction is edition/version dependent and does not sanitize webhook responses or Code-node console output. Do not assume it replaces data minimization or database access controls. [Execution data redaction](https://docs.n8n.io/deploy/host-n8n/configure-n8n/security/redact-execution-data)
- For OneJarc, use a durable unique constraint and transactional idempotency ledger, not a browser flag, to arbitrate concurrent creates. PostgreSQL supports unique-conflict handling with INSERT ON CONFLICT. This is a design recommendation; no database was provisioned. [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)

## 3. Configuration and enabling API mode later

Readable configuration: `lib/backend-config.ts` in the main app; `src/models/backend-config.ts` in the standalone MVC export. These are PUBLIC settings compiled into the website, not secret environment variables.

Each development/staging/production profile contains:

```ts
{
  environment: 'staging',
  dataSource: 'local', // 'api' only AFTER the backend and company auth are ready
  apiBaseUrl: '',     // public HTTPS API façade, e.g. https://api.example.test/onejarc/v1
  timeoutMs: 12000,
}
```

1. Keep local mode for today's GitHub test. Demo credentials admin / 123 and medtek / 123 are intentionally public and prove no identity.
2. Backend team supplies a public staging API base URL, approved IdP configuration, permission policy, CORS origin list, and implemented contracts below.
3. Implement an approved company identity SDK adapter for `CompanyAuthService` in `lib/company-auth.ts`. Register it once with `registerCompanyAuthService(adapter)` before mounting AuthProvider. It must implement restore, signOut, beginSignIn and getAccessToken; its inherited username/password signIn method should reject use.
4. Use the provider's approved OIDC/OAuth authorization-code + PKCE flow. The adapter obtains a short-lived USER access token intended for the OneJarc API, not an ID token, n8n editor token, or service key. Review refresh/expiry/logout behavior and keep tokens in the SDK's reviewed memory/session design. This task implements no redirect, token minting, token refresh or token storage.
5. Set the selected staging profile to dataSource api with its public URL, and select it as backendConfig. Rebuild. Do not toggle data modes from a user-controlled settings field.
6. API mode refuses prototype authentication. Without a registered adapter, company sign-in is disabled; there is no local fallback. Without an access token, no HTTP request is sent.
7. After staging validation, select the production profile and rebuild with production's separate URL. HTTPS is required outside development; HTTP is only accepted for loopback development.
8. Switching back to local is an explicit build/configuration decision, never an automatic recovery from an API outage.

No secret .env.example is needed: this implementation uses one typed public config file and does not read frontend environment keys. Do not inject secrets through VITE_, NEXT_PUBLIC_, build variables, HTML, or script tags. All bundled configuration is visible.

## 4. HTTP and response conventions

Paths below are relative to apiBaseUrl. IDs use letters, digits, hyphen or underscore (1–128 characters). The client rejects host-changing URLs, traversal, query/fragment injection in paths, and redirects.

All listed API routes require an approved user access token, including the prepared health endpoint. OPTIONS is handled separately by the gateway without business execution. Authentication is NEVER the client-supplied user/role/name.

Request headers:

```http
Accept: application/json
Authorization: Bearer <short-lived-user-access-token>
X-Request-ID: <random-correlation-id>
Content-Type: application/json
Idempotency-Key: <stable-key-for-one-mutation>
If-Match: "7"
```

Content-Type is set only with a body; Idempotency-Key on mutations; If-Match on catalog/category mutations. No browser cookies are sent (`credentials: omit`). There are no automatic retries. The timeout includes token lookup and response parsing. JSON responses are validated; unexpectedly large/invalid responses are rejected.

Success envelope (data shape varies by endpoint):

```json
{"success":true,"data":{"reference":"IT-1042"},"requestId":"REQ-20260911-ABC123"}
```

Error envelope (safe server message, no stack traces):

```json
{"success":false,"error":{"code":"VALIDATION_ERROR","message":"Review your submission.","fields":{"name":"REQUIRED"}},"requestId":"REQ-20260911-ABC123"}
```

The frontend selects public error messages by HTTP status; raw server messages are never shown. Field error codes allowed: REQUIRED, INVALID, TOO_LONG, INVALID_URL, DUPLICATE. Unknown field codes are ignored. Correlation IDs must be safe 1–128 character identifiers. Do not encode sensitive information into them.

| Status | UI treatment / backend meaning |
| --- | --- |
| 200 / 201 | Validated success; use 201 for newly created resources. |
| 400 / 422 | Field/form feedback; retain unsaved inputs. |
| 401 | Expire the mounted session; require sign-in. No demo fallback. |
| 403 | Access denied; do not retry with a different role claim. |
| 404 | Record unavailable; avoid disclosing hidden resources. |
| 409 / 412 | Conflict or stale revision; explicit Reload before resubmitting edited intent. |
| 429 | Friendly wait message; honor returned Retry-After seconds/date. No retry loop. |
| 500 / 502 / 503 / 504 | Generic unavailable message; log only code/status/request ID. |
| Network / timeout | Retain form; a timeout may have committed server-side. Check result or retry with the same idempotency key. |

The generic client accepts empty 204 only without a data decoder. Current typed business endpoints require JSON data, not 204. Use explicit 200/201 envelopes for their responses.

## 5. Compatible catalog data model

Keep the established `ToolDefinition`, `CatalogEntry`, and `CatalogSnapshot` model. It is not a flattened incompatible replacement.

- Definition: slug, name, description, category, subtitle, iconKey, color, applicationUrl, openBehavior, documentationUrl, supportUrl, statusUrl, accessType, owner, team, supportContact, status, statusNote, lifecycle, keywords, aliases, tags, tasks, quickActions, featured, demoPreview.
- Entries: id, draft definition, published definition or null, enabled, archived, optional admin-only apiConnection metadata, createdAt/By, updatedAt/By, optional publishedAt/By and archivedAt/By.
- Snapshot: version 1, nonnegative revision, categories string array, entries.
- Publication is a separate immutable employee-visible version, not merely a boolean on the current draft. Draft editing must not alter the employee version. Visibility derives from publication, enabled/archived flags, lifecycle and backend access policy. There is no separate visibility field in this prototype.
- Ownership/team are descriptive. They do not grant permission. AccessType is UX metadata, not a real entitlement.
- API audit fields must come from verified identity and server time. Local demo audit fields remain clearly untrusted prototype data.
- Icon keys resolve to the bundled allowlist; no HTML/script/SVG source is accepted from a catalog record.
- URL navigation checks reject embedded credentials and unsafe schemes. Production navigation requires HTTPS. Backend must additionally enforce approved hosts and reject secret-bearing query parameters.
- Validation: name/slug and populated values are checked on drafts; publish also requires description, owner, category and application URL unless explicitly demoPreview. Existing length/enum/category/quick-action validators are reused. The server must repeat schema AND business-policy validation.

Payload aliases used below:

```text
Write = {definition: ToolDefinition, publish: boolean, apiConnection?: nonsecret setup}
AdminCatalog = {version:1, revision:number, categories:string[], entries:CatalogEntry[]}
Mutation = {catalog: AdminCatalog}
EmployeeCatalog = {revision:number, categories:string[],
                   tools:[{id:string, definition:ToolDefinition}]}
Receipt = {reference:string}
```

The employee endpoint must return only allowed published/enabled/non-archived tools, never drafts or API setup. The client defensively projects known fields but cannot make an overbroad server response private. Admin mutations return the committed authorized snapshot so the current UI can update consistently; requests never send a client-mutated snapshot. For very large catalogs, add pagination/versioned contracts deliberately; the initial client accepts up to 1,000 employee tools and a 2 MB JSON response.

## 6. Endpoint / workflow map

Every row below specifies purpose, method/path, request body, success data, errors, authentication/permission and frontend caller. **All success data is inside the standard envelope.** All API calls require the verified company session; user/admin here means backend-derived role, not submitted JSON. Every row also allows 429 and 500-class safe errors.

| Purpose → suggested n8n workflow | Method / path | Request body | Success | Additional errors | Backend role / permission | Frontend service caller |
| --- | --- | --- | --- | --- | --- | --- |
| Browse visible tools → List Employee Tools | GET /tools | None | 200 EmployeeCatalog | 401,403 | user/admin, canViewTools; filter per identity | getTools() → employee repository |
| Read visible tool → Read Employee Tool | GET /tools/:id | None | 200 EmployeeCatalog with exactly one matching tool | 401,403,404 | user/admin, canViewTools + object policy | getTool(id), prepared detail read |
| Admin draft/published list → Read Admin Catalog | GET /admin/catalog | None | 200 AdminCatalog | 401,403 | admin, canManageToolCatalog | getAdminCatalog() → admin repository |
| Create tool → Create Tool | POST /tools | Write | 201 Mutation | 400,401,403,409,412 | admin, canCreateTool; canPublishTool if publish | createTool(input,categories,options) |
| Edit draft/published version → Edit Tool | PATCH /tools/:id | Write (complete draft replacement, NOT generic merge-patch) | 200 Mutation | 400,401,403,404,409,412 | admin, canEditTool; canPublishTool if publish | updateTool(id,input,categories,options) |
| Archive non-destructively → Archive Tool | POST /tools/:id/archive | {} | 200 Mutation | 401,403,404,409,412 | admin, canArchiveTool | archiveTool(id,options) |
| Restore archived record → Restore Tool | POST /tools/:id/restore | {} | 200 Mutation | 401,403,404,409,412 | admin, canArchiveTool | restoreTool(id,options) |
| Publish validated draft → Publish Tool | POST /tools/:id/publish | {} | 200 Mutation | 400,401,403,404,409,412 | admin, canPublishTool | publishTool(id,options) |
| Remove employee publication → Unpublish Tool | POST /tools/:id/unpublish | {} | 200 Mutation | 401,403,404,409,412 | admin, canPublishTool | unpublishTool(id,options) |
| Copy into unique unpublished draft → Duplicate Tool | POST /tools/:id/duplicate | {} | 201 Mutation | 401,403,404,409,412 | admin, canDuplicateTool | duplicateTool(id,options) |
| Enable/disable visibility → Set Tool Enabled | PATCH /tools/:id/enabled | {enabled:boolean} | 200 Mutation | 400,401,403,404,409,412 | admin, canEnableTool | setEnabled(id,enabled,options) |
| Browse categories → List Categories | GET /categories | None | 200 string[] | 401,403 | user/admin, canViewTools | getCategories(), prepared read; catalog loads include categories |
| Add category → Create Category | POST /categories | {name:string} | 201 Mutation | 400,401,403,409,412 | admin, canManageCategories | createCategory(name,options) |
| Rename referenced category → Rename Category | PATCH /categories | {name:string,previous:string} | 200 Mutation | 400,401,403,404,409,412 | admin, canManageCategories | renameCategory(name,previous,options) |
| Remove unused category → Remove Category | DELETE /categories | {name:string} | 200 Mutation | 400,401,403,404,409,412 | admin, canManageCategories; reject in-use | removeCategory(name,options) |
| Request permission → Access Request | POST /access-requests | {toolId,reason,urgency:"standard" or "urgent"} | 201 Receipt | 400,401,403,404,409 | user/admin, canRequestAccess + tool eligibility | workspace.submitAccessRequest(input) |
| Report issue → IT Incident | POST /incidents | {toolId,summary,details} | 201 Receipt | 400,401,403,404,409 | authenticated employee, visible tool | workspace.submitIncident(input) |
| Suggest improvement → Tool Suggestion | POST /suggestions | {text:string} | 201 Receipt | 400,401,403,409 | authenticated employee | workspace.submitSuggestion(text) |
| Personal service notices → List Notifications | GET /notifications | None | 200 NotificationRecord[] | 401,403 | authenticated recipient; never another employee's notices | shared.getNotifications(), prepared |
| Aggregate backend/tool health → Read System Status | GET /system-status | None | 200 {state,updatedAt} | 401,403 | authenticated employee, non-sensitive summary | shared.getSystemStatus(), prepared |
| Verified display profile → Current User | GET /me | None | 200 {id,username,displayName,role} | 401,403 | current authenticated subject only | shared.getMe(), prepared; IdP adapter still owns identity |
| Effective per-tool actions → Read Access Rules | GET /access-rules | None | 200 [{toolId,canLaunch,canRequest}] | 401,403 | current authenticated subject only | shared.getAccessRules(), prepared |
| Privileged history → Read Audit History | GET /audit-history | None | 200 [{id,action,actorId,toolId?,occurredAt}] | 401,403 | admin + explicit audit-read policy | shared.getAuditHistory(), prepared |
| Reachability → OneJarc Health | GET /health | None | 200 {status:"ok"} | 401,403,503 | authenticated employee; return no internals | shared.getHealth(), prepared/manual only |

PUT is supported centrally for future contracts but no current business workflow requires it. The DELETE category request has a JSON body; confirm gateway support or map to a workflow-specific POST at the façade, updating only the service contract if necessary. No destructive tool-delete endpoint exists.

NotificationRecord fields: id, title, message, createdAt, optional toolId. SystemStatus.state is operational/degraded/unavailable. Read-only service boundaries are typed/validated but not yet wired to production screens: no fake feed, health polling, entitlement decisions or audit history has been introduced.

## 7. Write flows, consistency, and duplicate prevention

Create/Edit/Archive:
1. React validates and disables duplicate saves.
2. Repository checks frontend permission and passes only command intent.
3. Gateway validates the user token, derives company membership/permissions, normalizes JSON, checks request size and rate limits.
4. Workflow independently checks the trusted principal and object/category rules; rejects unknown/mass-assignment fields.
5. Database transaction checks revision, creates/updates record, advances revision, stores server audit metadata and idempotency result together.
6. Respond with committed Mutation. The provider replaces its in-memory view. Employee browsing in another browser obtains the shared published projection on its next load/focus/refetch.
7. Preserve archived rows and prior audits. Category rename must update drafts and publications atomically. Never report success before persistence.

Access/Incident/Suggestion:
- Validate allowed tool, text length and authenticated company membership.
- Store a durable request and outbox record, then dispatch to approved monday.com/email/service desk integrations with server-side credentials.
- Return a real reference for accepted work, not a frontend-generated ticket number. An accepted access request is NOT a granted permission. If only queued internally, make the returned reference track that durable request, not a nonexistent external ticket.
- Access reasons are max 2,000 characters; incident summary 160, details 5,000; suggestion text 2,000. Enforce tighter company limits if needed.
- Local mode persists access IDs and suggestions only; incident submission stays an explicitly labeled preview. Failure leaves form input available.

Idempotency:
- UI uses synchronous in-flight guards and disabled submit controls.
- Workflow services share the pending promise for identical input; identical explicit retries after a failure reuse the key. Successful submissions get a new key next time.
- Catalog provider similarly retains a key for the same command AND revision after failure.
- Keys live only in memory: page reload/editor remount may lose them. Backend must additionally prevent duplicate open access requests and provide reconciliation/lookup before ambiguous retries across reloads.
- Scope the backend ledger to tenant + subject + method + canonical route + idempotency key; hash normalized body. Same key/different input → 409. Same key/same completed input → original committed response. In-progress duplicate → defined 409 or wait boundedly.
- Authenticate and authorize before replaying ledger responses. Check idempotency replay BEFORE treating an old If-Match as a new mutation; never leak another user's response.
- Use transactional uniqueness and an outbox for external side effects; independent workflow executions must not both create tickets. Define key retention and cleanup with the backend team.
- On revision conflict, retain draft text. Explicit reload obtains current catalog; re-open/reconcile before retry. No automatic overwrites.

Cache:
Catalog is kept in React/repository memory for the signed-in identity. Load, explicit Reload and focus in API mode refetch. Successful writes replace cache from the committed response. Stale read completions cannot overwrite newer reads/writes. Logout unmounts the provider. No background polling loop, GitHub cache or repository-file writes are used.

## 8. CORS and gateway requirements

Allow only the actual published frontend origin(s), for example https://jarcsys-collab.github.io if confirmed by the owner, plus separately approved staging/custom domains. An origin has scheme/host/port, **not a repository path**. Local http://127.0.0.1:3000 and http://localhost:3000 are distinct development origins; do not put them on production allowlists by default.

Gateway response policy for an allowlisted origin:

```http
Access-Control-Allow-Origin: <exact-matched-origin>
Vary: Origin
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, X-Request-ID, Idempotency-Key, If-Match
Access-Control-Expose-Headers: X-Request-ID, Retry-After
Cache-Control: no-store
```

Handle OPTIONS without bearer authentication or workflow side effects; validate the requesting origin/method/headers. Return consistent CORS headers even on errors for allowed origins. Do not reflect arbitrary origins. Browser calls currently omit cookies; a future cookie/BFF design requires separate CSRF/SameSite/credentials review. CORS is not authentication and cannot block a malicious non-browser client.

n8n's Webhook Allowed Origins documentation describes non-preflight requests. Do not assume that setting alone handles the authenticated request preflight. Verify the deployed version and make the gateway responsible for OPTIONS, rate limiting and consistent errors. Do not weaken browser requests to no-cors.

## 9. Security requirements and production gate

DO NOT:
- Store company passwords, permanent API tokens, n8n credentials, database passwords, webhook signatures or business application keys in React, bundles, HTML, localStorage or frontend environment variables.
- Treat public demo credentials, role JSON, admin=true, editable localStorage or hidden buttons as security.
- Expose anonymous privileged webhooks or allow direct bypass of the gateway.
- Forward arbitrary user-supplied API URLs into an HTTP Request workflow. Connections metadata is untrusted, not an SSRF exemption.
- Log Authorization, request bodies containing business reasons, or raw SQL/stack traces in browser/server diagnostics.
- Assume successful SSO authenticates the user to every catalog application.

DO:
- Verify token signature, approved issuer, audience, expiry/not-before, key rotation and company membership at the trusted server. Reject unsupported algorithms. A decoded JWT alone is not validation.
- Enforce least privilege per endpoint AND object. Derive actors and timestamps server-side.
- Authenticate gateway→n8n requests using private network/service credentials or verified signed identity; discard spoofable inbound identity headers. For signed messages define canonical body, timestamp window, nonce replay rules and key rotation. No signing key enters the browser.
- Enforce HTTPS, security headers, JSON/schema validation, payload limits, server-side rate limits, safe URL allowlists and parameterized database operations.
- Store secrets in approved server secret storage/n8n credentials; rotate, back up securely and limit workflow editor access.
- Keep append-only privileged audit records: principal, operation, tool, timestamp, requestId, outcome and safe change summary. Separate audit history from execution logs.
- Separate development/staging/production URLs, identity app registrations/audiences, credentials, workflow environments, databases, backups and access groups. Never test with production secrets or copied sensitive records.
- Review token storage/XSS/CSP, consent/scopes, outage recovery, accessibility and integration acceptance tests before real company use.

## 10. Datastore and remaining decisions

Use an approved durable datastore (for example PostgreSQL) independently of the frontend. Suggested entities: catalog entries/versioned definitions, categories, company identities/role mapping, entitlement rules, access requests, incidents, suggestions, notifications, audit events, idempotency ledger and workflow outbox. Include tenant/subject scoping, unique slug/category rules, revision constraints, retention, backup/restore and migration ownership.

n8n orchestrates these operations; its execution history, workflow variables and browser storage are not the shared OneJarc database. No database was created or selected automatically. Do not expose SQL credentials or database service-role keys to Pages.

**GitHub Actions Cache is for dependency/build acceleration only. It is NOT application storage, session storage, a database, a shared catalog or a user account store. GitHub repository files are NOT a live application database.**

Before enabling staging, provide: public base URL, confirmed frontend origins, chosen IdP and token audience, server role policy, supported endpoint/envelope contracts, datastore owner/schema, workflow owners, rate limits, idempotency/revision semantics, real receipt conventions, privacy/retention policy and a test account. API keys remain blank in the frontend.

## 11. Developer calls and verification

```ts
// React uses selected services; no raw fetch or webhook domain in components.
const { workspace } = useBackend();
const receipt = await workspace.submitAccessRequest({
  toolId: selected.id, reason, urgency: 'standard',
});

// Non-React adapters use the same client and service boundary.
const catalogService = createToolCatalogApiService(client);
const catalog = await catalogService.getTools();
```

Run the existing regression tests plus backend-ready.test.mjs, type check, then build. The offline tests inject HTTP fixtures; they do not start fake n8n endpoints or contact an external API. Before real rollout, integration-test OPTIONS/error CORS, token expiry/wrong audience, employee→admin denial, cross-user visibility, concurrent revision conflicts/idempotent replay, durable ticket references, and cross-browser shared data with the actual staging backend.

The GitHub package keeps site/, .github/workflows/pages.yml, relative assets, and hash navigation. Rebuild site/ after any configuration/source change; the existing manual Pages workflow publishes the committed site/ snapshot. This task does not publish or modify the live GitHub/Sites deployment.

