/** OneJarc frontend snapshot from company-tool-hub/components/catalog-preview.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';
/** Isolated preview uses the employee card component with inert callbacks. It
 * never opens URLs, changes favorites, or executes a configured quick action. */
import { useState } from 'react';
import { toEmployeeTool, type ToolDefinition } from '@/models/catalog-model';
import { ToolCard } from '@/views/components/tool-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/views/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/views/components/ui/dialog';

export function CatalogPreview({
  draft,
  id,
  open,
  onOpenChange,
}: {
  draft: ToolDefinition;
  id?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('desktop');
  const tool = toEmployeeTool(id ?? 'unsaved-preview', {
    ...draft,
    name: draft.name || 'Tool name',
    description: draft.description || 'Your short description appears here.',
    category: draft.category || 'Category',
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-2xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">Preview your tool</DialogTitle>
          <DialogDescription>
            Unsaved changes included. Buttons here do not launch tools or change
            favorites.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(String(value));
            setNotice('');
          }}
        >
          <TabsList
            aria-label="Preview layout"
            className="grid w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto sm:grid-cols-4"
          >
            {[
              ['desktop', 'Desktop card'],
              ['search', 'Search result'],
              ['details', 'Tool details'],
              ['mobile', 'Mobile card'],
            ].map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="min-h-11">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {['desktop', 'search', 'mobile'].map((key) => (
            <TabsContent key={key} value={key} className="mt-4">
              <div
                className={
                  key === 'mobile'
                    ? 'mx-auto max-w-[320px]'
                    : 'mx-auto max-w-[400px]'
                }
              >
                <ToolCard
                  tool={tool}
                  favorite={false}
                  match={
                    key === 'search'
                      ? 'Example match using this tool’s discovery metadata.'
                      : undefined
                  }
                  onFavorite={() =>
                    setNotice('Preview only: favorites are unchanged.')
                  }
                  onDetails={() => setMode('details')}
                  onLaunch={() =>
                    setNotice('Preview only: no link was opened.')
                  }
                  onTask={() =>
                    setNotice('Preview only: no action was executed.')
                  }
                />
              </div>
            </TabsContent>
          ))}
          <TabsContent value="details" className="mt-4 space-y-4">
            <h3 className="text-xl font-semibold">{tool.name}</h3>
            <p className="text-muted-foreground">{tool.description}</p>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ['Category', draft.category],
                ['Owner', draft.owner],
                ['Team', draft.team],
                ['Lifecycle', draft.lifecycle],
                ['Status', draft.status],
                ['Access', draft.accessType],
                [
                  'Application URL',
                  draft.applicationUrl ||
                    (draft.demoPreview ? 'Demo workspace' : 'Not set'),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-all">{value || 'Not set'}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm">
              Quick actions: {tool.tasks.join(' · ') || 'None'}
            </p>
          </TabsContent>
        </Tabs>
        <output className="min-h-5 text-sm text-muted-foreground">
          {notice}
        </output>
      </DialogContent>
    </Dialog>
  );
}
