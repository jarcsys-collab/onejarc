/** OneJarc frontend snapshot from company-tool-hub/hooks/use-auth.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';
/** React boundary for swappable identity providers. No catalog or view knows
 * passwords or the session storage format. Children do not render until restore. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createPrototypeAuthService,
  createSessionStore,
  type AuthService,
  type AuthUser,
} from '@/models/auth-service';
import { backendConfig } from '@/models/backend-config';
import { ApiError } from '@/models/api-client';
import {
  getCompanyAuthService,
  isCompanyAuthService,
  unconfiguredCompanyAuth,
} from '@/models/company-auth';
type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  error: string;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  companyMode: boolean;
  companyReady: boolean;
  beginCompanySignIn: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  expireSession: () => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({
  children,
  service: supplied,
}: {
  children: ReactNode;
  service?: AuthService;
}) {
  const companyMode = backendConfig.dataSource === 'api';
  const service = useRef<AuthService | null>(
    companyMode
      ? isCompanyAuthService(supplied ?? null)
        ? supplied!
        : (getCompanyAuthService() ?? unconfiguredCompanyAuth)
      : (supplied ?? null),
  );
  const explicitlySignedOut = useRef(false);
  // Ignore an earlier restore if a newer login/logout has changed identity.
  const identityRevision = useRef(0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  // These stable callbacks prevent API/repository instances from being recreated
  // on every render. Demo sessions can never supply a backend bearer token.
  const getAccessToken = useCallback(
    async () =>
      isCompanyAuthService(service.current)
        ? service.current.getAccessToken()
        : null,
    [],
  );
  const expireSession = useCallback(() => {
    identityRevision.current += 1;
    explicitlySignedOut.current = true;
    setUser(null);
    setError('Your session expired. Sign in again.');
    void service.current?.signOut().catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    async function restore() {
      if (explicitlySignedOut.current) return;
      const revision = identityRevision.current;
      try {
        service.current ??= createPrototypeAuthService(
          createSessionStore(window.sessionStorage),
        );
        const restored = await service.current.restore();
        if (
          active &&
          revision === identityRevision.current &&
          !explicitlySignedOut.current
        )
          setUser(restored);
      } catch {
        if (active && revision === identityRevision.current)
          setError(
            companyMode
              ? 'Company sign-in could not be restored. Please sign in again.'
              : 'Demo session storage is unavailable. Enable browser storage to sign in.',
          );
      } finally {
        if (active) setReady(true);
      }
    }
    void restore();
    // Check expiry on focus and periodically, including an already-open admin screen.
    const timer = window.setInterval(() => void restore(), 60_000);
    window.addEventListener('focus', restore);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', restore);
    };
  }, [companyMode]);
  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        error,
        companyMode,
        companyReady: isCompanyAuthService(service.current),
        getAccessToken,
        expireSession,
        async beginCompanySignIn() {
          if (!isCompanyAuthService(service.current))
            throw new ApiError('NOT_CONFIGURED');
          explicitlySignedOut.current = false;
          await service.current.beginSignIn();
          const restored = await service.current.restore();
          setUser(restored);
          setError('');
        },
        async signIn(username, password) {
          if (companyMode) throw new ApiError('NOT_CONFIGURED');
          if (!service.current)
            throw new Error('Demo session storage is unavailable.');
          const revision = ++identityRevision.current;
          const identity = await service.current.signIn(username, password);
          if (revision !== identityRevision.current) return;
          explicitlySignedOut.current = false;
          setError('');
          setUser(identity);
        },
        async signOut() {
          identityRevision.current += 1;
          explicitlySignedOut.current = true;
          // Never keep admin UI mounted if storage removal fails. Report the limit.
          try {
            await service.current?.signOut();
            setError('');
          } catch {
            setError(
              'Signed out in this tab, but the saved demo session could not be removed. Clear this site’s session storage before refreshing.',
            );
          } finally {
            setUser(null);
            window.location.hash = '';
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider.');
  return value;
}
