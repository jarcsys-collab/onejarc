/** OneJarc frontend snapshot from company-tool-hub/lib/hub-storage.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/**
 * Device-local prototype persistence, with validation and recoverable failures.
 * This module never deletes keys on parse errors. In-memory state remains usable
 * when browser storage is unavailable. Replace this adapter with authenticated
 * user preferences later; these values must never authorize access to a tool.
 */
export type Preferences = {
  theme: 'dark' | 'light' | 'system';
  reduceMotion: boolean;
  statusAlerts: boolean;
  maintenanceBanner: boolean;
  compactCards: boolean;
};
export type HubSnapshot = {
  favorites: string[];
  recent: string[];
  accessRequests: string[];
  preferences: Preferences;
  readNotificationIds: string[];
  statusSubscribed: boolean;
};
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
/** Identity-specific favorites/history; appearance remains a device preference.
 * The employee demo inherits legacy values without deleting or rewriting them. */
export function scopedHubStorage(
  storage: StoragePort,
  userId: string,
): StoragePort {
  return {
    getItem(key) {
      if (key === 'northstar-preferences') return storage.getItem(key);
      const value = storage.getItem(`onejarc-user:${userId}:${key}`);
      return value ?? (userId === 'demo-medtek' ? storage.getItem(key) : null);
    },
    setItem(key, value) {
      storage.setItem(
        key === 'northstar-preferences' ? key : `onejarc-user:${userId}:${key}`,
        value,
      );
    },
  };
}
export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  reduceMotion: false,
  statusAlerts: true,
  maintenanceBanner: true,
  compactCards: false,
};

/** Validate optional settings independently of schema age; old saved choices survive upgrades. */
export function parsePreferences(value: unknown): Preferences | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const incoming = value as Record<string, unknown>;
  const booleans = [
    'statusAlerts',
    'maintenanceBanner',
    'compactCards',
    'reduceMotion',
  ] as const;
  if (
    booleans.some(
      (key) =>
        incoming[key] !== undefined && typeof incoming[key] !== 'boolean',
    )
  )
    return null;
  if (
    incoming.theme !== undefined &&
    !['dark', 'light', 'system'].includes(incoming.theme as string)
  )
    return null;
  return {
    theme: (incoming.theme ??
      DEFAULT_PREFERENCES.theme) as Preferences['theme'],
    reduceMotion: (incoming.reduceMotion ??
      DEFAULT_PREFERENCES.reduceMotion) as boolean,
    statusAlerts: (incoming.statusAlerts ??
      DEFAULT_PREFERENCES.statusAlerts) as boolean,
    maintenanceBanner: (incoming.maintenanceBanner ??
      DEFAULT_PREFERENCES.maintenanceBanner) as boolean,
    compactCards: (incoming.compactCards ??
      DEFAULT_PREFERENCES.compactCards) as boolean,
  };
}

// Preserve the established keys so existing test users keep their saved choices.
const KEYS: Record<keyof HubSnapshot, string> = {
  favorites: 'northstar-favorites',
  recent: 'northstar-recent',
  accessRequests: 'northstar-access-requests',
  preferences: 'northstar-preferences',
  readNotificationIds: 'northstar-read-notifications',
  statusSubscribed: 'northstar-status-subscription',
};

/** Restore independent keys; one malformed record must not break the whole app. */
export function loadHubSnapshot(
  storage: StoragePort,
  fallback: HubSnapshot,
  toolIds: string[],
): { snapshot: HubSnapshot; damaged: boolean } {
  const snapshot: HubSnapshot = { ...fallback };
  let damaged = false;
  for (const field of Object.keys(KEYS) as (keyof HubSnapshot)[]) {
    try {
      const raw = storage.getItem(KEYS[field]);
      if (raw === null) continue;
      const value: unknown = JSON.parse(raw);
      if (field === 'preferences') {
        const restored = parsePreferences(value);
        if (!restored) throw new Error('Invalid preferences');
        snapshot.preferences = restored;
      } else if (field === 'statusSubscribed') {
        if (typeof value !== 'boolean') throw new Error('Invalid subscription');
        snapshot.statusSubscribed = value;
      } else {
        if (
          !Array.isArray(value) ||
          !value.every((item) => typeof item === 'string')
        )
          throw new Error('Invalid saved list');
        const unique = [...new Set(value as string[])];
        snapshot[field] =
          field === 'readNotificationIds'
            ? unique
            : unique.filter((id) => toolIds.includes(id));
      }
    } catch {
      damaged = true;
    }
  }
  return { snapshot, damaged };
}

/** Attempt to save the latest snapshot; callers keep it in memory for Retry. */
export function saveHubSnapshot(
  storage: StoragePort,
  snapshot: HubSnapshot,
): boolean {
  try {
    for (const field of Object.keys(KEYS) as (keyof HubSnapshot)[])
      storage.setItem(KEYS[field], JSON.stringify(snapshot[field]));
    return true;
  } catch {
    return false;
  }
}

/** Suggestions retain the existing local-only format and report write failures. */
export function saveSuggestion(
  storage: StoragePort,
  suggestion: string,
): boolean {
  try {
    const value: unknown = JSON.parse(
      storage.getItem('northstar-suggestions') ?? '[]',
    );
    if (
      !Array.isArray(value) ||
      !value.every((item) => typeof item === 'string')
    )
      return false;
    storage.setItem(
      'northstar-suggestions',
      JSON.stringify([suggestion, ...value].slice(0, 20)),
    );
    return true;
  } catch {
    return false;
  }
}
