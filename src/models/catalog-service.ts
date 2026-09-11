/** OneJarc frontend snapshot from company-tool-hub/lib/catalog-service.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** Catalog commands enforce policy, validate data, and commit once. UI visibility
 * is only one guard; calling a command as an employee also fails here. */
import type { AuthUser } from './auth-service';
import {
  validateApiConnection,
  type ApiConnection,
} from './catalog-connection';
import { requirePermission } from './permissions';
import {
  slugify,
  validateDefinition,
  type CatalogSnapshot,
  type ToolDefinition,
} from './catalog-model';
import type { ToolCatalogRepository } from './catalog-repository';
export type CatalogCommand =
  | {
      type: 'save';
      id?: string;
      definition: ToolDefinition;
      publish: boolean;
      apiConnection?: ApiConnection;
    }
  | {
      type:
        | 'duplicate'
        | 'archive'
        | 'restore'
        | 'publish'
        | 'unpublish'
        | 'toggle-enabled';
      id: string;
    }
  | { type: 'category-add'; name: string }
  | { type: 'category-rename'; name: string; previous: string }
  | { type: 'category-remove'; name: string };
export class CatalogValidationError extends Error {
  fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super('Review the highlighted fields before saving.');
    this.fields = fields;
  }
}
/** Stateless asynchronous service works with either prototype storage or an API.
 * Production must NOT trust this browser-supplied actor or audit metadata. */
export async function executeCatalogCommand(
  repository: ToolCatalogRepository,
  actor: AuthUser | null,
  command: CatalogCommand,
  expectedRevision: number,
): Promise<CatalogSnapshot> {
  requirePermission(actor, 'canManageToolCatalog');
  const current = await repository.read();
  if (current.revision !== expectedRevision)
    throw new Error(
      'The catalog changed. Reload it and reopen the editor before saving.',
    );
  const next = structuredClone(current);
  const now = new Date().toISOString();
  const stamp = { updatedAt: now, updatedBy: actor!.id };
  if (command.type.startsWith('category-')) {
    requirePermission(actor, 'canManageCategories');
    if (!('name' in command)) throw new Error('Missing category name.');
    const name = command.name.trim();
    if (!name || name.length > 80)
      throw new Error('Enter a category name up to 80 characters.');
    if (command.type === 'category-remove') {
      if (
        next.entries.some(
          (entry) =>
            entry.draft.category === name || entry.published?.category === name,
        )
      )
        throw new Error(
          'This category is still used by a tool or draft. Reassign those tools first.',
        );
      next.categories = next.categories.filter((item) => item !== name);
    } else {
      if (
        next.categories.some(
          (item) =>
            item.toLowerCase() === name.toLowerCase() &&
            (command.type !== 'category-rename' || item !== command.previous),
        )
      )
        throw new Error('A category with this name already exists.');
      if (command.type === 'category-add') next.categories.push(name);
      if (command.type === 'category-rename') {
        if (!next.categories.includes(command.previous))
          throw new Error('Category no longer exists.');
        next.categories = next.categories.map((item) =>
          item === command.previous ? name : item,
        );
        for (const entry of next.entries) {
          if (
            entry.draft.category === command.previous ||
            entry.published?.category === command.previous
          )
            Object.assign(entry, stamp);
          if (entry.draft.category === command.previous)
            entry.draft.category = name;
          if (entry.published?.category === command.previous)
            entry.published.category = name;
        }
      }
      next.categories.sort();
    }
  } else if (command.type === 'save') {
    requirePermission(actor, command.id ? 'canEditTool' : 'canCreateTool');
    if (command.publish) requirePermission(actor, 'canPublishTool');
    const definition = structuredClone(command.definition);
    definition.name = definition.name.trim();
    definition.slug ||= slugify(definition.name);
    const errors = validateDefinition(
      definition,
      next.categories,
      command.publish,
    );
    // A saved setup is still disconnected; no credentials or requests are allowed.
    if (command.apiConnection !== undefined)
      Object.assign(errors, validateApiConnection(command.apiConnection));
    if (
      next.entries.some(
        (entry) =>
          entry.id !== command.id &&
          [entry.draft.slug, entry.published?.slug].includes(definition.slug),
      )
    )
      errors.slug = 'Another tool already uses this slug.';
    if (Object.keys(errors).length) throw new CatalogValidationError(errors);
    const existing = next.entries.find((entry) => entry.id === command.id);
    if (command.id && (!existing || existing.archived))
      throw new Error('Restore this tool before editing it.');
    // Existing sample workspaces may keep preview mode. Newly created records
    // cannot use that migration exception to bypass the application URL rule.
    if (definition.demoPreview && !existing?.draft.demoPreview)
      throw new Error('New tools need a real application URL to publish.');
    if (existing) {
      existing.draft = definition;
      if (command.apiConnection !== undefined)
        existing.apiConnection = structuredClone(command.apiConnection);
      if (command.publish) existing.published = structuredClone(definition);
      Object.assign(existing, stamp);
    } else
      next.entries.push({
        id: crypto.randomUUID(),
        draft: definition,
        ...(command.apiConnection === undefined
          ? {}
          : { apiConnection: structuredClone(command.apiConnection) }),
        published: command.publish ? structuredClone(definition) : null,
        enabled: true,
        archived: false,
        createdAt: now,
        createdBy: actor!.id,
        ...stamp,
      });
  } else if ('id' in command) {
    const entry = next.entries.find((item) => item.id === command.id);
    if (!entry) throw new Error('This tool no longer exists.');
    const permission =
      command.type === 'duplicate'
        ? 'canDuplicateTool'
        : ['archive', 'restore'].includes(command.type)
          ? 'canArchiveTool'
          : command.type === 'toggle-enabled'
            ? 'canEnableTool'
            : 'canPublishTool';
    requirePermission(actor, permission);
    if (entry.archived && !['restore', 'duplicate'].includes(command.type))
      throw new Error('Restore this tool first.');
    if (command.type === 'duplicate') {
      requirePermission(actor, 'canCreateTool');
      let slug = `${entry.draft.slug}-copy`;
      let suffix = 2;
      while (
        next.entries.some(
          (item) => item.draft.slug === slug || item.published?.slug === slug,
        )
      )
        slug = `${entry.draft.slug}-copy-${suffix++}`;
      const draft = {
        ...structuredClone(entry.draft),
        name: `${entry.draft.name.slice(0, 110)} copy`,
        slug,
        demoPreview: false,
        lifecycle: 'Active' as const,
      };
      next.entries.push({
        id: crypto.randomUUID(),
        draft,
        published: null,
        enabled: true,
        archived: false,
        createdAt: now,
        createdBy: actor!.id,
        ...stamp,
      });
    } else {
      if (command.type === 'publish') {
        const errors = validateDefinition(entry.draft, next.categories, true);
        if (Object.keys(errors).length)
          throw new CatalogValidationError(errors);
        entry.published = structuredClone(entry.draft);
      }
      if (command.type === 'unpublish') entry.published = null;
      if (command.type === 'archive') {
        entry.archived = true;
        entry.published = null;
        entry.draft.lifecycle = 'Archived';
      }
      if (command.type === 'restore') {
        entry.archived = false;
        entry.draft.lifecycle = 'Active';
      }
      if (command.type === 'toggle-enabled') entry.enabled = !entry.enabled;
      Object.assign(entry, stamp);
    }
  }
  next.revision += 1;
  await repository.write(next, expectedRevision);
  return next;
}
