# OneJarc frontend handoff

## Responsibility and data flow

```text
index.html → src/main.tsx → controllers/hub-controller.tsx
                                  ├─ models/*: data and reusable rules
                                  └─ views/*: components receiving props/callbacks
user action → controller handler → model/local state → React renders updated views
```

React is retained. There is no new backend, server controller, database model, or rewritten UI. `hub-controller.tsx` is deliberately a controller/composition component: state and event handlers remain beside page JSX/local view helpers. This practical boundary keeps existing flows intact; extracting every page view is future refactoring work, not an implied completed strict MVC conversion.

## Models and shared services

- `tool-catalog.ts`: sample tool records and the Tool contract. Keep IDs stable for favorites/history/access state.
- `auth-service.ts` and `permissions.ts`: demo identities/session contract and client permission checks. Not trusted authentication or server authorization.
- `catalog-model.ts`, `catalog-service.ts`, `catalog-repository.ts`: draft/published catalog schema, guarded commands, and browser-local persistence boundary.
- `catalog-connection.ts`: non-secret API setup metadata and format validation only; no credentials or network calls.
- `catalog-editor-sections.ts`: editor tab definitions and validation-error navigation.
- `tool-search.ts`: deterministic problem matching, typo handling, clarification and ranked results.
- `tool-directory.ts`: category and alphabetical/recent ordering without mutating source records.
- `tool-actions.ts`: frontend access/maintenance routing. This is **not secure authorization**.
- `hub-storage.ts`: validates the existing `northstar-*` local-storage keys and reports failed persistence.
- `hub-appearance.ts`: browser theme and reduced-motion effects. This is a shared presentation service, not a business data model.
- `utils.ts`: shared class-name utility required by the existing components.

## Controller and views

Keep navigation state, task routing, favorites, requests and feedback coordinated in `hub-controller.tsx`. `ToolCard`, `DirectoryControls`, `ToolResultsSection`, `SiteSettings` and the existing UI primitives remain in `views/components/`. Their callbacks reuse controller handlers; do not duplicate request/maintenance gates inside cards or menus.

`views/hooks/use-auth.tsx` and `use-tool-catalog.tsx` own shared session/catalog state. `views/components/admin-console.tsx` and `catalog-editor.tsx` provide administration; `catalog-preview.tsx` isolates inert previews. The application bootstrap retains these providers and the login screen rather than inserting a fixed signed-in identity. Draft editing stays in parent state across the four tabs. API setup is outside the employee projection, but all browser-local data remains inspectable through developer tools.

`views/styles.css` contains existing semantic tokens and responsive/motion rules. The original SVG remains local. The only asset-path adaptation changes the logo reference to Vite's relative base so project-repository URLs work.

## Future backend seams — documentation only

| Current boundary | Future integration |
| --- | --- |
| Demo `auth-service.ts` plus `use-auth.tsx` | Trusted session/profile from an agreed authentication service. |
| Browser-local `catalog-repository.ts` seeded from `tool-catalog.ts` | Authenticated catalog API/database with stable IDs and server authorization. |
| Non-secret `catalog-connection.ts` setup | Server-side connector with a secret store, approved destinations and validated requests. |
| Sample status/notifications in the controller | Service-health feed and employee notification API. |
| `hub-storage.ts` | User preference/history API if cross-device persistence is required. |
| Request/report/task preview handlers | Validated server operations with real outcomes, retry/error states, and auditability. |
| Local search | Keep local matching or add a separately authenticated recommendation endpoint. |

Do not invent API URLs or place integration secrets in browser files. A real backend must validate identity, permissions, inputs, and availability even when the UI hides or blocks an action. CORS, sessions, CSRF protections where applicable, and rollout policy must be designed with the selected backend, not added as placeholder client checks.

## Maintenance and comments

Readable source files contain their original explanations plus an export-origin header. Generated JS/CSS contain a header pointing back to readable source; third-party internals are not manually annotated. Update comments with behavior changes and regenerate assets instead of patching bundles.

The exporter copies only the reachable frontend source and regression tests. It does not copy the original hosted page/layout, Sites configuration, Worker build, environment files, credentials, or Git metadata. Keep the original project authoritative unless the team explicitly decides to maintain this independent copy.
