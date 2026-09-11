/** OneJarc frontend snapshot from company-tool-hub/components/admin-console.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';
import { backendConfig } from '@/models/backend-config';
import { ApiError, describeApiError } from '@/models/api-client';
/** Administration is a guarded workspace reached from the profile menu.
 * Tables manage the central catalog; no employee cards are authored here. */
import { useState } from 'react';
import { ArrowLeft, MoreHorizontal, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/views/hooks/use-auth';
import { useToolCatalog } from '@/views/hooks/use-tool-catalog';
import {
  can,
  ADMIN_PERMISSIONS,
  EMPLOYEE_PERMISSIONS,
  type AdminSection,
} from '@/models/permissions';
import { ICONS, type CatalogEntry } from '@/models/catalog-model';
import {
  CatalogValidationError,
  type CatalogCommand,
} from '@/models/catalog-service';
import { CatalogEditor } from '@/views/components/catalog-editor';
import { CatalogSelect } from '@/views/components/catalog-fields';
import { Button } from '@/views/components/ui/button';
import { Input } from '@/views/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/views/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/views/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/views/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/views/components/ui/alert-dialog';

/** Direct hash navigation reaches this same guard; hiding entry links is not the policy. */
export function AdminConsole({
  section,
  onSection,
  onExit,
}: {
  section: AdminSection;
  onSection: (section: AdminSection) => void;
  onExit: () => void;
}) {
  const { user } = useAuth();
  if (!can(user, 'canManageToolCatalog'))
    return (
      <section className="rounded-2xl border border-border bg-card p-8">
        <ShieldCheck className="mb-4 size-8 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="my-4 text-muted-foreground">
          Your account can use company tools, but cannot access catalog
          administration.
        </p>
        <Button onClick={onExit}>Return to Home</Button>
      </section>
    );
  return (
    <AdminWorkspace
      key={section}
      section={section}
      onSection={onSection}
      onExit={onExit}
    />
  );
}

function AdminWorkspace({
  section,
  onSection,
  onExit,
}: {
  section: AdminSection;
  onSection: (section: AdminSection) => void;
  onExit: () => void;
}) {
  const { user } = useAuth();
  const catalog = useToolCatalog();
  const [editing, setEditing] = useState<CatalogEntry | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{
    command: CatalogCommand;
    title: string;
    description: string;
  } | null>(null);
  /** Every table action goes through the service; success appears only after storage commits. */
  async function act(command: CatalogCommand) {
    try {
      await catalog.execute(command);
      setError('');
      setNotice(
        backendConfig.dataSource === 'api'
          ? 'Catalog updated by the backend.'
          : 'Catalog updated on this browser.',
      );
      setConfirmation(null);
    } catch (failure) {
      setError(
        failure instanceof CatalogValidationError
          ? `Open Edit Tool to finish this record: ${Object.values(failure.fields).join(' ')}`
          : failure instanceof ApiError
            ? describeApiError(failure)
            : failure instanceof Error
              ? failure.message
              : 'Catalog update failed.',
      );
    }
  }
  if (editing)
    return (
      <CatalogEditor
        entry={editing === 'new' ? undefined : editing}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          setEditing(null);
          setNotice(message);
        }}
      />
    );
  const entries = catalog.snapshot.entries.filter((entry) => {
    const status = entry.archived
      ? 'Archived'
      : !entry.enabled
        ? 'Disabled'
        : entry.published
          ? 'Published'
          : 'Draft';
    return (
      (filter === 'All' || filter === status) &&
      `${entry.draft.name} ${entry.draft.owner} ${entry.draft.category}`
        .toLowerCase()
        .includes(query.toLowerCase().trim())
    );
  });
  return (
    <div className="space-y-6">
      <Button onClick={onExit} variant="ghost" className="min-h-11">
        <ArrowLeft />
        Employee workspace
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-primary">
            <ShieldCheck className="size-4" />
            Administration · Admin only
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {section === 'tools'
              ? 'Tool Catalog'
              : section === 'categories'
                ? 'Categories'
                : 'Access Rules'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {section === 'tools'
              ? 'Manage the tools employees discover, without editing code.'
              : section === 'categories'
                ? 'Keep discovery categories consistent across the workspace.'
                : 'Current prototype permissions and the future SSO boundary.'}
          </p>
        </div>
        {section === 'tools' && can(user, 'canCreateTool') && (
          <Button
            onClick={() => setEditing('new')}
            disabled={!catalog.ready || Boolean(catalog.error)}
            className="min-h-11"
          >
            <Plus />
            Add Tool
          </Button>
        )}
      </div>
      <Tabs
        value={section}
        onValueChange={(value) => onSection(value as AdminSection)}
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-fit">
          <TabsTrigger value="tools" className="min-h-11 px-4">
            Tool Catalog
          </TabsTrigger>
          <TabsTrigger value="categories" className="min-h-11 px-4">
            Categories
          </TabsTrigger>
          <TabsTrigger value="access" className="min-h-11 px-4">
            Access Rules
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
        {backendConfig.dataSource === 'api' ? (
          'API catalog · Changes are confirmed by the configured backend. Employee access grants and live service feeds require their own integrations.'
        ) : (
          <>
            Prototype catalog · Saved on this browser only, shared by its demo
            accounts. No production identity, database, live health feed, or
            employee access grants.
          </>
        )}
      </p>
      {(error || catalog.error) && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error || catalog.error}
        </p>
      )}
      {notice && (
        <output className="block rounded-xl bg-primary/10 p-4 text-sm text-primary">
          {notice}
        </output>
      )}
      {section === 'tools' && (
        <>
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_200px_auto]">
            <div>
              <label
                htmlFor="admin-catalog-search"
                className="text-sm font-medium"
              >
                Find a catalog record
              </label>
              <Input
                id="admin-catalog-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, owner, or category"
                className="mt-2 h-11"
              />
            </div>
            <CatalogSelect
              label="Visibility filter"
              value={filter}
              options={['All', 'Published', 'Draft', 'Disabled', 'Archived']}
              onChange={setFilter}
            />
            <Button
              variant="outline"
              onClick={() => void catalog.reload()}
              className="min-h-11"
            >
              Reload catalog
            </Button>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {entries.length} records · {catalog.tools.length} available to
            employees
          </p>
          <div className="rounded-2xl border border-border bg-card p-2 sm:p-3">
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    'Application',
                    'Category',
                    'Owner',
                    'Status',
                    'Access',
                    'Visibility',
                    'Updated',
                    'Actions',
                  ].map((heading) => (
                    <TableHead key={heading} className="h-12 px-3">
                      {heading}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const tool = entry.draft;
                  const Icon = ICONS[tool.iconKey];
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="px-3 py-4">
                        <div className="flex min-w-[200px] items-center gap-3">
                          <span
                            className="grid size-10 shrink-0 place-items-center rounded-xl text-white"
                            style={{ backgroundColor: tool.color }}
                          >
                            <Icon className="size-5" />
                          </span>
                          <div>
                            <span className="block font-medium">
                              {tool.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {tool.lifecycle}
                              {entry.published &&
                              JSON.stringify(entry.draft) !==
                                JSON.stringify(entry.published)
                                ? ' · Unpublished changes'
                                : ''}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3">
                        {tool.category || 'Not set'}
                      </TableCell>
                      <TableCell className="px-3">
                        {tool.owner || 'Unassigned'}
                      </TableCell>
                      <TableCell className="px-3">{tool.status}</TableCell>
                      <TableCell className="px-3">{tool.accessType}</TableCell>
                      <TableCell className="px-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${entry.archived || !entry.enabled ? 'bg-muted text-muted-foreground' : entry.published ? 'bg-primary/10 text-primary' : 'bg-hub-warning/10 text-hub-warning'}`}
                        >
                          {entry.archived
                            ? 'Archived'
                            : !entry.enabled
                              ? 'Disabled'
                              : entry.published
                                ? 'Published'
                                : 'Draft'}
                        </span>
                        {tool.featured && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Featured
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-3">
                        <time
                          dateTime={entry.updatedAt}
                          title={`${entry.updatedAt} · ${entry.updatedBy}`}
                        >
                          {new Date(entry.updatedAt).toLocaleDateString()}
                        </time>
                      </TableCell>
                      <TableCell className="px-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`Manage ${tool.name}`}
                            className="grid size-11 place-items-center rounded-xl hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <MoreHorizontal className="size-5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {!entry.archived && can(user, 'canEditTool') && (
                              <DropdownMenuItem
                                onClick={() => setEditing(entry)}
                                className="min-h-11"
                              >
                                Edit Tool
                              </DropdownMenuItem>
                            )}
                            {can(user, 'canDuplicateTool') && (
                              <DropdownMenuItem
                                onClick={() =>
                                  void act({ type: 'duplicate', id: entry.id })
                                }
                                className="min-h-11"
                              >
                                Duplicate as draft
                              </DropdownMenuItem>
                            )}
                            {!entry.archived && can(user, 'canPublishTool') && (
                              <DropdownMenuItem
                                onClick={() =>
                                  entry.published
                                    ? setConfirmation({
                                        command: {
                                          type: 'unpublish',
                                          id: entry.id,
                                        },
                                        title: `Unpublish ${tool.name}?`,
                                        description:
                                          'Employees will no longer see this tool. The draft will remain available to administrators.',
                                      })
                                    : void act({
                                        type: 'publish',
                                        id: entry.id,
                                      })
                                }
                                className="min-h-11"
                              >
                                {entry.published
                                  ? 'Unpublish Tool'
                                  : 'Publish Tool'}
                              </DropdownMenuItem>
                            )}
                            {!entry.archived && can(user, 'canEnableTool') && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmation({
                                    command: {
                                      type: 'toggle-enabled',
                                      id: entry.id,
                                    },
                                    title: `${entry.enabled ? 'Disable' : 'Enable'} ${tool.name}?`,
                                    description: entry.enabled
                                      ? 'Hide this tool from employee views without deleting its published version.'
                                      : 'The tool will reappear for employees if it has a published version.',
                                  })
                                }
                                className="min-h-11"
                              >
                                {entry.enabled ? 'Disable Tool' : 'Enable Tool'}
                              </DropdownMenuItem>
                            )}
                            {can(user, 'canArchiveTool') && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmation({
                                    command: {
                                      type: entry.archived
                                        ? 'restore'
                                        : 'archive',
                                      id: entry.id,
                                    },
                                    title: `${entry.archived ? 'Restore' : 'Archive'} ${tool.name}?`,
                                    description: entry.archived
                                      ? 'Restore as an unpublished draft. Review and publish it when ready.'
                                      : 'Remove it from employee views and retain an archived record. You can restore it later.',
                                  })
                                }
                                className="min-h-11 text-destructive"
                              >
                                {entry.archived
                                  ? 'Restore as draft'
                                  : 'Archive Tool'}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {entries.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">
                No catalog records match this filter.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground sm:hidden">
            Swipe the table horizontally to view metadata and actions.
          </p>
        </>
      )}
      {section === 'categories' && <CategoryAdministration />}
      {section === 'access' && (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Role permissions</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Read-only in this prototype. Roles come from the two demo accounts,
            not catalog ownership. Production roles will come from trusted
            company identity and directory groups.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permission</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...EMPLOYEE_PERMISSIONS, ...ADMIN_PERMISSIONS].map(
                (permission) => (
                  <TableRow key={permission}>
                    <TableCell>{permission}</TableCell>
                    <TableCell>
                      {can(
                        {
                          id: 'preview',
                          username: '',
                          displayName: '',
                          role: 'user',
                        },
                        permission,
                      )
                        ? 'Allowed'
                        : 'Denied'}
                    </TableCell>
                    <TableCell>Allowed</TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
          <p className="text-sm leading-6 text-muted-foreground">
            Future: map company groups to application roles, enforce every API
            action on the server, then add department/team visibility. No role
            editor or external SSO is connected now.
          </p>
        </section>
      )}
      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !catalog.busy) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={catalog.busy}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={catalog.busy}
              onClick={() => {
                if (confirmation) void act(confirmation.command);
              }}
            >
              {catalog.busy ? 'Saving…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Category changes use the same guarded repository transaction as tool changes. */
function CategoryAdministration() {
  const { user } = useAuth();
  const catalog = useToolCatalog();
  const [name, setName] = useState('');
  const [previous, setPrevious] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [remove, setRemove] = useState<string | null>(null);
  async function run(command: CatalogCommand) {
    try {
      await catalog.execute(command);
      setError('');
      setNotice('Categories updated across the catalog.');
      setName('');
      setPrevious(null);
      setRemove(null);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? describeApiError(failure)
          : failure instanceof Error
            ? failure.message
            : 'Could not update category.',
      );
    }
  }
  if (!can(user, 'canManageCategories'))
    return <p role="alert">Access denied.</p>;
  return (
    <section className="space-y-5">
      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            previous
              ? { type: 'category-rename', previous, name }
              : { type: 'category-add', name },
          );
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="category-name" className="text-sm font-medium">
            {previous ? `Rename ${previous}` : 'New category'}
          </label>
          <Input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            className="mt-2 h-11"
          />
        </div>
        <Button type="submit" disabled={catalog.busy} className="min-h-11">
          {previous ? 'Save name' : 'Add category'}
        </Button>
        {previous && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPrevious(null);
              setName('');
            }}
          >
            Cancel
          </Button>
        )}
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <output className="block text-sm text-primary">{notice}</output>
      )}
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {catalog.snapshot.categories.map((category) => (
          <div
            key={category}
            className="flex flex-wrap items-center justify-between gap-2 p-4"
          >
            <div>
              <p className="font-medium">{category}</p>
              <p className="text-xs text-muted-foreground">
                {
                  catalog.snapshot.entries.filter(
                    (entry) =>
                      entry.draft.category === category ||
                      entry.published?.category === category,
                  ).length
                }{' '}
                catalog records
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                aria-label={`Rename ${category}`}
                onClick={() => {
                  setName(category);
                  setPrevious(category);
                  document.getElementById('category-name')?.focus();
                }}
                className="min-h-11"
              >
                Rename
              </Button>
              <Button
                variant="ghost"
                aria-label={`Remove ${category}`}
                onClick={() => setRemove(category)}
                className="min-h-11 text-destructive"
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
      <AlertDialog
        open={Boolean(remove)}
        onOpenChange={(open) => !open && setRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {remove}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only unused categories can be removed. Tools and drafts will not
              be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={catalog.busy}
              onClick={() => {
                if (remove) void run({ type: 'category-remove', name: remove });
              }}
            >
              Remove category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
