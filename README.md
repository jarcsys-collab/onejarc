# OneJarc — upload-ready GitHub Pages test

This is the **empty-catalog edition**. No tools, categories, favorites, recent activity, or sample service notices are preinstalled. Your team adds its own tools through Administration. The existing design, login, search, settings and admin editor are retained. API credentials are blank. Nothing has been deployed yet.

## Upload and publish

1. Extract this ZIP on your computer. Do not upload the ZIP itself.
2. Create a GitHub repository for this test. Choose its visibility according to company policy; this is a demo login, not secure company authentication.
3. On the repository's default branch (usually `main`), use **Add file → Upload files**. Upload the extracted **contents**: `.github/`, `site/`, and `README.md`. Do not wrap them in an extra folder.
4. Confirm that `site/index.html`, `site/assets/`, `site/juno-logo.svg`, and `.github/workflows/pages.yml` exist at those exact paths. If `.github` was skipped, create `.github/workflows/pages.yml` with **Add file → Create new file**, and paste the included workflow contents. Keep `site/.nojekyll` too.
5. Open **Settings → Pages → Build and deployment → Source**, then select **GitHub Actions**. Do not choose **Deploy from a branch** for this folder layout.
6. Open **Actions → Publish OneJarc frontend test → Run workflow**. Choose the default branch and confirm **Run workflow**. The workflow runs only when you request it; uploading files alone does not start it.
7. Wait for success. Open the live website link shown by the deployment or in **Settings → Pages**. Use this Pages link, not the repository's `index.html` code-view link.

The workflow publishes only `site/`; no Node installation, API key, custom token, or build command is needed for this prepared snapshot. GitHub provides the workflow's standard permissions. If your organization blocks Pages, Actions, or publishing, an authorized repository administrator must enable them.

[GitHub Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## Add your first company tool

1. Sign in with the prototype admin account: username **admin**, password **123**.
2. Open the top-right **ONE JARC** menu → **Administration**.
3. In **Categories**, create a category your company needs.
4. Go to **Tool Catalog → Add Tool**. Enter the name, description, category, owner and application URL. Appearance, discovery and other advanced options are optional.
5. Use **Save Draft** to keep work private in this browser, or **Publish** to show the tool in the employee workspace. Keep it enabled.
6. To test the employee view in the same browser, sign out and use username **medtek**, password **123**.

The Home page also offers an administrator shortcut for creating the first category. Search will recommend only tools that have been added and published; it does not invent apps for an empty catalog.

## Important limits

- These demo credentials are visible in the frontend. Do not enter real company passwords or confidential information. A private repository does not automatically mean a private Pages website.
- Saved tool edits belong to this browser profile and website origin. They normally remain after refresh/reopening, but do **not** synchronize to another browser, computer or employee. Clearing site data removes them.
- Admin **Publish** updates the local catalog, not GitHub or company-wide data. A shared backend/database is still needed for everyone to see your changes.
- Localhost records are not transferred. This edition uses `onejarc-tool-catalog-github-empty-v1`, separate from old demo catalogs, without deleting them. Later uploads of this same edition do not intentionally clear user-added tools.
- API setup stores non-secret metadata only. **Check setup** validates format and sends no request. Keys stay blank; authentication, live health monitoring and workflows are not connected.

## Updating the website code later

Use the separate **full source ZIP** for code changes. Its `src/models/`, `src/controllers/`, and `src/views/` contain organized, commented source. Build and verify there, then replace this repository's generated `site/` contents with the new output and run the workflow again. Remove only obsolete generated asset files when updating; never edit the generated bundles directly.

This upload-ready package contains only the built website, deployment workflow and these instructions. It does not include your browser's saved tool records, API keys, `.env` files, server output, repository credentials, or development dependencies.
