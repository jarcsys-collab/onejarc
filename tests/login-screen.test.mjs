/** Render the real login view to protect its responsive composition and form
 * contract. Credential, role, restoration, and logout logic stay covered by
 * auth-catalog.test.mjs; this suite never opens a browser or creates a session. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Use the project's existing component-test setup without a public test server.
const root = fileURLToPath(new URL('../src/', import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  plugins: [react()],
  resolve: { alias: { '@': root } },
  server: { middlewareMode: true, hmr: false, watch: null },
});

try {
  const { AuthProvider } = await server.ssrLoadModule('/views/hooks/use-auth.tsx');
  const { LoginScreen } = await server.ssrLoadModule(
    '/views/components/login-screen.tsx',
  );
  const html = renderToStaticMarkup(
    createElement(
      AuthProvider,
      null,
      createElement(LoginScreen, { logo: createElement('span', null, 'JUNO') }),
    ),
  );

  await test('desktop login restores the brand/form split with the updated tagline', () => {
    assert.match(html, /lg:grid-cols-\[1.1fr_0.9fr\]/);
    // Shared tracks replace independent vertical centering of unequal columns.
    assert.match(html, /lg:grid-rows-\[auto_1fr_auto\]/);
    assert.equal((html.match(/lg:grid-rows-subgrid/g) ?? []).length, 2);
    assert.match(html, /aria-label="About OneJarc"/);
    assert.match(html, /Your company tools\./);
    assert.match(html, /One place to get things done\./);
    assert.match(html, /Sign in to your workspace/);
    assert.doesNotMatch(html, /Start work without the search/);
  });

  await test('one accessible credential form serves both desktop and mobile layouts', () => {
    assert.equal((html.match(/<form\b/g) ?? []).length, 1);
    assert.equal((html.match(/name="username"/g) ?? []).length, 1);
    assert.equal((html.match(/name="password"/g) ?? []).length, 1);
    assert.match(html, /for="login-username"/);
    assert.match(html, /for="login-password"/);
    assert.match(html, /type="password"/);
    assert.match(html, /autoComplete="username"/i);
    assert.match(html, /autoComplete="current-password"/i);
    assert.match(html, /aria-label="Show password"/);
    assert.match(html, /type="submit"/);
    assert.match(html, /required=""/);
    assert.match(html, /Welcome to OneJarc/);
    assert.match(html, /lg:hidden/);
  });

  await test('restored design retains honest prototype disclosure and no bypass-login button', () => {
    assert.match(html, /Prototype access only/);
    assert.match(html, /Demo credentials are visible in the frontend/);
    assert.match(html, /Company SSO is not connected/);
    assert.doesNotMatch(
      html,
      /Secure workspace|Company managed access|Continue to demo workspace/,
    );
    assert.match(html, /Sign In/);
  });
} finally {
  await server.close();
}
