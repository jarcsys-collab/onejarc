/** Verify the shipped empty edition using isolated storage and real services.
 * Test-created tools exist only in memory, never in the deployed seed catalog. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const server = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', plugins: [react()], resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, watch: null } });
try {
  const model = await server.ssrLoadModule('/models/catalog-model.ts');
  const { tools } = await server.ssrLoadModule('/models/tool-catalog.ts');
  const { CATALOG_KEY, createLocalCatalogRepository } = await server.ssrLoadModule('/models/catalog-repository.ts');
  const { executeCatalogCommand } = await server.ssrLoadModule('/models/catalog-service.ts');
  const { searchToolCatalog } = await server.ssrLoadModule('/models/tool-search.ts');
  const { blankApiConnection, validateApiConnection } = await server.ssrLoadModule('/models/catalog-connection.ts');
  const auth = await server.ssrLoadModule('/models/auth-service.ts');
  const admin = { id: 'demo-admin', username: 'admin', role: 'admin', displayName: 'OneJarc Administrator' };
  function memory() {
    const values = new Map();
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  }
  const definition = () => ({ ...model.newToolDefinition(), name: 'Our company tool', slug: 'our-company-tool', description: 'Process equipment reservations.', category: 'Our category', owner: 'Our team', applicationUrl: 'https://example.com/tool', keywords: ['equipment reservation'], tasks: ['reserve equipment'] });
  await test('fresh install has no seeded tools, categories or employee results', async () => {
    assert.deepEqual(tools, []);
    const catalog = await createLocalCatalogRepository(memory()).read();
    assert.deepEqual(catalog.entries, []);
    assert.deepEqual(catalog.categories, []);
    assert.deepEqual(model.publishedTools(catalog), []);
    assert.deepEqual(searchToolCatalog([], 'reserve equipment').results, []);
  });
  await test('old demo catalogs are neither loaded nor deleted by the empty edition', async () => {
    assert.equal(CATALOG_KEY, 'onejarc-tool-catalog-github-empty-v1');
    const storage = memory();
    storage.setItem('onejarc-tool-catalog-v1', 'old data kept');
    assert.deepEqual((await createLocalCatalogRepository(storage).read()).entries, []);
    assert.equal(storage.getItem('onejarc-tool-catalog-v1'), 'old data kept');
  });
  await test('admin can create category and first tool, save privately, publish, search and reopen', async () => {
    const storage = memory();
    const repository = createLocalCatalogRepository(storage);
    let catalog = await executeCatalogCommand(repository, admin, { type: 'category-add', name: 'Our category' }, 0);
    catalog = await executeCatalogCommand(repository, admin, { type: 'save', definition: definition(), apiConnection: blankApiConnection(), publish: false }, catalog.revision);
    const id = catalog.entries[0].id;
    assert.equal(model.publishedTools(catalog).length, 0);
    catalog = await executeCatalogCommand(repository, admin, { type: 'publish', id }, catalog.revision);
    assert.equal(model.publishedTools(catalog).length, 1);
    assert.equal(searchToolCatalog(model.publishedTools(catalog), 'reserve equipment').results[0].tool.id, id);
    const reopened = await createLocalCatalogRepository(storage).read();
    assert.deepEqual(reopened, catalog);
    assert.equal(reopened.entries[0].apiConnection.baseUrl, '');
    assert.equal(reopened.entries[0].apiConnection.configured, false);
    assert.ok(!Object.hasOwn(model.publishedTools(catalog)[0], 'apiConnection'));
    catalog = await executeCatalogCommand(repository, admin, { type: 'save', id, definition: { ...definition(), name: 'Edited draft' }, publish: false }, catalog.revision);
    assert.equal(model.publishedTools(catalog)[0].name, 'Our company tool');
    await assert.rejects(executeCatalogCommand(repository, admin, { type: 'archive', id }, 0), /catalog changed/);
    catalog = await executeCatalogCommand(repository, admin, { type: 'archive', id }, catalog.revision);
    assert.equal(catalog.entries.length, 1);
    assert.equal(model.publishedTools(catalog).length, 0);
  });
  await test('employee cannot populate catalog or bypass required publish fields', async () => {
    const repository = createLocalCatalogRepository(memory());
    await assert.rejects(executeCatalogCommand(repository, { ...admin, role: 'user' }, { type: 'category-add', name: 'Our category' }, 0), /Access denied/);
    await assert.rejects(executeCatalogCommand(repository, admin, { type: 'save', definition: { ...definition(), applicationUrl: 'javascript:alert(1)' }, publish: true }, 0), /highlighted fields/);
    assert.equal((await repository.read()).revision, 0);
  });
  await test('demo login and roles still work without any preinstalled tools', async () => {
    const service = auth.createPrototypeAuthService(auth.createSessionStore(memory()));
    assert.equal((await service.signIn('admin', '123')).role, 'admin');
    assert.equal((await service.signIn('medtek', '123')).role, 'user');
    await assert.rejects(service.signIn('admin', 'wrong'), /Incorrect/);
  });
  await test('connection setup stays blank and refuses secret properties', () => {
    assert.deepEqual(validateApiConnection(blankApiConnection()), {});
    assert.ok(validateApiConnection({ ...blankApiConnection(), apiKey: 'example' }).apiConnection);
    assert.ok(validateApiConnection({ ...blankApiConnection(), configured: true, baseUrl: 'https://example.com?token=example' })['apiConnection.baseUrl']);
  });
  await test('empty workspace offers setup guidance without sample activity or notices', async () => {
    const source = await readFile(new URL('../src/controllers/hub-controller.tsx', import.meta.url), 'utf8');
    assert.match(source, /const notifications: [^;]*(?:;[^;]*)*?\[\] = \[\];/);
    assert.match(source, /favorites: \[\]/);
    assert.match(source, /recent: \[\]/);
    assert.match(source, /No tools available yet/);
    assert.match(source, /Create your first category/);
    assert.match(source, /No notifications yet/);
    assert.doesNotMatch(source, /title: 'Service Center maintenance'|title: 'Connect file uploads are degraded'|title: 'Finance Suite issue resolved'/);
  });
} finally {
  await server.close();
}
