import type { FrameItem, WallDoc } from '../model/types';
import { styleById } from '../model/frameStyles';
import { formatSize } from '../model/units';
import { matLayout, frameMetrics } from '../geometry/frameGeometry';
import { hangingPlan } from '../geometry/hanging';

export interface ShoppingGroup {
  title: string;
  lines: { qty: number; text: string; detail?: string }[];
}

export function shoppingList(doc: WallDoc): ShoppingGroup[] {
  const units = doc.prefs.units;
  const frames = doc.order.map((id) => doc.items[id]).filter((i): i is FrameItem => i?.kind === 'frame');
  const framed = new Map<string, { qty: number; detail: string }>();
  const prints = new Map<string, number>();
  const mats = new Map<string, number>();
  for (const f of frames) {
    const s = styleById(f.styleId);
    const size = formatSize(Math.min(f.nominal.w, f.nominal.h), Math.max(f.nominal.w, f.nominal.h), units);
    if (s.face === 0) {
      const k = `${s.name} · ${size}`;
      prints.set(k, (prints.get(k) ?? 0) + 1);
    } else {
      const k = `${s.name} frame · ${size}`;
      const met = frameMetrics(f);
      framed.set(k, { qty: (framed.get(k)?.qty ?? 0) + 1, detail: `outer ${formatSize(met.outer.w, met.outer.h, units)}` });
    }
    if (f.mat.enabled) {
      const m = matLayout(f, artBox(f));
      if (m) {
        const k = `Mat ${size} with ${formatSize(m.opening.w, m.opening.h, units, false)} opening${f.mat.double.enabled ? ' (double)' : ''}`;
        mats.set(k, (mats.get(k) ?? 0) + 1);
      }
    }
  }
  const plan = hangingPlan(doc);
  const nails = plan.reduce((s, p) => s + p.nails.length, 0);
  const groups: ShoppingGroup[] = [];
  if (framed.size) groups.push({ title: 'Frames', lines: [...framed].map(([text, v]) => ({ qty: v.qty, text, detail: v.detail })) });
  if (prints.size) groups.push({ title: 'Prints (frameless)', lines: [...prints].map(([text, qty]) => ({ qty, text })) });
  if (mats.size) groups.push({ title: 'Mats', lines: [...mats].map(([text, qty]) => ({ qty, text })) });
  groups.push({
    title: 'Hardware',
    lines: [
      { qty: nails, text: 'Picture hooks / nails', detail: 'use wall anchors for pieces over ~20 lb' },
      { qty: frames.filter((f) => f.hanger.kind === 'd-rings').length * 2, text: 'D-rings' },
      { qty: frames.length * 2, text: 'Bumper pads', detail: 'keeps frames level and off the wall' },
    ].filter((l) => l.qty > 0),
  });
  return groups;
}

const artBox = (f: FrameItem) => {
  const m = frameMetrics(f);
  return { w: m.outer.w - 2 * m.artInset, h: m.outer.h - 2 * m.artInset };
};

export function shoppingText(doc: WallDoc) {
  return shoppingList(doc)
    .map((g) => `${g.title}\n${g.lines.map((l) => `  ${l.qty} × ${l.text}${l.detail ? ` (${l.detail})` : ''}`).join('\n')}`)
    .join('\n\n');
}
