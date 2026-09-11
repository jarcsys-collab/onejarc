/** Offline integration tests. All HTTP responses below are injected fixtures,
 * never real n8n endpoints; storage adapters cannot touch a user's browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
  const { createApiClient, ApiError, describeApiError } =
    await server.ssrLoadModule('/models/api-client.ts');
  const configuration = await server.ssrLoadModule('/models/backend-config.ts');
  const { createApiCatalogDataSource, createLocalCatalogDataSource } =
    await server.ssrLoadModule('/models/catalog-data-source.ts');
  const catalogApi = await server.ssrLoadModule('/models/catalog-api-service.ts');
  const workflow = await server.ssrLoadModule('/models/workspace-services.ts');
  const model = await server.ssrLoadModule('/models/catalog-model.ts');
  const auth = await server.ssrLoadModule('/models/auth-service.ts');
  const company = await server.ssrLoadModule('/models/company-auth.ts');
  const config = {
    environment: 'staging',
    dataSource: 'api',
    apiBaseUrl: 'https://api.example.test/onejarc/v1',
    timeoutMs: 200,
  };
  const admin = {
    id: 'test-admin',
    username: 'administrator',
    displayName: 'Test Administrator',
    role: 'admin',
  };
  const employee = { ...admin, id: 'test-employee', role: 'user' };
  const token = 'test-session-placeholder'; // Test fixture only; not an issued credential.
  const memory = () => {
    const values = new Map();
    return {
      values,
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    };
  };
  const envelope = (data, status = 200, headers = {}) =>
    new Response(
      JSON.stringify({ success: true, data, requestId: 'REQ-test-1' }),
      { status, headers: { 'Content-Type': 'application/json', ...headers } },
    );
  const client = (fetchImpl, extra = {}) =>
    createApiClient(config, {
      getAccessToken: async () => token,
      fetchImpl,
      ...extra,
    });
  const definition = () => ({
    ...model.newToolDefinition(),
    name: 'Our tool',
    slug: 'our-tool',
    description: 'Reserve equipment',
    category: 'Our category',
    owner: 'Operations',
    applicationUrl: 'https://example.com/tool',
  });
  const catalog = () => ({
    version: 1,
    revision: 1,
    categories: ['Our category'],
    entries: [
      {
        id: 'our-tool',
        draft: definition(),
        published: definition(),
        enabled: true,
        archived: false,
        createdAt: '2026-09-11T00:00:00Z',
        updatedAt: '2026-09-11T00:00:00Z',
        createdBy: 'server-actor',
        updatedBy: 'server-actor',
      },
    ],
  });

  for (const status of [200, 201])
    await test('API accepts committed JSON success ' + status, async () => {
      assert.deepEqual(
        await client(async () => envelope({ id: 'saved' }, status)).post(
          '/tools',
          { name: 'Example' },
        ),
        { id: 'saved' },
      );
    });
  for (const [status, code, message] of [
    [400, 'VALIDATION_ERROR', 'highlighted'],
    [401, 'UNAUTHORIZED', 'Sign in again'],
    [403, 'FORBIDDEN', 'permission'],
    [404, 'NOT_FOUND', 'no longer'],
    [409, 'CONFLICT', 'Reload'],
    [412, 'CONFLICT', 'Reload'],
    [429, 'RATE_LIMITED', 'wait'],
    [500, 'BACKEND_ERROR', 'temporarily'],
  ]) {
    await test('HTTP ' + status + ' maps to safe UI feedback', async () => {
      let expired = 0;
      const logs = [];
      const api = client(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'SQL_SECRET',
                message: 'database password is confidential',
                fields: { name: 'REQUIRED', description: 'SQL stack trace' },
              },
              requestId: 'REQ-failed',
            }),
            {
              status,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '30',
              },
            },
          ),
        { onUnauthorized: () => expired++, log: (event) => logs.push(event) },
      );
      await assert.rejects(
        api.post('/tools', { password: 'must-not-log' }),
        (e) => {
          assert.equal(e.code, code);
          assert.equal(e.status, status);
          assert.match(describeApiError(e), new RegExp(message));
          assert.doesNotMatch(
            describeApiError(e),
            /SQL|confidential|stack trace/,
          );
          if (status === 400)
            assert.deepEqual(e.fields, { name: 'This field is required.' });
          if (status === 429) assert.match(describeApiError(e), /30 seconds/);
          return true;
        },
      );
      assert.equal(expired, status === 401 ? 1 : 0);
      assert.doesNotMatch(
        JSON.stringify(logs),
        /password|confidential|must-not-log|test-session-placeholder|https/,
      );
      assert.equal(logs[0].requestId, 'REQ-failed');
    });
  }
  await test('network, timeout and explicit cancellation are distinguishable', async () => {
    await assert.rejects(
      client(async () => {
        throw new Error('private host');
      }).get('/tools'),
      (e) => e.code === 'NETWORK_ERROR' && !e.message.includes('private'),
    );
    await assert.rejects(
      client(() => new Promise(() => {})).get('/tools'),
      (e) => e.code === 'TIMEOUT',
    );
    const abort = new AbortController();
    abort.abort();
    let calls = 0;
    await assert.rejects(
      client(async () => {
        calls++;
        return envelope({});
      }).get('/tools', { signal: abort.signal }),
      (e) => e.code === 'CANCELLED',
    );
    assert.equal(calls, 0);
  });
  await test('all five verbs use one client with safe headers and confined base URL', async () => {
    const calls = [];
    const api = client(async (url, options) => {
      calls.push({ url, options });
      return envelope({});
    });
    await api.get('/tools', { query: { q: 'reserve a room' } });
    await api.post(
      '/tools',
      { name: 'T' },
      { idempotencyKey: 'stable-key', revision: 7 },
    );
    await api.put('/tools/one', {});
    await api.patch('/tools/one', {});
    await api.delete('/tools/one');
    assert.deepEqual(
      calls.map((c) => c.options.method),
      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    );
    assert.equal(calls[0].url, config.apiBaseUrl + '/tools?q=reserve+a+room');
    assert.equal(calls[1].options.headers['If-Match'], '"7"');
    assert.equal(calls[1].options.headers['Idempotency-Key'], 'stable-key');
    for (const { options } of calls) {
      assert.equal(options.headers.Authorization, 'Bearer ' + token);
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.equal(options.cache, 'no-store');
    }
    for (const path of [
      '//evil.test',
      '/../tools',
      '/%2e%2e/tools',
      '/tools?token=oops',
      '/tools/%2fadmin',
      '/tools/%252fadmin',
      '/tools#x',
    ])
      await assert.rejects(api.get(path), (e) => e.code === 'INVALID_REQUEST');
    assert.equal(calls.length, 5);
  });
  await test('local/blank mode, missing token and production HTTP cannot send requests', async () => {
    let calls = 0;
    const transport = async () => {
      calls++;
      return envelope({});
    };
    await assert.rejects(
      createApiClient(configuration.backendConfig, {
        getAccessToken: async () => token,
        fetchImpl: transport,
      }).get('/tools'),
      (e) => e.code === 'NOT_CONFIGURED',
    );
    await assert.rejects(
      client(transport, { getAccessToken: async () => null }).get('/tools'),
      (e) => e.status === 401,
    );
    for (const apiBaseUrl of [
      'http://api.example.test',
      'https://user:pass@example.test',
      'https://api.example.test?key=secret',
      '',
    ])
      assert.throws(() =>
        createApiClient(
          { ...config, apiBaseUrl },
          { getAccessToken: async () => null },
        ),
      );
    assert.equal(calls, 0);
    assert.equal(
      configuration.isAllowedLaunchUrl('http://localhost:3000', 'production'),
      false,
    );
    assert.equal(
      configuration.isAllowedLaunchUrl('https://example.com', 'production'),
      true,
    );
  });
  await test('strict response envelopes reject HTML, malformed JSON and mismatched tool IDs', async () => {
    for (const body of [
      '<html>gateway error</html>',
      '{',
      JSON.stringify({ data: {} }),
      JSON.stringify({ success: true, data: {}, requestId: '<script>' }),
    ])
      await assert.rejects(
        client(
          async () =>
            new Response(body, {
              headers: { 'Content-Type': 'application/json' },
            }),
        ).get('/tools'),
        (e) => e.code === 'INVALID_RESPONSE',
      );
    await assert.rejects(
      catalogApi
        .createToolCatalogApiService(
          client(async () =>
            envelope({ revision: 1, categories: [], tools: [] }),
          ),
        )
        .getTool('missing'),
      (e) => e.code === 'INVALID_RESPONSE',
    );
  });
  await test('employee repository fetches only the published projection and cannot write', async () => {
    const paths = [];
    const repository = createApiCatalogDataSource(
      client(async (url) => {
        paths.push(url);
        return envelope({
          revision: 1,
          categories: ['Our category'],
          tools: [
            {
              id: 'our-tool',
              definition: definition(),
              draft: { secret: 'not-for-user' },
            },
          ],
        });
      }),
      employee,
    );
    const result = await repository.read();
    assert.equal(result.tools[0].name, 'Our tool');
    assert.deepEqual(result.snapshot.entries, []);
    assert.doesNotMatch(JSON.stringify(result), /not-for-user/);
    await assert.rejects(
      repository.execute({ type: 'archive', id: 'our-tool' }, 1, 'key'),
      /Access denied/,
    );
    assert.deepEqual(paths, [config.apiBaseUrl + '/tools']);
  });
  await test('admin repository sends commands, revision and key, never a snapshot or claimed actor', async () => {
    const calls = [];
    const repository = createApiCatalogDataSource(
      client(async (url, options) => {
        calls.push({ url, options });
        return envelope(
          options.method === 'GET'
            ? catalog()
            : { catalog: { ...catalog(), revision: 2 } },
          options.method === 'POST' ? 201 : 200,
        );
      }),
      admin,
    );
    await repository.read();
    const saved = await repository.execute(
      { type: 'save', definition: definition(), publish: true },
      1,
      'create-key',
    );
    assert.equal(saved.snapshot.revision, 2);
    const body = JSON.parse(calls[1].options.body);
    assert.deepEqual(Object.keys(body).sort(), ['definition', 'publish']);
    assert.equal(calls[1].options.headers['Idempotency-Key'], 'create-key');
    assert.equal(calls[1].options.headers['If-Match'], '"1"');
    await assert.rejects(
      repository.execute({ type: 'archive', id: 'our-tool' }, 1, 'stale-key'),
      (e) => e.code === 'CONFLICT',
    );
    assert.equal(calls.length, 2);
  });
  await test('concurrent reads cannot replace a newer admin cache', async () => {
    let resolveFirst;
    let call = 0;
    const repository = createApiCatalogDataSource(
      client(async () => {
        call++;
        if (call === 1)
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        return envelope({ ...catalog(), revision: 2 });
      }),
      admin,
    );
    const first = repository.read();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await repository.read();
    resolveFirst(envelope(catalog()));
    await first;
    await assert.rejects(
      repository.execute({ type: 'archive', id: 'our-tool' }, 1, 'key'),
      (e) => e.code === 'CONFLICT',
    );
  });
  await test('local data source still creates/edits/publishes with no API and retains saved records', async () => {
    const storage = memory();
    const repo = createLocalCatalogDataSource(() => storage, admin);
    let view = await repo.read();
    view = await repo.execute(
      { type: 'category-add', name: 'Our category' },
      view.snapshot.revision,
      'local-1',
    );
    view = await repo.execute(
      { type: 'save', definition: definition(), publish: true },
      view.snapshot.revision,
      'local-2',
    );
    const item = view.tools.find((t) => t.slug === 'our-tool');
    assert.ok(item);
    view = await repo.execute(
      {
        type: 'save',
        id: item.id,
        definition: { ...definition(), name: 'Edited tool' },
        publish: true,
      },
      view.snapshot.revision,
      'local-3',
    );
    assert.equal(view.tools.find((t) => t.id === item.id).name, 'Edited tool');
    assert.deepEqual(
      (await createLocalCatalogDataSource(() => storage, admin).read())
        .snapshot,
      view.snapshot,
    );
  });
  await test('idempotent submit shares one pending promise and reuses the key after ambiguous failure', async () => {
    const keys = [];
    let fail = true;
    const send = workflow.createIdempotentSubmit(async (_, key) => {
      keys.push(key);
      await new Promise((r) => setTimeout(r, 5));
      if (fail) throw new ApiError('TIMEOUT');
      return 'saved';
    });
    const first = send({ toolId: 'one' });
    assert.equal(send({ toolId: 'one' }), first);
    await assert.rejects(send({ toolId: 'two' }), (e) => e.code === 'CONFLICT');
    await assert.rejects(first);
    fail = false;
    assert.equal(await send({ toolId: 'one' }), 'saved');
    assert.equal(keys[0], keys[1]);
    await send({ toolId: 'one' });
    assert.notEqual(keys[1], keys[2]);
  });
  await test('workflow services validate inputs and require real API receipts', async () => {
    const requests = [];
    const services = workflow.createApiWorkspaceServices(
      client(async (url, options) => {
        requests.push({ url, body: JSON.parse(options.body) });
        return envelope({ reference: 'IT-42' }, 201);
      }),
      employee,
    );
    const access = await services.submitAccessRequest({
      toolId: 'our-tool',
      reason: 'Need reporting',
      urgency: 'standard',
      role: 'admin',
    });
    const incident = await services.submitIncident({
      toolId: 'our-tool',
      summary: 'Cannot open',
      details: 'After clicking Open',
    });
    await services.submitSuggestion('Add a reporting tool');
    assert.deepEqual(access, { delivery: 'api', reference: 'IT-42' });
    assert.equal(incident.reference, 'IT-42');
    assert.ok(!('role' in requests[0].body));
    assert.throws(
      () =>
        services.submitAccessRequest({
          toolId: 'our-tool',
          reason: '',
          urgency: 'standard',
        }),
      (e) => e.status === 400,
    );
    assert.throws(
      () => services.submitSuggestion('a'.repeat(2001)),
      (e) => e.status === 400,
    );
    await assert.rejects(
      workflow
        .createApiWorkspaceServices(
          client(async () => envelope({ message: 'Workflow got started' })),
          employee,
        )
        .submitSuggestion('A suggestion'),
      (e) => e.code === 'INVALID_RESPONSE',
    );
  });
  await test('local requests/suggestions persist honestly, incident stays a preview, failed storage stays failure', async () => {
    const storage = memory();
    const services = workflow.createLocalWorkspaceServices(
      () => storage,
      employee,
    );
    assert.equal(
      (
        await services.submitAccessRequest({
          toolId: 'our-tool',
          reason: 'Do not persist this reason',
          urgency: 'urgent',
        })
      ).delivery,
      'local',
    );
    assert.equal(
      (await services.submitSuggestion('Our suggestion')).delivery,
      'local',
    );
    assert.equal(
      (
        await services.submitIncident({
          toolId: 'our-tool',
          summary: 'Issue',
          details: 'Details',
        })
      ).delivery,
      'preview',
    );
    assert.doesNotMatch(
      JSON.stringify([...storage.values]),
      /Do not persist this reason|Details/,
    );
    const blocked = workflow.createLocalWorkspaceServices(() => {
      throw new Error('Storage denied');
    }, employee);
    await assert.rejects(
      blocked.submitSuggestion('Keep form text'),
      /Could not save/,
    );
    await assert.rejects(
      blocked.submitAccessRequest({
        toolId: 'our-tool',
        reason: 'Keep form',
        urgency: 'standard',
      }),
      /Could not save/,
    );
  });
  await test('company auth seam has no demo token and API login renders no password form', async () => {
    assert.equal(company.getCompanyAuthService(), null);
    assert.equal(
      company.isCompanyAuthService(
        auth.createPrototypeAuthService(auth.createSessionStore(memory())),
      ),
      false,
    );
    await assert.rejects(
      company.unconfiguredCompanyAuth.signIn('admin', '123'),
      (e) => e.code === 'NOT_CONFIGURED',
    );
    const { AuthProvider } = await server.ssrLoadModule('/views/hooks/use-auth.tsx');
    const { LoginScreen } = await server.ssrLoadModule(
      '/views/components/login-screen.tsx',
    );
    configuration.backendConfig.dataSource = 'api';
    try {
      const html = renderToStaticMarkup(
        createElement(
          AuthProvider,
          null,
          createElement(LoginScreen, {
            logo: createElement('span', null, 'JUNO'),
          }),
        ),
      );
      assert.doesNotMatch(html, /name="password"|name="username"/);
      assert.match(html, /Company sign-in is not configured/);
      assert.match(html, /disabled/);
    } finally {
      configuration.backendConfig.dataSource = 'local';
    }
  });
} finally {
  await server.close();
}
