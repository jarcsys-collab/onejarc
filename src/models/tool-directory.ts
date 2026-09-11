/** OneJarc frontend snapshot from company-tool-hub/lib/tool-directory.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** Presentation-only directory filtering. Never changes catalog records, access
 * rules, or search ranking. Recent order uses the existing device-local history. */
import type { Tool } from './tool-catalog';

export type DirectorySort = 'az' | 'recent';

/** Return a new array; missing recent entries sort alphabetically after known ones. */
export function arrangeDirectory<T extends { tool: Tool }>(
  results: readonly T[],
  category: string,
  sort: DirectorySort,
  recent: readonly string[],
): T[] {
  const positions = new Map(recent.map((id, index) => [id, index]));
  return results
    .filter(({ tool }) => category === 'All' || tool.category === category)
    .sort((a, b) => {
      if (sort === 'recent') {
        const difference =
          (positions.get(a.tool.id) ?? Infinity) -
          (positions.get(b.tool.id) ?? Infinity);
        if (difference && !Number.isNaN(difference)) return difference;
      }
      return a.tool.name.localeCompare(b.tool.name);
    });
}
