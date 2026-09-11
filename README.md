# OneJarc — GitHub Pages test (empty catalog, n8n-ready frontend)

Prepared 11 September 2026. This is still LOCAL PROTOTYPE MODE. No tools/categories/sample notices are preinstalled. No n8n endpoint, company SSO, database, API key or production integration is connected.

## Upload and run

1. Extract this ZIP. Upload its contents, not the ZIP or an enclosing folder.
2. On your GitHub repository's default branch, use Add file → Upload files to upload `site/`, `.github/` and this README.
3. Verify the exact paths: `site/index.html`, `site/assets/`, `site/juno-logo.svg`, `site/.nojekyll` and `.github/workflows/pages.yml`. If the browser skipped hidden files, create the missing workflow file at its exact path and copy the included content.
4. Open Settings → Pages → Build and deployment → Source → GitHub Actions.
5. Open Actions → Publish OneJarc frontend test → Run workflow. Select the default branch and run.
6. Open the website URL shown by the successful deployment. The repository's HTML code-view page is not the running website.

This manual workflow publishes only site/. It does not run when files are uploaded, does not rebuild source, and needs no custom API key or user token. An authorized repository administrator must resolve any organization restrictions on Pages/Actions.

[GitHub custom Pages workflow instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## Add your company tools

- Sign in as `admin / 123`.
- Open ONE JARC → Administration → Categories and add your first category.
- Open Tool Catalog → Add Tool. Enter the details and approved application URL.
- Save Draft while editing; Publish and keep Enabled to show it in this browser's workspace.
- Sign out and use `medtek / 123` to test the employee view in the same browser.

Search recommends only published tools you have added. An empty catalog does not invent recommendations.

## What is prepared

The frontend includes a central API client, local/API repository selection, asynchronous request forms, and a future company-auth adapter interface. API URLs and keys are blank. Today's mode makes no n8n requests.

The separate full source archive includes organized, commented MVC-style source plus `docs/N8N_INTEGRATION.md` and `docs/BACKEND_READINESS_REPORT.md`. A backend team must implement and secure the documented contracts and company-auth adapter before enabling API mode. Future PUBLIC settings belong in `src/models/backend-config.ts`; never put service keys there. Rebuild site/ after source/configuration changes.

## Important limits

- Demo passwords are visible in browser code and are not secure company authentication. Do not enter real passwords or confidential data. Repository privacy does not by itself establish private website access.
- Tools saved here remain in this browser profile and website origin. They are not shared with other devices/employees. Clearing site data removes them.
- Admin Publish changes the local catalog, not GitHub or company-wide data.
- This empty edition uses `onejarc-tool-catalog-github-empty-v1`. It does not read or delete earlier demo catalogs, and later uploads do not intentionally reset tools you added to this edition.
- Access requests and suggestions are local demonstrations. Incident reports remain previews. No external ticket or approval is created.
- Per-tool Connections → Check setup validates metadata only and sends no request.
- No GitHub Actions cache or repository files are used as application storage.
- No browser records, .env files, server output, development dependencies or credentials are included in this upload package.

For code changes, use the full source ZIP, build/verify it, upload the resulting site/ snapshot and run the manual workflow again. Keep earlier backups; do not edit generated bundles.

