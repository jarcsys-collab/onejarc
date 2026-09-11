/** OneJarc frontend snapshot from company-tool-hub/components/catalog-api-connection.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';
/** API setup is an admin-only local draft, never a credential store or network
 * client. Check setup validates syntax only and cannot report a live connection. */
import { useState } from 'react';
import { Plug, ShieldCheck } from 'lucide-react';
import {
  API_AUTH_TYPES,
  API_PURPOSES,
  validateApiConnection,
  type ApiConnection,
} from '@/models/catalog-connection';
import { CatalogSelect } from '@/views/components/catalog-fields';
import { Button } from '@/views/components/ui/button';
import { Input } from '@/views/components/ui/input';
import { Switch } from '@/views/components/ui/switch';

export function CatalogApiConnection({
  value,
  onChange,
  errors,
}: {
  value: ApiConnection;
  onChange: (next: ApiConnection) => void;
  errors: Record<string, string>;
}) {
  const [checked, setChecked] = useState<{
    snapshot: string;
    errors: Record<string, string>;
  } | null>(null);
  const checkedCurrent =
    checked?.snapshot === JSON.stringify(value) ? checked : null;
  const visibleErrors = { ...errors, ...checkedCurrent?.errors };
  // A disabled setup can still contain an invalid edit; reveal it for correction.
  const hasFieldErrors = Object.keys(visibleErrors).some(
    (key) => key.startsWith('apiConnection.') && Boolean(visibleErrors[key]),
  );
  const [errorReveal, setErrorReveal] = useState({
    open: hasFieldErrors,
    invalid: hasFieldErrors,
  });
  // Retain visibility after correction; this guarded adjustment runs only when
  // validation changes, not on every render or each typed character.
  if (hasFieldErrors !== errorReveal.invalid)
    setErrorReveal({
      open: errorReveal.open || hasFieldErrors,
      invalid: hasFieldErrors,
    });
  const showFields = value.configured || hasFieldErrors || errorReveal.open;
  function change<K extends keyof ApiConnection>(
    key: K,
    next: ApiConnection[K],
  ) {
    onChange({ ...value, [key]: next });
  }
  function textField(
    key: 'baseUrl' | 'healthPath',
    label: string,
    placeholder: string,
  ) {
    const id = 'catalog-apiConnection.' + key;
    const error = visibleErrors['apiConnection.' + key];
    return (
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <Input
          id={id}
          value={value[key]}
          onChange={(event) => change(key, event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          maxLength={key === 'baseUrl' ? 2048 : 200}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? id + '-error' : undefined}
          className="mt-2 h-11 text-base"
        />
        {error && (
          <p id={id + '-error'} className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <section
      aria-labelledby="api-setup-title"
      id="catalog-apiConnection"
      tabIndex={-1}
      className="rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Plug className="size-5" />
        </span>
        <div className="min-w-[140px] flex-1">
          <h2 id="api-setup-title" className="text-lg font-semibold">
            API connection
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Prepare a connection for your backend team.
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          Not connected
        </span>
      </div>
      <label
        htmlFor="catalog-api-enabled"
        className="mt-6 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-muted/40 p-4"
      >
        <span>
          <span className="block text-sm font-medium">Set up an API</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Optional. This does not activate a connection.
          </span>
        </span>
        <Switch
          id="catalog-api-enabled"
          aria-label="Set up an API"
          checked={value.configured}
          onCheckedChange={(next) => {
            setErrorReveal({ open: false, invalid: hasFieldErrors });
            change('configured', next);
          }}
        />
      </label>
      {showFields && (
        <div className="mt-6 space-y-5">
          {textField(
            'baseUrl',
            'API base URL *',
            'https://api.your-company.example',
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <CatalogSelect
              id="catalog-apiConnection.purpose"
              label="Use this API for"
              value={value.purpose}
              options={API_PURPOSES}
              onChange={(next) =>
                change('purpose', next as ApiConnection['purpose'])
              }
              error={visibleErrors['apiConnection.purpose']}
            />
            <CatalogSelect
              id="catalog-apiConnection.authentication"
              label="Authentication method"
              value={value.authentication}
              options={API_AUTH_TYPES}
              onChange={(next) =>
                change(
                  'authentication',
                  next as ApiConnection['authentication'],
                )
              }
              error={visibleErrors['apiConnection.authentication']}
            />
          </div>
          {textField('healthPath', 'Health-check path (optional)', '/health')}
          <div className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm leading-6 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              <strong className="font-medium text-foreground">
                Credentials: not configured.
              </strong>{' '}
              API keys and tokens stay blank here. Add them through secure
              server-side settings when a backend is connected—not in URLs or
              browser storage.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setChecked({
                snapshot: JSON.stringify(value),
                errors: validateApiConnection(value),
              })
            }
            className="min-h-11"
          >
            Check setup
          </Button>
          {checkedCurrent && (
            <output className="block text-sm leading-6 text-muted-foreground">
              {Object.keys(checkedCurrent.errors).length
                ? 'Review the highlighted connection fields.'
                : 'Setup format looks valid. No request was sent; a backend connector is still required.'}
            </output>
          )}
        </div>
      )}
      {!showFields && (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Your tool can still open normally using its application URL. No API
          requests are made. You can configure this later.
        </p>
      )}
      {visibleErrors.apiConnection && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {visibleErrors.apiConnection}
        </p>
      )}
    </section>
  );
}
