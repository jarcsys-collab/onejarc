/** OneJarc frontend snapshot from company-tool-hub/lib/backend-config.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** PUBLIC browser configuration, never a secret store. Edit the selected profile
 * and rebuild for each deployment. All profiles deliberately start local/blank. */
export type BackendConfig = {
  environment: 'development' | 'staging' | 'production';
  dataSource: 'local' | 'api';
  apiBaseUrl: string;
  timeoutMs: number;
};
export const BACKEND_PROFILES: Record<
  BackendConfig['environment'],
  BackendConfig
> = {
  development: {
    environment: 'development',
    dataSource: 'local',
    apiBaseUrl: '',
    timeoutMs: 12000,
  },
  staging: {
    environment: 'staging',
    dataSource: 'local',
    apiBaseUrl: '',
    timeoutMs: 12000,
  },
  production: {
    environment: 'production',
    dataSource: 'local',
    apiBaseUrl: '',
    timeoutMs: 12000,
  },
};
export const backendConfig: BackendConfig = BACKEND_PROFILES.development;

/** All real launch destinations must be HTTPS outside the local development
 * profile. Catalog validation separately rejects credential-bearing URLs. */
export function isAllowedLaunchUrl(
  value: string,
  environment: BackendConfig['environment'],
): boolean {
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      (url.protocol === 'https:' ||
        (environment === 'development' &&
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}

/** Reject unsafe configured targets before attaching any session token. */
export function validateBackendConfig(config: BackendConfig): void {
  if (
    !['development', 'staging', 'production'].includes(config.environment) ||
    !['local', 'api'].includes(config.dataSource)
  )
    throw new Error('Invalid backend environment or data source.');
  if (
    !Number.isFinite(config.timeoutMs) ||
    config.timeoutMs < 100 ||
    config.timeoutMs > 60000
  )
    throw new Error('API timeout must be between 100 and 60000 milliseconds.');
  if (!config.apiBaseUrl && config.dataSource === 'local') return;
  try {
    const url = new URL(config.apiBaseUrl);
    const localHttp =
      config.environment === 'development' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (!localHttp && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      config.apiBaseUrl.length > 2048
    )
      throw new Error();
  } catch {
    throw new Error(
      'Configure an HTTPS API base URL without credentials, query strings, or fragments.',
    );
  }
}
