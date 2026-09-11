/** OneJarc frontend snapshot from company-tool-hub/lib/tool-catalog.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** EMPTY GITHUB CATALOG: no tools are preinstalled. Administrators add
 * categories and tools through the UI. This is a first-run default, not a reset. */
/**
 * Prototype tool catalog and shared frontend data contract.
 * Backend integration: replace these sample records with authenticated catalog
 * data, map stable icon identifiers to local components, and keep tool IDs stable
 * so existing favorites and requests continue to resolve. No launch URLs or
 * credentials are invented here; all workspaces are still frontend previews.
 */
import type { LucideIcon } from 'lucide-react';


export type ToolStatus =
  | 'Operational'
  | 'Maintenance'
  | 'Degraded'
  | 'Outage'
  | 'Coming Soon';
/** Catalog presentation, search metadata, and sample access/status fields. */
export type Tool = {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  tasks: string[];
  keywords: string[];
  category: string;
  icon: LucideIcon;
  color: string;
  status: ToolStatus;
  statusNote?: string;
  owner: string;
  access: 'Available' | 'Request access' | 'Restricted' | 'Coming Soon';
  reason: string;
  // Optional presentation metadata keeps the seed contract compatible. The
  // catalog repository supplies these fields to every runtime employee view.
  applicationUrl?: string;
  documentationUrl?: string;
  supportUrl?: string;
  statusUrl?: string;
  openBehavior?: 'new-tab' | 'same-tab';
  accessType?: string;
  subtitle?: string;
  team?: string;
  lifecycle?: string;
  supportContact?: string;
  featured?: boolean;
  quickActions?: { label: string; type: 'url' | 'task'; target: string }[];
};

/** Migration seed ONLY. Runtime consumers use useToolCatalog(), never this array.
 * Kept readable for existing regression tests and deterministic first-run setup. */
export const tools: Tool[] = [];
