/** OneJarc frontend snapshot from company-tool-hub/components/tool-results-section.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Grid2X2 } from 'lucide-react';
import { Button } from '@/views/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/views/components/ui/collapsible';

type ToolResultsSectionProps = {
  title: string;
  description: string;
  count: number;
  collapsible: boolean;
  /** The directory already has a page title; announce only the count visually. */
  compactHeader?: boolean;
  onBrowse?: () => void;
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Progressive disclosure is only used for Home's secondary tool collection.
 * Search/directory/favorites/recent results never acquire an extra reveal step.
 * The parent keys by view so Home starts closed on each fresh visit. This is
 * presentation state, deliberately not persisted as an employee preference.
 */
export function ToolResultsSection({
  title,
  description,
  count,
  collapsible,
  compactHeader = false,
  onBrowse,
  actions,
  children,
}: ToolResultsSectionProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelId = useId();

  if (!collapsible)
    return (
      <section
        className={compactHeader ? 'mt-5' : 'mt-8'}
        aria-labelledby={titleId}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id={titleId}
              className={
                compactHeader
                  ? 'sr-only'
                  : 'text-base font-semibold text-foreground'
              }
            >
              {title}
            </h2>
            <p
              className="mt-1 text-sm text-muted-foreground"
              aria-live={compactHeader ? 'polite' : undefined}
            >
              {compactHeader
                ? `${count} ${count === 1 ? 'tool' : 'tools'}`
                : description}
            </p>
          </div>
          {actions}
        </div>
        {children}
      </section>
    );

  return (
    <section className="mt-8" aria-labelledby={titleId}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Grid2X2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground"
            >
              {title}
              <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {count} tools
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {onBrowse && (
              <Button
                variant="ghost"
                onClick={onBrowse}
                className="text-muted-foreground hover:text-foreground"
              >
                View directory
                <ChevronRight aria-hidden="true" />
              </Button>
            )}
            <CollapsibleTrigger
              aria-controls={panelId}
              aria-label={`${open ? 'Hide' : 'Show'} all your tools`}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 text-sm font-medium text-primary outline-none transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {open ? 'Hide tools' : 'Show tools'}
              <ChevronDown
                aria-hidden="true"
                className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              />
            </CollapsibleTrigger>
          </div>
        </div>
        {/* The primitive removes closed content from keyboard/screen-reader order.
          App-wide reduced-motion rules also cover this short reveal animation. */}
        <CollapsibleContent
          id={panelId}
          className="overflow-hidden data-open:animate-in data-open:fade-in data-open:slide-in-from-top-1 duration-200"
        >
          <div className="pt-4">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
