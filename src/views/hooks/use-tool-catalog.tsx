/** OneJarc frontend snapshot from company-tool-hub/hooks/use-tool-catalog.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';
/** Shared in-memory catalog view. Repositories own persistence; errors never
 * silently fall back to a demo catalog, and stale reads cannot overwrite writes. */
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useBackend } from './use-backend';
import { ApiError, describeApiError, newRequestKey } from '@/models/api-client';
import { CATALOG_KEY } from '@/models/catalog-repository';
import type { CatalogCommand } from '@/models/catalog-service';
import type { CatalogView } from '@/models/catalog-data-source';

type CatalogContextValue = CatalogView & {
  ready: boolean;
  error: string;
  busy: boolean;
  reload: () => Promise<void>;
  execute: (command: CatalogCommand, revision?: number) => Promise<void>;
};
const CatalogContext = createContext<CatalogContextValue | null>(null);
export function ToolCatalogProvider({ children }: { children: ReactNode }) {
  const { catalog: repository, apiMode } = useBackend();
  const inFlight = useRef(false);
  const generation = useRef(0);
  const retry = useRef({ fingerprint: '', key: '' });
  const [view, setView] = useState<CatalogView>({
    snapshot: { version: 1, revision: 0, entries: [], categories: [] },
    tools: [],
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /** Focus/manual refresh replaces the brief cache; no aggressive polling. */
  const reload = useCallback(async () => {
    if (inFlight.current) return;
    const sequence = ++generation.current;
    try {
      const next = await repository.read();
      if (sequence !== generation.current) return;
      setView(next);
      setError('');
    } catch (failure) {
      if (sequence !== generation.current) return;
      setError(
        apiMode
          ? describeApiError(failure)
          : 'The local catalog could not be loaded. Stored data was preserved. Allow browser storage or repair the saved catalog, then reload.',
      );
    } finally {
      if (sequence === generation.current) setReady(true);
    }
  }, [repository, apiMode]);
  useEffect(() => {
    void reload();
    const storage = (event: StorageEvent) => {
      if (!apiMode && (event.key === CATALOG_KEY || event.key === null))
        void reload();
    };
    const focus = () => {
      if (apiMode) void reload();
    };
    window.addEventListener('storage', storage);
    window.addEventListener('focus', focus);
    return () => {
      generation.current++;
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', focus);
    };
  }, [reload, apiMode]);
  /** API commands send only intent. Retrying an identical ambiguous failure keeps
   * its key; If-Match prevents overwriting newer catalog data. */
  async function execute(
    command: CatalogCommand,
    revision = view.snapshot.revision,
  ) {
    if (!ready || error)
      throw new Error('Reload the catalog successfully before making changes.');
    if (inFlight.current)
      throw new Error('Wait for the current catalog change to finish.');
    inFlight.current = true;
    generation.current++;
    setBusy(true);
    const fingerprint = JSON.stringify({ command, revision });
    if (fingerprint !== retry.current.fingerprint || !retry.current.key)
      retry.current = { fingerprint, key: newRequestKey() };
    try {
      setView(await repository.execute(command, revision, retry.current.key));
      retry.current = { fingerprint: '', key: '' };
    } catch (failure) {
      // Conflict reload is explicit so the editor's unsaved text is not discarded.
      if (failure instanceof ApiError && failure.status === 401)
        setError(describeApiError(failure));
      throw failure;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <CatalogContext.Provider
      value={{
        ...view,
        tools: error ? [] : view.tools,
        ready,
        error,
        busy,
        reload,
        execute,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}
export function useToolCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useToolCatalog requires ToolCatalogProvider.');
  return value;
}
