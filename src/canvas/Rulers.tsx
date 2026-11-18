import { useEffect, useRef } from 'react';
import { useDoc, getDoc } from '../store/docStore';
import { useUi } from '../store/uiStore';
import { cam, chromeInsets, viewportEl } from '../store/camera';
import { PPI, CM_PER_IN, formatLength } from '../model/units';
import { formatWallLength } from '../model/wallPresets';
import { itemRect, unionRect } from '../geometry/frameGeometry';
import type { Units } from '../model/types';

/** Ruler band thickness in screen px. */
const T = 22;
/** Gap between the ruler and the wall edge. */
const GAP = 8;

const ACCENT = '#8b7cf6';
const AMBER = '#ffb020';

/** Major tick steps, in display units, from fine to coarse. */
const STEPS: Record<Units, number[]> = {
  in: [1, 2, 3, 6, 12, 24, 48, 96, 192],
  cm: [1, 2, 5, 10, 20, 50, 100, 200, 500],
};
const MINOR: Record<Units, number[]> = {
  in: [0.125, 0.25, 0.5, 1, 3, 6, 12, 24],
  cm: [0.1, 0.5, 1, 2, 5, 10, 20, 50, 100],
};

const toDisplay = (inches: number, units: Units) => (units === 'cm' ? inches * CM_PER_IN : inches);

function pickSteps(pxPerUnit: number, units: Units) {
  const major = STEPS[units].find((s) => s * pxPerUnit >= 64) ?? STEPS[units].at(-1)!;
  const minor = MINOR[units].find((m) => m < major && (major / m) % 1 < 1e-9 && m * pxPerUnit >= 7) ?? major;
  return { major, minor };
}

function tickLabel(v: number, units: Units) {
  if (units === 'cm') return `${Math.round(v * 10) / 10}`;
  return formatWallLength(v, 'in');
}

interface Label {
  pos: number;
  text: string;
  color: string;
  ink: string;
}

/**
 * Screen-space rulers that hug the wall: one across the top measuring width from the left edge,
 * one down the side measuring height up from the floor. They follow the camera, stick to the
 * visible area when the wall edge scrolls away, and mark the selection and pointer position.
 */
export function Rulers() {
  const on = useUi((s) => s.rulers);
  return on ? <RulerCanvas /> : null;
}

function RulerCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext('2d')!;
    let raf = 0;
    let pointer: { x: number; y: number } | null = null;

    const draw = () => {
      raf = 0;
      const vp = viewportEl.current;
      const vw = vp?.clientWidth ?? window.innerWidth;
      const vh = vp?.clientHeight ?? window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      if (el.width !== Math.round(vw * dpr) || el.height !== Math.round(vh * dpr)) {
        el.width = Math.round(vw * dpr);
        el.height = Math.round(vh * dpr);
        el.style.width = `${vw}px`;
        el.style.height = `${vh}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);

      const doc = getDoc();
      const units = doc.prefs.units;
      const { width: W, height: H } = doc.wall;
      const z = cam.z.get();
      const s = PPI * z; // screen px per inch
      const X0 = cam.tx.get();
      const Y0 = cam.ty.get();
      const X1 = X0 + W * s;
      const Y1 = Y0 + H * s; // floor line
      const ins = chromeInsets();

      const ui = useUi.getState();
      const sel = unionRect(ui.selection.map((id) => doc.items[id]).filter(Boolean).map(itemRect));

      const pxPerUnit = units === 'cm' ? s / CM_PER_IN : s;
      const { major, minor } = pickSteps(pxPerUnit, units);

      ctx.font = '600 10px ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';

      // ---------------------------------------------------------------- top ruler (width)
      const ry = Math.min(Math.max(Y0 - T - GAP, ins.top + 4), vh - T - ins.bottom);
      const hx0 = Math.max(X0, ins.left + T + GAP);
      const hx1 = Math.min(X1, vw - ins.right);
      if (hx1 > hx0) {
        band(ctx, hx0, ry, hx1 - hx0, T);
        ctx.save();
        ctx.beginPath();
        ctx.rect(hx0, ry, hx1 - hx0, T);
        ctx.clip();
        if (sel) highlight(ctx, X0 + sel.x * s, ry, sel.w * s, T, true);
        const total = toDisplay(W, units);
        const specials: Label[] = [{ pos: X1, text: `${formatWallLength(W, units)} wide`, color: AMBER, ink: '#111' }];
        if (sel) {
          specials.push({ pos: X0 + sel.x * s, text: formatLength(sel.x, units), color: ACCENT, ink: '#fff' });
          specials.push({ pos: X0 + (sel.x + sel.w) * s, text: formatLength(sel.x + sel.w, units), color: ACCENT, ink: '#fff' });
        }
        ticks(ctx, total, minor, major, (v) => X0 + (v / total) * (X1 - X0), hx0, hx1, (p, len) => {
          ctx.moveTo(p, ry + T);
          ctx.lineTo(p, ry + T - len);
        });
        // Regular labels, skipping ones that would collide with the highlighted values.
        ctx.fillStyle = 'rgba(232,232,240,0.85)';
        ctx.textAlign = 'left';
        for (let v = 0; v <= total + 1e-9; v += major) {
          const p = X0 + (v / total) * (X1 - X0);
          if (p < hx0 - 40 || p > hx1) continue;
          const text = tickLabel(v, units);
          if (specials.some((l) => Math.abs(l.pos - p) < 48)) continue;
          ctx.fillText(text, p + 3, ry + 8);
        }
        if (pointer && pointer.x >= hx0 && pointer.x <= hx1) marker(ctx, pointer.x, ry, 1, T);
        ctx.restore();
        for (const l of specials) if (l.pos >= hx0 - 1 && l.pos <= hx1 + 1) pill(ctx, l, l.pos, ry + T / 2, 'h', hx0, hx1);
      }

      // ---------------------------------------------------------------- side ruler (height from floor)
      const rx = Math.min(Math.max(X0 - T - GAP, ins.left + 4), vw - T - ins.right);
      const vy0 = Math.max(Y0, ry + T + GAP);
      const vy1 = Math.min(Y1, vh - ins.bottom);
      if (vy1 > vy0) {
        band(ctx, rx, vy0, T, vy1 - vy0);
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx, vy0, T, vy1 - vy0);
        ctx.clip();
        if (sel) highlight(ctx, rx, Y0 + sel.y * s, T, sel.h * s, false);
        const total = toDisplay(H, units);
        const specials: Label[] = [{ pos: Y0, text: `${formatWallLength(H, units)} high`, color: AMBER, ink: '#111' }];
        if (sel) {
          specials.push({ pos: Y0 + sel.y * s, text: formatLength(H - sel.y, units), color: ACCENT, ink: '#fff' });
          specials.push({ pos: Y0 + (sel.y + sel.h) * s, text: formatLength(H - sel.y - sel.h, units), color: ACCENT, ink: '#fff' });
        }
        ticks(ctx, total, minor, major, (v) => Y1 - (v / total) * (Y1 - Y0), vy0, vy1, (p, len) => {
          ctx.moveTo(rx + T, p);
          ctx.lineTo(rx + T - len, p);
        });
        ctx.fillStyle = 'rgba(232,232,240,0.85)';
        ctx.textAlign = 'left';
        for (let v = 0; v <= total + 1e-9; v += major) {
          const p = Y1 - (v / total) * (Y1 - Y0);
          if (p < vy0 || p > vy1 + 40) continue;
          if (specials.some((l) => Math.abs(l.pos - p) < 48)) continue;
          ctx.save();
          ctx.translate(rx + 8, p - 3);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(tickLabel(v, units), 0, 0);
          ctx.restore();
        }
        if (pointer && pointer.y >= vy0 && pointer.y <= vy1) marker(ctx, rx, pointer.y, T, 1);
        ctx.restore();
        for (const l of specials) if (l.pos >= vy0 - 1 && l.pos <= vy1 + 1) pill(ctx, l, rx + T / 2, l.pos, 'v', vy0, vy1);
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const onMove = (e: PointerEvent) => {
      const r = viewportEl.current?.getBoundingClientRect();
      pointer = r ? { x: e.clientX - r.left, y: e.clientY - r.top } : null;
      schedule();
    };
    const onLeave = () => {
      pointer = null;
      schedule();
    };

    draw();
    const unsubs = [
      cam.tx.on('change', schedule),
      cam.ty.on('change', schedule),
      cam.z.on('change', schedule),
      useDoc.subscribe(schedule),
      useUi.subscribe(schedule),
    ];
    const ro = new ResizeObserver(schedule);
    if (viewportEl.current) ro.observe(viewportEl.current);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      unsubs.forEach((u) => u());
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvas} className="gw-rulers" data-noexport aria-hidden />;
}

function band(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(22,22,28,0.88)';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fill();
  ctx.stroke();
}

function highlight(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, horizontal: boolean) {
  ctx.fillStyle = 'rgba(139,124,246,0.28)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ACCENT;
  if (horizontal) {
    ctx.fillRect(x, y + h - 2, w, 2);
  } else {
    ctx.fillRect(x + w - 2, y, 2, h);
  }
}

function marker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Draw minor/mid/major ticks for values 0..total (display units). */
function ticks(
  ctx: CanvasRenderingContext2D,
  total: number,
  minor: number,
  major: number,
  toScreen: (v: number) => number,
  lo: number,
  hi: number,
  line: (p: number, len: number) => void,
) {
  // Only iterate the visible range.
  const a = toScreen(0);
  const b = toScreen(total);
  const vAt = (p: number) => ((p - a) / (b - a)) * total;
  const v0 = Math.max(0, Math.floor(Math.min(vAt(lo), vAt(hi)) / minor) * minor);
  const v1 = Math.min(total, Math.max(vAt(lo), vAt(hi)));
  const half = major / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = Math.round(v0 / minor); i * minor <= v1 + 1e-9; i++) {
    const v = i * minor;
    const p = Math.round(toScreen(v)) + 0.5;
    const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    const isHalf = !isMajor && Math.abs(v / half - Math.round(v / half)) < 1e-6;
    line(p, isMajor ? T - 3 : isHalf ? 9 : 5);
  }
  // Always mark both ends of the wall.
  for (const v of [0, total]) {
    const p = Math.round(toScreen(v)) + 0.5;
    if (p >= lo - 1 && p <= hi + 1) line(p, T);
  }
  ctx.stroke();
}

function pill(ctx: CanvasRenderingContext2D, l: Label, x: number, y: number, dir: 'h' | 'v', lo: number, hi: number) {
  const w = ctx.measureText(l.text).width + 10;
  const h = 16;
  ctx.save();
  ctx.translate(x, y);
  if (dir === 'v') ctx.rotate(-Math.PI / 2);
  // Keep the pill inside the ruler's visible span.
  const c = dir === 'h' ? x : y;
  const start = Math.min(Math.max(c - w / 2, lo), Math.max(lo, hi - w));
  const shift = start - (c - w / 2);
  // In the rotated (vertical) frame local +x points up the screen.
  const off = dir === 'h' ? shift : -shift;
  ctx.fillStyle = l.color;
  ctx.beginPath();
  ctx.roundRect(-w / 2 + off, -h / 2, w, h, 5);
  ctx.fill();
  ctx.fillStyle = l.ink;
  ctx.textAlign = 'center';
  ctx.fillText(l.text, off, 0.5);
  ctx.restore();
}
