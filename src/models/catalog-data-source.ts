/** OneJarc frontend snapshot from company-tool-hub/lib/catalog-data-source.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** UI-facing command repository. API mode sends intent to authorized endpoints;
 * it NEVER uploads a client-mutated catalog snapshot or silently falls back local. */
import type { AuthUser } from './auth-service';
import { ApiError, type ApiClient } from './api-client';
import {
  createToolCatalogApiService,
  employeeProjection,
} from './catalog-api-service';
import { createLocalCatalogRepository } from './catalog-repository';
import { executeCatalogCommand, type CatalogCommand } from './catalog-service';
import { publishedTools, slugify, type CatalogSnapshot } from './catalog-model';
import { requirePermission, can } from './permissions';
export type CatalogView = {
  snapshot: CatalogSnapshot;
  tools: ReturnType<typeof publishedTools>;
};
export interface CatalogDataSource {
  read(): Promise<CatalogView>;
  execute(
    command: CatalogCommand,
    revision: number,
    idempotencyKey: string,
  ): Promise<CatalogView>;
}
export function createLocalCatalogDataSource(
  storage: () => Storage,
  actor: AuthUser,
): CatalogDataSource {
  const repository = () => createLocalCatalogRepository(storage());
  const view = (snapshot: CatalogSnapshot): CatalogView => ({
    snapshot,
    tools: publishedTools(snapshot),
  });
  return {
    async read() {
      return view(await repository().read());
    },
    async execute(command, revision) {
      return view(
        await executeCatalogCommand(repository(), actor, command, revision),
      );
    },
  };
}
export function createApiCatalogDataSource(
  client: ApiClient,
  actor: AuthUser,
): CatalogDataSource {
  const api = createToolCatalogApiService(client);
  let current: CatalogSnapshot | null = null;
  let sequence = 0;
  return {
    async read() {
      const requestSequence = ++sequence;
      if (can(actor, 'canManageToolCatalog')) {
        const loaded = await api.getAdminCatalog();
        if (requestSequence === sequence) current = loaded;
        return { snapshot: loaded, tools: publishedTools(loaded) };
      }
      requirePermission(actor, 'canViewTools');
      const catalog = await api.getTools();
      return {
        snapshot: {
          version: 1,
          revision: catalog.revision,
          categories: catalog.categories,
          entries: [],
        },
        tools: employeeProjection(catalog),
      };
    },
    async execute(command, revision, idempotencyKey) {
      sequence++;
      requirePermission(actor, 'canManageToolCatalog');
      if (!current || current.revision !== revision)
        throw new ApiError('CONFLICT', 409);
      const options = { revision, idempotencyKey };
      let response;
      if (command.type === 'save') {
        requirePermission(actor, command.id ? 'canEditTool' : 'canCreateTool');
        if (command.publish) requirePermission(actor, 'canPublishTool');
        const definition = {
          ...command.definition,
          slug: command.definition.slug || slugify(command.definition.name),
        };
        const input = {
          definition,
          publish: command.publish,
          apiConnection: command.apiConnection,
        };
        response = command.id
          ? await api.updateTool(command.id, input, current.categories, options)
          : await api.createTool(input, current.categories, options);
      } else if ('name' in command) {
        requirePermission(actor, 'canManageCategories');
        if (!command.name.trim() || command.name.length > 80)
          throw new ApiError('VALIDATION_ERROR', 400);
        response =
          command.type === 'category-add'
            ? await api.createCategory(command.name.trim(), options)
            : command.type === 'category-rename'
              ? await api.renameCategory(
                  command.name.trim(),
                  command.previous,
                  options,
                )
              : await api.removeCategory(command.name, options);
      } else {
        const entry = current.entries.find((item) => item.id === command.id);
        if (!entry) throw new ApiError('NOT_FOUND', 404);
        if (command.type === 'toggle-enabled') {
          requirePermission(actor, 'canEnableTool');
          response = await api.setEnabled(command.id, !entry.enabled, options);
        } else {
          requirePermission(
            actor,
            command.type === 'duplicate'
              ? 'canDuplicateTool'
              : ['archive', 'restore'].includes(command.type)
                ? 'canArchiveTool'
                : 'canPublishTool',
          );
          const action = {
            duplicate: api.duplicateTool,
            archive: api.archiveTool,
            restore: api.restoreTool,
            publish: api.publishTool,
            unpublish: api.unpublishTool,
          }[command.type];
          response = await action(command.id, options);
        }
      }
      // The committed server response replaces the brief in-memory cache. Reads
      // on focus/Reload refetch; no stale mutation is replayed automatically.
      current = response.catalog;
      return { snapshot: current, tools: publishedTools(current) };
    },
  };
}
