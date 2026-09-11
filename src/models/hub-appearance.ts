/** OneJarc frontend snapshot from company-tool-hub/lib/hub-appearance.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/**
 * Shared browser appearance behavior for Sites and Apps Script.
 * Preferences are device-local only. Applying to <html> also themes portaled
 * menus, tooltips, sheets, and dialogs, not just the center workspace.
 */
type Appearance = { theme: 'dark' | 'light' | 'system'; reduceMotion: boolean };

/** Resolve a saved choice without depending on a browser (also used by tests). */
export function resolveTheme(
  theme: Appearance['theme'],
  systemDark: boolean,
): 'dark' | 'light' {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

/** Synchronize appearance with the OS; return cleanup for React's effect lifecycle. */
export function watchAppearance(preferences: Appearance): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const theme = resolveTheme(preferences.theme, media.matches);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.reduceMotion = String(
      preferences.reduceMotion,
    );
  };
  apply();
  media.addEventListener('change', apply);
  return () => media.removeEventListener('change', apply);
}
