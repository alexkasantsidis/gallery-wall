import { useState } from 'react';
import { motion } from 'motion/react';
import { useUi, ui, toast } from '../store/uiStore';
import { useDoc, commit } from '../store/docStore';
import { clientToWorld } from '../store/camera';
import { Button, LengthInput } from '../components/ui';

/**
 * Scale calibration for a wall photo: draw a line over something of known length,
 * type that length, and the photo is rescaled (about the line's start) to true size.
 */
export function Calibrator() {
  const on = useUi((s) => s.calibrating);
  const units = useDoc((s) => s.doc.prefs.units);
  const [line, setLine] = useState<{ a: { x: number; y: number }; b: { x: number; y: number }; wa: { x: number; y: number }; wb: { x: number; y: number } } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [len, setLen] = useState(30);
  if (!on) return null;

  const done = () => {
    setLine(null);
    ui().set({ calibrating: false });
  };

  const apply = () => {
    if (!line) return;
    const measured = Math.hypot(line.wb.x - line.wa.x, line.wb.y - line.wa.y);
    if (measured < 0.5) return;
    const k = len / measured;
    commit((d) => {
      const p = d.wall.style.photo;
      if (!p) return;
      p.x = line.wa.x - (line.wa.x - p.x) * k;
      p.y = line.wa.y - (line.wa.y - p.y) * k;
      p.width *= k;
    });
    toast('Wall photo scaled to real size');
    done();
  };

  return (
    <div
      className="absolute inset-0 z-30 cursor-crosshair"
      onPointerDown={(e) => {
        if (line && !drawing) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const w = clientToWorld(e.clientX, e.clientY);
        setLine({ a: { x: e.clientX, y: e.clientY }, b: { x: e.clientX, y: e.clientY }, wa: w, wb: w });
        setDrawing(true);
      }}
      onPointerMove={(e) => {
        if (!drawing || !line) return;
        let x = e.clientX;
        let y = e.clientY;
        if (e.shiftKey) {
          if (Math.abs(x - line.a.x) > Math.abs(y - line.a.y)) y = line.a.y;
          else x = line.a.x;
        }
        setLine({ ...line, b: { x, y }, wb: clientToWorld(x, y) });
      }}
      onPointerUp={() => setDrawing(false)}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {line && (
          <>
            <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} stroke="#ffb020" strokeWidth={2.5} />
            <circle cx={line.a.x} cy={line.a.y} r={5} fill="#ffb020" />
            <circle cx={line.b.x} cy={line.b.y} r={5} fill="#ffb020" />
          </>
        )}
      </svg>
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass absolute top-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl px-4 py-2.5 text-[12.5px] text-ink-200"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {line && !drawing && Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) > 8 ? (
          <>
            That line is
            <LengthInput value={len} units={units} min={0.5} onChange={setLen} className="w-24" ariaLabel="Known length" />
            <Button variant="primary" onClick={apply}>
              Apply scale
            </Button>
            <Button variant="ghost" onClick={() => setLine(null)}>
              Redraw
            </Button>
          </>
        ) : (
          <>Drag across something with a known length (a door, a sofa, a tape measure). Hold Shift to keep it straight.</>
        )}
        <Button variant="ghost" onClick={done}>
          Cancel
        </Button>
      </motion.div>
    </div>
  );
}
