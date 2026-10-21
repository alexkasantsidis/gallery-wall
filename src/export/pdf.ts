import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import type { WallDoc } from '../model/types';
import { hangingPlan } from '../geometry/hanging';
import { itemRect } from '../geometry/frameGeometry';
import { styleById } from '../model/frameStyles';
import { formatLength, formatSize } from '../model/units';
import { downloadBlob, safeName } from './download';

const PT = 72; // points per inch
const ink = rgb(0.1, 0.1, 0.12);
const muted = rgb(0.45, 0.45, 0.5);
const accent = rgb(0.85, 0.45, 0.05);
const nailRed = rgb(0.86, 0.15, 0.15);

/** Ascii-only text for the standard PDF fonts (fractions → decimals). */
const t = (s: string) =>
  s
    .replace(/[⅛¼⅜½⅝¾⅞]/g, (c) => ({ '⅛': '.125', '¼': '.25', '⅜': '.375', '½': '.5', '⅝': '.625', '¾': '.75', '⅞': '.875' })[c]!)
    .replace(/(^|[^\d])\.(\d)/g, (_m, pre: string, d: string) => `${pre}0.${d}`)
    .replace(/″/g, '"')
    .replace(/×/g, 'x')
    .replace(/·/g, '-')
    .replace(/[^\x20-\x7e]/g, '');

