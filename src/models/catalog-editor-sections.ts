/** OneJarc frontend snapshot from company-tool-hub/lib/catalog-editor-sections.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** One section map drives tab labels and validation jumps. Keep field ownership
 * here in sync when adding controls; hidden errors must remain discoverable. */
export const EDITOR_SECTIONS = [
  { id: 'details', label: 'Details' },
  { id: 'access', label: 'Access & status' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'connections', label: 'Connections' },
] as const;
export type EditorSection = (typeof EDITOR_SECTIONS)[number]['id'];

export function sectionForField(key: string): EditorSection {
  if (
    key.startsWith('apiConnection') ||
    ['documentationUrl', 'supportUrl', 'statusUrl'].includes(key)
  )
    return 'connections';
  if (
    [
      'accessType',
      'status',
      'statusNote',
      'lifecycle',
      'metadata',
      'team',
      'supportContact',
      'featured',
    ].includes(key)
  )
    return 'access';
  if (['keywords', 'aliases', 'tags', 'tasks', 'quickActions'].includes(key))
    return 'discovery';
  return 'details';
}
