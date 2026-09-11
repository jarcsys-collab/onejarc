# OneJarc backend-readiness implementation report

Prepared 11 September 2026. No production n8n connection, database, SSO implementation, new backend server, Git push or deployment was performed.

## RESEARCH FINDINGS

The secure target is a user-authenticated company API façade, mapped to n8n workflows with persistent storage behind them. Do not ship a shared webhook secret in a static site. Controlled JSON responses must distinguish committed records from a workflow-started acknowledgement. The gateway needs explicit CORS/preflight, authentication, authorization, rate limiting and generic error responses. Database-backed idempotency and an outbox protect concurrent creates/external tickets. Execution logging needs its own privacy review.

Primary-source findings, links, endpoint contracts and security requirements are documented in N8N_INTEGRATION.md. These are OneJarc-specific design decisions, not a claim that n8n alone supplies all security automatically.

## INSPECTION / CURRENT APPLICATION

| Area | Finding |
| --- | --- |
| Framework | React 19.2.6 + TypeScript, Vinext 1.0.0-beta.5 / Vite 8.0.13; existing Base UI/Shadcn components, Tailwind 4 and Lucide icons. |
| Localhost server | The existing dev script runs vinext dev on port 3000; localhost is not an application database. |
| Frontend | app/hub-app.tsx owns navigation/state; reusable components and hooks render the established OneJarc UI. No redesign was made. |
| Server-side components | Existing Vinext App Router rendering/hosting infrastructure remains. The project is not literally “no server files,” but there is no implemented shared company business backend for the catalog/request flows. |
| Catalog | Serializable definitions, draft/published versions, enabled/archive flags, categories, validators and a local command service already existed. |
| Roles/auth | Public prototype admin and medtek accounts remain centralized in AuthService. Their forgeable browser markers are not production authentication. |
| Persistence | Browser-local catalog; account-scoped favorites/recent/access IDs; device appearance; local suggestions. Demo session marker in sessionStorage. |
| Navigation | Existing in-page views and guarded hash admin routes remain static-host compatible. |
| Tool actions | Configured catalog URLs open safely; local task previews remain demonstrations, not executed external workflows. |
| APIs/n8n/database | No production endpoints or credentials supplied or connected. New API services are dormant in local mode. No new database connections or arbitrary integrations. |
| Search/status | Local recommendation matching, catalog status metadata, demo notices in the seeded local app. No AI service or live status monitor was introduced. |
| GitHub export | Separate static Vite MVC-style snapshot; relative assets, hash navigation, site/ and the manual Pages workflow. Empty-catalog export remains empty. |

## ARCHITECTURE

React → BackendProvider → local/API CatalogDataSource + WorkspaceServices → central API client → public API base URL → future authenticated gateway/n8n → future datastore/company applications.

AuthProvider selects the prototype adapter in local mode or a future approved company adapter in API mode. API calls can receive a user access token but never a demo marker/password or permanent service key. Company auth is deliberately unconfigured.

## FILES CREATED FOR THIS CHANGE

- lib/backend-config.ts — public environment/data-source settings, URL policy.
- lib/api-client.ts — five HTTP verbs, token hook, timeouts, safe errors, request IDs and mutation headers.
- lib/catalog-api-service.ts — typed catalog/category API contracts and employee projection.
- lib/catalog-data-source.ts — interchangeable local/API command repositories.
- lib/company-auth.ts — registration interface for future approved SSO; unconfigured fail-closed adapter.
- lib/workspace-services.ts — access/incident/suggestion local/API adapters, idempotency helper, prepared shared-data reads.
- hooks/use-backend.tsx — service composition per signed-in identity.
- hooks/use-submission.ts — pending/error state and synchronous duplicate-submit guard.
- tests/backend-ready.test.mjs — offline transport, repository, permission, auth-mode, workflow and storage regression coverage.
- tests/backend-forms.test.mjs — pending/failed request-form rendering without a real backend.
- docs/N8N_INTEGRATION.md — endpoint and security handoff.
- docs/BACKEND_READINESS_REPORT.md — this implementation report.

## FILES MODIFIED FOR THIS CHANGE

- app/hub-app.tsx — provider wiring, async access/incident/suggestion flows, honest API/local messages, production navigation policy, suppress local sample alerts in API mode.
- hooks/use-auth.tsx — company adapter selection, future access-token hook and 401 session expiration.
- hooks/use-tool-catalog.tsx — repository-independent loading/commands, in-memory refresh, stale-response protection and retry keys.
- components/login-screen.tsx — existing local form preserved; unconfigured company sign-in state in API mode.
- components/catalog-editor.tsx — API field errors and safe support references.
- components/admin-console.tsx — API-aware success/error messages.
- lib/catalog-model.ts — backwards-compatible optional server audit metadata.
- scripts/prepare-github-mvc.mjs — export the backend handoff and new offline API tests.
- scripts/github-empty-catalog.mjs — preserve the empty-notification transformation after service wiring.
- scripts/github-mvc-template/README.md — explain the exported integration/configuration boundary.

Existing unrelated/earlier uncommitted changes were preserved. Dependencies and lockfile were not changed for this integration work.

## API CLIENT

One centralized fetch boundary supports GET, POST, PUT, PATCH, DELETE; typed success/error envelopes; JSON parsing; required future user token; timeout/cancellation; request IDs; idempotency keys; If-Match; safe status/field messages; and redacted development diagnostics. It rejects invalid paths/redirects, unconfigured mode and missing tokens. No automatic retries, token persistence or secret-bearing configuration.

## REPOSITORY LAYER

