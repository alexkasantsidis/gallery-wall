/// <reference lib="webworker" />
// Decodes photos off the main thread: hashing, EXIF-aware decode, preview pyramid, average colour, rotation.

export const PREVIEW_SIZES = [512, 1024, 2048] as const;

type Req =
  | { id: number; type: 'ingest'; blob: Blob }
  | { id: number; type: 'rotate'; blob: Blob; deg: number };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

async function encode(bmp: ImageBitmap, maxEdge: number, deg = 0): Promise<Blob> {
  const s = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s));
  const h = Math.max(1, Math.round(bmp.height * s));
  const swap = deg % 180 !== 0;
  const canvas = new OffscreenCanvas(swap ? h : w, swap ? w : h);
  const g = canvas.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.translate(canvas.width / 2, canvas.height / 2);
  g.rotate((deg * Math.PI) / 180);
  g.drawImage(bmp, -w / 2, -h / 2, w, h);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
}

function averageColor(bmp: ImageBitmap): string {
  const c = new OffscreenCanvas(8, 8);
  const g = c.getContext('2d')!;
  g.drawImage(bmp, 0, 0, 8, 8);
  const d = g.getImageData(0, 0, 8, 8).data;
  let r = 0;
  let gr = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    gr += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4;
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(gr)}${hex(b)}`;
}

async function sha256(blob: Blob) {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

ctx.onmessage = async (e: MessageEvent<Req>) => {
  const req = e.data;
  try {
    if (req.type === 'ingest') {
      const [hash, bmp] = await Promise.all([sha256(req.blob), createImageBitmap(req.blob, { imageOrientation: 'from-image' })]);
      const longest = Math.max(bmp.width, bmp.height);
      const previews: Record<string, Blob> = {};
      for (const size of PREVIEW_SIZES) {
        previews[size] = await encode(bmp, size);
        if (longest <= size) break;
      }
      const avgColor = averageColor(bmp);
      ctx.postMessage({ id: req.id, ok: true, hash, w: bmp.width, h: bmp.height, avgColor, previews });
      bmp.close();
    } else {
      const bmp = await createImageBitmap(req.blob);
      const out = await encode(bmp, Math.max(bmp.width, bmp.height), req.deg);
      bmp.close();
      ctx.postMessage({ id: req.id, ok: true, blob: out });
    }
  } catch (err) {
    ctx.postMessage({ id: req.id, ok: false, error: String(err) });
  }
};
