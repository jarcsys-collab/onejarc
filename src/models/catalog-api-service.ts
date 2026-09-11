/** OneJarc frontend snapshot from company-tool-hub/lib/catalog-api-service.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** OneJarc's public API contract, not n8n's management API. A gateway can map
 * these paths onto workflows without changing components. Audits stay server-owned. */
import { ApiError, type ApiClient, type ApiRequestOptions } from './api-client';
import { isAllowedLaunchUrl } from './backend-config';
import {
  newToolDefinition,
  parseCatalog,
  toEmployeeTool,
  validateDefinition,
  type CatalogSnapshot,
  type ToolDefinition,
  type CatalogEntry,
} from './catalog-model';
import { validateApiConnection } from './catalog-connection';
import { type CatalogCommand, CatalogValidationError } from './catalog-service';
export type CatalogWrite = Pick<
  Extract<CatalogCommand, { type: 'save' }>,
  'definition' | 'publish' | 'apiConnection'
>;
export type EmployeeCatalog = {
  revision: number;
  categories: string[];
  tools: { id: string; definition: ToolDefinition }[];
};
export type CatalogMutation = { catalog: CatalogSnapshot };
export type BackendAudit = {
  publishedBy?: string;
  publishedAt?: string;
  archivedBy?: string;
  archivedAt?: string;
};
export type AuditedCatalogEntry = CatalogEntry & BackendAudit;
export function pathId(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new ApiError('INVALID_REQUEST');
  return encodeURIComponent(id);
}
export function parseAdminCatalog(value: unknown): CatalogSnapshot {
  return parseCatalog(JSON.stringify(value));
}
/** Employees receive only published, enabled definitions, never drafts or API setup. */
export function parseEmployeeCatalog(value: unknown): EmployeeCatalog {
  const record = value as EmployeeCatalog;
  if (
    !record ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    !Array.isArray(record.categories) ||
    record.categories.length > 100 ||
    record.categories.some(
      (c) => typeof c !== 'string' || !c.trim() || c.length > 80,
    ) ||
    !Array.isArray(record.tools) ||
    record.tools.length > 1000
  )
    throw new Error('Invalid employee catalog');
  const ids = new Set<string>();
  const template = newToolDefinition();
  const tools = record.tools.map((item) => {
    pathId(item.id);
    if (ids.has(item.id)) throw new Error('Duplicate tool');
    ids.add(item.id);
    // Reuse the full shape validator before dropping unknown properties.
    const check = parseAdminCatalog({
      version: 1,
      revision: 0,
      categories: record.categories,
      entries: [
        {
          id: item.id,
          draft: item.definition,
          published: item.definition,
          enabled: true,
          archived: false,
          createdAt: '',
          updatedAt: '',
          createdBy: '',
          updatedBy: '',
        },
      ],
    });
    const definition = Object.fromEntries(
      Object.keys(template).map((key) => [
        key,
        check.entries[0].published![key as keyof ToolDefinition],
      ]),
    ) as ToolDefinition;
    return { id: item.id, definition };
  });
  return {
    revision: record.revision,
    categories: [...record.categories],
    tools,
  };
}
export function employeeProjection(catalog: EmployeeCatalog) {
  return catalog.tools.map((item) => toEmployeeTool(item.id, item.definition));
}

export function createToolCatalogApiService(client: ApiClient) {
  const mutation = (value: unknown): CatalogMutation => ({
    catalog: parseAdminCatalog((value as CatalogMutation)?.catalog),
  });
  /** Preserve existing metadata validation; the backend MUST independently repeat it. */
  function validateWrite(input: CatalogWrite, categories: string[]) {
    const errors = validateDefinition(
      input.definition,
      categories,
      input.publish,
    );
    if (input.apiConnection !== undefined)
      Object.assign(errors, validateApiConnection(input.apiConnection));
    for (const key of [
      'applicationUrl',
      'documentationUrl',
      'supportUrl',
      'statusUrl',
    ] as const)
      if (
        input.definition[key] &&
        !isAllowedLaunchUrl(input.definition[key], client.environment)
      )
        errors[key] = 'Use HTTPS in staging and production.';
    if (
      input.definition.quickActions.some(
        (action) =>
          action.type === 'url' &&
          !isAllowedLaunchUrl(action.target, client.environment),
      )
    )
      errors.quickActions =
        'Quick action URLs must use HTTPS in staging and production.';
    if (Object.keys(errors).length) throw new CatalogValidationError(errors);
    // Explicit writable allowlist: never submit roles, snapshots or audit actors.
    return {
      definition: Object.fromEntries(
        Object.keys(newToolDefinition()).map((key) => [
          key,
          input.definition[key as keyof ToolDefinition],
        ]),
      ),
      publish: input.publish,
      ...(input.apiConnection === undefined
        ? {}
        : { apiConnection: input.apiConnection }),
    };
  }
  return {
    getTools: (options?: ApiRequestOptions) =>
      client.get('/tools', options, parseEmployeeCatalog),
    getTool: (id: string, options?: ApiRequestOptions) =>
      client.get('/tools/' + pathId(id), options, (value) => {
        const result = parseEmployeeCatalog(value);
        if (result.tools.length !== 1 || result.tools[0].id !== id)
          throw new Error('Invalid tool response');
        return result.tools[0];
      }),
    getAdminCatalog: (options?: ApiRequestOptions) =>
      client.get('/admin/catalog', options, parseAdminCatalog),
    createTool: (
      input: CatalogWrite,
      categories: string[],
      options?: ApiRequestOptions,
    ) =>
      client.post(
        '/tools',
        validateWrite(input, categories),
        options,
        mutation,
      ),
    updateTool: (
      id: string,
      input: CatalogWrite,
      categories: string[],
      options?: ApiRequestOptions,
    ) =>
      client.patch(
        '/tools/' + pathId(id),
        validateWrite(input, categories),
        options,
        mutation,
      ),
    archiveTool: (id: string, options?: ApiRequestOptions) =>
      client.post('/tools/' + pathId(id) + '/archive', {}, options, mutation),
    publishTool: (id: string, options?: ApiRequestOptions) =>
      client.post('/tools/' + pathId(id) + '/publish', {}, options, mutation),
    unpublishTool: (id: string, options?: ApiRequestOptions) =>
      client.post('/tools/' + pathId(id) + '/unpublish', {}, options, mutation),
    restoreTool: (id: string, options?: ApiRequestOptions) =>
      client.post('/tools/' + pathId(id) + '/restore', {}, options, mutation),
    duplicateTool: (id: string, options?: ApiRequestOptions) =>
      client.post('/tools/' + pathId(id) + '/duplicate', {}, options, mutation),
    setEnabled: (id: string, enabled: boolean, options?: ApiRequestOptions) =>
      client.patch(
        '/tools/' + pathId(id) + '/enabled',
        { enabled },
        options,
        mutation,
      ),
    getCategories: (options?: ApiRequestOptions) =>
      client.get('/categories', options, (value) => {
        if (
          !Array.isArray(value) ||
          value.some(
            (name) =>
              typeof name !== 'string' || !name.trim() || name.length > 80,
          )
        )
          throw new Error('Invalid categories');
        return value as string[];
      }),
    createCategory: (name: string, options?: ApiRequestOptions) =>
      client.post('/categories', { name }, options, mutation),
    renameCategory: (
      name: string,
      previous: string,
      options?: ApiRequestOptions,
    ) => client.patch('/categories', { name, previous }, options, mutation),
    removeCategory: (name: string, options?: ApiRequestOptions) =>
      client.request('DELETE', '/categories', { name }, options, mutation),
  };
}
