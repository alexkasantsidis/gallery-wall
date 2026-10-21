import { memo, useMemo } from 'react';
import { newFrame } from '../model/defaults';
import { frameMetrics } from '../geometry/frameGeometry';
import { FrameView } from '../frames/FrameView';
import { useTextureVersion } from '../frames/textures';
import { PPI } from '../model/units';
import type { FrameItem, Size } from '../model/types';

/** A tiny live render of a frame style, scaled to fit a box. */
export const FramePreview = memo(function FramePreview({
  styleId,
  nominal = { w: 5, h: 6.5 },
  box,
  color,
  item: given,
}: {
  styleId: string;
  nominal?: Size;
  box: number;
  color?: string | null;
  item?: FrameItem;
}) {
  const item = useMemo(() => {
    if (given) return given;
    const f = newFrame({ x: 0, y: 0, nominal, styleId });
    f.mat.width = Math.min(nominal.w, nominal.h) * 0.16;
    f.color = color ?? null;
    return f;
  }, [given, styleId, nominal.w, nominal.h, color]);
  const texVersion = useTextureVersion((s) => s.v);
  const outer = frameMetrics(item).outer;
  const s = box / (Math.max(outer.w, outer.h) * PPI);
  return (
    <div style={{ width: outer.w * PPI * s, height: outer.h * PPI * s, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: outer.w * PPI, height: outer.h * PPI, transform: `scale(${s})`, transformOrigin: '0 0' }}>
        <FrameView item={item} lightAngle={330} zoom={s} texVersion={texVersion} />
      </div>
    </div>
  );
});