/** Hanging guide: wall diagram with numbered frames and nail points + a measurement table. */
export async function hangingGuidePdf(doc: WallDoc) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const units = doc.prefs.units;
  const plan = hangingPlan(doc);
  const W = 11 * PT;
  const H = 8.5 * PT;

  // ---- page 1: diagram ----
  const page = pdf.addPage([W, H]);
  page.drawText(t(doc.name), { x: 36, y: H - 44, size: 18, font: bold, color: ink });
  page.drawText(t(`Hanging guide - wall ${formatSize(doc.wall.width, doc.wall.height, units)} - measurements are to the nail, from the floor and the left edge of the wall`), { x: 36, y: H - 62, size: 9, font, color: muted });
  const area = { x: 36, y: 40, w: W - 72, h: H - 120 };
  const s = Math.min(area.w / doc.wall.width, area.h / doc.wall.height);
  const ox = area.x + (area.w - doc.wall.width * s) / 2;
  const oy = area.y;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + (doc.wall.height - y) * s;
  page.drawRectangle({ x: X(0), y: Y(doc.wall.height), width: doc.wall.width * s, height: doc.wall.height * s, borderColor: ink, borderWidth: 1, color: rgb(0.97, 0.96, 0.94) });
  const eyeY = doc.wall.height - doc.wall.eyeLine;
  page.drawLine({ start: { x: X(0), y: Y(eyeY) }, end: { x: X(doc.wall.width), y: Y(eyeY) }, color: accent, thickness: 0.6, dashArray: [4, 3] });
  page.drawText(t(`eye level ${formatLength(doc.wall.eyeLine, units)}`), { x: X(doc.wall.width) - 70, y: Y(eyeY) + 3, size: 7, font, color: accent });
  for (const id of doc.order) {
    const it = doc.items[id];
    if (it?.kind !== 'furniture') continue;
    const r = itemRect(it);
    page.drawRectangle({ x: X(r.x), y: Y(r.y + r.h), width: r.w * s, height: r.h * s, color: rgb(0.85, 0.85, 0.85), opacity: 0.6 });
    page.drawText(t(it.name), { x: X(r.x) + 3, y: Y(r.y + r.h) + 3, size: 7, font, color: muted });
  }
  for (const p of plan) {
    const r = p.rect;
    page.drawRectangle({ x: X(r.x), y: Y(r.y + r.h), width: r.w * s, height: r.h * s, borderColor: ink, borderWidth: 0.8, color: rgb(1, 1, 1) });
    const label = String(p.index);
    page.drawText(label, { x: X(r.x + r.w / 2) - bold.widthOfTextAtSize(label, 11) / 2, y: Y(r.y + r.h / 2) - 4, size: 11, font: bold, color: ink });
    for (const n of p.nails) page.drawCircle({ x: X(n.x), y: Y(n.y), size: 2.4, color: nailRed });
  }

  // ---- table pages ----
  const cols = [
    { h: '#', w: 26 },
    { h: 'Piece', w: 150 },
    { h: 'Size', w: 90 },
    { h: 'Style', w: 120 },
    { h: 'Hanger', w: 90 },
    { h: 'Nail from floor', w: 100 },
    { h: 'Nail from left', w: 120 },
  ];
  let tp = pdf.addPage([W, H]);
  let y = H - 50;
  const header = (pg: PDFPage) => {
    let x = 36;
    for (const c of cols) {
      pg.drawText(c.h, { x, y, size: 9, font: bold, color: muted });
      x += c.w;
    }
    y -= 8;
    pg.drawLine({ start: { x: 36, y }, end: { x: W - 36, y }, thickness: 0.5, color: muted });
    y -= 16;
  };
  tp.drawText('Measurements', { x: 36, y: H - 30, size: 14, font: bold, color: ink });
  header(tp);
  for (const p of plan) {
    if (y < 50) {
      tp = pdf.addPage([W, H]);
      y = H - 50;
      header(tp);
    }
    const f = p.item;
    const st = styleById(f.styleId);
    const nails = p.nails;
    const cells = [
      String(p.index),
      f.name || st.name,
      formatSize(f.nominal.w, f.nominal.h, units),
      st.name,
      `${f.hanger.kind} (${formatLength(f.hanger.drop, units)})`,
      formatLength(nails[0].fromFloor, units),
      nails.map((n) => formatLength(n.fromLeft, units)).join(' & '),
    ];
    let x = 36;
    cells.forEach((c, i) => {
      tp.drawText(t(c).slice(0, 32), { x, y, size: 9.5, font: i === 0 || i >= 5 ? bold : font, color: i >= 5 ? accent : ink });
      x += cols[i].w;
    });
    y -= 18;
  }
  tp.drawText('Tip: hang the anchor piece first, then work outward. Check each nail with a level before hanging.', { x: 36, y: 30, size: 8, font, color: muted });
  const bytes = await pdf.save();
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${safeName(doc.name)}-hanging-guide.pdf`);
}

function clipLine(page: PDFPage, a: { x: number; y: number }, b: { x: number; y: number }, tile: { x: number; y: number; w: number; h: number }, toPage: (x: number, y: number) => { x: number; y: number }) {
  // Axis-aligned segments only (frame outlines), clipped to the tile.
  const x1 = Math.max(Math.min(a.x, b.x), tile.x);
  const x2 = Math.min(Math.max(a.x, b.x), tile.x + tile.w);
  const y1 = Math.max(Math.min(a.y, b.y), tile.y);
  const y2 = Math.min(Math.max(a.y, b.y), tile.y + tile.h);
  if (a.x === b.x && (a.x < tile.x || a.x > tile.x + tile.w || y1 >= y2)) return;
  if (a.y === b.y && (a.y < tile.y || a.y > tile.y + tile.h || x1 >= x2)) return;
  const s = a.x === b.x ? toPage(a.x, y1) : toPage(x1, a.y);
  const e = a.x === b.x ? toPage(a.x, y2) : toPage(x2, a.y);
  page.drawLine({ start: s, end: e, thickness: 1.5, color: ink });
}

/** 1:1 paper templates, tiled across Letter pages, with the nail point marked. */
export async function paperTemplatesPdf(doc: WallDoc, paper: 'letter' | 'a4' = 'letter') {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const units = doc.prefs.units;
  const [PW, PH] = paper === 'letter' ? [8.5, 11] : [8.27, 11.69];
  const M = 0.5;
  const TW = PW - 2 * M;
  const TH = PH - 2 * M - 0.4;
  for (const p of hangingPlan(doc)) {
    const r = p.rect;
    const cols = Math.ceil(r.w / TW);
    const rows = Math.ceil(r.h / TH);
    for (let ry = 0; ry < rows; ry++)
      for (let cx = 0; cx < cols; cx++) {
        const page = pdf.addPage([PW * PT, PH * PT]);
        const tile = { x: cx * TW, y: ry * TH, w: TW, h: TH };
        // local frame coords (inches from frame top-left) -> page points
        const toPage = (x: number, y: number) => ({ x: (M + x - tile.x) * PT, y: (PH - M - 0.4 - (y - tile.y)) * PT });
        const corners = [
          { x: 0, y: 0 },
          { x: r.w, y: 0 },
          { x: r.w, y: r.h },
          { x: 0, y: r.h },
        ];
        for (let i = 0; i < 4; i++) clipLine(page, corners[i], corners[(i + 1) % 4], tile, toPage);
        // Light fill hint inside the frame area of this tile.
        for (const n of p.nails) {
          const lx = n.x - r.x;
          const ly = n.y - r.y;
          if (lx >= tile.x && lx <= tile.x + tile.w && ly >= tile.y && ly <= tile.y + tile.h) {
            const c = toPage(lx, ly);
            page.drawLine({ start: { x: c.x - 14, y: c.y }, end: { x: c.x + 14, y: c.y }, thickness: 1, color: nailRed });
            page.drawLine({ start: { x: c.x, y: c.y - 14 }, end: { x: c.x, y: c.y + 14 }, thickness: 1, color: nailRed });
            page.drawCircle({ x: c.x, y: c.y, size: 4, borderColor: nailRed, borderWidth: 1 });
            page.drawText('NAIL HERE', { x: c.x + 8, y: c.y + 6, size: 8, font: bold, color: nailRed });
          }
        }
        // Centre label on the tile that holds the centre.
        const cxIn = r.w / 2;
        const cyIn = r.h / 2;
        if (cxIn >= tile.x && cxIn < tile.x + tile.w && cyIn >= tile.y && cyIn < tile.y + tile.h) {
          const c = toPage(cxIn, cyIn);
          const label = `#${p.index}  ${t(p.item.name || styleById(p.item.styleId).name)}`;
          page.drawText(label, { x: c.x - bold.widthOfTextAtSize(label, 14) / 2, y: c.y, size: 14, font: bold, color: ink });
          const sub = t(`${formatSize(r.w, r.h, units)} outer`);
          page.drawText(sub, { x: c.x - font.widthOfTextAtSize(sub, 10) / 2, y: c.y - 16, size: 10, font, color: muted });
        }
        page.drawText(t(`#${p.index} - page ${ry * cols + cx + 1} of ${rows * cols} (row ${ry + 1}, column ${cx + 1}) - print at 100% / actual size`), { x: M * PT, y: (PH - M + 0.05) * PT - 12, size: 8, font, color: muted });
        // 1-inch scale check.
        page.drawLine({ start: { x: M * PT, y: 0.3 * PT }, end: { x: (M + 1) * PT, y: 0.3 * PT }, thickness: 1, color: ink });
        page.drawText('1 inch - verify scale', { x: (M + 1.1) * PT, y: 0.27 * PT, size: 7, font, color: muted });
      }
  }
  if (pdf.getPageCount() === 0) return;
  const bytes = await pdf.save();
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${safeName(doc.name)}-paper-templates.pdf`);
}
