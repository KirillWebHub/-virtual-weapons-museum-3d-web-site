import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const directory = resolve(process.argv[2] ?? fileURLToPath(new URL('../dist/', import.meta.url)));
async function collect(current = directory) {
  const result = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || current === directory && entry.name === 'version.json') continue;
    if (entry.isSymbolicLink()) throw new Error(`Cannot publish a symbolic link: ${entry.name}`);
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) result.push(...await collect(path));
    else if (entry.isFile()) result.push(relative(directory, path).split(sep).join('/'));
  }
  return result.sort();
}
const files = {};
for (const path of await collect()) files[path] = createHash('sha256').update(await readFile(resolve(directory, path))).digest('hex');
const packageInfo = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const revision = process.env.GITHUB_SHA ?? null;
if (revision !== null && !/^[a-f0-9]{40}$/i.test(revision)) throw new Error('GITHUB_SHA must be a complete commit SHA');
const release = { schemaVersion: 1, project: 'virtual-museum', version: packageInfo.version, revision, builtAt: new Date().toISOString(), files };
await writeFile(resolve(directory, 'version.json'), JSON.stringify(release, null, 2) + '\n');
console.log(`Release identity: ${Object.keys(files).length} files, revision ${revision ?? 'local (not a published commit)'}`);
