/** OneJarc frontend snapshot from company-tool-hub/components/site-settings.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';

import { Monitor, Moon, Settings, Sun } from 'lucide-react';
import { DEFAULT_PREFERENCES, type Preferences } from '@/models/hub-storage';
import { Button } from '@/views/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/views/components/ui/radio-group';
import { Switch } from '@/views/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/views/components/ui/sheet';

const appearanceOptions = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const;

const switches = [
  {
    key: 'compactCards',
    title: 'Compact tool grid',
    description: 'Fit more tools on larger screens.',
  },
  {
    key: 'reduceMotion',
    title: 'Reduce motion',
    description:
      'Minimize animations and transitions. Your device’s reduced-motion preference is always respected.',
  },
  {
    key: 'statusAlerts',
    title: 'Status alerts',
    description: 'Show unread incident and maintenance indicators.',
  },
  {
    key: 'maintenanceBanner',
    title: 'Maintenance banner',
    description: 'Show planned maintenance above the workspace.',
  },
] as const;

/**
 * Both sidebar Settings and profile Preferences open this shared panel.
 * Catalog administration lives separately in the profile menu.
 * Changes apply immediately; HubContent owns persistence and retry behavior.
 * Restore defaults affects settings only, never favorites or saved requests.
 */
export function SiteSettings({
  open,
  onOpenChange,
  preferences,
  onChange,
  saveError,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: Preferences;
  onChange: (value: Preferences) => void;
  saveError: string;
  onRetry: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-border bg-popover p-0 text-foreground sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 border-b border-border px-6 py-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <Settings className="size-4" /> Your workspace
          </div>
          <SheetTitle className="text-2xl font-semibold text-foreground">
            Site settings
          </SheetTitle>
          <SheetDescription className="text-sm leading-6 text-muted-foreground">
            Make OneJarc comfortable for you. Changes apply immediately and stay
            on this device.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
          <section aria-labelledby="appearance-title">
            <h3 id="appearance-title" className="text-base font-semibold">
              Appearance
            </h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Choose a theme, or follow your device.
            </p>
            <RadioGroup
              aria-label="Color theme"
              value={preferences.theme}
              onValueChange={(value) => {
                if (value === 'light' || value === 'dark' || value === 'system')
                  onChange({ ...preferences, theme: value });
              }}
              className="grid-cols-3 gap-3"
            >
              {appearanceOptions.map(({ value, label, Icon }) => (
                <label
                  key={value}
                  htmlFor={`theme-${value}`}
                  className={`relative flex min-h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border p-3 transition-colors ${preferences.theme === value ? 'border-primary bg-primary/10 ring-1 ring-primary/25' : 'border-border bg-card hover:bg-accent'}`}
                >
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <RadioGroupItem id={`theme-${value}`} value={value} />
                    <span>{label}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </section>

          <section aria-labelledby="workspace-settings-title">
            <h3
              id="workspace-settings-title"
              className="mb-3 text-base font-semibold"
            >
              Display & alerts
            </h3>
            <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">
              {switches.map((item) => (
                <label
                  key={item.key}
                  htmlFor={`site-${item.key}`}
                  className="flex cursor-pointer items-center gap-4 py-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                  <Switch
                    id={`site-${item.key}`}
                    checked={preferences[item.key]}
                    onCheckedChange={(checked) =>
                      onChange({ ...preferences, [item.key]: checked })
                    }
                    aria-label={item.title}
                  />
                </label>
              ))}
            </div>
          </section>
          {saveError && (
            <div
              role="alert"
              className="rounded-xl border border-hub-warning/25 bg-hub-warning/10 p-4 text-sm text-hub-warning"
            >
              <p>{saveError}</p>
              <Button
                variant="outline"
                className="mt-3 border-current bg-transparent"
                onClick={onRetry}
              >
                Retry saving
              </Button>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => onChange({ ...DEFAULT_PREFERENCES })}
            className="w-full"
          >
            Restore default settings
          </Button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-6 py-4">
          <p className="text-xs text-muted-foreground">
            {saveError
              ? 'Using settings for this session'
              : 'Saved automatically on this device'}
          </p>
          <Button onClick={() => onOpenChange(false)} className="min-w-20">
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
