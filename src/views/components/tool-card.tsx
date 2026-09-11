/** OneJarc frontend snapshot from company-tool-hub/components/tool-card.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';

/** Calm catalog presentation. The parent owns favorites, access gates, and task
 * routing; this component only discloses those existing actions on demand. */
import { useState } from 'react';
import {
  ArrowRight,
  Heart,
  Info,
  KeyRound,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';
import type { Tool } from '@/models/tool-catalog';
import { Button } from '@/views/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/views/components/ui/dropdown-menu';

type ToolCardProps = {
  tool: Tool;
  favorite: boolean;
  match?: string;
  requestPending?: boolean;
  onFavorite: () => void;
  onDetails: () => void;
  onLaunch: () => void;
  onTask: (task: string) => void;
  primaryTask?: string;
  bestMatch?: boolean;
};

/** Secondary actions use the installed menu's keyboard, touch, and focus behavior.
 * Search keeps its match explanation and matched task first in the action menu. */
export function ToolCard({
  tool,
  favorite,
  match,
  requestPending,
  onFavorite,
  onDetails,
  onLaunch,
  onTask,
  primaryTask,
  bestMatch = false,
}: ToolCardProps) {
  const Icon = tool.icon;
  const [favoriteTouched, setFavoriteTouched] = useState(false);
  const quickTasks = [
    ...new Set([primaryTask, ...tool.tasks].filter(Boolean) as string[]),
  ];
  const needsAccess = tool.access === 'Request access';
  const blocked =
    ['Restricted', 'Coming Soon'].includes(tool.access) ||
    ['Outage', 'Coming Soon'].includes(tool.status);
  const actionLabel = blocked
    ? tool.access === 'Restricted'
      ? 'Restricted'
      : 'Unavailable'
    : needsAccess
      ? requestPending
        ? 'View request'
        : 'Request'
      : 'Open';

  return (
    <article
      aria-label={tool.name}
      className={`hub-tool-card group flex min-w-0 flex-col rounded-2xl border bg-card p-4 sm:p-5 ${bestMatch ? 'border-primary/40' : 'border-border'}`}
    >
      {bestMatch && (
        <span className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Best match
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        {/* The name opens complete details, so truncation never hides the only path to context. */}
        <button
          type="button"
          onClick={onDetails}
          aria-label={`View details for ${tool.name}`}
          className="flex min-w-0 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card"
        >
          <span
            className="grid size-11 shrink-0 place-items-center rounded-xl text-white"
            style={{ backgroundColor: tool.color }}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold leading-5 text-foreground">
              {tool.name}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {tool.category}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setFavoriteTouched(true);
            onFavorite();
          }}
          aria-label={`${favorite ? 'Remove' : 'Add'} ${tool.name} ${favorite ? 'from' : 'to'} favorites`}
          aria-pressed={favorite}
          className={`hub-favorite grid size-11 shrink-0 place-items-center rounded-xl outline-none transition-colors duration-200 hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring ${favorite ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Heart
            key={String(favorite)}
            aria-hidden="true"
            className={`size-4 ${favorite ? 'fill-current' : ''} ${favoriteTouched ? 'hub-favorite-feedback' : ''}`}
          />
        </button>
      </div>
      <p className="mt-4 min-h-10 line-clamp-2 text-sm leading-5 text-muted-foreground">
        {tool.description}
      </p>
      {match && (
        <p className="mt-3 text-sm leading-5 text-primary">
          <Sparkles className="mr-1 inline size-3.5" aria-hidden="true" />
          {match}
        </p>
      )}

      {/* Normal operation is quiet; exceptional status and approval remain visible before launch. */}
      <div className="mt-auto flex items-end justify-between gap-2 pt-4">
        <div className="min-w-0 flex-1 pb-2.5">
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${tool.status === 'Operational' ? 'text-muted-foreground' : 'font-medium text-hub-warning'}`}
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${tool.status === 'Operational' ? 'bg-hub-success' : 'bg-hub-warning'}`}
            />
            {tool.status}
          </span>
          {needsAccess && (
            <span className="mt-1 flex items-center gap-1 text-xs text-hub-info">
              <KeyRound className="size-3 shrink-0" aria-hidden="true" />
              {requestPending ? 'Request pending' : 'Approval required'}
            </span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`More actions for ${tool.name}`}
              title="Details and quick actions"
              className="grid size-11 place-items-center rounded-xl text-muted-foreground outline-none transition-colors duration-200 hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent data-popup-open:text-foreground"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="hub-tool-menu w-64 max-w-[calc(100vw-2rem)] rounded-xl p-1.5"
            >
              <DropdownMenuItem
                onClick={onDetails}
                className="min-h-11 gap-2 px-3"
              >
                <Info aria-hidden="true" />
                View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-3 py-2">
                  Quick actions
                </DropdownMenuLabel>
                {quickTasks.map((task) => (
                  <DropdownMenuItem
                    key={task}
                    onClick={() => onTask(task)}
                    className="min-h-11 justify-between gap-3 px-3 capitalize"
                  >
                    <span>{task}</span>
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={onLaunch}
            disabled={blocked}
            variant="ghost"
            aria-label={`${actionLabel} ${tool.name}`}
            className="hub-tool-launch h-11 gap-1 rounded-xl px-2 text-sm font-medium text-primary hover:bg-primary/10 hover:text-primary"
          >
            {needsAccess && requestPending ? 'Pending' : actionLabel}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  );
}
