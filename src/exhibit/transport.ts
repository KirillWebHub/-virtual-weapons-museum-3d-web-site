/** Lossless transport for static hosting; the original GLB stays available as fallback. */
export async function fetchGlb(url: URL, signal: AbortSignal, compressed = import.meta.env.PROD): Promise<ArrayBuffer> {
  signal.throwIfAborted();
  if (compressed && typeof DecompressionStream !== 'undefined') {
    try {
      const packed = new URL(url); packed.pathname += '.gz';
      const response = await fetch(packed, { signal });
      if (!response.ok) throw new Error(`GLB gzip: HTTP ${response.status}`);
      let data = await response.arrayBuffer(); signal.throwIfAborted();
      // Some hosts may apply Content-Encoding themselves; avoid decompressing twice.
      if (!isGlb(data)) data = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      signal.throwIfAborted();
      if (!isGlb(data)) throw new Error('Invalid compressed GLB');
      return data;
    } catch (error) { signal.throwIfAborted(); /* Older/misconfigured hosts use the original. */ }
  }
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`GLB: HTTP ${response.status}`);
  const data = await response.arrayBuffer(); signal.throwIfAborted();
  if (!isGlb(data)) throw new Error('Invalid GLB');
  return data;
}
function isGlb(data: ArrayBuffer): boolean {
  if (data.byteLength < 12) return false;
  const header = new DataView(data);
  return header.getUint32(0, true) === 0x46546c67 && header.getUint32(4, true) === 2 && header.getUint32(8, true) === data.byteLength;
}
