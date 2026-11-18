import { describe, expect, it } from 'vitest';
import { resizeWallDoc } from '../../src/geometry/wallResize';
import { formatWallLength, matchWallPreset, US_WALL_PRESETS } from '../../src/model/wallPresets';
import { newWallDoc, newFrame, newFurniture } from '../../src/model/defaults';
import { frameMetrics } from '../../src/geometry/frameGeometry';

describe('wall resize', () => {
  const setup = () => {
    const d = newWallDoc('t');
    const f = newFrame({ x: 40, y: 20, nominal: { w: 11, h: 14 }, styleId: 'gallery-black' });
    const sofa = newFurniture('sofa', d.wall.height, 30);
    d.items[f.id] = f;
    d.items[sofa.id] = sofa;
    d.order.push(f.id, sofa.id);
    return { d, f, sofa };
  };

  it('keeps art at true size and keeps its height above the floor', () => {
    const { d, f, sofa } = setup();
    const before = frameMetrics(d.items[f.id] as typeof f).outer;
    const floorGap = d.wall.height - f.y;
    const sofaGap = d.wall.height - (sofa.y + sofa.h);
    resizeWallDoc(d, 192, 108);
    const ff = d.items[f.id] as typeof f;
    expect(frameMetrics(ff).outer).toEqual(before);
    expect(ff.nominal).toEqual({ w: 11, h: 14 });
    expect(d.wall.height - ff.y).toBeCloseTo(floorGap);
    const s = d.items[sofa.id] as typeof sofa;
    expect(d.wall.height - (s.y + s.h)).toBeCloseTo(sofaGap);
    expect(s.w).toBe(sofa.w);
  });

  it('keeps the arrangement centred horizontally', () => {
    const { d, f } = setup();
    const fromCentre = f.x - d.wall.width / 2;
    resizeWallDoc(d, 240, 96);
    expect(d.items[f.id].x - d.wall.width / 2).toBeCloseTo(fromCentre);
  });

  it('clamps to sane limits and reports items left off the wall', () => {
    const { d } = setup();
    const r = resizeWallDoc(d, 1, 1);
    expect(d.wall.width).toBe(24);
    expect(d.wall.height).toBe(48);
    expect(r.outside.length).toBeGreaterThan(0);
  });
});

describe('wall presets', () => {
  it('formats feet and metres', () => {
    expect(formatWallLength(144, 'in')).toBe('12′');
    expect(formatWallLength(150, 'in')).toBe('12′ 6″');
    expect(formatWallLength(300 / 2.54, 'cm')).toBe('3.0 m');
    expect(formatWallLength(250 / 2.54, 'cm')).toBe('2.5 m');
  });
  it('matches a preset by size', () => {
    expect(matchWallPreset(144, 96, 'in')?.id).toBe(US_WALL_PRESETS.find((p) => p.id === 'living')!.id);
    expect(matchWallPreset(143, 96, 'in')).toBeNull();
  });
});