Local mode delegates to the existing validated command service and catalog storage. API mode sends command intent to typed endpoints. Admin-only snapshots and employee published projections use separate reads; no client-generated full snapshot or claimed actor/role is sent. Cache lives in memory, refreshes on load/focus/manual reload, and updates after committed writes. Read generations protect against stale completions.

## LOCAL MODE

All profiles start local with blank URLs. Login remains admin / 123 and medtek / 123. The main local development app keeps its original demo tools; the GitHub empty-catalog package has none. No saved user-created catalogs are erased. Access requests and suggestions remain browser-local; incidents remain preview-only. Settings, favorites, recent items, search and tool actions remain available.

## FUTURE API MODE

Backend team must implement the documented endpoints, persistent data, authorization and approved company SSO adapter first. Register the adapter before AuthProvider mounts; select the staging profile and public API URL in backend-config.ts, switch dataSource to api, then rebuild. Without an adapter, API mode displays “not configured”; it never authenticates with the demo accounts or falls back to browser data.

## N8N ENDPOINTS NEEDED

Implemented service contracts: tools list/detail, admin catalog, tool create/edit/publish/unpublish/archive/restore/duplicate/enable, categories list/add/rename/remove, access requests, incidents and suggestions.

Prepared read boundaries: notifications, system status, current profile, access rules, audit history and health. These are deliberately not presented as connected features; screens still need their feed-specific wiring when the contracts exist. Health does not poll. Access request receipts are acceptance, not granted entitlements; approval status is not synchronized.

See N8N_INTEGRATION.md for each endpoint's method, body, success/error response, permission and frontend caller.

## AUTHENTICATION READINESS

AuthService/AuthProvider remain the single identity boundary. CompanyAuthService adds beginSignIn/getAccessToken hooks. No SSO SDK, login endpoint, password flow to n8n, fake JWT or real company session is implemented. Demo markers never become API credentials.

## AUTHORIZATION READINESS

Existing centralized permissions still protect UI/commands. The backend must re-check company membership, roles and per-record access for every endpoint. Browser permissions, returned UI rules and catalog access labels are not sufficient authorization.

## CORS REQUIREMENTS

Explicit approved frontend origins; OPTIONS handling; GET/POST/PUT/PATCH/DELETE; Authorization, Content-Type, X-Request-ID, Idempotency-Key and If-Match headers. Expose X-Request-ID and Retry-After. No wildcard authenticated production policy or no-cors workaround. Current client omits cookies.

## SECURITY REQUIREMENTS

HTTPS; verified user tokens; server authorization; request validation/limits; rate limiting; scoped idempotency; server-owned audit identity; approved outbound URL policy; server-only credentials; reviewed execution retention. Frontend contains public demo credentials by design, never production passwords/API keys. The complete security checklist and limitations are in N8N_INTEGRATION.md.

## DATABASE REQUIREMENTS

Persistent catalog/categories, requests, entitlements, notifications, audit history, idempotency ledger and outbox belong in an approved datastore. n8n orchestrates them. GitHub Pages, Actions Cache, repository files and browser storage are not the shared production backend.

## N8N_INTEGRATION DOCUMENT

Main source: docs/N8N_INTEGRATION.md. Standalone source package: docs/N8N_INTEGRATION.md; source modules map from lib/ to src/models/ and hooks/components to src/views/.

## VALIDATION AND LIMITS

The existing 93 regressions, 22 new offline API/repository tests and four pending/error form-render tests cover the changed frontend. Tests inject transport fixtures; there are no mock HTTP endpoints. TypeScript and static/hosting builds are checked during handoff. Generated packages also run their exported tests, syntax checks and root/repository-subpath asset checks.

Component/form tests are server-rendered, not a full browser click-through. Actual n8n CORS, token verification, database transactions, cross-browser synchronization and external ticket delivery cannot be verified until a staging backend is supplied. Static bundle scanning detects common secret formats and accidental private files; it is not a formal security audit.

## GITHUB PAGES

Keep site/ and .github/workflows/pages.yml together. The workflow stays manual and publishes the prepared site/ snapshot; no server runtime, backend or GitHub application storage is required. Rebuild after changing public config/source. Updated empty-catalog archives are provided separately so older exports and user-created files are not overwritten. No live deployment was changed.

## CONFIRM

- Can the frontend later connect to n8n without a major rewrite? **YES**, for the prepared catalog/request flows; a real backend and company auth adapter are still required.
- Can catalog data become shared across browsers? **YES, once authenticated backend persistence is connected. Not in local mode.**
- Are n8n secrets stored in frontend code? **NO.**
- Is GitHub cache used as application storage? **NO.**
- Does the prototype still work without n8n? **YES.**
- Is this production authentication/security or a connected backend? **NO.**

## VERIFIED HANDOFF RESULTS — 11 September 2026

- Main regression suite: **119 passed, 0 failed** (93 existing + 22 API/repository + 4 form-render tests).
- Empty-catalog standalone package: **38 passed, 0 failed**; its tests cover empty first-run creation/publish/search/reopen plus API/auth/appearance contracts.
- TypeScript: passed for main source and exported source.
- Existing Vinext hosting build: passed; independent Vite static Pages build: passed.
- Static verification: HTML, JavaScript syntax, CSS, logo, root URLs and repository-subpath asset URLs passed.
- Local app: HTTP 200 at http://127.0.0.1:3000/.
- Common-credential-pattern scan: 119 selected source/bundle files, 0 recognized credential matches. This is a bounded scan, not proof of absence of every possible secret format.
- Export content audit: 82 files; 0 .env/private repository/hosting/server-output/dependency files. All three API profiles have blank URLs; selected mode is local.
- Existing live Sites/GitHub deployments and browser-owned catalogs were not modified.
