/** Check static portability, file integrity, and actual HTTP asset delivery at
 * both domain-root and repository-subpath URLs. This is not browser/UI testing. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = join(root, 'site');

/** A deployable tree must contain only regular static files, not symlinks/source/secrets. */
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), 'Static output must not contain symlinks.');
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspect(path);
      continue;
    }
    assert(
      !/^(?:\.env|\.git|hosting\.json)/.test(entry.name),
      'Private configuration in output.',
    );
    assert(
      !/\.(?:tsx?|map)$/.test(entry.name),
      'Only compiled browser files may be published.',
    );
    if (entry.name.endsWith('.js'))
      execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  }
}
await inspect(site);
assert((await lstat(join(site, '.nojekyll'))).isFile());
const html = await readFile(join(site, 'index.html'), 'utf8');
assert(html.includes('OneJarc') && html.includes('id="root"'));
assert(
  !html.includes('<?') && !html.includes('/src/'),
  'Unbuilt or Apps Script-only page shell.',
);
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(
  (match) => match[1],
);
assert(references.some((path) => path.endsWith('.js')));
assert(references.some((path) => path.endsWith('.css')));
for (const reference of references) {
  assert(
    !/^(?:\/|https?:|data:)/.test(reference),
    `Nonportable asset: ${reference}`,
  );
  assert(
    (await lstat(resolve(site, reference))).isFile(),
    `Missing asset: ${reference}`,
  );
}
const scriptReference = references.find((path) => path.endsWith('.js'));
const javascript = await readFile(resolve(site, scriptReference), 'utf8');
assert(
  !javascript.includes('"/juno-logo.svg"'),
  'Logo must work at a repository subpath.',
);
assert(javascript.includes('juno-logo.svg'));
assert(
  javascript.includes('More actions for') && javascript.includes('Show tools'),
);

// Local test server only: maps two mount points onto the exact same built files.
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    const relative = path.startsWith('/future-test-repository/')
      ? path.slice('/future-test-repository/'.length)
      : path.slice(1);
    const target = resolve(site, relative || 'index.html');
    if (!target.startsWith(site + sep)) {
      response.writeHead(403).end();
      return;
    }
    const content = await readFile(target);
    response.writeHead(200).end(content);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const mount of ['/', '/future-test-repository/']) {
    const page = await fetch(origin + mount);
    assert.equal(page.status, 200);
    assert.equal(await page.text(), html);
    for (const reference of [...references, './juno-logo.svg']) {
      const asset = await fetch(new URL(reference, origin + mount));
      assert.equal(
        asset.status,
        200,
        `Asset unavailable under ${mount}: ${reference}`,
      );
      assert((await asset.arrayBuffer()).byteLength > 0);
    }
  }
  console.log(
    'Static package verified: HTML, JS, CSS, logo, root URLs and repository-subpath URLs.',
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
