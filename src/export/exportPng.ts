import { domToBlob } from 'modern-screenshot';
import type { WallDoc } from '../model/types';
import { PPI } from '../model/units';
import { downloadBlob, safeName } from './download';

/** Render the wall (without selection UI) to a PNG roughly `width` pixels wide. */
export async function exportPng(doc: WallDoc, width = 3000) {
  const el = document.querySelector<HTMLElement>('[data-world]');
  if (!el) throw new Error('Wall not mounted');
  const floorExtra = 14; // matches the world box in Viewport
  const scale = width / (doc.wall.width * PPI);
  const blob = await domToBlob(el, {
    scale,
    width: doc.wall.width * PPI,
    height: (doc.wall.height + floorExtra) * PPI,
    backgroundColor: '#16161a',
    filter: (node) => !(node instanceof HTMLElement && node.hasAttribute('data-noexport')),
    style: { transform: 'none' },
  });
  if (!blob) throw new Error('Export failed');
  downloadBlob(blob, `${safeName(doc.name)}.png`);
}
