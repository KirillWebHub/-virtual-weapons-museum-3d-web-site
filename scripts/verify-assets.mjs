import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const buildDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
export function siteUrl(value) {
  const url = new URL(value);
  assert.ok(['http:', 'https:'].includes(url.protocol), 'Use an HTTP(S) site URL');
  assert.ok(!url.username && !url.password && !url.search && !url.hash, 'Use a public site base URL without credentials, query or fragment');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}
async function outputFiles(directory, current = directory) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // Pages excludes hidden build metadata; runtime never requests it.
    assert.ok(!entry.isSymbolicLink(), `Symbolic links must not be published: ${entry.name}`);
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) files.push(...await outputFiles(directory, path));
    else if (entry.isFile()) files.push(relative(directory, path).split(sep).join('/'));
  }
  return files.sort();
}

export function assetReferences(content, file) {
  if (file.endsWith('.html')) return [...content.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
  if (file.endsWith('.css')) return [...content.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)/g)].map(match => match[1] ?? match[2] ?? match[3]);
  return [...content.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)].map(match => match[1]);
}

/** Verify the actual static documents and every public build byte, not a dev-server fallback. */
export async function verifyAssets({ directory = buildDirectory, base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173/' } = {}) {
  directory = resolve(directory); const origin = siteUrl(base);
  const manifest = JSON.parse(await readFile(resolve(directory, '.vite/manifest.json'), 'utf8'));
  const entries = Object.entries(manifest), all = Object.values(manifest);
  const models = [...new Set(entries.filter(([key]) => key.startsWith('3D-models/')).map(([, entry]) => entry.file))].filter(file => file.endsWith('.glb'));
  assert.equal(models.length, 5, 'Exactly five active exhibits must be built');
  for (const key of ['3D-models/akm-detailed.glb', '3D-models/mosin-rifle.glb', 'src/assets/hero/display-case.glb', 'src/assets/hero/soviet-coin-1946.glb', 'src/assets/finale/shooting-range-target.glb']) assert.ok(manifest[key], `Missing ${key}`);
  for (const key of ['3D-models/low-poly_mosin_nagant_189130.glb', '3D-models/akm__free_lowpoly.glb', 'docs/mockups/assets/references/ak47-reference.glb']) assert.ok(!manifest[key], `Inactive model was bundled: ${key}`);
  const glbs = all.map(entry => entry.file).filter(file => file.endsWith('.glb'));
  assert.equal(glbs.length, 8, 'Five exhibits and three decorative models');
  assert.equal(all.filter(entry => entry.file.endsWith('.webp')).length, 5, 'Five covers');
  assert.equal(all.filter(entry => entry.file.endsWith('.ttf')).length, 4, 'Four local fonts');
  const files = await outputFiles(directory), bytes = new Map();
  for (const file of files) bytes.set(file, await readFile(resolve(directory, file)));
  for (const name of ['index', 'mosin', 'ppsh', 'sks', 'pm', 'akm']) assert.ok(bytes.has(`${name}.html`), `Missing static page: ${name}.html`);
  assert.deepEqual(files.filter(file => file.endsWith('.gz')).sort(), glbs.map(file => `${file}.gz`).sort(), 'Every gzip must have a known GLB original');
  const fetchFile = async file => {
    const url = new URL(file, origin);
    assert.ok(url.origin === origin.origin && url.pathname.startsWith(origin.pathname), `Asset escapes site base: ${file}`);
    const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, `${file}: expected HTTP 200, got ${response.status}`);
    return { response, body: Buffer.from(await response.arrayBuffer()) };
  };
  let total = 0;
  for (const file of files.filter(file => !file.endsWith('.gz'))) {
    const { response, body } = await fetchFile(file), expected = bytes.get(file);
    assert.deepEqual(body, expected, `${file}: response differs from this build, or is fallback HTML`);
    total += body.length;
    if (file.endsWith('.html')) assert.match(response.headers.get('content-type') ?? '', /text\/html/i, `${file}: HTML MIME`);
    if (file.endsWith('.js')) assert.match(response.headers.get('content-type') ?? '', /(?:java|ecma)script/i, `${file}: module MIME`);
    if (file.endsWith('.css')) assert.match(response.headers.get('content-type') ?? '', /text\/css/i, `${file}: stylesheet MIME`);
    if (file.endsWith('.glb')) { assert.equal(body.subarray(0, 4).toString(), 'glTF'); assert.equal(body.readUInt32LE(4), 2); assert.equal(body.readUInt32LE(8), body.length); }
    if (file.endsWith('.ttf')) assert.equal(body.readUInt32BE(0), 0x00010000, `${file}: TrueType header`);
    if (file.endsWith('.webp')) { assert.equal(body.subarray(0, 4).toString(), 'RIFF'); assert.equal(body.subarray(8, 12).toString(), 'WEBP'); }
  }
  for (const file of glbs) {
    assert.ok(bytes.has(`${file}.gz`), `${file}: missing transport companion`);
    const { response, body } = await fetchFile(`${file}.gz`);
    const decoded = body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : (assert.match(response.headers.get('content-encoding') ?? '', /gzip/i), body);
    assert.deepEqual(decoded, bytes.get(file), `${file}: gzip must preserve all bytes`);
    assert.deepEqual(gunzipSync(bytes.get(`${file}.gz`)), bytes.get(file), `${file}: local gzip mismatch`);
  }
  // Test paths emitted in HTML and CSS under the requested base, including nested imports.
  for (const file of files.filter(file => /\.(html|css|js)$/.test(file))) {
    const content = bytes.get(file).toString('utf8');
    for (const value of assetReferences(content, file)) {
      if (/^(?:https?:|data:|#)/.test(value)) continue;
      const url = new URL(value, new URL(file, origin));
      assert.ok(url.origin === origin.origin && url.pathname.startsWith(origin.pathname), `${file}: reference escapes base: ${value}`);
      const destination = decodeURIComponent(url.pathname.slice(origin.pathname.length)) || 'index.html';
      assert.ok(bytes.has(destination), `${file}: missing referenced output ${destination}`);
    }
  }
  const release = JSON.parse(bytes.get('version.json')?.toString('utf8') ?? 'null');
  assert.ok(release && release.schemaVersion === 1 && release.project === 'virtual-museum', 'Missing release identity');
  const published = files.filter(file => file !== 'version.json');
  assert.deepEqual(Object.keys(release.files).sort(), published, 'Release inventory must include every public output');
  for (const file of published) assert.equal(release.files[file], createHash('sha256').update(bytes.get(file)).digest('hex'), `${file}: release checksum mismatch`);
  console.log(`PASS ${origin.href}: 6 pages, 8 GLB/gzip, 5 covers, 4 fonts; ${files.length} public files verified (${total} bytes excluding gzip companions).`);
  return { base: origin.href, files: files.length, bytes: total, revision: release.revision, version: release.version };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await verifyAssets();

/** Anonymous verification uses the deployed release identity, without rebuilding a different local version. */
export async function verifyPublishedSite({ url, revision } = {}) {
  const base = siteUrl(url);
  const request = async file => {
    const target = new URL(file, base);
    assert.ok(target.origin === base.origin && target.pathname.startsWith(base.pathname), `Published path escapes site: ${file}`);
    const response = await fetch(target, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, `${file}: HTTP ${response.status}`);
    return { response, body: Buffer.from(await response.arrayBuffer()) };
  };
  const identity = JSON.parse((await request('version.json')).body.toString('utf8'));
  assert.ok(identity.schemaVersion === 1 && identity.project === 'virtual-museum', 'Unexpected public project identity');
  assert.ok(identity.files && typeof identity.files === 'object' && !Array.isArray(identity.files), 'Missing public file inventory');
  if (revision !== undefined) { assert.match(revision, /^[a-f0-9]{40}$/i, 'Expected a complete commit SHA'); assert.equal(identity.revision, revision, 'The expected commit is not published yet'); }
  const files = Object.keys(identity.files).sort();
  for (const file of files) {
    assert.ok(file && !file.startsWith('/') && !/[\\\0?#:]/.test(file) && !file.split('/').some(part => part === '.' || part === '..' || part.startsWith('.')), `Invalid public file path: ${file}`);
    assert.match(identity.files[file], /^[a-f0-9]{64}$/, `${file}: invalid checksum`);
  }
  for (const name of ['index', 'mosin', 'ppsh', 'sks', 'pm', 'akm']) assert.ok(files.includes(`${name}.html`), `Missing chapter: ${name}`);
  const glbs = files.filter(file => file.endsWith('.glb'));
  assert.equal(glbs.length, 8, 'Public build must contain eight models');
  assert.deepEqual(files.filter(file => file.endsWith('.gz')), glbs.map(file => `${file}.gz`), 'Every model must have its gzip companion');
  assert.equal(files.filter(file => file.endsWith('.ttf')).length, 4, 'Four local fonts');
  assert.equal(files.filter(file => file.endsWith('.webp')).length, 5, 'Five exhibit covers');
  for (const name of ['coin-1946.txt', 'golos-text-OFL.txt', 'gsap-LICENSE-NOTICE.txt', 'lozung-caps.txt', 'morfin-sans.txt', 'oswald-OFL.txt', 'three-LICENSE.txt', 'yaml-LICENSE.txt']) assert.ok(files.includes(`licenses/${name}`), `Missing license notice: ${name}`);
  const bodies = new Map();
  for (const file of files) {
    const { response, body } = await request(file);
    const httpDecoded = file.endsWith('.gz') && body[0] !== 0x1f && /gzip/i.test(response.headers.get('content-encoding') ?? '');
    if (httpDecoded) assert.deepEqual(body, bodies.get(file.slice(0, -3)), `${file}: HTTP decoded payload differs`);
    else assert.equal(createHash('sha256').update(body).digest('hex'), identity.files[file], `${file}: public checksum mismatch`);
    if (file.endsWith('.html')) assert.match(response.headers.get('content-type') ?? '', /text\/html/i);
    if (file.endsWith('.js')) assert.match(response.headers.get('content-type') ?? '', /(?:java|ecma)script/i);
    if (file.endsWith('.css')) assert.match(response.headers.get('content-type') ?? '', /text\/css/i);
    if (file.endsWith('.glb')) { assert.equal(body.subarray(0, 4).toString(), 'glTF'); assert.equal(body.readUInt32LE(4), 2); assert.equal(body.readUInt32LE(8), body.length); }
    if (file.endsWith('.gz') && !httpDecoded) assert.deepEqual(gunzipSync(body), bodies.get(file.slice(0, -3)), `${file}: gzip differs from the original GLB`);
    bodies.set(file, body);
  }
  for (const [file, body] of bodies) if (/\.(html|css|js)$/.test(file)) {
    for (const reference of assetReferences(body.toString('utf8'), file)) {
      if (/^(?:https?:|data:|#)/.test(reference)) continue;
      const target = new URL(reference, new URL(file, base));
      assert.ok(target.origin === base.origin && target.pathname.startsWith(base.pathname), `${file}: reference escapes the published base`);
      assert.ok(bodies.has(decodeURIComponent(target.pathname.slice(base.pathname.length)) || 'index.html'), `${file}: missing public reference ${reference}`);
    }
  }
  console.log(`PASS public release ${base.href}: ${files.length + 1} files, revision ${identity.revision ?? 'local'}`);
  return { base: base.href, files: files.length + 1, revision: identity.revision };
}
