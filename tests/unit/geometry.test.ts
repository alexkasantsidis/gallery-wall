import { describe, expect, it } from 'vitest';
import { snapMove, snapNominal, existingGaps, neighbourChips } from '../../src/geometry/snapping';
import { placeImage, panAnchor, zoomAbout, effectivePpi, ppiGrade } from '../../src/geometry/crop';
import { arrange } from '../../src/geometry/arrange';
import { nailsFor } from '../../src/geometry/hanging';
import { frameMetrics, matLayout, contentRect } from '../../src/geometry/frameGeometry';
import { US_PRESETS, METRIC_PRESETS, matchPreset, presetForAspect } from '../../src/model/sizePresets';
import { formatInches, formatLength, parseLength, formatSize } from '../../src/model/units';
import { newFrame } from '../../src/model/defaults';
import type { Rect } from '../../src/model/types';

describe('units', () => {
  it('formats fractional inches', () => {
    expect(formatInches(10.25)).toBe('10¼');
    expect(formatInches(3.5)).toBe('3½');
    expect(formatInches(0.125)).toBe('⅛');
    expect(formatInches(7.99)).toBe('8');
    expect(formatLength(28.5 / 2.54, 'cm')).toBe('28.5 cm');
    expect(formatSize(11, 14, 'in')).toBe('11×14″');
  });
  it('parses user input', () => {
    expect(parseLength('11 1/4', 'in')).toBeCloseTo(11.25);
    expect(parseLength('11¼', 'in')).toBeCloseTo(11.25);
    expect(parseLength('8.5"', 'in')).toBeCloseTo(8.5);
    expect(parseLength('25.4', 'cm')).toBeCloseTo(10);
    expect(parseLength('abc', 'in')).toBeNull();
  });
});

describe('size presets', () => {
  it('matches presets in either orientation', () => {
    expect(matchPreset({ w: 14, h: 11 }, US_PRESETS)?.id).toBe('us-11x14');
    expect(matchPreset({ w: 13, h: 11 }, US_PRESETS)).toBeNull();
  });
  it('picks a preset close to an image aspect', () => {
    const s = presetForAspect(4 / 3, US_PRESETS, 150);
    expect(Math.abs(s.w / s.h - 4 / 3)).toBeLessThan(0.1);
    expect(s.w).toBeGreaterThan(s.h);
  });
  it('has metric A-series sizes', () => {
    expect(METRIC_PRESETS.find((p) => p.id === 'cm-21x29.7')?.label).toBe('A4 cm');
  });
});

describe('snapNominal', () => {
  const step = 0.25;
  it('snaps a corner drag to the nearest preset within threshold', () => {
    const r = snapNominal({ w: 10.8, h: 14.3 }, US_PRESETS, 0.5, step, { w: true, h: true });
    expect(r.preset?.id).toBe('us-11x14');
    expect(r.size).toEqual({ w: 11, h: 14 });
  });
  it('snaps landscape orientation', () => {
    const r = snapNominal({ w: 14.2, h: 10.9 }, US_PRESETS, 0.5, step, { w: true, h: true });
    expect(r.size).toEqual({ w: 14, h: 11 });
  });
  it('edge drags only complete a preset with the fixed dimension', () => {
    const r = snapNominal({ w: 15.8, h: 20 }, US_PRESETS, 0.5, step, { w: true, h: false });
    expect(r.size).toEqual({ w: 16, h: 20 });
    const r2 = snapNominal({ w: 15.8, h: 19 }, US_PRESETS, 0.5, step, { w: true, h: false });
    expect(r2.preset).toBeNull();
    expect(r2.size).toEqual({ w: 15.75, h: 19 });
  });
  it('falls back to quarter-inch steps', () => {
    const r = snapNominal({ w: 13.13, h: 17.4 }, US_PRESETS, 0.2, step, { w: true, h: true });
    expect(r.preset).toBeNull();
    expect(r.size).toEqual({ w: 13.25, h: 17.5 });
  });
});

