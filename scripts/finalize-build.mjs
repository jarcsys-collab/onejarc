/** Add static-host metadata after Vite builds. Never modify readable MVC source. */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const site = fileURLToPath(new URL('../site/', import.meta.url));
await writeFile(join(site, '.nojekyll'), '');
// CSS is generated from the commented view stylesheet and React class names.
for (const name of await readdir(join(site, 'assets'))) {
  if (!name.endsWith('.css')) continue;
  const path = join(site, 'assets', name);
  const css = await readFile(path, 'utf8');
  if (!css.startsWith('/* ONEJARC'))
    await writeFile(
      path,
      '/* ONEJARC GENERATED STYLES. Edit src/views/styles.css and view component classes; then rebuild. */\n' +
        css,
    );
}
