import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Scan } from 'lucide-react';
import { useDoc, getDoc } from '../store/docStore';
import { useUi } from '../store/uiStore';
import { cam, zoomBy, fitRect, viewportSize, screenToWorld } from '../store/camera';
import { itemRect } from '../geometry/frameGeometry';
import { IconButton } from '../components/ui';
import { styleById } from '../model/frameStyles';

export const fitWall = () => {
  const d = getDoc();
  fitRect({ x: -4, y: -4, w: d.wall.width + 8, h: d.wall.height + 18 }, { padding: 90, animated: true });
};

function ZoomLabel() {
  const [z, setZ] = useState(cam.z.get());
  useEffect(() => cam.z.on('change', setZ), []);
  return <span className="w-11 text-center text-[11.5px] text-ink-300 tabular-nums">{Math.round(z * 100)}%</span>;
}

/** Minimap with a draggable viewport rectangle. */
function Minimap() {
  const wall = useDoc((s) => s.doc.wall);
  const items = useDoc((s) => s.doc.items);
  const order = useDoc((s) => s.doc.order);
  const view = useRef<HTMLDivElement>(null);
  const W = 168;
  const s = W / wall.width;
  const H = wall.height * s;

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = view.current;
      if (!el) return;
      const { w, h } = viewportSize();
      const a = screenToWorld(0, 0);
      const b = screenToWorld(w, h);
      el.style.left = `${a.x * s}px`;
      el.style.top = `${a.y * s}px`;
      el.style.width = `${(b.x - a.x) * s}px`;
      el.style.height = `${(b.y - a.y) * s}px`;
    };
    const sch = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    const u = [cam.tx.on('change', sch), cam.ty.on('change', sch), cam.z.on('change', sch)];
    return () => u.forEach((f) => f());
  }, [s]);

  const jump = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const wx = (e.clientX - r.left) / s;
    const wy = (e.clientY - r.top) / s;
    const { w, h } = viewportSize();
    const z = cam.z.get();
    cam.tx.set(w / 2 - wx * 96 * z);
    cam.ty.set(h / 2 - wy * 96 * z);
  };

  return (
    <div
      className="relative cursor-crosshair overflow-hidden rounded-lg"
      style={{ width: W, height: H, background: wall.style.color }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        jump(e);
      }}
      onPointerMove={(e) => e.buttons && jump(e)}
    >
      {order.map((id) => {
        const it = items[id];
        if (!it) return null;
        const r = itemRect(it);
        const c = it.kind === 'frame' ? (it.color ?? styleById(it.styleId).color) : it.color;
        return <div key={id} className="absolute rounded-[1px]" style={{ left: r.x * s, top: r.y * s, width: r.w * s, height: r.h * s, background: c, opacity: it.kind === 'furniture' ? 0.5 : 0.9 }} />;
      })}
      <div ref={view} className="pointer-events-none absolute rounded-[3px] border border-accent bg-accent/10" />
    </div>
  );
}

export function Navigator() {
  const [mapOpen, setMapOpen] = useState(true);
  const inspector = useUi((s) => s.showInspector && s.selection.length > 0);
  return (
    <div className="pointer-events-none absolute bottom-4 flex flex-col items-end gap-2 transition-[right] duration-300" style={{ right: inspector ? 312 : 16 }}>
      {mapOpen && (
        <div className="glass pointer-events-auto rounded-xl p-1.5">
          <Minimap />
        </div>
      )}
      <div className="glass pointer-events-auto flex items-center rounded-xl p-1">
        <IconButton label="Zoom out (Ctrl −)" tipSide="top" onClick={() => zoomBy(1 / 1.25)}>
          <Minus size={15} />
        </IconButton>
        <button className="rounded-md hover:bg-white/8" onClick={() => setMapOpen(!mapOpen)} title="Toggle minimap">
          <ZoomLabel />
        </button>
        <IconButton label="Zoom in (Ctrl +)" tipSide="top" onClick={() => zoomBy(1.25)}>
          <Plus size={15} />
        </IconButton>
        <IconButton label="Fit wall (Shift 1)" tipSide="top" onClick={fitWall}>
          <Scan size={15} />
        </IconButton>
      </div>
    </div>
  );
}
