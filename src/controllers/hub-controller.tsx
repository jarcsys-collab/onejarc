/** OneJarc frontend snapshot from company-tool-hub/app/hub-app.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { AuthProvider, useAuth } from '@/views/hooks/use-auth';
import { BackendProvider, useBackend } from '@/views/hooks/use-backend';
import { useSubmission } from '@/views/hooks/use-submission';
import { isAllowedLaunchUrl, backendConfig } from '@/models/backend-config';
import type {
  AccessRequestInput,
  SubmissionReceipt,
} from '@/models/workspace-services';
import { LoginScreen } from '@/views/components/login-screen';
import {
  can,
  requirePermission,
  readAdminRoute,
  type AdminSection,
} from '@/models/permissions';
import { type Tool, type ToolStatus } from '@/models/tool-catalog';
import { ToolCatalogProvider, useToolCatalog } from '@/views/hooks/use-tool-catalog';
import { AdminConsole } from '@/views/components/admin-console';
import { isSafeToolUrl } from '@/models/catalog-model';
import { searchToolCatalog } from '@/models/tool-search';
import {
  DEFAULT_PREFERENCES,
  loadHubSnapshot,
  saveHubSnapshot,
  scopedHubStorage,
  type HubSnapshot,
  type Preferences,
} from '@/models/hub-storage';
import { watchAppearance } from '@/models/hub-appearance';
import { SiteSettings } from '@/views/components/site-settings';
import { ToolResultsSection } from '@/views/components/tool-results-section';
import { ToolCard } from '@/views/components/tool-card';
import { DirectoryControls } from '@/views/components/directory-controls';
import { arrangeDirectory, type DirectorySort } from '@/models/tool-directory';
import { getTaskRoute } from '@/models/tool-actions';
import { HubErrorBoundary } from '@/views/components/hub-error-boundary';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Boxes,
  CalendarClock,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Compass,
  ExternalLink,
  Grid2X2,
  Heart,
  HelpCircle,
  Home,
  LifeBuoy,
  LoaderCircle,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
  X,
} from 'lucide-react';

import { Badge } from '@/views/components/ui/badge';
import { Button } from '@/views/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/views/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/views/components/ui/dropdown-menu';
import { Input } from '@/views/components/ui/input';
import { Textarea } from '@/views/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/views/components/ui/sheet';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/views/components/ui/sidebar';

type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: unknown) => unknown;
};

declare global {
  interface Document {
    readonly modelContext?: {
      registerTool: (
        tool: WebMcpTool,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

type View =
  | 'Home'
  | 'All tools'
  | 'Favorites'
  | 'Recent'
  | 'Categories'
  | 'System status'
  | 'Get help';

/** No fabricated service notices in the empty deployment. A real feed can be connected later. */
const notifications: { id: string; icon: LucideIcon; color: string; title: string; message: string; time: string; unread: boolean }[] = [];

const guideArticles = [
  {
    title: 'Choose the right company tool',
    summary:
      'Use guided search, recommendations, and access labels effectively.',
    body: 'Describe the outcome you need in the search box instead of guessing an app name. Review the recommendation reason, catalog status, and access label before opening the tool.',
  },
  {
    title: 'Request application access',
    summary: 'Understand approvals and track a request from the hub.',
    body: 'Open a restricted tool and choose Request access. Add a clear business reason and urgency. The request remains marked as pending on this device after submission.',
  },
  {
    title: 'Respond to a service incident',
    summary: 'Check current notices before reporting a problem.',
    body: 'Open System status to see active maintenance and degraded services. If your issue is not listed, use Report a problem so the service desk receives the affected tool and details.',
  },
];

type SupportFlow = 'problem' | 'guides' | null;

/** Start without fabricated favorites or recent activity; saved choices still restore. */
const DEFAULT_SNAPSHOT: HubSnapshot = {
  favorites: [],
  recent: [],
  accessRequests: [],
  preferences: DEFAULT_PREFERENCES,
  readNotificationIds: [],
  statusSubscribed: false,
};

type Feedback = {
  message: string;
  tone?: 'success' | 'error' | 'info';
  action?: { label: string; run: () => void };
};

const navItems: { label: View; icon: LucideIcon; badge?: string }[] = [
  { label: 'Home', icon: Home },
  { label: 'All tools', icon: Grid2X2 },
  { label: 'Favorites', icon: Star },
  { label: 'Recent', icon: Clock3 },
  { label: 'Categories', icon: Boxes },
];

const homeGreetings = [
  'Welcome back',
  'Good to see you',
  'Ready when you are',
  'Let’s find the right tool',
  'What are we solving today',
];

function StatusBadge({ status }: { status: ToolStatus }) {
  const styles = {
    Operational: 'bg-emerald-400',
    Maintenance: 'bg-amber-400',
    Degraded: 'bg-orange-400',
    Outage: 'bg-red-400',
    'Coming Soon': 'bg-slate-400',
  };
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className={`size-1.5 rounded-full ${styles[status]}`}
        aria-hidden="true"
      />
      {status}
    </span>
  );
}

function AppMark({
  tool,
  size = 'md',
}: {
  tool: Tool;
  size?: 'sm' | 'md' | 'lg';
}) {
  const Icon = tool.icon;
  const sizeClass =
    size === 'lg'
      ? 'size-14 rounded-2xl'
      : size === 'sm'
        ? 'size-9 rounded-[0.7rem]'
        : 'size-11 rounded-xl';
  return (
    <div
      className={`grid shrink-0 place-items-center text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.24)] ${sizeClass}`}
      style={{ backgroundColor: tool.color }}
    >
      <Icon
        className={size === 'lg' ? 'size-6' : 'size-5'}
        aria-hidden="true"
      />
    </div>
  );
}

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`hub-brand-mark hub-dark-surface grid shrink-0 place-items-center rounded-xl border border-primary/15 bg-[linear-gradient(145deg,#202a2d,#0b0f11)] shadow-[0_0_30px_rgba(92,226,216,.14),inset_0_1px_0_rgba(255,255,255,.08)] ${large ? 'size-10' : 'size-8'}`}
    >
      {/* Local vector stays portable to the client-only Apps Script build without an image server. */}
      {/* oxlint-disable-next-line nextjs/no-img-element */}
      <img
        src={`${import.meta.env.BASE_URL}juno-logo.svg`}
        width={1097}
        height={343}
        alt=""
        className={`${large ? 'w-7' : 'w-6'} h-auto max-w-full object-contain`}
      />
    </span>
  );
}

