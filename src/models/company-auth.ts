/** OneJarc frontend snapshot from company-tool-hub/lib/company-auth.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** Registration seam for a future company-approved OIDC/SSO adapter. This file
 * implements no identity provider and never stores a token or accepts passwords. */
import type { AuthService } from './auth-service';
import { ApiError } from './api-client';

export interface CompanyAuthService extends AuthService {
  kind: 'company';
  /** Delegate redirect/PKCE to the approved identity SDK, not an n8n password flow. */
  beginSignIn(): Promise<void>;
  /** Return a short-lived user access token from the SDK's reviewed session store. */
  getAccessToken(): Promise<string | null>;
}
let adapter: CompanyAuthService | null = null;
/** Call once during application bootstrap, before mounting AuthProvider. */
export function registerCompanyAuthService(service: CompanyAuthService) {
  adapter = service;
}
export function getCompanyAuthService() {
  return adapter;
}
export function isCompanyAuthService(
  service: AuthService | null,
): service is CompanyAuthService {
  return (
    !!service &&
    'kind' in service &&
    service.kind === 'company' &&
    'getAccessToken' in service &&
    typeof service.getAccessToken === 'function'
  );
}
/** Fail closed in API mode until an approved adapter is installed. */
export const unconfiguredCompanyAuth: AuthService = {
  async restore() {
    return null;
  },
  async signIn() {
    throw new ApiError('NOT_CONFIGURED');
  },
  async signOut() {},
};
