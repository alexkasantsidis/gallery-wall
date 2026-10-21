import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { db, type AssetRecord } from '../store/db';
import { newId } from '../model/defaults';

export interface AssetMeta {
  id: string;
  w: number;
  h: number;
  avgColor: string;
  name: string;
}

// ---------- worker plumbing ----------
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

function call<T>(msg: Record<string, unknown>): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./imageWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data);
      else p.reject(new Error(e.data.error));
    };
  }
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ ...msg, id });
  });
}

// ---------- metadata cache ----------
export const useAssetMetas = create<{ metas: Record<string, AssetMeta> }>(() => ({ metas: {} }));
const metaLoads = new Map<string, Promise<AssetMeta | null>>();

const toMeta = (r: AssetRecord): AssetMeta => ({ id: r.id, w: r.w, h: r.h, avgColor: r.avgColor, name: r.name });

export function loadMeta(id: string): Promise<AssetMeta | null> {
  const known = useAssetMetas.getState().metas[id];
  if (known) return Promise.resolve(known);
  let p = metaLoads.get(id);
  if (!p) {
    p = db.assets.get(id).then((r) => {
      if (!r) return null;
      const m = toMeta(r);
      useAssetMetas.setState((s) => ({ metas: { ...s.metas, [id]: m } }));
      return m;
    });
    metaLoads.set(id, p);
  }
  return p;
}

export function useAssetMeta(id: string | null | undefined): AssetMeta | null {
  const meta = useAssetMetas((s) => (id ? s.metas[id] : undefined));
  useEffect(() => {
    if (id && !meta) void loadMeta(id);
  }, [id, meta]);
  return meta ?? null;
}

// ---------- ingest ----------
const isHeic = (f: Blob & { name?: string }) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name ?? '');

interface IngestResult {
  hash: string;
  w: number;
  h: number;
  avgColor: string;
  previews: Record<string, Blob>;
}

/** Store a photo (deduplicated by content hash) and return its metadata. */
export async function ingest(file: Blob & { name?: string }, opts: { id?: string } = {}): Promise<AssetMeta> {
  let blob: Blob = file;
  let res: IngestResult;
  try {
    res = await call<IngestResult>({ type: 'ingest', blob });
  } catch (err) {
    if (!isHeic(file)) throw err;
    // Browsers other than Safari cannot decode HEIC: convert to JPEG first.
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    blob = Array.isArray(converted) ? converted[0] : converted;
    res = await call<IngestResult>({ type: 'ingest', blob });
  }
  if (isHeic(file) && blob === file) {
    // Safari decoded it, but keep a portable original for export.
    blob = res.previews['2048'] ?? Object.values(res.previews).pop()!;
  }
  if (!opts.id) {
    const existing = await db.assets.where('hash').equals(res.hash).first();
    if (existing) {
      const m = toMeta(existing);
      useAssetMetas.setState((s) => ({ metas: { ...s.metas, [m.id]: m } }));
      return m;
    }
  }
  const rec: AssetRecord = {
    id: opts.id ?? newId(),
    hash: res.hash,
    name: file.name ?? 'photo',
    mime: blob.type || 'image/jpeg',
    w: res.w,
    h: res.h,
    avgColor: res.avgColor,
    original: blob,
    previews: res.previews,
    createdAt: Date.now(),
  };
  await db.assets.put(rec);
  const m = toMeta(rec);
  useAssetMetas.setState((s) => ({ metas: { ...s.metas, [m.id]: m } }));
  return m;
}

// ---------- object URLs (with level of detail + rotation) ----------
export type LodSize = 512 | 1024 | 2048 | 'orig';
const LODS: LodSize[] = [512, 1024, 2048, 'orig'];
const urlCache = new Map<string, Promise<string>>();

export function pickLod(targetPx: number): LodSize {
  for (const l of LODS) if (l !== 'orig' && l >= targetPx) return l;
  return 'orig';
}

export function assetUrl(id: string, lod: LodSize, rotate = 0): Promise<string> {
  const key = `${id}:${lod}:${rotate}`;
  let p = urlCache.get(key);
  if (!p) {
    p = (async () => {
      const r = await db.assets.get(id);
      if (!r) throw new Error('missing asset');
      let blob: Blob | undefined;
      if (lod === 'orig') blob = r.original;
      else {
        // Largest available preview not bigger than requested, else the biggest we have.
        const keys = Object.keys(r.previews).map(Number).sort((a, b) => a - b);
        const k = keys.find((k) => k >= lod) ?? keys[keys.length - 1];
        blob = r.previews[k];
      }
      if (!blob) throw new Error('missing blob');
      if (rotate) {
        const out = await call<{ blob: Blob }>({ type: 'rotate', blob, deg: rotate });
        blob = out.blob;
      }
      return URL.createObjectURL(blob);
    })();
    p.catch(() => urlCache.delete(key));
    urlCache.set(key, p);
  }
  return p;
}

/** Object URL for an asset at a resolution that suits `targetPx`, never stepping down once sharper. */
export function useAssetUrl(id: string | null | undefined, targetPx: number, rotate = 0): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const best = useRef<{ key: string; rank: number }>({ key: '', rank: -1 });
  const lod = pickLod(targetPx);
  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    const base = `${id}:${rotate}`;
    const rank = LODS.indexOf(lod);
    if (best.current.key === base && rank <= best.current.rank) return;
    let alive = true;
    assetUrl(id, lod, rotate)
      .then((u) => {
        if (!alive) return;
        best.current = { key: base, rank };
        setUrl(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, lod, rotate]);
  return id ? url : null;
}

export async function getAsset(id: string) {
  return db.assets.get(id);
}