/** Close the mobile drawer before opening settings so two modal focus traps cannot overlap. */
function SidebarSettingsItem({
  active,
  onOpen,
}: {
  active: boolean;
  onOpen: () => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip="Settings"
        isActive={active}
        onClick={() => {
          if (isMobile) setOpenMobile(false);
          onOpen();
        }}
        className="h-10 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground data-active:bg-primary/10 data-active:text-primary"
      >
        <Settings aria-hidden="true" />
        <span>Settings</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function StatusView({
  onOpenTool,
  lastUpdated,
  subscribed,
  onRefresh,
  onToggleSubscription,
}: {
  onOpenTool: (tool: Tool) => void;
  lastUpdated: string;
  subscribed: boolean;
  onRefresh: () => void;
  onToggleSubscription: () => void;
}) {
  const { tools } = useToolCatalog();
  const affected = tools.filter((tool) => tool.status !== 'Operational');
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
            Prototype operations
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground md:text-3xl">
            System status
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sample / manually maintained status · Last viewed {lastUpdated}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={onRefresh}
            className="border-border bg-transparent text-foreground/65 hover:bg-foreground/[0.05] hover:text-foreground"
          >
            <LoaderCircle className="size-4" /> Refresh status
          </Button>
          <Button
            onClick={onToggleSubscription}
            className={
              subscribed
                ? 'bg-hub-success text-primary-foreground hover:bg-hub-success'
                : 'bg-primary text-primary-foreground hover:bg-primary'
            }
          >
            {subscribed ? (
              <CircleCheck className="size-4" />
            ) : (
              <Bell className="size-4" />
            )}{' '}
            {subscribed ? 'Subscribed' : 'Get updates'}
          </Button>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-xl border border-hub-warning/15 bg-hub-warning/[0.07] px-3 py-2 text-xs font-medium text-hub-warning">
        <AlertTriangle className="size-3.5" /> {affected.length} tools need
        attention
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            {tools.length - affected.length}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Operational</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-3xl font-semibold tracking-[-0.04em] text-hub-warning">
            {tools.filter((tool) => tool.status === 'Maintenance').length}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">In maintenance</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-3xl font-semibold tracking-[-0.04em] text-hub-warning">
            {tools.filter((tool) => tool.status === 'Degraded').length}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Degraded</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-foreground">
          Active notices
        </h2>
        <div className="mt-4 space-y-3">
          {affected.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onOpenTool(tool)}
              className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-border hover:bg-accent"
            >
              <AppMark tool={tool} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{tool.name}</h3>
                  <Badge
                    className={
                      tool.status === 'Maintenance'
                        ? 'bg-hub-warning/10 text-hub-warning'
                        : 'bg-hub-warning/10 text-hub-warning'
                    }
                  >
                    {tool.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tool.statusNote}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            All systems
          </h2>
          <span className="text-xs text-muted-foreground">
            {tools.length} monitored tools
          </span>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          {tools.map((tool, index) => (
            <button
              key={tool.id}
              onClick={() => onOpenTool(tool)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-foreground/[0.025] ${index !== tools.length - 1 ? 'border-b border-border' : ''}`}
            >
              <AppMark tool={tool} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/82">
                {tool.name}
              </span>
              <StatusBadge status={tool.status} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function HelpView({
  onReportProblem,
  onReadGuide,
  onRequestAccess,
  onSuggestion,
}: {
  onReportProblem: () => void;
  onReadGuide: () => void;
  onRequestAccess: () => void;
  onSuggestion: (suggestion: string) => Promise<string>;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [suggestionError, setSuggestionError] = useState('');
  const submission = useSubmission();
  const [confirmation, setConfirmation] = useState('');
  const helpActions = [
    {
      icon: Wrench,
      title: 'Report a problem',
      text: 'Create an IT support request.',
      action: onReportProblem,
    },
    {
      icon: BookOpen,
      title: 'Read a guide',
      text: 'Browse approved help articles.',
      action: onReadGuide,
    },
    {
      icon: ShieldCheck,
      title: 'Request access',
      text: 'Ask for a tool or permission.',
      action: onRequestAccess,
    },
  ];
  return (
    <div className="animate-in fade-in duration-300">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
          Support
        </p>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground md:text-3xl">
          How can we help?
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Start with a guide, report an issue, or suggest a tool for the hub.
        </p>
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-3">
        {helpActions.map((item) => (
          <button
            key={item.title}
            onClick={item.action}
            className="rounded-2xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/20 hover:bg-accent"
          >
            <item.icon className="size-5 text-primary" />
            <h2 className="mt-5 font-semibold text-foreground">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            <span className="mt-5 flex items-center gap-1 text-xs font-semibold text-primary">
              Continue <ArrowRight className="size-3" />
            </span>
          </button>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-violet-400/10 text-hub-info">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">
              Suggest a tool or improvement
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell the workplace team what would make this hub more useful.
            </p>
          </div>
        </div>
        {submitted ? (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-hub-success/15 bg-hub-success/[0.06] p-4 text-sm text-hub-success">
            <CircleCheck className="size-5 shrink-0" /> {confirmation}
          </div>
        ) : (
          <form
            className="mt-5 flex flex-col gap-3 sm:flex-row"
            aria-busy={submission.busy}
            onSubmit={async (event) => {
              event.preventDefault();
              const text = suggestion.trim();
              if (!text) {
                setSuggestionError('Please describe your suggestion.');
                return;
              }
              setSuggestionError('');
              const message = await submission.run(() => onSuggestion(text));
              if (message) {
                setConfirmation(message);
                setSubmitted(true);
              }
            }}
          >
            <label htmlFor="suggestion" className="sr-only">
              Your suggestion
            </label>
            <Input
              id="suggestion"
              disabled={submission.busy}
              maxLength={2000}
              required
              value={suggestion}
              onChange={(event) => setSuggestion(event.target.value)}
              placeholder="What should we add or improve?"
              className="h-11 border-border bg-background text-foreground placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              disabled={submission.busy}
              className="h-11 bg-primary px-5 text-primary-foreground hover:bg-primary"
            >
              {submission.busy ? 'Sending…' : 'Send suggestion'}
            </Button>
          </form>
        )}
        {(suggestionError || submission.error) && (
          <p role="alert" className="mt-3 text-sm text-hub-warning">
            {suggestionError || submission.error}
          </p>
        )}
        {submitted && (
          <Button
            variant="ghost"
            onClick={() => {
              setSubmitted(false);
              setSuggestion('');
            }}
            className="mt-3 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          >
            Send another suggestion
          </Button>
        )}
      </section>
    </div>
  );
}

function SupportDialog({
  flow,
  onClose,
  onSubmitted,
  initialContext = '',
}: {
  flow: SupportFlow;
  onClose: () => void;
  onSubmitted: (message: string) => void;
  initialContext?: string;
}) {
  const { tools } = useToolCatalog();
  const [submitted, setSubmitted] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState(0);
  const { workspace, apiMode } = useBackend();
  const submission = useSubmission();
  const [confirmation, setConfirmation] = useState('');

  // The parent keys this dialog by flow/context to reset form state on a new visit.

  const isGuide = flow === 'guides';
  return (
    <Dialog
      open={Boolean(flow)}
      onOpenChange={(open) => !open && !submission.busy && onClose()}
    >
      <DialogContent className="max-h-[90svh] max-w-[calc(100%-2rem)] overflow-y-auto border border-border bg-popover text-foreground shadow-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-foreground">
            {isGuide ? 'Help guides' : 'Report a problem'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isGuide
              ? 'Practical guidance for finding tools, getting access, and handling incidents.'
              : 'Give the service desk enough detail to route your issue.'}
          </DialogDescription>
        </DialogHeader>

        {isGuide ? (
          <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-2">
              {guideArticles.map((guide, index) => (
                <button
                  key={guide.title}
                  onClick={() => setSelectedGuide(index)}
                  className={`w-full rounded-xl border p-3 text-left transition ${selectedGuide === index ? 'border-primary/25 bg-primary/[0.08]' : 'border-border bg-foreground/[0.025] hover:bg-foreground/[0.05]'}`}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {guide.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {guide.summary}
                  </span>
                </button>
              ))}
            </div>
            <article className="rounded-xl border border-border bg-background p-5">
              <BookOpen className="size-5 text-primary" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {guideArticles[selectedGuide].title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {guideArticles[selectedGuide].body}
              </p>
            </article>
          </div>
        ) : submitted ? (
          <div className="rounded-xl border border-hub-success/15 bg-hub-success/[0.06] p-5 text-sm text-hub-success">
            <CircleCheck className="mb-3 size-5" /> {confirmation}
          </div>
        ) : (
          <form
            key={initialContext}
            id="problem-form"
            className="space-y-4"
            aria-busy={submission.busy}
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const receipt = await submission.run(() =>
                workspace.submitIncident({
                  toolId: String(data.get('toolId') ?? ''),
                  summary: String(data.get('summary') ?? ''),
                  details: String(data.get('details') ?? ''),
                }),
              );
              if (!receipt) return;
              const message =
                receipt.delivery === 'api'
                  ? `Incident submitted. Reference: ${receipt.reference}.`
                  : 'Demo report preview complete. No incident has been sent to the service desk.';
              setConfirmation(message);
              setSubmitted(true);
              onSubmitted(message);
            }}
          >
            <p className="rounded-lg bg-primary/[0.06] p-3 text-xs leading-5 text-primary/80">
              {apiMode
                ? 'Describe the issue without including passwords or API keys.'
                : 'Frontend preview: this form is not connected to a service desk yet.'}
            </p>
            <label className="block text-sm text-foreground/65">
              Affected tool
              <select
                required
                name="toolId"
                disabled={submission.busy}
                defaultValue=""
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50"
              >
                <option value="" disabled>
                  Select a tool
                </option>
                {tools.map((tool) => (
                  <option key={tool.id} value={tool.id}>
                    {tool.name}
                  </option>
                ))}
              </select>
            </label>
            <label
              htmlFor="incident-summary"
              className="block text-sm text-foreground/65"
            >
              Issue summary
              <Input
                id="incident-summary"
                name="summary"
                maxLength={160}
                disabled={submission.busy}
                required
                defaultValue={initialContext}
                placeholder="Example: I cannot upload a file"
                className="mt-1.5 h-11 border-border bg-background text-foreground placeholder:text-muted-foreground"
              />
            </label>
            <label
              htmlFor="incident-details"
              className="block text-sm text-foreground/65"
            >
              Details
              <Textarea
                id="incident-details"
                name="details"
                maxLength={5000}
                disabled={submission.busy}
                required
                placeholder="What were you doing, and what happened?"
                className="mt-1.5 min-h-28 border-border bg-background text-foreground placeholder:text-muted-foreground"
              />
            </label>
          </form>
        )}

        {submission.error && (
          <p role="alert" className="text-sm text-destructive">
            {submission.error}
          </p>
        )}
        <DialogFooter>
          <Button
            disabled={submission.busy}
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          >
            {submitted || isGuide ? 'Done' : 'Cancel'}
          </Button>
          {!isGuide && !submitted && (
            <Button
              type="submit"
              form="problem-form"
              disabled={submission.busy}
              className="bg-primary text-primary-foreground hover:bg-primary"
            >
              {submission.busy
                ? 'Submitting…'
                : apiMode
                  ? 'Submit incident'
                  : 'Preview submission'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccessRequestDialog({
  toolId,
  pending,
  onToolChange,
  onClose,
  onSubmit,
}: {
  toolId: string | null;
  pending: boolean;
  onToolChange: (toolId: string) => void;
  onClose: () => void;
  onSubmit: (input: AccessRequestInput) => Promise<SubmissionReceipt>;
}) {
  const { tools } = useToolCatalog();
  const requestableTools = tools.filter(
    (tool) => tool.access === 'Request access',
  );
  const selected =
    tools.find((tool) => tool.id === toolId) ?? requestableTools[0];
  const { apiMode } = useBackend();
  const submission = useSubmission();
  if (!selected) return null;
  return (
    <Dialog
      open={Boolean(toolId)}
      onOpenChange={(open) => !open && !submission.busy && onClose()}
    >
      <DialogContent className="max-w-[calc(100%-2rem)] border border-border bg-popover text-foreground shadow-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {pending ? 'Access request status' : 'Request tool access'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {pending
              ? apiMode
                ? `Your ${selected.name} request was submitted in this session.`
                : `Your ${selected.name} request is saved in this prototype only.`
              : apiMode
                ? 'Provide a business reason. Do not include credentials.'
                : 'Demo access request: saved on this device; no approval request is sent yet.'}
          </DialogDescription>
        </DialogHeader>
        {pending ? (
          <div className="rounded-xl border border-hub-info/15 bg-hub-info/[0.06] p-5">
            <div className="flex items-center gap-3">
              <Clock3 className="size-5 text-hub-info" />
              <div>
                <p className="font-semibold text-foreground">
                  {apiMode ? 'Request submitted' : 'Demo request saved'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {apiMode
                    ? 'The backend accepted your request. Approval status is not synchronized yet.'
                    : 'Stored on this device · Approval workflow not connected'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form
            id="access-request-form"
            className="space-y-4"
            aria-busy={submission.busy}
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              await submission.run(() =>
                onSubmit({
                  toolId: selected.id,
                  reason: String(data.get('reason') ?? ''),
                  urgency:
                    data.get('urgency') === 'urgent' ? 'urgent' : 'standard',
                }),
              );
            }}
          >
            <label className="block text-sm text-foreground/65">
              Tool
              <select
                value={selected.id}
                disabled={submission.busy}
                onChange={(event) => onToolChange(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50"
              >
                {requestableTools.map((tool) => (
                  <option key={tool.id} value={tool.id}>
                    {tool.name} · {tool.owner}
                  </option>
                ))}
              </select>
            </label>
            <label
              htmlFor="access-reason"
              className="block text-sm text-foreground/65"
            >
              Business reason
              <Textarea
                id="access-reason"
                name="reason"
                maxLength={2000}
                disabled={submission.busy}
                required
                placeholder="Explain what you need to complete with this tool"
                className="mt-1.5 min-h-28 border-border bg-background text-foreground placeholder:text-muted-foreground"
              />
            </label>
            <label className="block text-sm text-foreground/65">
              Urgency
              <select
                defaultValue="standard"
                name="urgency"
                disabled={submission.busy}
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50"
              >
                <option value="standard">
                  Standard · within 2 business days
                </option>
                <option value="urgent">Urgent · work is blocked</option>
              </select>
            </label>
          </form>
        )}
        {submission.error && (
          <p role="alert" className="text-sm text-destructive">
            {submission.error}
          </p>
        )}
        <DialogFooter>
          <Button
            disabled={submission.busy}
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          >
            Close
          </Button>
          {!pending && (
            <Button
              type="submit"
              form="access-request-form"
              disabled={submission.busy}
              className="bg-primary text-primary-foreground hover:bg-primary"
            >
              {submission.busy
                ? 'Sending…'
                : apiMode
                  ? 'Request access'
                  : 'Save demo request'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToolWorkspaceDialog({
  tool,
  onClose,
  onStartTask,
}: {
  tool: Tool | null;
  onClose: () => void;
  onStartTask: (task: string) => void;
}) {
  return (
    <Dialog open={Boolean(tool)} onOpenChange={(open) => !open && onClose()}>
      {tool && (
        <DialogContent className="max-w-[calc(100%-2rem)] overflow-hidden border border-border bg-popover p-0 text-foreground shadow-2xl sm:max-w-xl">
          <div className="hub-dark-surface bg-[linear-gradient(120deg,rgba(17,79,82,.9),rgba(34,145,139,.55))] p-6">
            <div className="flex items-center gap-4">
              <AppMark tool={tool} size="lg" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
                  Company tool preview
                </p>
                <DialogTitle className="mt-1 text-2xl text-foreground">
                  {tool.name}
                </DialogTitle>
              </div>
            </div>
          </div>
          <div className="p-5">
            <DialogDescription className="text-sm leading-6 text-foreground/65">
              Choose a common action to preview. Company tools are not connected
              in this test version.
            </DialogDescription>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {tool.tasks.map((task) => (
                <button
                  key={task}
                  onClick={() => onStartTask(task)}
                  className="flex items-center justify-between rounded-xl border border-border bg-foreground/[0.025] p-3 text-left text-sm font-medium capitalize text-foreground/75 transition hover:border-primary/20 hover:bg-primary/[0.06] hover:text-foreground"
                >
                  {task}
                  <ArrowRight className="size-4 text-primary" />
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="border-t border-border bg-foreground/[0.02] p-4">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            >
              Return to hub
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Owns view state and delegates search, storage, and task routing to documented modules. */
function HubContent({
  initialName = 'ONE JARC',
  initialEmail = 'one.jarc@jarcgroup.ph',
}: {
  initialName?: string;
  initialEmail?: string;
}) {
  const auth = useAuth();
  const catalog = useToolCatalog();
  const { workspace, apiMode } = useBackend();
  const visibleNotifications = apiMode ? [] : notifications;
  const { tools } = catalog;
  const [adminSection, setAdminSection] = useState<AdminSection | null>(null);
  const storageUserId = auth.user!.id;
  const userStorage = useCallback(
    () => scopedHubStorage(window.localStorage, storageUserId),
    [storageUserId],
  );
  initialName = auth.user?.displayName ?? initialName;
  initialEmail = auth.user
    ? auth.user.role === 'admin'
      ? 'Administrator'
      : 'User'
    : initialEmail;
  const [activeView, setActiveView] = useState<View>('Home');
  const [query, setQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [isAnalyzing, startSearchTransition] = useTransition();
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [category, setCategory] = useState('All');
  // Browsing controls are session-only and never override recommendation ranking.
  const [directorySort, setDirectorySort] = useState<DirectorySort>('az');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [launchedTool, setLaunchedTool] = useState<Tool | null>(null);
  const [accessToolId, setAccessToolId] = useState<string | null>(null);
  const [accessRequests, setAccessRequests] = useState<string[]>([]);
  const [supportFlow, setSupportFlow] = useState<SupportFlow>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [statusSubscribed, setStatusSubscribed] = useState(false);
  const [statusUpdatedAt, setStatusUpdatedAt] = useState('just now');
  const [maintenanceVisible, setMaintenanceVisible] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [persistenceError, setPersistenceError] = useState('');
  const [taskPreview, setTaskPreview] = useState<{
    tool: Tool;
    task: string;
  } | null>(null);
  const [pendingTask, setPendingTask] = useState<{
    toolId: string;
    task: string;
  } | null>(null);
  const [incidentContext, setIncidentContext] = useState('');
  const lastSavedSnapshot = useRef('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Hash navigation is portable to static exports. Every direct admin view is
  // still evaluated by AdminConsole; no role comes from the URL.
  useEffect(() => {
    const sync = () => setAdminSection(readAdminRoute(window.location.hash));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  /** Profile-menu and admin-tab navigation share the same permission guard. */
  const openAdministration = (section: AdminSection) => {
    if (!can(auth.user, 'canManageToolCatalog')) return;
    setSettingsOpen(false);
    setAdminSection(section);
    navigateAdminLocation(section);
  };

  /** Existing event handlers share one accessible, actionable feedback surface. */
  const setLaunchMessage = (
    message: string,
    options: Omit<Feedback, 'message'> = {},
  ) => setFeedback({ message, ...options });

  const snapshot = useMemo<HubSnapshot>(
    () => ({
      favorites,
      recent,
      // API confirmations are session UI hints, not authoritative browser records.
      accessRequests: apiMode ? [] : accessRequests,
      preferences,
      readNotificationIds,
      statusSubscribed,
    }),
    [
      favorites,
      recent,
      accessRequests,
      apiMode,
      preferences,
      readNotificationIds,
      statusSubscribed,
    ],
  );

  useEffect(() => {
    if (preferencesReady) return;
    try {
      const { snapshot: restored, damaged } = loadHubSnapshot(
        userStorage(),
        DEFAULT_SNAPSHOT,
        tools.map((tool) => tool.id),
      );
      // This one-time effect hydrates an external browser store after server rendering.
      // oxlint-disable-next-line react/react-compiler
      setFavorites(restored.favorites);
      setRecent(restored.recent);
      setAccessRequests(apiMode ? [] : restored.accessRequests);
      setPreferences(restored.preferences);
      setReadNotificationIds(restored.readNotificationIds);
      setStatusSubscribed(restored.statusSubscribed);
      setMaintenanceVisible(restored.preferences.maintenanceBanner);
      // Hydration must not immediately overwrite unreadable or older saved values.
      lastSavedSnapshot.current = JSON.stringify(restored);
      if (damaged)
        setPersistenceError(
          'Some saved choices could not be restored. This session still works; save the current choices to repair this device’s copy.',
        );
    } catch {
      lastSavedSnapshot.current = JSON.stringify(DEFAULT_SNAPSHOT);
      setPersistenceError(
        'Browser storage is unavailable. Your choices will work for this session but may not survive a refresh.',
      );
    } finally {
      setPreferencesReady(true);
    }
  }, [preferencesReady, userStorage, tools, apiMode]);

  // Applying on the document also updates all dialogs rendered through portals.
  useEffect(() => {
    if (!preferencesReady) return;
    return watchAppearance({
      theme: preferences.theme,
      reduceMotion: preferences.reduceMotion,
    });
  }, [preferencesReady, preferences.theme, preferences.reduceMotion]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool(
        {
          name: 'search_company_tools',
          title: 'Search company tools',
          description:
            'Find approved company tools for a task, show the same recommendation results in the portal, and return the best matches with access and status information.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                minLength: 2,
                description:
                  'The tool name or task to solve, such as request time off or submit an expense.',
              },
            },
            required: ['query'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute(input) {
            requirePermission(auth.user, 'canUseSearch');
            if (
              typeof input !== 'object' ||
              input === null ||
              typeof (input as { query?: unknown }).query !== 'string' ||
              (input as { query: string }).query.trim().length < 2
            ) {
              throw new Error(
                'query must be a string with at least 2 characters',
              );
            }

            const nextQuery = (input as { query: string }).query.trim();
            // Agent-assisted search uses exactly the same ranking and clarification as the UI.
            const analysis = searchToolCatalog(tools, nextQuery);
            const matches = analysis.results.slice(0, 3);

            clearAdminLocation();
            setAdminSection(null);
            setActiveView('All tools');
            setQuery(nextQuery);
            setSearchDraft(nextQuery);
            return {
              query: nextQuery,
              correction: analysis.correction,
              clarification: analysis.clarification,
              recommendations: matches.map(({ tool, match }) => ({
                id: tool.id,
                name: tool.name,
                reason: match || tool.reason,
                status: tool.status,
                access: tool.access,
              })),
            };
          },
        },
        { signal: lifecycle.signal },
      );

      await context.registerTool(
        {
          name: 'save_company_tool_favorite',
          title: 'Save favorite company tool',
          description:
            'Add a published company tool to the same favorites list shown in the portal.',
          inputSchema: {
            type: 'object',
            properties: {
              toolId: {
                type: 'string',
                description: 'Stable ID of the published tool to save.',
              },
            },
            required: ['toolId'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const toolId =
              typeof input === 'object' && input !== null
                ? (input as { toolId?: unknown }).toolId
                : undefined;
            if (typeof toolId !== 'string') {
              throw new Error('toolId must be a string');
            }
            requirePermission(auth.user, 'canFavoriteTools');
            const tool = tools.find((candidate) => candidate.id === toolId);
            if (!tool)
              throw new Error('toolId does not match a published tool');

            setFavorites((current) =>
              current.includes(toolId) ? current : [toolId, ...current],
            );
            return { saved: true, toolId, name: tool.name };
          },
        },
        { signal: lifecycle.signal },
      );
    };

    void register().catch((error) => {
      console.warn('WebMCP registration was unavailable.', error);
    });
    return () => lifecycle.abort();
  }, [tools, auth.user]);

  useEffect(() => {
    if (
      !preferencesReady ||
      lastSavedSnapshot.current === JSON.stringify(snapshot)
    )
      return;
    try {
      if (!saveHubSnapshot(userStorage(), snapshot))
        throw new Error('Storage unavailable');
      lastSavedSnapshot.current = JSON.stringify(snapshot);
      // Report the external storage result, not a value derived from React state.
      // oxlint-disable-next-line react/react-compiler
      setPersistenceError('');
    } catch {
      setPersistenceError(
        'Your latest choices are in this session only. Browser storage could not save them.',
      );
    }
  }, [snapshot, preferencesReady, userStorage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k' &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        clearAdminLocation();
        setAdminSection(null);
        setActiveView('All tools');
        window.setTimeout(() => searchRef.current?.focus(), 0);
      }
      // Global shortcuts must never consume punctuation inside forms or editors.
      const editing =
        event.target instanceof Element &&
        Boolean(
          event.target.closest(
            'input, textarea, select, [contenteditable="true"]',
          ),
        );
      if (
        event.key === '/' &&
        !editing &&
        !document.querySelector('[role="dialog"]') &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        clearAdminLocation();
        setAdminSection(null);
        setActiveView('All tools');
        window.setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!feedback || feedback.tone === 'error') return;
    const timer = window.setTimeout(
      () => setFeedback(null),
      feedback.action ? 9000 : 5000,
    );
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const searchAnalysis = useMemo(
    () => searchToolCatalog(tools, query),
    [query, tools],
  );
  const rankedResults = searchAnalysis.results;

  const categories = useMemo(
    () => [
      'All',
      ...Array.from(new Set(tools.map((tool) => tool.category))).sort(),
    ],
    [tools],
  );

  const visibleResults = useMemo(() => {
    if (activeView === 'All tools' && !query)
      return arrangeDirectory(rankedResults, category, directorySort, recent);
    let results = rankedResults;
    if (activeView === 'Favorites')
      results = results.filter(({ tool }) => favorites.includes(tool.id));
    if (activeView === 'Recent')
      results = results.filter(({ tool }) => recent.includes(tool.id));
    if (activeView === 'Categories' && category !== 'All')
      results = results.filter(({ tool }) => tool.category === category);
    return results;
  }, [
    activeView,
    category,
    directorySort,
    favorites,
    rankedResults,
    recent,
    query,
  ]);

  const favoriteTools = tools.filter((tool) => favorites.includes(tool.id));
  const recentTools = recent
    .map((id) => tools.find((tool) => tool.id === id))
    .filter(Boolean) as Tool[];
  const unreadCount = preferences.statusAlerts
    ? visibleNotifications.filter(
        (notice) => notice.unread && !readNotificationIds.includes(notice.id),
      ).length
    : 0;
  const cardGridClass = preferences.compactCards
    ? 'hub-tool-grid hub-tool-grid-compact'
    : 'hub-tool-grid';

  // Reconcile open dialogs when another tab disables/unpublishes or edits a tool.
  // A stale object must not bypass the latest published launch/access rules.
  useEffect(() => {
    // Synchronize dialog selections after an external repository update.
    // oxlint-disable-next-line react/react-compiler
    setSelectedTool((current) =>
      current ? (tools.find((tool) => tool.id === current.id) ?? null) : null,
    );
    setLaunchedTool((current) =>
      current ? (tools.find((tool) => tool.id === current.id) ?? null) : null,
    );
    setAccessToolId((current) =>
      tools.some(
        (tool) => tool.id === current && tool.access === 'Request access',
      )
        ? current
        : null,
    );
    setTaskPreview((current) =>
      current && tools.some((tool) => tool.id === current.tool.id)
        ? current
        : null,
    );
  }, [tools]);

  const toggleFavorite = (toolId: string) => {
    const tool = tools.find((candidate) => candidate.id === toolId);
    if (!can(auth.user, 'canFavoriteTools') || !tool) return;
    const removing = favorites.includes(toolId);
    setFavorites((current) =>
      removing ? current.filter((id) => id !== toolId) : [toolId, ...current],
    );
    setLaunchMessage(
      `${tool?.name ?? 'Tool'} ${removing ? 'removed from' : 'added to'} favorites.`,
      removing
        ? {
            action: {
              label: 'Undo',
              run: () => {
                setFavorites((current) =>
                  current.includes(toolId) ? current : [toolId, ...current],
                );
                setLaunchMessage(
                  `${tool?.name ?? 'Tool'} restored to favorites.`,
                );
              },
            },
          }
        : {},
    );
  };

  /** Retry preserves current in-memory choices instead of resetting the employee’s workspace. */
  const retryPersistence = () => {
    try {
      if (!saveHubSnapshot(userStorage(), snapshot))
        throw new Error('Storage unavailable');
      lastSavedSnapshot.current = JSON.stringify(snapshot);
      setPersistenceError('');
      setLaunchMessage('Your choices are now saved on this device.');
    } catch {
      setPersistenceError(
        'Saving is still unavailable. Keep this tab open to retain this session’s choices, or enable browser storage and retry.',
      );
    }
  };

  const openToolWorkspace = (tool: Tool) => {
    if (
      !can(auth.user, 'canOpenTools') ||
      !tools.some((item) => item.id === tool.id)
    )
      return;
    if (
      ['Restricted', 'Coming Soon'].includes(tool.access) ||
      ['Outage', 'Coming Soon'].includes(tool.status)
    ) {
      setLaunchMessage(
        'This tool is not currently available to open. Contact its owner for help.',
        { tone: 'info' },
      );
      return;
    }
    setRecent((current) =>
      [tool.id, ...current.filter((id) => id !== tool.id)].slice(0, 6),
    );
    setSelectedTool(null);
    if (tool.applicationUrl) {
      openCatalogLink(tool.applicationUrl, tool.openBehavior);
      return;
    }
    setLaunchedTool(tool);
    setLaunchMessage(`${tool.name} preview opened.`, { tone: 'info' });
  };

  const launchTool = (tool: Tool) => {
    if (
      !can(auth.user, 'canOpenTools') ||
      !tools.some((item) => item.id === tool.id)
    )
      return;
    setPendingTask(null);
    if (tool.access === 'Request access') {
      setAccessToolId(tool.id);
    } else if (tool.status === 'Maintenance') {
      setSelectedTool(tool);
    } else {
      openToolWorkspace(tool);
    }
  };

  const selectView = (view: View) => {
    setAdminSection(null);
    clearAdminLocation();
    setActiveView(view);
    setQuery('');
    setSearchDraft('');
    if (view !== 'Categories') setCategory('All');
    if (view === 'Home')
      setGreetingIndex((current) => (current + 1) % homeGreetings.length);
  };

  const focusGlobalSearch = () => {
    selectView('All tools');
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const submitSearch = (value = searchDraft) => {
    if (!can(auth.user, 'canUseSearch')) return;
    setAdminSection(null);
    clearAdminLocation();
    const nextQuery = value.trim();
    if (!nextQuery) {
      searchRef.current?.focus();
      return;
    }
    // React schedules the local calculation; no artificial loading delay or API claim.
    startSearchTransition(() => {
      setQuery(nextQuery);
      setCategory('All');
      setSearchDraft(nextQuery);
      setActiveView('All tools');
    });
  };

  /** One routing path for task buttons in recommendations, cards, and workspaces. */
  const startToolTask = (
    tool: Tool,
    task: string,
    maintenanceAcknowledged = false,
  ) => {
    if (
      !can(auth.user, 'canOpenTools') ||
      !tools.some((item) => item.id === tool.id)
    )
      return;
    const route = getTaskRoute(tool, task, maintenanceAcknowledged);
    setLaunchedTool(null);
    if (route === 'invalid') {
      setLaunchMessage('This action is no longer listed for the tool.', {
        tone: 'error',
      });
      return;
    }
    if (route === 'blocked') {
      setLaunchMessage(
        'This tool is restricted or unavailable. Contact its owner.',
        { tone: 'info' },
      );
      return;
    }
    if (route === 'access') {
      setSelectedTool(null);
      setAccessToolId(tool.id);
      return;
    }
    if (route === 'maintenance') {
      setPendingTask({ toolId: tool.id, task });
      setSelectedTool(tool);
      return;
    }
    setSelectedTool(null);
    setPendingTask(null);
    if (route === 'incident') {
      setIncidentContext(query || task);
      setSupportFlow('problem');
      return;
    }
    if (route === 'permissions') {
      setAccessToolId(
        tools.find((candidate) => candidate.access === 'Request access')?.id ??
          null,
      );
      return;
    }
    setRecent((current) =>
      [tool.id, ...current.filter((id) => id !== tool.id)].slice(0, 6),
    );
    const action = tool.quickActions?.find((item) => item.label === task);
    if (action?.type === 'url') {
      openCatalogLink(action.target, tool.openBehavior);
      return;
    }
    setTaskPreview({ tool, task: action?.target ?? task });
  };

  const submitAccessRequest = async (input: AccessRequestInput) => {
    const { toolId } = input;
    const tool = tools.find((candidate) => candidate.id === toolId);
    if (
      !can(auth.user, 'canRequestAccess') ||
      !tool ||
      tool.access !== 'Request access'
    )
      throw new Error('This tool is not available for access requests.');
    const receipt = await workspace.submitAccessRequest(input);
    setAccessRequests((current) =>
      current.includes(toolId) ? current : [toolId, ...current],
    );
    setAccessToolId(null);
    setLaunchMessage(
      receipt.delivery === 'api'
        ? `Access request submitted. Reference: ${receipt.reference}.`
        : `Demo access request saved for ${tool?.name ?? 'the selected tool'}. No approval request has been sent.`,
      { tone: 'info' },
    );
    return receipt;
  };

  const openNotification = (noticeId: string) => {
    setReadNotificationIds((current) =>
      current.includes(noticeId) ? current : [...current, noticeId],
    );
    setNotificationsOpen(false);
    if (noticeId === 'maintenance')
      setSelectedTool(
        tools.find((tool) => tool.id === 'service-center') ?? null,
      );
    else if (noticeId === 'connect')
      setSelectedTool(tools.find((tool) => tool.id === 'connect') ?? null);
    else selectView('System status');
  };

  const userInitials = initialName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sectionTitle = query
    ? 'Recommended for you'
    : activeView === 'Home'
      ? 'All your tools'
      : activeView === 'Categories' && category !== 'All'
        ? category
        : activeView;

  return (
    <SidebarProvider
      defaultOpen
      style={{ '--sidebar-width': '15.5rem' } as React.CSSProperties}
    >
      <Sidebar collapsible="icon" className="border-border bg-sidebar">
        <SidebarHeader className="px-3 pb-5 pt-4 group-data-[collapsible=icon]:px-1.5">
          <button
            onClick={() => selectView('Home')}
            aria-label="OneJarc home"
            title="OneJarc home"
            className="flex h-11 min-w-0 items-center gap-3 rounded-xl px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0"
          >
            <BrandMark />
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-sm font-bold tracking-[0.04em] text-foreground">
                OneJarc
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Company tools
              </span>
            </span>
          </button>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">
              Workspace
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={!settingsOpen && activeView === item.label}
                      onClick={() => selectView(item.label)}
                      className="h-10 rounded-xl text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground data-active:bg-primary/[0.11] data-active:text-primary"
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.label === 'Favorites' && (
                      <SidebarMenuBadge className="text-muted-foreground">
                        {favorites.length}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-muted-foreground">
              Support
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="System status"
                    isActive={!settingsOpen && activeView === 'System status'}
                    onClick={() => selectView('System status')}
                    className="h-10 rounded-xl text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground data-active:bg-primary/[0.11] data-active:text-primary"
                  >
                    <Compass />
                    <span>System status</span>
                    <span className="ml-auto size-2 rounded-full bg-amber-400" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Get help"
                    isActive={!settingsOpen && activeView === 'Get help'}
                    onClick={() => selectView('Get help')}
                    className="h-10 rounded-xl text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground data-active:bg-primary/[0.11] data-active:text-primary"
                  >
                    <HelpCircle />
                    <span>Get help</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarSettingsItem
                  active={settingsOpen}
                  onOpen={() => setSettingsOpen(true)}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <div className="rounded-2xl border border-border bg-foreground/[0.035] p-3 group-data-[collapsible=icon]:hidden">
            <p className="text-xs font-medium text-foreground/78">
              Missing a tool?
            </p>
            <p className="mt-1 text-xs leading-4 text-muted-foreground">
              Suggest an addition for the catalog.
            </p>
            <button
              onClick={() => selectView('Get help')}
              className="mt-3 text-xs font-semibold text-primary hover:text-primary"
            >
              Send a request →
            </button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl md:px-7">
          <SidebarTrigger className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground" />
          {/* Keep navigation and identity readable; the search shortcut yields width on laptops. */}
          <div className="hidden shrink-0 items-center gap-2 whitespace-nowrap text-sm text-muted-foreground sm:flex">
            <span>Workspace</span>
            <ChevronRight className="size-3" />
            <span className="text-foreground/78">
              {adminSection ? 'Administration' : activeView}
            </span>
          </div>
          <button
            onClick={focusGlobalSearch}
            className="ml-auto hidden h-9 min-w-0 max-w-[360px] flex-1 items-center gap-2 rounded-xl border border-border bg-foreground/[0.035] px-3 text-sm text-muted-foreground transition hover:border-border hover:bg-foreground/[0.05] md:flex"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Search tools or describe a task</span>
            <kbd className="ml-auto hidden shrink-0 whitespace-nowrap rounded border border-border bg-foreground/5 px-1.5 py-0.5 text-xs text-muted-foreground xl:block">
              ⌘ K
            </kbd>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotificationsOpen(true)}
              className="relative text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              aria-label={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            >
              <Bell />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-400 ring-2 ring-background" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-xs font-semibold text-foreground/75 outline-none ring-primary/50 transition hover:bg-foreground/[0.05] focus-visible:ring-2"
                    aria-label="Open ONE JARC profile menu"
                  />
                }
              >
                <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-pink-400 text-xs font-bold text-white">
                  {userInitials}
                </span>
                <span className="hidden whitespace-nowrap sm:inline">
                  ONE JARC
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 border border-border bg-popover p-1.5 text-foreground shadow-2xl"
              >
                {/* Base UI group labels need a group provider, even for the profile header. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2 py-2.5">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {initialName}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                      {initialEmail}
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-foreground/[0.07]" />
                {/* Administration belongs to the account menu, not personal
                    preferences. The handler and destination also enforce RBAC. */}
                {can(auth.user, 'canManageToolCatalog') && (
                  <DropdownMenuItem
                    onClick={() => openAdministration('tools')}
                    className="h-9 rounded-lg px-2 text-foreground/65 focus:bg-foreground/[0.06] focus:text-foreground"
                  >
                    <ShieldCheck /> Administration
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setSettingsOpen(true)}
                  className="h-9 rounded-lg px-2 text-foreground/65 focus:bg-foreground/[0.06] focus:text-foreground"
                >
                  <Settings /> Preferences
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => selectView('Get help')}
                  className="h-9 rounded-lg px-2 text-foreground/65 focus:bg-foreground/[0.06] focus:text-foreground"
                >
                  <LifeBuoy /> Help center
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-foreground/[0.07]" />
                <DropdownMenuItem
                  onClick={() => void auth.signOut()}
                  className="h-9 rounded-lg px-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-7 md:px-8 md:pt-9">
          {/* A persistent recovery notice is more useful than a disappearing save error. */}
          {persistenceError && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-hub-warning/25 bg-hub-warning/[0.07] p-4"
            >
              <AlertTriangle className="size-5 shrink-0 text-hub-warning" />
              <p className="min-w-0 flex-1 text-sm leading-6 text-hub-warning">
                {persistenceError}
              </p>
              <Button
                onClick={retryPersistence}
                variant="outline"
                className="border-hub-warning/25 bg-transparent text-hub-warning"
              >
                Retry saving
              </Button>
            </div>
          )}
          {adminSection ? (
            <AdminConsole
              section={adminSection}
              onSection={openAdministration}
              onExit={() => selectView('Home')}
            />
          ) : activeView === 'System status' ? (
            <StatusView
              onOpenTool={setSelectedTool}
              lastUpdated={statusUpdatedAt}
              subscribed={statusSubscribed}
              onRefresh={() => {
                setStatusUpdatedAt(
                  new Date().toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  }),
                );
                setLaunchMessage('System status refreshed.');
              }}
              onToggleSubscription={() => {
                setStatusSubscribed((current) => !current);
                setLaunchMessage(
                  statusSubscribed
                    ? 'Status updates turned off.'
                    : 'You will receive status updates.',
                );
              }}
            />
          ) : activeView === 'Get help' ? (
            <HelpView
              onReportProblem={() => {
                setIncidentContext('');
                setSupportFlow('problem');
              }}
              onReadGuide={() => setSupportFlow('guides')}
              onRequestAccess={() =>
                setAccessToolId(
                  tools.find((tool) => tool.access === 'Request access')?.id ??
                    null,
                )
              }
              onSuggestion={async (suggestion) => {
                const receipt = await workspace.submitSuggestion(suggestion);
                const message =
                  receipt.delivery === 'api'
                    ? `Suggestion submitted. Reference: ${receipt.reference}.`
                    : 'Demo suggestion saved on this device. Nothing has been sent for review.';
                setLaunchMessage(message, { tone: 'info' });
                return message;
              }}
            />
          ) : (
            <div>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  {activeView === 'Home' && (
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
                      Your workspace
                    </p>
                  )}
                  <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground md:text-3xl">
                    {activeView === 'Home'
                      ? `${homeGreetings[greetingIndex]}, ONE JARC`
                      : activeView}
                  </h1>
                  {activeView === 'All tools' && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Find and access approved company tools.
                    </p>
                  )}
                </div>
                {activeView === 'Home' && (
                  <span className="hidden text-sm text-muted-foreground sm:inline">
                    {tools.length} tools available
                  </span>
                )}
              </div>

              {/* Fresh catalog guidance stays outside the collapsed tool collection. */}
              {activeView === 'Home' && !query && tools.length === 0 && (
                <section className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-5">
                  <h2 className="font-semibold">No tools available yet</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{can(auth.user, 'canManageToolCatalog') ? 'Create a category, add your company tools, then publish them to this workspace.' : 'Your administrator will add company tools here. Once published, you can search, open, and favorite them.'}</p>
                  {can(auth.user, 'canManageToolCatalog') && <Button className="mt-4 min-h-11" onClick={() => openAdministration(catalog.snapshot.categories.length ? 'tools' : 'categories')}>{catalog.snapshot.categories.length ? 'Manage tools' : 'Create your first category'}</Button>}
                </section>
              )}
              {maintenanceVisible &&
                !apiMode &&
                tools.some(
                  (tool) =>
                    tool.id === 'service-center' &&
                    tool.status === 'Maintenance',
                ) && (
                  <div className="mb-4 flex items-center gap-3 rounded-xl border border-hub-warning/15 bg-hub-warning/[0.055] px-3 py-2.5 text-sm text-hub-warning/80">
                    <CalendarClock className="size-4 shrink-0 text-hub-warning" />
                    <p className="min-w-0 flex-1">
                      <strong className="font-semibold text-hub-warning">
                        Planned maintenance:
                      </strong>{' '}
                      Service Center will be read-only today, 7:00–8:00 PM.
                    </p>
                    <button
                      onClick={() =>
                        setSelectedTool(
                          tools.find((tool) => tool.id === 'service-center') ??
                            null,
                        )
                      }
                      className="hidden shrink-0 text-xs font-semibold text-hub-warning hover:text-foreground sm:block"
                    >
                      View details
                    </button>
                    <button
                      onClick={() => {
                        setMaintenanceVisible(false);
                        setPreferences((current) => ({
                          ...current,
                          maintenanceBanner: false,
                        }));
                      }}
                      className="rounded-md p-1 text-hub-warning/60 hover:bg-foreground/[0.06] hover:text-foreground"
                      aria-label="Dismiss maintenance notice"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}

              {/* Home keeps guided onboarding; other views reuse the same input as
                  a compact search surface. Global search still focuses this one field. */}
              <section
                aria-label="Find a company tool"
                className={
                  activeView === 'Home'
                    ? 'hub-dark-surface relative overflow-hidden rounded-[1.4rem] border border-primary/15 bg-[linear-gradient(120deg,#133b43_0%,#176b6f_48%,#56c8bd_130%)] px-5 py-7 md:px-8 md:py-8'
                    : 'min-w-0'
                }
              >
                {activeView === 'Home' && (
                  <div className="pointer-events-none absolute -left-24 top-10 h-36 w-[70%] rotate-[-7deg] rounded-[50%] border border-primary/10" />
                )}
                <div
                  className={
                    activeView === 'Home'
                      ? 'relative grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center'
                      : ''
                  }
                >
                  {activeView === 'Home' && (
                    <div>
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-foreground/[0.08] px-3 py-1.5 text-xs font-medium text-cyan-50/85">
                        <Sparkles className="size-3.5" /> Guided search
                      </div>
                      <h2 className="max-w-lg text-2xl font-semibold tracking-[-0.035em] text-foreground md:text-[2rem]">
                        Not sure which tool to use?
                      </h2>
                      <p className="mt-3 max-w-lg text-sm leading-6 text-cyan-50/65">
                        Describe what you need to get done. We’ll match your
                        task with the right company tool and explain why.
                      </p>
                    </div>
                  )}
                  <div
                    className={
                      activeView === 'Home'
                        ? 'rounded-2xl border border-border bg-[#082428]/45 p-3'
                        : ''
                    }
                  >
                    <label htmlFor="tool-search" className="sr-only">
                      Describe what you need to do
                    </label>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        submitSearch();
                      }}
                      className={
                        activeView === 'Home'
                          ? 'flex items-center gap-2 rounded-xl bg-white p-2 pl-4'
                          : 'flex min-w-0 items-center gap-2 rounded-xl border border-input bg-card p-1.5 pl-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/20'
                      }
                    >
                      <Search className="size-5 shrink-0 text-slate-400" />
                      <Input
                        ref={searchRef}
                        id="tool-search"
                        value={searchDraft}
                        onChange={(event) => setSearchDraft(event.target.value)}
                        placeholder={
                          activeView === 'Home'
                            ? 'Try “I need to request time off”'
                            : 'Search tools or describe a task…'
                        }
                        className={`h-11 min-w-0 border-0 bg-transparent px-1 shadow-none outline-none focus-visible:ring-0 ${activeView === 'Home' ? 'text-slate-950 placeholder:text-slate-500' : 'text-foreground placeholder:text-muted-foreground'}`}
                      />
                      {searchDraft && (
                        <Button
                          type="button"
                          onClick={() => {
                            setSearchDraft('');
                            setQuery('');
                            searchRef.current?.focus();
                          }}
                          className={`size-11 shrink-0 rounded-lg bg-transparent p-0 ${activeView === 'Home' ? 'text-slate-600 hover:bg-slate-100' : 'text-muted-foreground hover:bg-accent'}`}
                          aria-label="Clear search"
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                      <Button
                        type="submit"
                        disabled={!searchDraft.trim() || isAnalyzing}
                        className="h-11 shrink-0 rounded-lg bg-[#0f7474] px-3 text-white hover:bg-[#0c6262] disabled:opacity-50"
                        aria-label="Analyze problem and recommend tools"
                      >
                        {isAnalyzing ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Search className="size-4" />
                        )}
                        <span className="hidden sm:inline">
                          {isAnalyzing ? 'Analyzing' : 'Analyze'}
                        </span>
                      </Button>
                    </form>
                    <p
                      aria-live="polite"
                      className={`mt-2 min-h-4 px-1 text-xs ${activeView === 'Home' ? 'text-cyan-50/80' : 'text-muted-foreground'}`}
                    >
                      {isAnalyzing
                        ? 'Finding relevant tools…'
                        : query
                          ? `${rankedResults.length} ${rankedResults.length === 1 ? 'match' : 'matches'} for “${query}”`
                          : 'Describe the problem in your own words.'}
                    </p>
                    {activeView === 'Home' && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 px-1 text-xs text-cyan-50/80">
                        <span>Popular:</span>
                        {[
                          'Request leave',
                          'Report an issue',
                          'Make a presentation',
                        ].map((term) => (
                          <button
                            key={term}
                            onClick={() => {
                              setSearchDraft(term);
                              submitSearch(term);
                            }}
                            className="rounded-full border border-border bg-foreground/[0.06] px-2.5 py-1 transition hover:bg-foreground/[0.12] hover:text-foreground"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Spelling and ambiguity are explained beside the results, without inventing certainty. */}
              {query && searchAnalysis.correction && (
                <output className="mt-4 block text-sm text-foreground/75">
                  Interpreted as{' '}
                  <span className="font-medium text-primary">
                    “{searchAnalysis.correction}”
                  </span>
                  . Your original description is kept above.
                </output>
              )}
              {query && searchAnalysis.clarification && (
                <section
                  aria-label="Clarify your task"
                  className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.045] p-5"
                >
                  <h3 className="text-base font-semibold text-foreground">
                    {searchAnalysis.clarification.question}
                  </h3>
                  <p className="mt-1 text-sm text-foreground/65">
                    Choose an option to narrow the recommendation, or edit your
                    description.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {searchAnalysis.clarification.options.map((option) => (
                      <Button
                        key={option.label}
                        onClick={() => {
                          setSearchDraft(option.query);
                          submitSearch(option.query);
                        }}
                        variant="outline"
                        className="h-auto min-h-10 whitespace-normal border-primary/20 bg-transparent text-primary hover:bg-primary/10"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </section>
              )}

              {activeView === 'Home' &&
                !query &&
                tools.some((tool) => tool.featured) && (
                  <section className="mt-8" aria-label="Featured tools">
                    <h2 className="mb-4 text-base font-semibold">
                      Featured tools
                    </h2>
                    <div className={cardGridClass}>
                      {tools
                        .filter((tool) => tool.featured)
                        .map((tool) => (
                          <ToolCard
                            key={tool.id}
                            tool={tool}
                            favorite={favorites.includes(tool.id)}
                            onFavorite={() => toggleFavorite(tool.id)}
                            onDetails={() => setSelectedTool(tool)}
                            onLaunch={() => launchTool(tool)}
                            onTask={(task) => startToolTask(tool, task)}
                            requestPending={accessRequests.includes(tool.id)}
                          />
                        ))}
                    </div>
                  </section>
                )}

              {activeView === 'Home' && !query && favoriteTools.length > 0 && (
                <section className="mt-8" aria-labelledby="favorites-title">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2
                        id="favorites-title"
                        className="text-base font-semibold text-foreground"
                      >
                        Favorites
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Your everyday shortcuts
                      </p>
                    </div>
                    <Button
                      onClick={() => selectView('Favorites')}
                      variant="ghost"
                      className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                    >
                      View all <ChevronRight />
                    </Button>
                  </div>
                  <div className={cardGridClass}>
                    {favoriteTools.slice(0, 3).map((tool) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        favorite
                        requestPending={accessRequests.includes(tool.id)}
                        onFavorite={() => toggleFavorite(tool.id)}
                        onDetails={() => {
                          setPendingTask(null);
                          setSelectedTool(tool);
                        }}
                        onLaunch={() => launchTool(tool)}
                        onTask={(task) => startToolTask(tool, task)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {activeView === 'Home' && !query && recentTools.length > 0 && (
                <section className="mt-8" aria-labelledby="recent-title">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2
                        id="recent-title"
                        className="text-base font-semibold text-foreground"
                      >
                        Pick up where you left off
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Recently opened tools
                      </p>
                    </div>
                    <button
                      onClick={() => selectView('Recent')}
                      className="text-xs font-semibold text-primary hover:text-primary"
                    >
                      See recent
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recentTools.slice(0, 2).map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => launchTool(tool)}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/20 hover:bg-accent"
                      >
                        <AppMark tool={tool} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {tool.name}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Opened recently
                          </span>
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {activeView === 'Categories' && !query && (
                <div
                  className="mt-7 flex flex-wrap gap-2"
                  aria-label="Filter by category"
                >
                  {categories.map((item) => (
                    <button
                      key={item}
                      onClick={() => setCategory(item)}
                      aria-pressed={category === item}
                      className={`rounded-full border px-3 py-2 text-xs font-medium transition ${category === item ? 'border-primary/25 bg-primary/[0.1] text-primary' : 'border-border bg-foreground/[0.025] text-muted-foreground hover:border-border hover:text-foreground'}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}

              <ToolResultsSection
                key={`${activeView}:${Boolean(query)}:${activeView === 'Home' ? greetingIndex : ''}`}
                title={sectionTitle}
                description={
                  query
                    ? `${visibleResults.length} ${visibleResults.length === 1 ? 'match' : 'matches'} for “${query}”`
                    : activeView === 'Favorites'
                      ? 'Saved on this device'
                      : activeView === 'Recent'
                        ? 'Your latest destinations'
                        : 'Tools approved or requestable for your role'
                }
                count={visibleResults.length}
                collapsible={activeView === 'Home' && !query}
                compactHeader={activeView === 'All tools' && !query}
                onBrowse={() => selectView('All tools')}
                actions={
                  activeView === 'All tools' && !query ? (
                    <DirectoryControls
                      categories={categories}
                      category={category}
                      sort={directorySort}
                      onCategory={setCategory}
                      onSort={setDirectorySort}
                    />
                  ) : activeView === 'Recent' && recent.length > 0 ? (
                    <Button
                      onClick={() => {
                        setRecent([]);
                        setLaunchMessage('Recent tools cleared.');
                      }}
                      variant="ghost"
                      className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                    >
                      Clear recent
                    </Button>
                  ) : null
                }
              >
                {visibleResults.length ? (
                  <div className={cardGridClass}>
                    {visibleResults.map(({ tool, match, bestTask }, index) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        match={query ? match : undefined}
                        primaryTask={query ? bestTask : undefined}
                        bestMatch={Boolean(
                          query && index === 0 && !searchAnalysis.clarification,
                        )}
                        favorite={favorites.includes(tool.id)}
                        requestPending={accessRequests.includes(tool.id)}
                        onFavorite={() => toggleFavorite(tool.id)}
                        onDetails={() => {
                          setPendingTask(null);
                          setSelectedTool(tool);
                        }}
                        onLaunch={() => launchTool(tool)}
                        onTask={(task) => startToolTask(tool, task)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-foreground/[0.02] px-5 py-14 text-center">
                    <div className="mx-auto grid size-11 place-items-center rounded-xl bg-foreground/[0.05] text-muted-foreground">
                      {activeView === 'Favorites' && !query ? (
                        <Heart className="size-5" />
                      ) : activeView === 'Recent' && !query ? (
                        <Clock3 className="size-5" />
                      ) : (
                        <Search className="size-5" />
                      )}
                    </div>
                    <h3 className="mt-4 font-semibold text-foreground">
                      {activeView === 'Favorites' && !query
                        ? 'No favorites saved'
                        : activeView === 'Recent' && !query
                          ? 'No recent tools'
                          : 'No matching tools yet'}
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      {activeView === 'Favorites' && !query
                        ? 'Use the heart on any tool to keep it within easy reach.'
                        : activeView === 'Recent' && !query
                          ? 'Tools you open will appear here automatically.'
                          : 'Try describing the outcome you need, use a category, or ask the service desk to point you in the right direction.'}
                    </p>
                    <div className="mt-5 flex justify-center gap-2">
                      {query && (
                        <Button
                          onClick={() => {
                            setQuery('');
                            setSearchDraft('');
                          }}
                          variant="outline"
                          className="border-border bg-transparent text-foreground hover:bg-foreground/[0.05]"
                        >
                          Clear search
                        </Button>
                      )}
                      <Button
                        onClick={() =>
                          selectView(
                            activeView === 'Favorites' ||
                              activeView === 'Recent'
                              ? 'All tools'
                              : 'Get help',
                          )
                        }
                        className="bg-primary text-primary-foreground hover:bg-primary"
                      >
                        {activeView === 'Favorites' || activeView === 'Recent'
                          ? 'Browse tools'
                          : 'Ask for help'}
                      </Button>
                    </div>
                  </div>
                )}
              </ToolResultsSection>
            </div>
          )}
        </main>

        {/* Interactive feedback supports Undo/Dismiss; persistent errors stay until handled. */}
        {feedback && (
          <div className="fixed bottom-5 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-popover/95 p-3 text-sm text-foreground shadow-2xl backdrop-blur-xl">
              {feedback.tone === 'error' ? (
                <AlertTriangle className="size-5 shrink-0 text-hub-warning" />
              ) : feedback.tone === 'info' ? (
                <Compass className="size-5 shrink-0 text-primary" />
              ) : (
                <Check className="size-5 shrink-0 text-hub-success" />
              )}
              <p
                role={feedback.tone === 'error' ? 'alert' : 'status'}
                className="min-w-0 flex-1 leading-5"
              >
                {feedback.message}
              </p>
              {feedback.action && (
                <Button
                  onClick={feedback.action.run}
                  variant="ghost"
                  className="text-primary hover:bg-foreground/10"
                >
                  {feedback.action.label}
                </Button>
              )}
              <Button
                aria-label="Dismiss message"
                size="icon"
                variant="ghost"
                onClick={() => setFeedback(null)}
                className="shrink-0 text-foreground/70"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </SidebarInset>

      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent
          side="right"
          className="w-full border-border bg-popover p-0 text-foreground sm:max-w-md"
        >
          <SheetHeader className="border-b border-border px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Bell className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg text-foreground">
                  Notifications
                </SheetTitle>
                <SheetDescription className="text-muted-foreground">
                  Updates relevant to your tools
                </SheetDescription>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() =>
                    setReadNotificationIds(
                      visibleNotifications
                        .filter((notice) => notice.unread)
                        .map((notice) => notice.id),
                    )
                  }
                  className="text-xs font-semibold text-primary hover:text-primary"
                >
                  Mark all read
                </button>
              )}
            </div>
          </SheetHeader>
          <div className="space-y-2 overflow-y-auto p-3">
            {!preferences.statusAlerts && (
              <div className="rounded-xl border border-border bg-foreground/[0.025] p-4 text-sm text-muted-foreground">
                Status alerts are paused. Turn them back on in Preferences.
              </div>
            )}
            {visibleNotifications.length === 0 && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No notifications yet. Live service alerts are not connected.</p>}
            {visibleNotifications.map((notice) => (
              <button
                key={notice.id}
                onClick={() => openNotification(notice.id)}
                className="relative w-full rounded-2xl border border-border bg-foreground/[0.025] p-4 text-left transition hover:border-border hover:bg-foreground/[0.045]"
              >
                {notice.unread && !readNotificationIds.includes(notice.id) && (
                  <span className="absolute right-4 top-4 size-2 rounded-full bg-primary" />
                )}
                <div className="flex items-start gap-3 pr-4">
                  <notice.icon
                    className={`mt-0.5 size-5 shrink-0 ${notice.color}`}
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {notice.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                      {notice.message}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {notice.time}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            <Button
              onClick={() => {
                setNotificationsOpen(false);
                selectView('System status');
              }}
              variant="outline"
              className="mt-2 w-full border-border bg-transparent text-foreground/65 hover:bg-foreground/[0.05] hover:text-foreground"
            >
              View full system status
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(selectedTool)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTool(null);
            setPendingTask(null);
          }
        }}
      >
        {selectedTool && (
          <DialogContent className="hub-tool-details max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] overflow-y-auto border border-border bg-popover p-0 text-foreground shadow-2xl sm:max-w-lg">
            <DialogHeader className="border-b border-border p-5 pr-12">
              <div className="flex items-center gap-4">
                <AppMark tool={selectedTool} size="lg" />
                <div>
                  <DialogTitle className="text-xl font-semibold text-foreground">
                    {selectedTool.name}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-muted-foreground">
                    {selectedTool.category} · Owned by {selectedTool.owner}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="px-5 pb-1">
              {selectedTool.status !== 'Operational' && (
                <div
                  className={`mb-5 flex gap-3 rounded-xl border p-3.5 ${selectedTool.status === 'Maintenance' ? 'border-hub-warning/15 bg-hub-warning/[0.055]' : 'border-hub-warning/15 bg-hub-warning/[0.055]'}`}
                >
                  <AlertTriangle
                    className={`mt-0.5 size-4 shrink-0 ${selectedTool.status === 'Maintenance' ? 'text-hub-warning' : 'text-hub-warning'}`}
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedTool.status}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {selectedTool.statusNote}
                    </p>
                  </div>
                </div>
              )}
              <p className="text-sm leading-6 text-muted-foreground">
                {selectedTool.description}
              </p>
              {selectedTool.subtitle && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedTool.subtitle}
                </p>
              )}
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ['Team', selectedTool.team],
                  ['Lifecycle', selectedTool.lifecycle],
                  ['Support contact', selectedTool.supportContact],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ))}
              </dl>
              <div className="mt-3 flex flex-wrap gap-3">
                {[
                  ['Documentation', selectedTool.documentationUrl],
                  ['Support', selectedTool.supportUrl],
                  ['Status page', selectedTool.statusUrl],
                ]
                  .filter(([, url]) => url && isSafeToolUrl(url))
                  .map(([label, url]) => (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline underline-offset-4"
                    >
                      {label}
                      <ExternalLink className="size-3" />
                    </a>
                  ))}
              </div>
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Quick actions
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* These are the same guarded actions as the card menu, not a
                      second implementation of access or maintenance routing. */}
                  {selectedTool.tasks.map((task) => (
                    <button
                      key={task}
                      type="button"
                      onClick={() => startToolTask(selectedTool, task)}
                      className="flex min-h-11 items-center gap-2 rounded-xl bg-foreground/[0.035] px-3 py-2 text-left text-sm capitalize text-foreground outline-none transition-colors duration-200 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {task}
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl bg-foreground/5 p-3">
                <StatusBadge status={selectedTool.status} />
                <span
                  className={`text-xs font-medium ${selectedTool.access === 'Available' ? 'text-hub-success/80' : 'text-hub-info/80'}`}
                >
                  {selectedTool.access === 'Request access' &&
                  accessRequests.includes(selectedTool.id)
                    ? 'Request pending'
                    : (selectedTool.accessType ?? selectedTool.access)}
                </span>
              </div>
            </div>
            <DialogFooter className="mx-0 mb-0 border-border bg-foreground/[0.02] p-4">
              <Button
                variant="ghost"
                onClick={() => setSelectedTool(null)}
                className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              >
                Close
              </Button>
              <Button
                disabled={
                  ['Restricted', 'Coming Soon'].includes(selectedTool.access) ||
                  ['Outage', 'Coming Soon'].includes(selectedTool.status)
                }
                onClick={() => {
                  const tool = selectedTool;
                  if (pendingTask?.toolId === tool.id)
                    startToolTask(tool, pendingTask.task, true);
                  else if (tool.access === 'Available') openToolWorkspace(tool);
                  else {
                    setSelectedTool(null);
                    setAccessToolId(tool.id);
                  }
                }}
                className="bg-primary text-primary-foreground hover:bg-primary"
              >
                {selectedTool.access === 'Available'
                  ? selectedTool.status === 'Operational'
                    ? 'Open tool'
                    : 'Open anyway'
                  : accessRequests.includes(selectedTool.id)
                    ? 'View request'
                    : 'Request access'}{' '}
                <ExternalLink className="size-3.5" />
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <SiteSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        preferences={preferences}
        onChange={(value) => {
          setPreferences(value);
          setMaintenanceVisible(value.maintenanceBanner);
        }}
        saveError={persistenceError}
        onRetry={retryPersistence}
      />

      <SupportDialog
        key={`${supportFlow}:${incidentContext}`}
        flow={supportFlow}
        initialContext={incidentContext}
        onClose={() => setSupportFlow(null)}
        onSubmitted={(message) => setLaunchMessage(message, { tone: 'info' })}
      />

      <AccessRequestDialog
        toolId={accessToolId}
        pending={Boolean(accessToolId && accessRequests.includes(accessToolId))}
        onToolChange={setAccessToolId}
        onClose={() => setAccessToolId(null)}
        onSubmit={submitAccessRequest}
      />

      <ToolWorkspaceDialog
        tool={launchedTool}
        onClose={() => setLaunchedTool(null)}
        onStartTask={(task) => {
          if (launchedTool) startToolTask(launchedTool, task);
        }}
      />

      {/* Direct task destination for the frontend phase. Replace this preview with
          a trusted app deep link/API integration when the destination is connected. */}
      <Dialog
        open={Boolean(taskPreview)}
        onOpenChange={(open) => {
          if (!open) setTaskPreview(null);
        }}
      >
        {taskPreview && (
          <DialogContent className="max-h-[90svh] max-w-[calc(100%-2rem)] overflow-y-auto border border-border bg-popover text-foreground sm:max-w-lg">
            <DialogHeader>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Demo task preview
              </p>
              <DialogTitle className="mt-2 text-xl capitalize text-foreground">
                {taskPreview.task}
              </DialogTitle>
              <DialogDescription className="text-foreground/70">
                {taskPreview.tool.name} · {taskPreview.tool.owner}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.045] p-4">
              <AppMark tool={taskPreview.tool} />
              <p className="text-sm leading-6 text-foreground/75">
                You reached this task directly. {taskPreview.tool.name} is not
                connected in this test version, so no company task, request, or
                transaction has been started.
              </p>
            </div>
            {taskPreview.tool.status !== 'Operational' && (
              <output className="block text-sm text-hub-warning">
                {taskPreview.tool.status}: {taskPreview.tool.statusNote}
              </output>
            )}
            <DialogFooter>
              <Button
                onClick={() => setTaskPreview(null)}
                className="bg-primary text-primary-foreground hover:bg-primary"
              >
                Back to tools
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </SidebarProvider>
  );
}

/** Public entry used by both the hosted page and the client-only Apps Script build. */
export function HubApp(props: { initialName?: string; initialEmail?: string }) {
  return (
    <HubErrorBoundary>
      <AuthProvider>
        <AuthenticatedHub {...props} />
      </AuthProvider>
    </HubErrorBoundary>
  );
}

/** No employee/admin content mounts before session restoration or after logout. */
function AuthenticatedHub(props: {
  initialName?: string;
  initialEmail?: string;
}) {
  const auth = useAuth();
  if (!auth.ready)
    return (
      <main className="grid min-h-svh place-items-center bg-background text-foreground">
        <output>Restoring session…</output>
      </main>
    );
  if (!auth.user) return <LoginScreen logo={<BrandMark large />} />;
  return (
    <BackendProvider key={auth.user.id + ':' + auth.user.role}>
      <ToolCatalogProvider>
        <CatalogReadyHub {...props} />
      </ToolCatalogProvider>
    </BackendProvider>
  );
}

/** Fail closed on an unreadable catalog instead of showing misleading seed data. */
function CatalogReadyHub(props: {
  initialName?: string;
  initialEmail?: string;
}) {
  const catalog = useToolCatalog();
  const auth = useAuth();
  if (!catalog.ready)
    return (
      <main className="grid min-h-svh place-items-center bg-background text-foreground">
        <output>Loading tool catalog…</output>
      </main>
    );
  if (catalog.error)
    return (
      <main className="grid min-h-svh place-items-center bg-background p-8 text-foreground">
        <section>
          <p role="alert" className="mb-4 max-w-lg">
            {catalog.error}
          </p>
          <Button onClick={() => void catalog.reload()}>Reload catalog</Button>
          <Button variant="ghost" onClick={() => void auth.signOut()}>
            Sign out
          </Button>
        </section>
      </main>
    );
  return <HubContent {...props} />;
}

/** Validated navigation, never a fetch/webhook call. External pages cannot retain
 * an opener reference to OneJarc. Production should add an approved-host policy. */
function openCatalogLink(
  url: string,
  behavior: Tool['openBehavior'] = 'new-tab',
) {
  if (
    !isSafeToolUrl(url) ||
    !isAllowedLaunchUrl(url, backendConfig.environment)
  )
    return;
  if (behavior === 'same-tab') window.location.assign(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/** Hash changes are browser navigation, deliberately isolated from React state. */
function clearAdminLocation() {
  if (readAdminRoute(window.location.hash)) window.location.hash = '';
}
function navigateAdminLocation(section: AdminSection) {
  window.location.hash = `/admin/${section}`;
}
