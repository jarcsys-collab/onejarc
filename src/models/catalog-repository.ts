/** OneJarc frontend snapshot from company-tool-hub/lib/catalog-repository.ts.
 * Original logic is retained. Edit this readable copy if maintaining the standalone
 * package; regenerate from the main project for future synchronized snapshots.
 * See ARCHITECTURE.md for the MVC-style boundary and demo/backend limits. */
/** Persistence port. Replace this local adapter with an authenticated API later;
 * admin components never read/write storage directly. No backend is created. */
import {
  createSeedCatalog,
  parseCatalog,
  type CatalogSnapshot,
} from './catalog-model';
export const CATALOG_KEY = 'onejarc-tool-catalog-github-empty-v1';
export interface ToolCatalogRepository {
  read(): Promise<CatalogSnapshot>;
  write(snapshot: CatalogSnapshot, expectedRevision: number): Promise<void>;
}
export function createLocalCatalogRepository(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): ToolCatalogRepository {
  function readLocal() {
    const raw = storage.getItem(CATALOG_KEY);
    return raw === null ? createSeedCatalog() : parseCatalog(raw);
  }
  return {
    async read() {
      return readLocal();
    },
    async write(snapshot, expectedRevision) {
      // Best-effort cross-tab conflict detection. A real API must use a database
      // transaction/ETag; browser storage cannot provide a transactional lock.
      if (readLocal().revision !== expectedRevision)
        throw new Error(
          'The catalog changed in another tab. Reload the catalog before saving again.',
        );
      storage.setItem(
        CATALOG_KEY,
        JSON.stringify(parseCatalog(JSON.stringify(snapshot))),
      );
    },
  };
}
