import { defineConfig } from 'vite';
import { gzipSync } from 'node:zlib';
import type { Plugin } from 'vite';
import { resolve } from 'node:path';

const glbTransport: Plugin = { name: 'museum-glb-transport', apply: 'build', generateBundle(_, bundle) {
  for (const entry of Object.values(bundle)) if (entry.type === 'asset' && entry.fileName.endsWith('.glb')) {
    this.emitFile({ type: 'asset', fileName: `${entry.fileName}.gz`, source: gzipSync(entry.source, { level: 9 }) });
  }
} };
export default defineConfig({
  plugins: [glbTransport],
  base: './',
  assetsInclude: ['**/*.glb'],
  build: {
    assetsInlineLimit: 0,
    manifest: true,
    rolldownOptions: { input: Object.fromEntries(['index', 'mosin', 'ppsh', 'sks', 'pm', 'akm'].map(name => [name, resolve(import.meta.dirname, `${name}.html`)])) },
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
