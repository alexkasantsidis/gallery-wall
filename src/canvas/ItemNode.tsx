import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import { useDoc } from '../store/docStore';
import { useUi } from '../store/uiStore';
import { registry } from '../store/registry';
import { useZoomBucket, zoomFromBucket } from '../store/camera';
import { itemRect } from '../geometry/frameGeometry';
import { PPI } from '../model/units';
import { FrameView } from '../frames/FrameView';
import { FurnitureView } from '../frames/FurnitureView';
import { styleById } from '../model/frameStyles';
import type { Item } from '../model/types';
import { useTextureVersion } from '../frames/textures';

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.9 };
export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type HandleDir = (typeof HANDLES)[number];

/** One item on the wall. Position/size are MotionValues so drags never re-render React. */
export const ItemNode = memo(function ItemNode({ id }: { id: string }) {
  const item = useDoc((s) => s.doc.items[id]);
  if (!item) return null;
  return <ItemNodeInner id={id} item={item} />;
});

const ItemNodeInner = memo(function ItemNodeInner({ id, item }: { id: string; item: Item }) {
  const lightAngle = useDoc((s) => s.doc.wall.style.light.angle);
  const pictureLights = useDoc((s) => s.doc.wall.style.light.pictureLights);
  const selected = useUi((s) => s.selection.includes(id));
  const single = useUi((s) => s.selection.length === 1);
  const loading = useUi((s) => !!s.loading[id]);
  const hangHighlight = useUi((s) => s.hangStep != null);
  const bucket = useZoomBucket((s) => s.bucket);
  const texVersion = useTextureVersion((s) => s.v);

  const r = itemRect(item);
  const x = useMotionValue(r.x * PPI);
  const y = useMotionValue(r.y * PPI);
  const w = useMotionValue(r.w * PPI);
  const h = useMotionValue(r.h * PPI);
  const pulse = useMotionValue(0.9);
  const live = useRef(false);
  const mounted = useRef(false);
  const el = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    registry.set(id, { x, y, w, h, pulse, live });
    return () => {
      registry.delete(id);
    };
  }, [id, x, y, w, h, pulse]);

  useEffect(() => {
    animate(pulse, 1, { type: 'spring', stiffness: 380, damping: 22 });
  }, [pulse]);

  // Committed geometry changed (undo, arrange, inspector edits, style changes): spring to it.
  useEffect(() => {
    const targets: Array<[typeof x, number]> = [
      [x, r.x * PPI],
      [y, r.y * PPI],
      [w, r.w * PPI],
      [h, r.h * PPI],
    ];
    for (const [mv, v] of targets) {
      if (!mounted.current || live.current) mv.set(v);
      else if (Math.abs(mv.get() - v) > 0.01) animate(mv, v, SPRING);
    }
    mounted.current = true;
  }, [r.x, r.y, r.w, r.h, x, y, w, h]);

  const metal = item.kind === 'frame' && styleById(item.styleId).variant === 'metal';
  const onPointerMove = metal
    ? (e: React.PointerEvent) => {
        const b = el.current?.getBoundingClientRect();
        if (!b) return;
        el.current!.style.setProperty('--mx', `${(((e.clientX - b.left) / b.width) * 100).toFixed(1)}%`);
        el.current!.style.setProperty('--my', `${(((e.clientY - b.top) / b.height) * 100).toFixed(1)}%`);
      }
    : undefined;

  const showHandles = selected && single && !item.locked;
  const label = item.kind === 'frame' ? `${styleById(item.styleId).name} ${item.nominal.w} by ${item.nominal.h}` : item.name;

  return (
    <motion.div
      ref={el}
      className={`gw-item ${item.kind === 'furniture' ? 'gw-item-furniture' : ''} ${selected ? 'is-selected' : ''} ${item.locked ? 'is-locked' : ''}`}
      data-item-id={id}
      style={{ x, y, width: w, height: h }}
      onPointerMove={onPointerMove}
      aria-label={label}
      role="img"
    >
      {item.kind === 'frame' && pictureLights && <div className="gw-picture-light" />}
      <motion.div className="gw-item-inner" style={{ scale: pulse, opacity: hangHighlight ? 0.92 : 1 }}>
        {item.kind === 'frame' ? (
          <FrameView item={item} lightAngle={lightAngle} zoom={zoomFromBucket(bucket)} loading={loading} texVersion={texVersion} />
        ) : (
          <FurnitureView item={item} />
        )}
      </motion.div>
      {selected && (
        <div className="gw-selection" data-noexport>
          {showHandles &&
            HANDLES.map((d) => (
              <div key={d} className={`gw-handle gw-handle-${d}`} data-handle={d} data-item-handle={id} />
            ))}
        </div>
      )}
    </motion.div>
  );
});
