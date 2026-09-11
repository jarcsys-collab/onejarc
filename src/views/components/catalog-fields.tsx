/** OneJarc frontend snapshot from company-tool-hub/components/catalog-fields.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';
/** Shared, labeled catalog controls keep editor errors and keyboard behavior
 * consistent. The existing Select primitive owns focus, typeahead and popup UI. */
import { useId, useState, type ReactNode } from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/views/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/views/components/ui/select';
export function CatalogSelect({
  label,
  value,
  options,
  onChange,
  error,
  id: suppliedId,
  labels,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  error?: string;
  id?: string;
  labels?: Record<string, string>;
}) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Select
        value={value || null}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
      >
        <SelectTrigger
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-2 h-11 w-full data-[size=default]:h-11"
        >
          <SelectValue placeholder="Choose an option">
            {labels?.[value]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option} className="min-h-10">
              {labels?.[option] ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Optional metadata stays collapsed until requested. Invalid fields force the
 * section open so a failed save never hides the correction the admin needs. */
export function CatalogDisclosure({
  title,
  description,
  invalid = false,
  children,
}: {
  title: string;
  description?: string;
  invalid?: boolean;
  children: ReactNode;
}) {
  const [expansion, setExpansion] = useState({ open: invalid, invalid });
  // Adjust only when validation changes, without an effect/cascading render.
  // Once revealed, keep the panel open as its first correction clears the error.
  if (invalid !== expansion.invalid)
    setExpansion({ open: expansion.open || invalid, invalid });
  return (
    <Accordion
      value={expansion.open || invalid ? ['options'] : []}
      onValueChange={(values) =>
        setExpansion({ open: values.length > 0 || invalid, invalid })
      }
      className="rounded-2xl border border-border bg-card px-5 sm:px-6"
    >
      <AccordionItem value="options">
        <AccordionTrigger className="min-h-16 items-center py-4 hover:no-underline">
          <span>
            <span className="block text-base font-medium">{title}</span>
            {description && (
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                {description}
              </span>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-6">
          <div className="grid gap-5 sm:grid-cols-2">{children}</div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
export function CatalogSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <legend className="px-2 text-base font-semibold">{title}</legend>
      {description && (
        <p className="mb-5 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
