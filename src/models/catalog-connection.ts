/** OneJarc frontend snapshot from company-tool-hub/lib/catalog-connection.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** Non-secret API setup metadata only. Nothing here makes an HTTP request or
 * stores credentials. A future server connector must authorize and execute it. */
export const API_AUTH_TYPES = [
  'None',
  'API key',
  'Bearer token',
  'OAuth 2.0',
] as const;
export const API_PURPOSES = [
  'Tool status',
  'Read data',
  'Workflow actions',
] as const;
export type ApiConnection = {
  configured: boolean;
  baseUrl: string;
  healthPath: string;
  authentication: (typeof API_AUTH_TYPES)[number];
  purpose: (typeof API_PURPOSES)[number];
};
export function blankApiConnection(): ApiConnection {
  return {
    configured: false,
    baseUrl: '',
    healthPath: '',
    authentication: 'None',
    purpose: 'Tool status',
  };
}

/** Reject unknown/secret-bearing fields and URL credentials/query strings.
 * Checking format is not a network test or proof that a company owns a host. */
export function validateApiConnection(value: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { apiConnection: 'Use a valid API configuration.' };
  const record = value as Record<string, unknown>;
  const defaults = blankApiConnection();
  if (
    Object.keys(record).some((key) => !Object.hasOwn(defaults, key)) ||
    Object.entries(defaults).some(
      ([key, fallback]) => typeof record[key] !== typeof fallback,
    )
  )
    return {
      apiConnection:
        'API setup accepts connection metadata only, never keys, tokens, or headers.',
    };
  const connection = value as ApiConnection;
  if (connection.baseUrl) {
    try {
      const url = new URL(connection.baseUrl);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        connection.baseUrl.length > 2048
      )
        throw new Error('Unsafe API URL');
    } catch {
      errors['apiConnection.baseUrl'] =
        'Use an HTTPS base URL without credentials, query strings, or fragments.';
    }
  }
  if (connection.configured && !connection.baseUrl.trim())
    errors['apiConnection.baseUrl'] =
      'Add a base URL, or turn off API setup to leave it for later.';
  if (
    connection.healthPath &&
    !/^\/[a-zA-Z0-9_/-]{0,199}$/.test(connection.healthPath)
  )
    errors['apiConnection.healthPath'] =
      'Use a path such as /health, without query strings or credentials.';
  if (connection.healthPath.startsWith('//'))
    errors['apiConnection.healthPath'] =
      'Use a relative path starting with one slash.';
  if (!API_AUTH_TYPES.includes(connection.authentication))
    errors['apiConnection.authentication'] =
      'Choose a supported authentication method.';
  if (!API_PURPOSES.includes(connection.purpose))
    errors['apiConnection.purpose'] =
      'Choose what this connection will be used for.';
  return errors;
}