describe('snapMove', () => {
  const wall = { width: 120, height: 96 };
  it('aligns edges to a neighbour', () => {
    const others: Rect[] = [{ x: 10, y: 10, w: 10, h: 10 }];
    const s = snapMove({ x: 10.3, y: 30, w: 8, h: 8 }, { rects: others, wall, eyeY: null }, 0.5);
    expect(s.dx).toBeCloseTo(-0.3);
    expect(s.guides.length).toBeGreaterThan(0);
  });
  it('matches an existing gap (equal spacing)', () => {
    const others: Rect[] = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 13, y: 0, w: 10, h: 10 },
    ];
    expect(existingGaps(others, 'x')).toContain(3);
    // Moving box to the right of the second one, ~3.2" away -> snaps to a 3" gap.
    const s = snapMove({ x: 26.2, y: 40, w: 7, h: 7 }, { rects: others, wall, eyeY: null }, 0.5);
    expect(s.dx).toBeCloseTo(0); // no vertical overlap: no gap snap
    const s2 = snapMove({ x: 26.2, y: 1.3, w: 7, h: 7 }, { rects: others, wall, eyeY: null }, 0.5);
    expect(26.2 + s2.dx).toBeCloseTo(26);
    expect(s2.chips.some((c) => c.equal)).toBe(true);
  });
  it('snaps to the wall centre', () => {
    const s = snapMove({ x: 55.7, y: 30, w: 8, h: 8 }, { rects: [], wall, eyeY: null }, 0.5);
    expect(55.7 + s.dx + 4).toBeCloseTo(60);
  });
  it('reports neighbour distances', () => {
    const chips = neighbourChips({ x: 20, y: 0, w: 5, h: 5 }, [{ x: 0, y: 0, w: 17.5, h: 5 }]);
    expect(chips[0].b - chips[0].a).toBeCloseTo(2.5);
  });
});

describe('crop model', () => {
  const open = { w: 10, h: 8 };
  const img = { w: 4000, h: 2000 }; // wider than the opening -> overflows horizontally
  it('always covers the opening', () => {
    for (const ax of [0, 0.3, 1]) {
      const p = placeImage(open, img, { ax, ay: 0.5, zoom: 1 });
      expect(p.left).toBeLessThanOrEqual(1e-9);
      expect(p.left + p.width).toBeGreaterThanOrEqual(open.w - 1e-9);
      expect(p.top).toBeCloseTo(0);
      expect(p.height).toBeCloseTo(open.h);
    }
  });
  it('keeps the anchor point fixed across opening aspect changes', () => {
    const a = { ax: 0.7, ay: 0.4, zoom: 1.5 };
    for (const o of [open, { w: 20, h: 6 }, { w: 5, h: 9 }]) {
      const p = placeImage(o, img, a);
      // image point at fraction ax is at opening fraction ax
      expect(p.left + a.ax * p.width).toBeCloseTo(a.ax * o.w);
      expect(p.top + a.ay * p.height).toBeCloseTo(a.ay * o.h);
    }
  });
  it('pans and clamps the anchor', () => {
    const p = { ax: 0.5, ay: 0.5, zoom: 1 };
    const moved = panAnchor(open, img, p, 2, 0);
    expect(moved.ax).toBeLessThan(0.5);
    const far = panAnchor(open, img, p, 1000, 1000);
    expect(far.ax).toBe(0);
    expect(far.ay).toBe(0.5); // no vertical overflow at zoom 1
  });
  it('zooms about a focus point', () => {
    const p = { ax: 0.5, ay: 0.5, zoom: 1 };
    const z = zoomAbout(open, img, p, 2, { x: 5, y: 4 });
    expect(z.zoom).toBe(2);
    const before = placeImage(open, img, p);
    const after = placeImage(open, img, { ...p, ...z });
    // centre stays on the same image point
    expect((5 - before.left) / before.width).toBeCloseTo((5 - after.left) / after.width);
  });
  it('computes print resolution', () => {
    const ppi = effectivePpi({ w: 10, h: 8 }, { w: 3000, h: 2400 }, 1);
    expect(ppi).toBeCloseTo(300);
    expect(ppiGrade(ppi)).toBe('great');
    expect(ppiGrade(100)).toBe('low');
  });
});

