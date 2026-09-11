/** OneJarc frontend snapshot from company-tool-hub/lib/permissions.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** Central policy. UI, navigation, agent actions and catalog services ask the
 * same question. Production APIs must independently enforce this policy. */
import type { AuthUser } from './auth-service';
export const EMPLOYEE_PERMISSIONS = [
  'canViewTools',
  'canFavoriteTools',
  'canUseSearch',
  'canOpenTools',
  'canRequestAccess',
] as const;
export const ADMIN_PERMISSIONS = [
  'canManageToolCatalog',
  'canCreateTool',
  'canEditTool',
  'canDuplicateTool',
  'canArchiveTool',
  'canPublishTool',
  'canEnableTool',
  'canManageCategories',
] as const;
export type Permission =
  | (typeof EMPLOYEE_PERMISSIONS)[number]
  | (typeof ADMIN_PERMISSIONS)[number];
const grants: Record<string, readonly Permission[]> = {
  user: EMPLOYEE_PERMISSIONS,
  admin: [...EMPLOYEE_PERMISSIONS, ...ADMIN_PERMISSIONS],
};
/** Unknown users, roles and permissions are denied by default. */
export function can(user: AuthUser | null, permission: Permission): boolean {
  return Boolean(
    user &&
    Object.hasOwn(grants, user.role) &&
    grants[user.role].includes(permission),
  );
}
/** Service guard protects handlers even when reached outside a visible button. */
export function requirePermission(
  user: AuthUser | null,
  permission: Permission,
): void {
  if (!can(user, permission))
    throw new Error('Access denied. This action requires an administrator.');
}
export type AdminSection = 'tools' | 'categories' | 'access';
/** Hash routes remain portable to static GitHub Pages and Apps Script exports. */
export function readAdminRoute(hash: string): AdminSection | null {
  const route = hash.replace(/^#\/?/, '').replace(/\/$/, '');
  if (!route.startsWith('admin')) return null;
  return route === 'admin/categories'
    ? 'categories'
    : route === 'admin/access'
      ? 'access'
      : 'tools';
}
