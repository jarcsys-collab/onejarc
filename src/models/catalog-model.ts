/** OneJarc frontend snapshot from company-tool-hub/lib/catalog-model.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** Serializable catalog contract. Icon keys resolve through an approved local
 * registry, never executable strings. Ownership describes responsibility only. */
import {
  LayoutDashboard,
  Users,
  Wrench,
  FileText,
  MessageSquareText,
  ShieldCheck,
  WalletCards,
  Palette,
  BarChart3,
  ShoppingCart,
  Globe,
  BriefcaseBusiness,
} from 'lucide-react';
import { tools as seeds, type Tool, type ToolStatus } from './tool-catalog';
import {
  validateApiConnection,
  type ApiConnection,
} from './catalog-connection';

export const ICONS = {
  dashboard: LayoutDashboard,
  people: Users,
  support: Wrench,
  documents: FileText,
  chat: MessageSquareText,
  security: ShieldCheck,
  finance: WalletCards,
  creative: Palette,
  analytics: BarChart3,
  purchasing: ShoppingCart,
  globe: Globe,
  business: BriefcaseBusiness,
};
export const ACCENTS = [
  '#7c6df2',
  '#ef6b93',
  '#29b7aa',
  '#df9643',
  '#579ee9',
  '#55bf87',
  '#42a8a0',
  '#b56be8',
  '#e17958',
  '#5778d9',
];
export const STATUSES = [
  'Operational',
  'Degraded',
  'Maintenance',
  'Outage',
  'Coming Soon',
] as const;
export const ACCESS_TYPES = [
  'Open',
  'Request Access',
  'Approval Required',
  'Restricted',
  'Coming Soon',
] as const;
export const LIFECYCLES = [
  'Experimental',
  'Active',
  'Deprecated',
  'Archived',
] as const;
export type ToolDefinition = {
  slug: string;
  name: string;
  description: string;
  category: string;
  subtitle: string;
  iconKey: keyof typeof ICONS;
  color: string;
  applicationUrl: string;
  openBehavior: 'new-tab' | 'same-tab';
  documentationUrl: string;
  supportUrl: string;
  statusUrl: string;
  accessType: (typeof ACCESS_TYPES)[number];
  owner: string;
  team: string;
  supportContact: string;
  status: ToolStatus;
  statusNote: string;
  lifecycle: (typeof LIFECYCLES)[number];
  keywords: string[];
  aliases: string[];
  tags: string[];
  tasks: string[];
  quickActions: { label: string; type: 'url' | 'task'; target: string }[];
  featured: boolean;
  demoPreview: boolean;
};
export type CatalogEntry = {
  id: string;
  // Admin-only setup is deliberately outside published employee definitions.
  // Optional for backwards compatibility with existing browser catalogs.
  apiConnection?: ApiConnection;
  draft: ToolDefinition;
  published: ToolDefinition | null;
  enabled: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  // Optional server-owned audit fields; old local records remain compatible.
  publishedBy?: string;
  publishedAt?: string;
  archivedBy?: string;
  archivedAt?: string;
};
export type CatalogSnapshot = {
  version: 1;
  revision: number;
  entries: CatalogEntry[];
  categories: string[];
};
export type CatalogErrors = Record<string, string>;

/** All new tools begin as unpublished drafts with no invented URL or owner. */
export function newToolDefinition(): ToolDefinition {
  return {
    slug: '',
    name: '',
    description: '',
    category: '',
    subtitle: '',
    iconKey: 'globe',
    color: ACCENTS[0],
    applicationUrl: '',
    openBehavior: 'new-tab',
    documentationUrl: '',
    supportUrl: '',
    statusUrl: '',
    accessType: 'Open',
    owner: '',
    team: '',
    supportContact: '',
    status: 'Operational',
    statusNote: '',
    lifecycle: 'Active',
    keywords: [],
    aliases: [],
    tags: [],
    tasks: [],
    quickActions: [],
    featured: false,
    demoPreview: false,
  };
}
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
/** Navigation-only URLs. Reject scripts, credentials, protocol-relative URLs and
 * arbitrary schemes; localhost HTTP is the sole test-development exception. */
export function isSafeToolUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}
/** Drafts may be incomplete; publishing requires the complete employee contract.
 * Both paths reject unsafe populated values instead of postponing validation. */
