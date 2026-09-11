/** OneJarc frontend snapshot from company-tool-hub/components/directory-controls.tsx.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
'use client';

/** Compact controls reuse catalog categories and device-local recent history.
 * They apply only to browsing; problem-search results keep their relevance order. */
import { ArrowDownAZ, ChevronDown, ListFilter } from 'lucide-react';
import type { DirectorySort } from '@/models/tool-directory';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/views/components/ui/dropdown-menu';

export function DirectoryControls({
  categories,
  category,
  sort,
  onCategory,
  onSort,
}: {
  categories: string[];
  category: string;
  sort: DirectorySort;
  onCategory: (value: string) => void;
  onSort: (value: DirectorySort) => void;
}) {
  const triggerClass =
    'inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm text-muted-foreground outline-none transition-colors duration-200 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Filter category: ${category}`}
          className={triggerClass}
        >
          <ListFilter className="size-4" aria-hidden="true" />
          {category === 'All' ? 'All categories' : category}
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="hub-tool-menu w-56 max-w-[calc(100vw-2rem)] rounded-xl p-1.5"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-3 py-2">
              Category
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={category} onValueChange={onCategory}>
              {categories.map((item) => (
                <DropdownMenuRadioItem
                  className="min-h-11 px-3"
                  value={item}
                  key={item}
                >
                  {item === 'All' ? 'All categories' : item}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Sort tools: ${sort === 'az' ? 'A–Z' : 'Recently used'}`}
          className={triggerClass}
        >
          <ArrowDownAZ className="size-4" aria-hidden="true" />
          {sort === 'az' ? 'A–Z' : 'Recent'}
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="hub-tool-menu w-56 max-w-[calc(100vw-2rem)] rounded-xl p-1.5"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-3 py-2">
              Sort tools
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => onSort(value as DirectorySort)}
            >
              <DropdownMenuRadioItem value="az" className="min-h-11 px-3">
                A–Z
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="recent" className="min-h-11 px-3">
                Recently used
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
