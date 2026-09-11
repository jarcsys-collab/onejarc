/** OneJarc frontend snapshot from company-tool-hub/components/login-screen.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';
/** Responsive sign-in view: restore the desktop brand/form split while keeping
 * the compact mobile form. Credential and role checks remain in AuthService. */
import { useRef, useState, type SubmitEvent, type ReactNode } from 'react';
import {
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/views/hooks/use-auth';
import { Button } from '@/views/components/ui/button';
import { Input } from '@/views/components/ui/input';

export function LoginScreen({ logo }: { logo: ReactNode }) {
  const auth = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  /** Native form submission supports Enter and browser/password-manager semantics. */
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const data = new FormData(event.currentTarget);
    const usernameValue = data.get('username');
    const passwordValue = data.get('password');
    const username = typeof usernameValue === 'string' ? usernameValue : '';
    const password = typeof passwordValue === 'string' ? passwordValue : '';
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await auth.signIn(username, password);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Sign-in could not be completed. Try again.',
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="grid min-h-svh bg-background text-foreground lg:grid-cols-[1.1fr_0.9fr] lg:grid-rows-[auto_1fr_auto] lg:gap-y-16">
      {/* Both desktop panels share header/content/footer tracks through subgrid.
          This keeps content starts and footer baselines aligned even when a
          validation message changes the form height, without pixel offsets. */}
      {/* Desktop brand panel follows the original composition. Decorative rings
          stay clipped to this panel and never intercept form interaction. */}
      <aside
        aria-label="About OneJarc"
        className="relative hidden min-w-0 overflow-hidden border-r border-border p-10 lg:row-span-3 lg:grid lg:grid-rows-subgrid xl:p-12"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-48 top-[20%] size-[600px] rounded-full border-[90px] border-primary/[0.035]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-35%] left-[22%] size-[720px] rounded-full bg-primary/[0.055] blur-[120px]"
        />
        <div className="relative flex items-center gap-4">
          <span className="[&>.hub-brand-mark]:size-12 [&_img]:w-8">
            {logo}
          </span>
          <div>
            <p className="text-base font-bold tracking-[.04em]">OneJarc</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Company tools
            </p>
          </div>
        </div>
        <div className="relative max-w-[46rem] self-start">
          <p className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.07] px-3.5 py-2 text-sm font-medium text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
            Your everyday workspace
          </p>
          <h2 className="text-[clamp(3rem,4.1vw,5rem)] font-semibold leading-[1.08] tracking-[-.055em]">
            <span className="block">Your company tools.</span>
            <span className="block">One place to get things done.</span>
          </h2>
          <p className="mt-8 max-w-xl text-lg leading-8 text-muted-foreground">
            Find the right tools, see their status, and get to your next task.
          </p>
        </div>
        {/* Describe current capabilities, not security guarantees the demo lacks. */}
        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 self-start text-sm leading-6 text-muted-foreground">
          <span>Tool discovery</span>
          <span
            aria-hidden="true"
            className="size-1 rounded-full bg-foreground/20"
          />
          <span>Workspace access</span>
        </div>
      </aside>

      {/* The form remains a single instance at every width, preserving Enter,
          password-manager semantics, validation, and the existing auth flow. */}
      <div className="flex min-w-0 items-center justify-center px-5 py-10 sm:px-10 sm:py-12 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:grid lg:grid-rows-subgrid lg:items-start lg:justify-normal lg:justify-items-center lg:px-12 lg:py-0">
        <section
          aria-labelledby="login-title"
          className="w-full max-w-[440px] rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-9 lg:row-start-2 lg:max-w-[480px] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            {logo}
            <span className="text-lg font-semibold">OneJarc</span>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-primary lg:flex lg:min-h-10 lg:items-center">
            Welcome back
          </p>
          <h1
            id="login-title"
            className="mt-3 text-3xl font-semibold tracking-tight lg:mt-6"
          >
            <span className="lg:hidden">Welcome to OneJarc</span>
            <span className="hidden lg:inline">Sign in to your workspace</span>
          </h1>
          <p className="mt-3 text-base leading-6 text-muted-foreground">
            {auth.companyMode
              ? 'Use your company account to access OneJarc.'
              : 'Enter your username and password to access OneJarc.'}
          </p>
          {auth.companyMode ? (
            <div className="mt-8 space-y-4">
              <Button
                className="h-12 w-full rounded-xl"
                disabled={loading || !auth.companyReady}
                onClick={async () => {
                  if (loading) return;
                  setLoading(true);
                  setError('');
                  try {
                    await auth.beginCompanySignIn();
                  } catch {
                    setError(
                      'Company sign-in could not be started. Contact your administrator.',
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {loading ? 'Connecting…' : 'Continue with company sign-in'}
              </Button>
              {(error || auth.error || !auth.companyReady) && (
                <p role="alert" className="text-sm text-muted-foreground">
                  {error ||
                    auth.error ||
                    'Company sign-in is not configured yet. No demo credentials are sent to the API.'}
                </p>
              )}
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="mt-8 space-y-5"
              aria-busy={loading}
            >
              <div>
                <label htmlFor="login-username" className="text-sm font-medium">
                  Username
                </label>
                <Input
                  id="login-username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={100}
                  disabled={loading}
                  className="mt-2 h-12 text-base"
                  aria-describedby={
                    error || auth.error ? 'login-error' : undefined
                  }
                />
              </div>
              <div>
                <label htmlFor="login-password" className="text-sm font-medium">
                  Password
                </label>
                <div className="relative mt-2">
                  <Input
                    id="login-password"
                    name="password"
                    type={visible ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    maxLength={256}
                    disabled={loading}
                    className="h-12 pr-12 text-base"
                    aria-describedby={
                      error || auth.error ? 'login-error' : undefined
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                    className="absolute right-1 top-1 size-10"
                  >
                    {visible ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
              {(error || auth.error) && (
                <p
                  id="login-error"
                  ref={errorRef}
                  tabIndex={-1}
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error || auth.error}
                </p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl text-base shadow-[0_16px_40px_rgba(82,224,214,.10)] lg:h-14"
              >
                {loading ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound aria-hidden="true" />
                )}
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          )}
          {/* Keep prototype disclosure visible without implying real company SSO. */}
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-foreground/[0.025] p-4 text-sm leading-6 text-muted-foreground">
            <ShieldCheck
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p>
              {auth.companyMode ? (
                'API mode requires an approved company identity provider. Access to each service must also be authorized by the backend.'
              ) : (
                <>
                  Prototype access only. Demo credentials are visible in the
                  frontend. Company SSO is not connected; do not enter a real
                  company password.
                </>
              )}
            </p>
          </div>
          <p className="mt-7 text-center text-sm leading-6 text-muted-foreground lg:hidden">
            Need sign-in help? Contact your workspace administrator.
          </p>
        </section>
        {/* Desktop help occupies the same footer track as the left-hand labels;
            mobile keeps its existing help text inside the compact login card. */}
        <p className="hidden w-full max-w-[480px] text-center text-sm leading-6 text-muted-foreground lg:row-start-3 lg:block">
          Need sign-in help? Contact your workspace administrator.
        </p>
      </div>
    </main>
  );
}