export function validateDefinition(
  value: ToolDefinition,
  categories: string[],
  publish: boolean,
): CatalogErrors {
  const errors: CatalogErrors = {};
  if (!value.name.trim()) errors.name = 'Enter a tool name.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug))
    errors.slug = 'Use lowercase words separated by hyphens.';
  if (publish && !value.description.trim())
    errors.description = 'Add a short description before publishing.';
  if ((publish || value.category) && !categories.includes(value.category))
    errors.category = 'Choose a catalog category.';
  if (publish && !value.owner.trim())
    errors.owner = 'Assign an owner before publishing.';
  if (publish && !value.demoPreview && !value.applicationUrl.trim())
    errors.applicationUrl = 'Enter the application URL before publishing.';
  if (!Object.hasOwn(ICONS, value.iconKey))
    errors.iconKey = 'Choose an approved icon.';
  if (!ACCENTS.includes(value.color))
    errors.color = 'Choose an approved accent.';
  if (
    !STATUSES.includes(value.status) ||
    !ACCESS_TYPES.includes(value.accessType) ||
    !LIFECYCLES.includes(value.lifecycle)
  )
    errors.metadata = 'Choose valid status, access and lifecycle values.';
  if (!['new-tab', 'same-tab'].includes(value.openBehavior))
    errors.openBehavior = 'Choose a supported open behavior.';
  if (publish && value.lifecycle === 'Archived')
    errors.lifecycle =
      'Archived tools cannot be published. Select an active lifecycle.';
  for (const key of [
    'applicationUrl',
    'documentationUrl',
    'supportUrl',
    'statusUrl',
  ] as const)
    if (value[key] && !isSafeToolUrl(value[key]))
      errors[key] = 'Use a full HTTPS URL without embedded credentials.';
  for (const key of [
    'name',
    'slug',
    'description',
    'subtitle',
    'owner',
    'team',
    'supportContact',
    'statusNote',
  ] as const)
    if (
      value[key].length >
      (key === 'description' || key === 'statusNote' ? 500 : 120)
    )
      errors[key] = 'This value is too long.';
  for (const key of ['keywords', 'aliases', 'tags', 'tasks'] as const)
    if (
      value[key].length > 30 ||
      value[key].some((item) => !item.trim() || item.length > 120)
    )
      errors[key] = 'Use at most 30 nonempty items, up to 120 characters each.';
  if (
    value.quickActions.length > 12 ||
    value.quickActions.some(
      (action) =>
        !action.label.trim() ||
        action.label.length > 120 ||
        !['url', 'task'].includes(action.type) ||
        !action.target.trim() ||
        (action.type === 'url' && !isSafeToolUrl(action.target)),
    )
  )
    errors.quickActions =
      'Each quick action needs a label and a valid HTTPS URL or task target (maximum 12).';
  if (
    new Set(value.quickActions.map((action) => action.label.toLowerCase()))
      .size !== value.quickActions.length
  )
    errors.quickActions = 'Quick action labels must be unique.';
  return errors;
}

/** Seeds retain stable IDs and demo workspaces. No fake external URLs are added. */
export function createSeedCatalog(): CatalogSnapshot {
  const now = '2026-09-09T00:00:00.000Z';
  return {
    version: 1,
    revision: 0,
    categories: [...new Set(seeds.map((tool) => tool.category))].sort(),
    entries: seeds.map((tool) => {
      const iconKey = (Object.entries(ICONS).find(
        ([, icon]) => icon === tool.icon,
      )?.[0] ?? 'globe') as keyof typeof ICONS;
      const draft: ToolDefinition = {
        ...newToolDefinition(),
        slug: tool.id,
        name: tool.name,
        description: tool.description,
        category: tool.category,
        iconKey,
        color: tool.color,
        accessType: tool.access === 'Available' ? 'Open' : 'Approval Required',
        owner: tool.owner,
        team: tool.owner,
        status: tool.status,
        statusNote: tool.statusNote ?? '',
        keywords: tool.keywords,
        aliases: tool.aliases,
        tasks: tool.tasks,
        demoPreview: true,
        quickActions: tool.tasks.map((task) => ({
          label: task,
          type: 'task',
          target: task,
        })),
      };
      return {
        id: tool.id,
        draft,
        published: structuredClone(draft),
        enabled: true,
        archived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: 'prototype-seed',
        updatedBy: 'prototype-seed',
      };
    }),
  };
}
/** One projection feeds every employee surface, including search and quick actions. */
export function toEmployeeTool(id: string, value: ToolDefinition): Tool {
  return {
    ...value,
    id,
    icon: ICONS[value.iconKey],
    access:
      value.accessType === 'Open'
        ? 'Available'
        : ['Restricted', 'Coming Soon'].includes(value.accessType)
          ? (value.accessType as 'Restricted' | 'Coming Soon')
          : 'Request access',
    reason: `Matches ${value.name}'s published tasks and discovery metadata.`,
    keywords: [...value.keywords, ...value.tags],
    tasks: [
      ...new Set([
        ...value.quickActions.map((action) => action.label),
        ...value.tasks,
      ]),
    ],
    applicationUrl: value.applicationUrl || undefined,
  };
}
export function publishedTools(snapshot: CatalogSnapshot): Tool[] {
  return snapshot.entries
    .filter((entry) => entry.published && entry.enabled && !entry.archived)
    .map((entry) => toEmployeeTool(entry.id, entry.published!));
}

