/** OneJarc frontend snapshot from company-tool-hub/hooks/use-backend.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';
/** Composition root: React calls services; this boundary alone selects local/API
 * repositories. One provider per identity prevents cross-user in-memory caches. */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from './use-auth';
import { backendConfig } from '@/models/backend-config';
import { createApiClient } from '@/models/api-client';
import {
  createApiCatalogDataSource,
  createLocalCatalogDataSource,
} from '@/models/catalog-data-source';
import {
  createApiWorkspaceServices,
  createLocalWorkspaceServices,
  createSharedDataApiService,
} from '@/models/workspace-services';

function useBackendServices() {
  const { user, getAccessToken, expireSession } = useAuth();
  return useMemo(() => {
    if (!user) throw new Error('Sign in before accessing workspace services.');
    const actor = { ...user };
    const client = createApiClient(backendConfig, {
      getAccessToken,
      onUnauthorized: expireSession,
      // Only redacted codes and correlation IDs are logged, never inputs/tokens.
      log: (event) => {
        if (backendConfig.environment === 'development')
          console.warn('[OneJarc API]', event);
      },
    });
    const apiMode = backendConfig.dataSource === 'api';
    return {
      apiMode,
      catalog: apiMode
        ? createApiCatalogDataSource(client, actor)
        : createLocalCatalogDataSource(() => window.localStorage, actor),
      workspace: apiMode
        ? createApiWorkspaceServices(client, actor)
        : createLocalWorkspaceServices(() => window.localStorage, actor),
      shared: createSharedDataApiService(client),
    };
    // Restored identity objects can change while the actual identity stays the same.
  }, [user?.id, user?.role, getAccessToken, expireSession]);
}
const BackendContext = createContext<ReturnType<
  typeof useBackendServices
> | null>(null);
export function BackendProvider({ children }: { children: ReactNode }) {
  const value = useBackendServices();
  return (
    <BackendContext.Provider value={value}>{children}</BackendContext.Provider>
  );
}
export function useBackend() {
  const value = useContext(BackendContext);
  if (!value) throw new Error('useBackend requires BackendProvider.');
  return value;
}
