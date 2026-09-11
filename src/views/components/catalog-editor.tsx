/** OneJarc frontend snapshot from company-tool-hub/components/catalog-editor.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';
/** Four focused panels share one parent draft, so switching tabs never drops
 * edits. Only the guarded service saves data; previews have no side effects. */
import { useRef, useState } from 'react';
import { ArrowLeft, Eye, Plus, Save, Send, Trash2, Check } from 'lucide-react';
import {
  ACCENTS,
  ACCESS_TYPES,
  ICONS,
  LIFECYCLES,
  STATUSES,
  newToolDefinition,
  slugify,
  type CatalogEntry,
  type CatalogErrors,
  type ToolDefinition,
} from '@/models/catalog-model';
import {
  blankApiConnection,
  type ApiConnection,
} from '@/models/catalog-connection';
import {
  EDITOR_SECTIONS,
  sectionForField,
  type EditorSection,
} from '@/models/catalog-editor-sections';
import { CatalogValidationError } from '@/models/catalog-service';
import { ApiError, describeApiError } from '@/models/api-client';
import { can } from '@/models/permissions';
import { useAuth } from '@/views/hooks/use-auth';
import { useToolCatalog } from '@/views/hooks/use-tool-catalog';
import {
  CatalogSection,
  CatalogSelect,
  CatalogDisclosure,
} from '@/views/components/catalog-fields';
import { CatalogApiConnection } from '@/views/components/catalog-api-connection';
import { CatalogPreview } from '@/views/components/catalog-preview';
import { Button } from '@/views/components/ui/button';
import { Input } from '@/views/components/ui/input';
import { Textarea } from '@/views/components/ui/textarea';
import { Switch } from '@/views/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/views/components/ui/tabs';
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

const listFields = ['keywords', 'aliases', 'tags', 'tasks'] as const;
type TextField =
  | 'name'
  | 'slug'
  | 'description'
  | 'subtitle'
  | 'owner'
  | 'team'
  | 'supportContact'
  | 'statusNote'
  | 'applicationUrl'
  | 'documentationUrl'
  | 'supportUrl'
  | 'statusUrl';