/** Storage is untrusted input, even in the demo. Reject a malformed snapshot as
 * a whole and preserve its raw value for recovery instead of silently seeding. */
export function parseCatalog(raw: string): CatalogSnapshot {
  const value = JSON.parse(raw);
  if (
    !value ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !Array.isArray(value.categories) ||
    value.categories.length > 100 ||
    value.categories.some(
      (name: unknown) =>
        typeof name !== 'string' || !name.trim() || name.length > 80,
    ) ||
    !Array.isArray(value.entries) ||
    value.entries.length > 1000
  )
    throw new Error('Invalid catalog format.');
  if (
    new Set(value.categories.map((name: string) => name.toLowerCase())).size !==
    value.categories.length
  )
    throw new Error('Duplicate categories.');
  const ids = new Set<string>();
  for (const entry of value.entries) {
    if (
      !entry ||
      typeof entry.id !== 'string' ||
      !entry.id ||
      ids.has(entry.id) ||
      typeof entry.enabled !== 'boolean' ||
      typeof entry.archived !== 'boolean'
    )
      throw new Error('Invalid catalog record.');
    ids.add(entry.id);
    if (
      entry.apiConnection !== undefined &&
      Object.keys(validateApiConnection(entry.apiConnection)).length
    )
      throw new Error('Invalid API setup. Stored data was preserved.');
    for (const field of ['createdAt', 'updatedAt', 'createdBy', 'updatedBy'])
      if (typeof entry[field] !== 'string')
        throw new Error('Invalid catalog audit metadata.');
    for (const field of [
      'publishedBy',
      'publishedAt',
      'archivedBy',
      'archivedAt',
    ])
      if (
        entry[field] !== undefined &&
        (typeof entry[field] !== 'string' || entry[field].length > 256)
      )
        throw new Error('Invalid optional audit metadata.');
    for (const definition of [
      entry.draft,
      ...(entry.published === null ? [] : [entry.published]),
    ]) {
      if (!definition || typeof definition !== 'object')
        throw new Error('Invalid tool definition.');
      const template = newToolDefinition();
      for (const [field, fallback] of Object.entries(template)) {
        if (Array.isArray(fallback)) {
          if (!Array.isArray(definition[field]))
            throw new Error('Invalid discovery metadata.');
          if (field === 'quickActions') {
            if (
              definition[field].some(
                (a: unknown) =>
                  !a ||
                  typeof a !== 'object' ||
                  ['label', 'type', 'target'].some(
                    (key) =>
                      typeof (a as Record<string, unknown>)[key] !== 'string',
                  ),
              )
            )
              throw new Error('Invalid quick action.');
          } else if (
            definition[field].some((item: unknown) => typeof item !== 'string')
          )
            throw new Error('Invalid discovery item.');
        } else if (typeof definition[field] !== typeof fallback)
          throw new Error('Invalid tool field.');
      }
      if (
        Object.keys(
          validateDefinition(
            definition,
            value.categories,
            definition === entry.published,
          ),
        ).length
      )
        throw new Error('Catalog contains invalid tool data.');
    }
  }
  return value as CatalogSnapshot;
}
