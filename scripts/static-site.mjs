import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary',
  '.gz': 'application/gzip', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

export function normalizeBasePath(value = '/') {
  if (!value.startsWith('/') || !value.endsWith('/') || /[?#\\\0]/.test(value)
    || value.includes('//') || value.split('/').some(part => part === '.' || part === '..')
    || decodeURIComponent(value) !== value) throw new Error('Base path must be a plain absolute directory path, for example /museum/.');
  return value;
}

/** A strict preview of static hosting: missing documents never fall back to index.html. */
export async function serveBuild({ directory = defaultDirectory, basePath = '/', port = 0 } = {}) {
  basePath = normalizeBasePath(basePath);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be an integer between 0 and 65535.');
  const directoryPath = resolve(directory), directoryInfo = await lstat(directoryPath);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) throw new Error('The build must be a real directory.');
  const root = await realpath(directoryPath);
  const server = createServer(async (request, response) => {
    const fail = (status, message) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD'); fail(405, 'Method not allowed'); return;
    }
    let pathname;
    try { pathname = decodeURIComponent((request.url ?? '/').split('?')[0]); }
    catch { fail(400, 'Invalid URL encoding'); return; }
    if (!pathname.startsWith('/') || /[\\\0]/.test(pathname) || pathname.split('/').some(part => part === '.' || part === '..')) {
      fail(400, 'Invalid path'); return;
    }
    if (basePath !== '/' && pathname === basePath.slice(0, -1)) {
      response.writeHead(301, { Location: basePath }); response.end(); return;
    }
    if (!pathname.startsWith(basePath)) { fail(404, 'Not found'); return; }
    let relative = pathname.slice(basePath.length);
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const file = resolve(root, relative);
    if (file !== root && !file.startsWith(root + sep)) { fail(403, 'Forbidden'); return; }
    try {
      // Do not let a preview silently publish symlinked files outside the artifact.
      let current = root, info;
      for (const segment of relative.split('/').filter(Boolean)) {
        current = resolve(current, segment); info = await lstat(current);
        if (info.isSymbolicLink()) { fail(403, 'Symbolic links are not served'); return; }
      }
      if (!info?.isFile()) { fail(404, 'Not found'); return; }
      const headers = {
        'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream',
        'Content-Length': info.size, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes',
      };
      let start = 0, end = info.size - 1, status = 200;
      if (request.headers.range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
        if (!match || !Number.isSafeInteger(Number(match[1])) || !Number.isSafeInteger(Number(match[2] || end))) {
          response.setHeader('Content-Range', `bytes */${info.size}`); fail(416, 'Invalid range'); return;
        }
        start = Number(match[1]); end = Math.min(info.size - 1, Number(match[2] || end));
        if (start > end || start >= info.size) {
          response.setHeader('Content-Range', `bytes */${info.size}`); fail(416, 'Range not satisfiable'); return;
        }
        status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`; headers['Content-Length'] = end - start + 1;
      }
      response.writeHead(status, headers);
      if (request.method === 'HEAD' || info.size === 0) { response.end(); return; }
      const stream = createReadStream(file, { start, end });
      stream.on('error', () => response.destroy()); response.on('close', () => stream.destroy()); stream.pipe(response);
    } catch (error) { fail(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, 'Not found'); }
  });
  await new Promise((accept, reject) => {
    server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); accept(); });
  });
  const address = server.address(), origin = `http://127.0.0.1:${address.port}`;
  let closing;
  return {
    origin, base: origin + basePath, basePath, directory: root,
    close() {
      closing ??= new Promise((accept, reject) => {
        server.close(error => error ? reject(error) : accept()); server.closeAllConnections();
      });
      return closing;
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = { port: 4185 };
    for (let i = 0; i < args.length; i += 2) {
      const flag = args[i], value = args[i + 1];
      if (!value) throw new Error(`Missing value for ${flag}`);
      if (flag === '--base-path') options.basePath = value;
      else if (flag === '--port') options.port = Number(value);
      else if (flag === '--dir') options.directory = resolve(value);
      else throw new Error(`Unknown option ${flag}`);
    }
    const build = await serveBuild(options);
    console.log(`Static build: ${build.base}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void build.close(); });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
