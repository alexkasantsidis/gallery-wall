import { strToU8, strFromU8, zip, unzip } from 'fflate';
import { db } from '../store/db';
import type { WallDoc } from '../model/types';
import { ingest } from '../photos/assets';
import { downloadBlob, safeName } from './download';
import { newId } from '../model/defaults';

const FORMAT = 'gallery-wall/1';

/** Every asset id a wall references (photos + wall photo). */
export function referencedAssets(doc: WallDoc): string[] {
  const ids = new Set<string>();
  for (const it of Object.values(doc.items)) {
    if (it.kind !== 'frame') continue;
    if (it.content.kind === 'single' && it.content.photo) ids.add(it.content.photo.assetId);
    if (it.content.kind === 'grid') for (const c of it.content.cells) if (c.photo) ids.add(c.photo.assetId);
  }
  if (doc.wall.style.photo) ids.add(doc.wall.style.photo.assetId);
  return [...ids];
}

/** A single portable .wall file: wall.json + original photos, zipped. */
export async function exportWallFile(doc: WallDoc) {
  const files: Record<string, Uint8Array> = {
    'wall.json': strToU8(JSON.stringify({ format: FORMAT, doc }, null, 1)),
  };
  for (const id of referencedAssets(doc)) {
    const a = await db.assets.get(id);
    if (!a) continue;
    files[`assets/${id}.json`] = strToU8(JSON.stringify({ id, name: a.name, mime: a.mime }));
    files[`assets/${id}.bin`] = new Uint8Array(await a.original.arrayBuffer());
  }
  const data = await new Promise<Uint8Array>((res, rej) => zip(files, { level: 0 }, (err, out) => (err ? rej(err) : res(out))));
  downloadBlob(new Blob([data as BlobPart], { type: 'application/zip' }), `${safeName(doc.name)}.wall`);
}

export async function importWallFile(file: File): Promise<WallDoc> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = await new Promise<Record<string, Uint8Array>>((res, rej) => unzip(buf, (err, out) => (err ? rej(err) : res(out))));
  const manifest = JSON.parse(strFromU8(files['wall.json']));
  if (manifest.format !== FORMAT) throw new Error('Not a gallery wall file');
  const doc = manifest.doc as WallDoc;
  for (const path of Object.keys(files)) {
    const m = path.match(/^assets\/(.+)\.json$/);
    if (!m) continue;
    const meta = JSON.parse(strFromU8(files[path]));
    if (await db.assets.get(meta.id)) continue;
    const bin = files[`assets/${meta.id}.bin`];
    if (!bin) continue;
    const blob = new File([bin as BlobPart], meta.name ?? 'photo', { type: meta.mime ?? 'image/jpeg' });
    await ingest(blob, { id: meta.id });
  }
  if (await db.walls.get(doc.id)) {
    doc.id = newId();
    doc.name = `${doc.name} (imported)`;
  }
  doc.updatedAt = Date.now();
  await db.walls.put(doc);
  return doc;
}
