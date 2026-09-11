/** Appearance/migration regression tests use a tiny DOM port, never user browser state. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  loadHubSnapshot,
  saveHubSnapshot,
} from '../src/models/hub-storage.ts';
import { resolveTheme, watchAppearance } from '../src/models/hub-appearance.ts';

await test('legacy preferences retain every old choice while gaining appearance defaults', () => {
  assert.deepEqual(
    parsePreferences({
      statusAlerts: false,
      maintenanceBanner: false,
      compactCards: true,
    }),
    {
      ...DEFAULT_PREFERENCES,
      statusAlerts: false,
      maintenanceBanner: false,
      compactCards: true,
    },
  );
});
await test('malformed appearance settings are rejected safely', () => {
  for (const value of [
    null,
    [],
    'light',
    { theme: 'sepia' },
    { reduceMotion: 'yes' },
  ])
    assert.equal(parsePreferences(value), null);
});
await test('all supported themes and motion choices round-trip', () => {
  for (const theme of ['light', 'dark', 'system']) {
    const snapshot = {
      favorites: ['peoplehub'],
      recent: [],
      accessRequests: [],
      preferences: { ...DEFAULT_PREFERENCES, theme, reduceMotion: true },
      readNotificationIds: [],
      statusSubscribed: false,
    };
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    assert.equal(saveHubSnapshot(storage, snapshot), true);
    assert.deepEqual(
      loadHubSnapshot(storage, snapshot, ['peoplehub']).snapshot,
      snapshot,
    );
  }
});
await test('explicit themes ignore the OS and system theme follows it', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});
await test('document appearance reacts to system changes and unsubscribes cleanly', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const classes = new Set();
  const dataset = {};
  let listener;
  const media = {
    matches: false,
    addEventListener: (_name, fn) => {
      listener = fn;
    },
    removeEventListener: (_name, fn) => {
      assert.equal(listener, fn);
      listener = undefined;
    },
  };
  globalThis.window = { matchMedia: () => media };
  globalThis.document = {
    documentElement: {
      dataset,
      classList: {
        toggle: (name, enabled) =>
          enabled ? classes.add(name) : classes.delete(name),
      },
    },
  };
  try {
    const stop = watchAppearance({ theme: 'system', reduceMotion: true });
    assert.equal(dataset.theme, 'light');
    assert.equal(dataset.reduceMotion, 'true');
    assert.equal(classes.has('dark'), false);
    media.matches = true;
    listener();
    assert.equal(dataset.theme, 'dark');
    assert.equal(classes.has('dark'), true);
    stop();
    assert.equal(listener, undefined);
    const stopLight = watchAppearance({ theme: 'light', reduceMotion: false });
    assert.equal(dataset.theme, 'light');
    assert.equal(dataset.reduceMotion, 'false');
    stopLight();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

/** Standard sRGB contrast check for the actual light theme's primary reading surfaces. */
function luminance(hex) {
  const values = hex.match(/[\da-f]{2}/gi).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
await test('light-theme reading text and primary buttons meet 4.5:1 contrast', async () => {
  const css = await readFile(
    new URL('../src/views/styles.css', import.meta.url),
    'utf8',
  );
  const block = css.match(/:root\[data-theme=['"]light['"]\]\s*\{([^}]+)\}/)[1];
  const tokens = Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  for (const [ink, surface] of [
    ['foreground', 'background'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'card'],
    ['primary', 'card'],
    ['primary-foreground', 'primary'],
    ['hub-warning', 'card'],
    ['hub-info', 'card'],
  ]) {
    const pair = [luminance(tokens[ink]), luminance(tokens[surface])].sort(
      (a, b) => b - a,
    );
    assert.ok(
      (pair[0] + 0.05) / (pair[1] + 0.05) >= 4.5,
      `${ink} on ${surface}`,
    );
  }
});