describe('frame geometry', () => {
  it('derives outer size from nominal size and moulding', () => {
    const f = newFrame({ x: 0, y: 0, nominal: { w: 8, h: 10 }, styleId: 'thin-black' }); // face .75, lip .25
    expect(frameMetrics(f).outer).toEqual({ w: 9, h: 11 });
    const m = newFrame({ x: 0, y: 0, nominal: { w: 12, h: 18 }, styleId: 'metal-print' });
    expect(frameMetrics(m).outer).toEqual({ w: 12, h: 18 });
  });
  it('lays out a fixed mat opening centred with bottom weighting', () => {
    const f = newFrame({ x: 0, y: 0, nominal: { w: 11, h: 14 }, styleId: 'thin-black' });
    f.mat = { ...f.mat, enabled: true, mode: 'opening', opening: { w: 8, h: 10 }, bottomWeight: 0.5 };
    const art = { w: 10.5, h: 13.5 };
    const m = matLayout(f, art)!;
    expect(m.opening.x).toBeCloseTo(1.25);
    expect(m.borders.bottom - m.borders.top).toBeCloseTo(0.5);
    const c = contentRect(f);
    expect(c.w).toBe(8);
  });
});

describe('arrange', () => {
  const items = [
    { id: 'a', w: 20, h: 25 },
    { id: 'b', w: 12, h: 15 },
    { id: 'c', w: 18, h: 12 },
    { id: 'd', w: 9, h: 11 },
    { id: 'e', w: 14, h: 14 },
    { id: 'f', w: 8, h: 10 },
  ];
  for (const mode of ['salon', 'grid', 'row'] as const) {
    it(`${mode}: no overlaps and gaps respected`, () => {
      const gap = 2.5;
      const pos = arrange(items, { mode, gap, center: { x: 60, y: 40 }, seed: 42 });
      const rects = items.map((i) => ({ ...pos[i.id], w: i.w, h: i.h }));
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const sepX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
          const sepY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
          expect(Math.max(sepX, sepY)).toBeGreaterThanOrEqual(gap - 0.02);
        }
    });
  }
  it('centres the cluster and respects maxBottom', () => {
    const pos = arrange(items, { mode: 'salon', gap: 2, center: { x: 60, y: 40 }, seed: 1, maxBottom: 50 });
    const bottom = Math.max(...items.map((i) => pos[i.id].y + i.h));
    expect(bottom).toBeLessThanOrEqual(50 + 1e-6);
  });
  it('is deterministic per seed and varies across seeds', () => {
    const a = arrange(items, { mode: 'salon', gap: 2, center: { x: 0, y: 0 }, seed: 5 });
    const b = arrange(items, { mode: 'salon', gap: 2, center: { x: 0, y: 0 }, seed: 5 });
    const c = arrange(items, { mode: 'salon', gap: 2, center: { x: 0, y: 0 }, seed: 99 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe('hanging', () => {
  it('puts a wire nail at centre, drop below the top', () => {
    const f = newFrame({ x: 10, y: 20, nominal: { w: 8, h: 10 }, styleId: 'thin-black' });
    f.hanger = { kind: 'wire', drop: 2.5, ringInset: 1.5 };
    const [n] = nailsFor(f, 96);
    expect(n.x).toBeCloseTo(10 + 4.5);
    expect(n.fromFloor).toBeCloseTo(96 - 22.5);
  });
  it('uses two nails for D-rings', () => {
    const f = newFrame({ x: 0, y: 0, nominal: { w: 20, h: 30 }, styleId: 'metal-print' });
    f.hanger = { kind: 'd-rings', drop: 2, ringInset: 1.5 };
    const ns = nailsFor(f, 96);
    expect(ns.map((n) => n.x)).toEqual([1.5, 18.5]);
  });
});