/** Preserve raw list input while typing; normalize only for preview/save. */
function splitList(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function CatalogEditor({
  entry,
  onClose,
  onSaved,
}: {
  entry?: CatalogEntry;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const catalog = useToolCatalog();
  const { user } = useAuth();
  // Freeze the starting revision to reject conflicting updates from another tab.
  const [revision] = useState(catalog.snapshot.revision);
  const [definition, setDefinition] = useState<ToolDefinition>(() =>
    structuredClone(entry?.draft ?? newToolDefinition()),
  );
  const [connection, setConnection] = useState<ApiConnection>(() =>
    structuredClone(entry?.apiConnection ?? blankApiConnection()),
  );
  const [lists, setLists] = useState(
    () =>
      Object.fromEntries(
        listFields.map((key) => [key, (entry?.draft[key] ?? []).join('\n')]),
      ) as Record<(typeof listFields)[number], string>,
  );
  const [section, setSection] = useState<EditorSection>('details');
  const [errors, setErrors] = useState<CatalogErrors>({});
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [dirty, setDirty] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const draft = {
    ...definition,
    ...Object.fromEntries(
      listFields.map((key) => [key, splitList(lists[key])]),
    ),
  } as ToolDefinition;
  const Icon = ICONS[definition.iconKey];
  const activeErrors = Object.entries(errors).filter(([, value]) =>
    Boolean(value),
  );
  const invalid = (...keys: string[]) =>
    keys.some((key) => Boolean(errors[key]));

  /** Clear only the edited field's error; other tabs keep their correction badges. */
  function update<K extends keyof ToolDefinition>(
    key: K,
    value: ToolDefinition[K],
  ) {
    setDefinition((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setErrors((current) => ({ ...current, [key]: '' }));
  }
  function updateConnection(next: ApiConnection) {
    setConnection(next);
    setDirty(true);
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => !key.startsWith('apiConnection'),
        ),
      ),
    );
  }
  /** Reveal the owning tab before focusing a control, including collapsed extras. */
  function jumpToError(key: string) {
    setSection(sectionForField(key));
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const target =
          document.getElementById('catalog-' + key) ?? errorRef.current;
        target?.focus();
        target?.scrollIntoView({ block: 'center' });
      }),
    );
  }
  /** The service rechecks roles, URLs, metadata and revision before one write.
   * API setup is non-secret entry metadata, not part of the employee projection. */
  async function save(publish: boolean) {
    if (catalog.busy) return;
    setMessage('');
    setErrors({});
    try {
      await catalog.execute(
        {
          type: 'save',
          id: entry?.id,
          definition: { ...draft, slug: draft.slug || slugify(draft.name) },
          apiConnection: connection,
          publish,
        },
        revision,
      );
      onSaved(
        publish
          ? entry && !entry.enabled
            ? 'Version published. Enable this tool in the catalog to show it to employees.'
            : 'Tool published. Employee views now use this version.'
          : 'Draft saved. The employee-facing version was not changed.',
      );
    } catch (failure) {
      if (
        failure instanceof CatalogValidationError ||
        failure instanceof ApiError
      ) {
        setErrors(failure.fields);
        const first = Object.keys(failure.fields)[0];
        if (first) setSection(sectionForField(first));
      }
      setMessage(
        failure instanceof ApiError
          ? describeApiError(failure)
          : failure instanceof Error
            ? failure.message
            : 'Could not save. Your draft is still here.',
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  // Shared field renderers keep labels, error descriptions and focus targets consistent.
  function field(key: TextField, label: string, placeholder?: string) {
    const id = 'catalog-' + key;
    const multiline = key === 'description' || key === 'statusNote';
    const props = {
      id,
      value: definition[key],
      placeholder,
      maxLength: key.endsWith('Url') ? 2048 : multiline ? 500 : 120,
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => update(key, event.target.value),
      'aria-invalid': Boolean(errors[key]),
      'aria-describedby': errors[key] ? id + '-error' : undefined,
      className: 'mt-2 text-base ' + (multiline ? 'min-h-24 resize-y' : 'h-11'),
    };
    return (
      <div
        className={multiline || key === 'applicationUrl' ? 'sm:col-span-2' : ''}
      >
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {multiline ? <Textarea {...props} rows={3} /> : <Input {...props} />}
        {errors[key] && (
          <p id={id + '-error'} className="mt-1 text-sm text-destructive">
            {errors[key]}
          </p>
        )}
      </div>
    );
  }
  function listField(
    key: (typeof listFields)[number],
    label: string,
    placeholder: string,
  ) {
    const id = 'catalog-' + key;
    return (
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <Textarea
          id={id}
          value={lists[key]}
          placeholder={placeholder}
          onChange={(event) => {
            setLists((current) => ({ ...current, [key]: event.target.value }));
            setDirty(true);
            setErrors((current) => ({ ...current, [key]: '' }));
          }}
          className="mt-2 min-h-28 text-base"
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? id + '-error' : undefined}
        />
        {errors[key] && (
          <p id={id + '-error'} className="mt-1 text-sm text-destructive">
            {errors[key]}
          </p>
        )}
      </div>
    );
  }
  function updateAction(
    index: number,
    change: Partial<ToolDefinition['quickActions'][number]>,
  ) {
    update(
      'quickActions',
      definition.quickActions.map((action, i) =>
        i === index ? { ...action, ...change } : action,
      ),
    );
  }
  if (!can(user, entry ? 'canEditTool' : 'canCreateTool'))
    return <p role="alert">Access denied.</p>;

  return (
    <div className="space-y-6">
      {/* A compact heading explains publication once, without a competing banner. */}
      <header>
        <Button
          variant="ghost"
          onClick={() => (dirty ? setDiscard(true) : onClose())}
          className="-ml-3 mb-3 min-h-11"
        >
          <ArrowLeft />
          Back to Tool Catalog
        </Button>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
          Administration · {entry ? 'Edit tool' : 'New tool'}
        </p>
        <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">
          {entry ? 'Edit ' + entry.draft.name : 'Add a tool'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Start with the essentials. Save a draft anytime; publish when ready. *
          Required to publish.
        </p>
      </header>
      {message && (
        <div
          role="alert"
          tabIndex={-1}
          ref={errorRef}
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"
        >
          <p className="font-medium">{message}</p>
          {activeErrors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {activeErrors.map(([key, value]) => (
                <li key={key}>
                  <button
                    type="button"
                    className="min-h-9 text-left underline decoration-destructive/40 underline-offset-4 focus-visible:outline-2"
                    onClick={() => jumpToError(key)}
                  >
                    {value}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <form
          id="catalog-editor"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save(false);
          }}
          className="min-w-0"
        >
          <Tabs
            value={section}
            onValueChange={(value) => setSection(value as EditorSection)}
          >
            <TabsList
              aria-label="Tool editor sections"
              className="mb-4 grid w-full grid-cols-2 gap-1 rounded-xl p-1 group-data-horizontal/tabs:h-auto sm:grid-cols-4"
            >
              {EDITOR_SECTIONS.map((item) => {
                const count = activeErrors.filter(
                  ([key]) => sectionForField(key) === item.id,
                ).length;
                return (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="min-h-11 rounded-lg px-2"
                  >
                    {item.label}
                    {count > 0 && (
                      <span
                        className="rounded-full bg-destructive/15 px-1.5 text-xs text-destructive"
                        aria-label={count + ' errors'}
                      >
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Details is intentionally short; identity and catalog naming are optional. */}
            <TabsContent value="details" className="space-y-5">
              <CatalogSection
                title="Tool essentials"
                description="Help employees recognize this tool and understand when to use it."
              >
                {field('name', 'Tool name *', 'e.g. Finance Suite')}
                <CatalogSelect
                  id="catalog-category"
                  label="Category *"
                  value={definition.category}
                  options={catalog.snapshot.categories}
                  onChange={(value) => update('category', value)}
                  error={errors.category}
                />
                {field(
                  'description',
                  'Short description *',
                  'What can someone accomplish with this tool?',
                )}
                {field('owner', 'Tool owner *', 'Responsible person or team')}
                <CatalogSelect
                  id="catalog-openBehavior"
                  label="Open application in"
                  value={definition.openBehavior}
                  options={['new-tab', 'same-tab']}
                  labels={{ 'new-tab': 'New tab', 'same-tab': 'Current tab' }}
                  onChange={(value) =>
                    update(
                      'openBehavior',
                      value as ToolDefinition['openBehavior'],
                    )
                  }
                  error={errors.openBehavior}
                />
                {field(
                  'applicationUrl',
                  definition.demoPreview
                    ? 'Application URL (optional for this demo)'
                    : 'Application URL *',
                  'https://tools.your-company.example',
                )}
                <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                  Use an approved HTTPS link without passwords or secret tokens.
                  API setup is separate under Connections.
                </p>
              </CatalogSection>
              <CatalogDisclosure
                title="Appearance"
                description="Tool icon and accent color"
                invalid={invalid('iconKey', 'color')}
              >
                <CatalogSelect
                  id="catalog-iconKey"
                  label="Icon"
                  value={definition.iconKey}
                  options={Object.keys(ICONS)}
                  onChange={(value) =>
                    update('iconKey', value as keyof typeof ICONS)
                  }
                  error={errors.iconKey}
                />
                <div id="catalog-color" tabIndex={-1}>
                  <p className="text-sm font-medium">Accent color</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ACCENTS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={'Accent ' + color}
                        aria-pressed={definition.color === color}
                        onClick={() => update('color', color)}
                        className={
                          'grid size-11 place-items-center rounded-xl border focus-visible:ring-2 focus-visible:ring-ring ' +
                          (definition.color === color
                            ? 'border-primary bg-primary/10'
                            : 'border-border')
                        }
                      >
                        <span
                          className="grid size-7 place-items-center rounded-full text-white"
                          style={{ backgroundColor: color }}
                        >
                          {definition.color === color && (
                            <Check className="size-4" />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                  {errors.color && (
                    <p className="mt-1 text-sm text-destructive">
                      {errors.color}
                    </p>
                  )}
                </div>
              </CatalogDisclosure>
              <CatalogDisclosure
                title="Advanced details"
                description="Optional subtitle and stable catalog slug"
                invalid={invalid('slug', 'subtitle')}
              >
                {field('subtitle', 'Subtitle (optional)')}
                {field(
                  'slug',
                  'Catalog slug',
                  'Generated from the tool name if blank',
                )}
              </CatalogDisclosure>
            </TabsContent>

            {/* These values describe catalog access/status; they do not grant external access. */}
            <TabsContent value="access" className="space-y-5">
              <CatalogSection
                title="Access & availability"
                description="Catalog settings only. The destination application still controls its own permissions."
              >
                <CatalogSelect
                  id="catalog-accessType"
                  label="Who can open this tool?"
                  value={definition.accessType}
                  options={ACCESS_TYPES}
                  onChange={(value) =>
                    update('accessType', value as ToolDefinition['accessType'])
                  }
                  error={errors.accessType}
                />
                <CatalogSelect
                  id="catalog-status"
                  label="Tool status"
                  value={definition.status}
                  options={STATUSES}
                  onChange={(value) =>
                    update('status', value as ToolDefinition['status'])
                  }
                  error={errors.status}
                />
                <CatalogSelect
                  id="catalog-lifecycle"
                  label="Lifecycle"
                  value={definition.lifecycle}
                  options={LIFECYCLES.filter((value) => value !== 'Archived')}
                  onChange={(value) =>
                    update('lifecycle', value as ToolDefinition['lifecycle'])
                  }
                  error={errors.lifecycle}
                />
                <label
                  htmlFor="catalog-featured"
                  className="flex items-center justify-between gap-3 self-end rounded-xl border border-border p-3"
                >
                  <span className="text-sm font-medium">Featured on Home</span>
                  <Switch
                    id="catalog-featured"
                    checked={definition.featured}
                    onCheckedChange={(value) => update('featured', value)}
                  />
                </label>
                {field(
                  'statusNote',
                  'Status note (optional)',
                  'Useful context about an outage or maintenance',
                )}
                <p
                  id="catalog-metadata"
                  tabIndex={-1}
                  className="text-xs leading-5 text-muted-foreground sm:col-span-2"
                >
                  {errors.metadata ||
                    'Status is maintained manually for now, not monitored by a live API. Publish and enable a tool to make it visible to employees.'}
                </p>
              </CatalogSection>
              <CatalogDisclosure
                title="Support & responsibility"
                description="Optional team and support contact"
                invalid={invalid('team', 'supportContact')}
              >
                {field('team', 'Team')}
                {field(
                  'supportContact',
                  'Support contact',
                  'Team name or contact address',
                )}
              </CatalogDisclosure>
            </TabsContent>

            {/* Published discovery metadata feeds existing local search and task routing. */}
            <TabsContent value="discovery" className="space-y-5">
              <CatalogSection
                title="Help people find this tool"
                description="Use everyday words and problems employees might search for. One item per line or comma-separated."
              >
                {listField(
                  'keywords',
                  'Search keywords',
                  'expenses, invoices, reimbursement',
                )}
                {listField(
                  'tasks',
                  'Common tasks',
                  'Submit an expense\nReview a budget',
                )}
              </CatalogSection>
              <CatalogDisclosure
                title="More search options"
                description="Alternative names and tags"
                invalid={invalid('aliases', 'tags')}
              >
                {listField(
                  'aliases',
                  'Alternative names',
                  'Other names employees use',
                )}
                {listField('tags', 'Tags', 'Short labels to improve discovery')}
              </CatalogDisclosure>
              <CatalogDisclosure
                title={'Quick actions · ' + definition.quickActions.length}
                description="Optional shortcuts for common tasks"
                invalid={invalid('quickActions')}
              >
                <div
                  id="catalog-quickActions"
                  tabIndex={-1}
                  className="space-y-4 sm:col-span-2"
                >
                  <p className="text-sm leading-6 text-muted-foreground">
                    Links open a destination. Task previews use the existing
                    demo flow; they do not call an API or workflow.
                  </p>
                  {errors.quickActions && (
                    <p className="text-sm text-destructive">
                      {errors.quickActions}
                    </p>
                  )}
                  {definition.quickActions.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No shortcuts yet. Add one to help employees get started
                      faster.
                    </p>
                  )}
                  {definition.quickActions.map((action, index) => (
                    <div
                      key={index}
                      className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2"
                    >
                      <div className="flex items-center justify-between gap-3 sm:col-span-2">
                        <p className="truncate text-sm font-medium">
                          {action.label || 'New shortcut'}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            update(
                              'quickActions',
                              definition.quickActions.filter(
                                (_, i) => i !== index,
                              ),
                            )
                          }
                          aria-label={'Remove quick action ' + (index + 1)}
                          className="min-h-11 text-destructive"
                        >
                          <Trash2 />
                          <span className="sr-only sm:not-sr-only">Remove</span>
                        </Button>
                      </div>
                      <div>
                        <label
                          htmlFor={'action-label-' + index}
                          className="text-sm font-medium"
                        >
                          Button label
                        </label>
                        <Input
                          id={'action-label-' + index}
                          value={action.label}
                          maxLength={120}
                          onChange={(event) =>
                            updateAction(index, { label: event.target.value })
                          }
                          className="mt-2 h-11 text-base"
                        />
                      </div>
                      <CatalogSelect
                        label={'Action type ' + (index + 1)}
                        value={action.type}
                        options={['url', 'task']}
                        labels={{ url: 'Open a link', task: 'Task preview' }}
                        onChange={(value) =>
                          updateAction(index, { type: value as 'url' | 'task' })
                        }
                      />
                      <div className="sm:col-span-2">
                        <label
                          htmlFor={'action-target-' + index}
                          className="text-sm font-medium"
                        >
                          {action.type === 'url'
                            ? 'Destination URL'
                            : 'Task to preview'}
                        </label>
                        <Input
                          id={'action-target-' + index}
                          value={action.target}
                          placeholder={
                            action.type === 'url'
                              ? 'https://…'
                              : 'Describe the task to preview'
                          }
                          onChange={(event) =>
                            updateAction(index, { target: event.target.value })
                          }
                          className="mt-2 h-11 text-base"
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={definition.quickActions.length >= 12}
                    onClick={() =>
                      update('quickActions', [
                        ...definition.quickActions,
                        { label: '', type: 'url', target: '' },
                      ])
                    }
                    className="min-h-11"
                  >
                    <Plus />
                    Add quick action
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Up to 12 shortcuts per tool.
                  </p>
                </div>
              </CatalogDisclosure>
            </TabsContent>

            {/* Connection setup is a future handoff: no credentials, HTTP checks or activation. */}
            <TabsContent value="connections" className="space-y-5">
              <CatalogApiConnection
                value={connection}
                onChange={updateConnection}
                errors={errors}
              />
              <CatalogDisclosure
                title="Helpful links"
                description="Documentation, support and status pages"
                invalid={invalid('documentationUrl', 'supportUrl', 'statusUrl')}
              >
                {field('documentationUrl', 'Documentation URL', 'https://…')}
                {field('supportUrl', 'Support URL', 'https://…')}
                {field('statusUrl', 'Status page URL', 'https://…')}
                <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                  These are navigation links, not API endpoints. Do not include
                  credentials or private webhook URLs.
                </p>
              </CatalogDisclosure>
            </TabsContent>
          </Tabs>
        </form>

        {/* Compact desktop summary updates immediately; full previews remain available on mobile. */}
        <aside
          aria-label="Live tool summary"
          className="sticky top-6 hidden min-w-0 rounded-2xl border border-border bg-card p-5 xl:block"
        >
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">
            At a glance
          </p>
          <div className="mt-5 flex items-center gap-3">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-2xl text-white"
              style={{ backgroundColor: definition.color }}
            >
              <Icon className="size-6" />
            </span>
            <div className="min-w-0">
              <h2 className="break-words font-semibold">
                {definition.name || 'Your tool'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {definition.category || 'Choose a category'}
              </p>
            </div>
          </div>
          <p className="mt-4 break-words text-sm leading-6 text-muted-foreground">
            {definition.description ||
              'A short description helps people choose the right tool.'}
          </p>
          <dl className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
            {[
              ['Owner', definition.owner || 'Not set'],
              ['Status', definition.status],
              ['Access', definition.accessType],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words text-right">{value}</dd>
              </div>
            ))}
          </dl>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreview(true)}
            className="mt-5 min-h-11 w-full"
          >
            <Eye />
            Preview layouts
          </Button>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {entry?.published
              ? 'Employees see the last published version until you publish again.'
              : 'This tool stays private until you publish it.'}
            {entry && !entry.enabled ? ' This tool is currently disabled.' : ''}
          </p>
        </aside>
      </div>

      {/* Save stays reachable on long panels; opening previews never submits the form. */}
      <footer className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-popover/95 p-3 shadow-xl backdrop-blur">
        <output className="hidden px-2 text-xs text-muted-foreground sm:block">
          {dirty ? 'Unsaved changes' : 'Editing draft'}
        </output>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setPreview(true)}
          className="min-h-11"
        >
          <Eye />
          Preview
        </Button>
        <Button
          type="submit"
          form="catalog-editor"
          variant="outline"
          disabled={catalog.busy}
          className="ml-auto min-h-11"
        >
          <Save />
          {catalog.busy ? 'Saving…' : 'Save Draft'}
        </Button>
        {can(user, 'canPublishTool') && (
          <Button
            type="button"
            disabled={catalog.busy}
            onClick={() => void save(true)}
            className="min-h-11"
          >
            <Send />
            Publish
          </Button>
        )}
      </footer>
      <CatalogPreview
        draft={draft}
        id={entry?.id}
        open={preview}
        onOpenChange={setPreview}
      />
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved draft, connection setup and published tool will remain
              unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
