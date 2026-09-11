/** OneJarc frontend snapshot from company-tool-hub/lib/tool-actions.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/**
 * Shared routing rules for card, search, and workspace task buttons.
 * These frontend checks explain the prototype flow; production authorization
 * must also be enforced by the destination service. No external calls are made.
 */
type ActionTool = {
  id: string;
  tasks: string[];
  access: 'Available' | 'Request access' | 'Restricted' | 'Coming Soon';
  status: string;
  quickActions?: { label: string; type: 'url' | 'task'; target: string }[];
};
export type TaskRoute =
  | 'access'
  | 'maintenance'
  | 'incident'
  | 'permissions'
  | 'preview'
  | 'blocked'
  | 'invalid';
// Reserved/closed tools must not pass through ordinary preview or URL handlers.

/** All entry points must respect approval and maintenance before starting a task. */
export function getTaskRoute(
  tool: ActionTool,
  task: string,
  maintenanceAcknowledged = false,
): TaskRoute {
  if (!tool.tasks.includes(task)) return 'invalid';
  if (
    ['Restricted', 'Coming Soon'].includes(tool.access) ||
    ['Outage', 'Coming Soon'].includes(tool.status)
  )
    return 'blocked';
  if (tool.access === 'Request access') return 'access';
  if (tool.status === 'Maintenance' && !maintenanceAcknowledged)
    return 'maintenance';
  // An administrator may give a task a friendlier label. Route its target,
  // but keep URL actions out of the legacy built-in task shortcuts.
  const action = tool.quickActions?.find(
    (candidate) => candidate.label === task,
  );
  if (action?.type === 'url') return 'preview';
  const target = action?.type === 'task' ? action.target : task;
  if (
    tool.id === 'service-center' &&
    /report an issue|open a ticket/.test(target)
  )
    return 'incident';
  if (tool.id === 'access-manager' && target === 'request access')
    return 'permissions';
  return 'preview';
}
