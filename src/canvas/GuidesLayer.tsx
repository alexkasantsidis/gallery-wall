import { AnimatePresence, motion } from 'motion/react';
import { useUi } from '../store/uiStore';
import { useDoc } from '../store/docStore';
import { PPI, formatLength } from '../model/units';
import { hangingPlan } from '../geometry/hanging';

const px = (v: number) => v * PPI;

/** Snap guides, spacing chips, size badge, marquee, eye line and hanging markers (world space, counter-scaled strokes). */
export function GuidesLayer() {
  const guides = useUi((s) => s.guides);
  const chips = useUi((s) => s.chips);
  const badge = useUi((s) => s.badge);
  const marquee = useUi((s) => s.marquee);
  const hangStep = useUi((s) => s.hangStep);
  const snapPulse = useUi((s) => s.snapPulse);
  const wall = useDoc((s) => s.doc.wall);
  const units = useDoc((s) => s.doc.prefs.units);
  const doc = useDoc((s) => (hangStep != null ? s.doc : null));
  const eyeY = wall.height - wall.eyeLine;

  return (
    <div className="gw-guides" data-noexport>
      {wall.showEyeLine && (
        <div className="gw-eyeline" style={{ top: px(eyeY), width: px(wall.width) }}>
          <span className="gw-eyeline-label">Eye level · {formatLength(wall.eyeLine, units)}</span>
        </div>
      )}

      {guides.map((g, i) =>
        g.axis === 'x' ? (
          <div key={i} className="gw-guide gw-guide-v" style={{ left: px(g.pos), top: px(g.from), height: px(g.to - g.from) }} />
        ) : (
          <div key={i} className="gw-guide gw-guide-h" style={{ top: px(g.pos), left: px(g.from), width: px(g.to - g.from) }} />
        ),
      )}

      {chips.map((c, i) => {
        const len = c.b - c.a;
        if (len < 0.05) return null;
        const style =
          c.axis === 'x'
            ? { left: px(c.a), top: px(c.cross), width: px(len) }
            : { top: px(c.a), left: px(c.cross), height: px(len) };
        return (
          <div key={i} className={`gw-chip gw-chip-${c.axis} ${c.equal ? 'is-equal' : ''}`} style={style}>
            <span>{formatLength(len, units)}</span>
          </div>
        );
      })}

      <AnimatePresence>
        {badge && (
          <motion.div
            className={`gw-badge ${badge.preset ? 'is-preset' : ''}`}
            style={{ left: px(badge.x), top: px(badge.y) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div className="gw-badge-anchor">
              <motion.div
                key={badge.preset ? `${badge.label}-${snapPulse}` : 'free'}
                className="gw-badge-inner"
                initial={badge.preset ? { scale: 1.25 } : false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 600, damping: 18 }}
              >
                <strong>{badge.label}</strong>
                <span>{badge.sub}</span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {marquee && <div className="gw-marquee" style={{ left: px(marquee.x), top: px(marquee.y), width: px(marquee.w), height: px(marquee.h) }} />}

      {doc && hangStep != null && <HangMarkers doc={doc} step={hangStep} />}
    </div>
  );
}

function HangMarkers({ doc, step }: { doc: NonNullable<ReturnType<typeof useDoc.getState>['doc']>; step: number }) {
  const plan = hangingPlan(doc);
  const units = doc.prefs.units;
  return (
    <>
      {plan.map((p) => {
        const active = p.index === step;
        return (
          <div key={p.item.id}>
            <div className={`gw-hang-outline ${active ? 'is-active' : ''}`} style={{ left: px(p.rect.x), top: px(p.rect.y), width: px(p.rect.w), height: px(p.rect.h) }}>
              <span className="gw-hang-num">{p.index}</span>
            </div>
            {p.nails.map((n, i) => (
              <div key={i} className={`gw-nail ${active ? 'is-active' : ''}`} style={{ left: px(n.x), top: px(n.y) }} />
            ))}
            {active &&
              p.nails.map((n, i) => (
                <div key={`d${i}`}>
                  <div className="gw-dim gw-dim-v" style={{ left: px(n.x), top: px(n.y), height: px(n.fromFloor) }}>
                    <span>{formatLength(n.fromFloor, units)} from floor</span>
                  </div>
                  {i === 0 && (
                    <div className="gw-dim gw-dim-h" style={{ left: 0, top: px(n.y), width: px(n.fromLeft) }}>
                      <span>{formatLength(n.fromLeft, units)} from left</span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        );
      })}
    </>
  );
}
