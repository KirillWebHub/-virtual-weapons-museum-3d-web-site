import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveBuild, normalizeBasePath } from './static-site.mjs';
import { verifyAssets, verifyPublishedSite } from './verify-assets.mjs';

const defaultDirectory = fileURLToPath(new URL('../dist/', import.meta.url));

/** Exercise the exact release on a host with real 404s, at root and in a repository subdirectory. */
export async function verifySite({ directory = defaultDirectory, basePath = '/-virtual-weapons-museum-3d-web-site/', url, revision } = {}) {
  directory = resolve(directory);
  if (url) {
    const base = new URL(url);
    assert.ok(['http:', 'https:'].includes(base.protocol) && !base.username && !base.password && !base.search && !base.hash, 'Provide a plain HTTP(S) site URL.');
    assert.ok(base.pathname.endsWith('/'), 'The public site URL must end with /.');
    await verifyPublishedSite({ url: base.href, ...(revision !== undefined ? { revision } : {}) });
    return;
  }
  basePath = normalizeBasePath(basePath);
  const manifest = JSON.parse(await readFile(resolve(directory, '.vite/manifest.json'), 'utf8'));
  const asset = Object.values(manifest).find(entry => entry.file?.endsWith('.js'))?.file;
  assert.ok(asset, 'The build must contain a JavaScript bundle.');
  for (const prefix of new Set(['/', basePath])) {
    const host = await serveBuild({ directory, basePath: prefix });
    try {
      await verifyAssets({ directory, base: host.base });
      await verifyPublishedSite({ url: host.base });
      for (const missing of ['missing-chapter.html', 'assets/missing-resource.js']) {
        const response = await fetch(new URL(missing, host.base));
        assert.equal(response.status, 404, `${missing}: missing paths must not return fallback HTML`); await response.body?.cancel();
      }
      if (prefix !== '/') {
        const response = await fetch(new URL(`/${asset}`, host.origin));
        assert.equal(response.status, 404, 'An asset without the repository prefix must not resolve.'); await response.body?.cancel();
      }
      console.log(`PASS strict static routing ${prefix}`);
    } finally { await host.close(); }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
      const flag = args[i], value = args[i + 1];
      if (!value) throw new Error(`Missing value for ${flag}`);
      if (flag === '--base-path') options.basePath = value;
      else if (flag === '--url') options.url = value;
      else if (flag === '--revision') options.revision = value;
      else if (flag === '--dir') options.directory = resolve(value);
      else throw new Error(`Unknown option ${flag}`);
    }
    await verifySite(options);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
