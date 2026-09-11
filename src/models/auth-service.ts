/** OneJarc frontend snapshot from company-tool-hub/lib/auth-service.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/**
 * PROTOTYPE ONLY: these public demo credentials are discoverable in browser code.
 * This provider proves no real identity. Replace AuthService with an SSO-backed
 * implementation; never reuse this session format as a production credential.
 */
export type Role = 'user' | 'admin';
export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
};
export type DemoSession = { version: 1; userId: string; expiresAt: number };
export interface SessionStore {
  read(): DemoSession | null;
  write(session: DemoSession): void;
  clear(): void;
}
export interface AuthService {
  restore(): Promise<AuthUser | null>;
  signIn(username: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
}

// The ONLY credential-to-identity mapping. No other module checks usernames.
const DEMO_ACCOUNTS = [
  {
    user: {
      id: 'demo-admin',
      username: 'admin',
      displayName: 'OneJarc Administrator',
      role: 'admin' as const,
    },
    password: '123',
  },
  {
    user: {
      id: 'demo-medtek',
      username: 'medtek',
      displayName: 'Medtek User',
      role: 'user' as const,
    },
    password: '123',
  },
];
export const DEMO_SESSION_KEY = 'onejarc-demo-session-v1';
export const DEMO_SESSION_DURATION = 8 * 60 * 60 * 1000;

/** Store only a non-secret demo identity marker, never the entered password.
 * Malformed markers fail closed without deleting unrelated browser preferences. */
export function createSessionStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): SessionStore {
  return {
    read() {
      const raw = storage.getItem(DEMO_SESSION_KEY);
      if (!raw) return null;
      try {
        const value = JSON.parse(raw);
        return value?.version === 1 &&
          typeof value.userId === 'string' &&
          Number.isFinite(value.expiresAt)
          ? value
          : null;
      } catch {
        return null;
      }
    },
    write(session) {
      storage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
    },
    clear() {
      storage.removeItem(DEMO_SESSION_KEY);
    },
  };
}

/** Async interface also fits future /session, /login and /logout API adapters.
 * Restored roles come from the account model, not an editable stored role field.
 * The marker itself remains forgeable: this is UX simulation, not security. */
export function createPrototypeAuthService(
  store: SessionStore,
  now = Date.now,
): AuthService {
  return {
    async restore() {
      const session = store.read();
      if (
        !session ||
        session.expiresAt <= now() ||
        session.expiresAt > now() + DEMO_SESSION_DURATION
      )
        return null;
      const account = DEMO_ACCOUNTS.find(
        ({ user }) => user.id === session.userId,
      );
      return account ? { ...account.user } : null;
    },
    async signIn(username, password) {
      const account = DEMO_ACCOUNTS.find(
        (item) =>
          item.user.username === username.trim().toLowerCase() &&
          item.password === password,
      );
      if (!account) throw new Error('Incorrect username or password.');
      // A failed save must not be reported as a durable successful sign-in.
      try {
        store.write({
          version: 1,
          userId: account.user.id,
          expiresAt: now() + DEMO_SESSION_DURATION,
        });
      } catch {
        throw new Error(
          'Demo session could not be saved. Allow browser storage and try again.',
        );
      }
      return { ...account.user };
    },
    async signOut() {
      store.clear();
    },
  };
}
