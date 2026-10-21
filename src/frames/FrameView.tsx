import { memo, type CSSProperties } from 'react';
import { ImagePlus } from 'lucide-react';
import type { FrameItem, GridContent, PhotoPlacement } from '../model/types';
import { PPI } from '../model/units';
import { frameMetrics, matLayout, contentRect } from '../geometry/frameGeometry';
import type { FrameStyleDef } from '../model/frameStyles';
import { fineNoise, ornateTile, woodGrain, type Side } from './textures';
import { PhotoCell } from './PhotoCell';

const px = (inches: number) => inches * PPI;

export interface FrameViewProps {
  item: FrameItem;
  /** Light direction the wall uses (deg, light comes FROM). */
  lightAngle: number;
  /** On-screen pixels per world px (for image level of detail). */
  zoom: number;
  loading?: boolean;
  /** Texture cache version; changes when procedural textures finish rasterising. */
  texVersion?: number;
}

/** Unit vector pointing toward the light source in screen space (y down). */
const lightVec = (angle: number) => ({ x: Math.sin((angle * Math.PI) / 180), y: -Math.cos((angle * Math.PI) / 180) });

export function dropShadow(depth: number, angle: number, strength = 1) {
  const l = lightVec(angle);
  const d = px(depth) * 0.16;
  const dx = -l.x * d;
  const dy = -l.y * d + d * 0.25;
  return [
    `${dx.toFixed(1)}px ${dy.toFixed(1)}px ${(d * 1.6).toFixed(1)}px rgba(0,0,0,${0.32 * strength})`,
    `${(dx * 2.2).toFixed(1)}px ${(dy * 2.2).toFixed(1)}px ${(d * 4.5).toFixed(1)}px rgba(0,0,0,${0.18 * strength})`,
    `0 1px 2px rgba(0,0,0,${0.25 * strength})`,
  ].join(', ');
}

const SIDE_DIR: Record<Side, string> = { top: 'to bottom', bottom: 'to top', left: 'to right', right: 'to left' };
const SIDE_NORMAL: Record<Side, { x: number; y: number }> = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

const PROFILE_STOPS: Record<FrameStyleDef['profile'], string> = {
  flat: 'rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 10%, rgba(0,0,0,0) 82%, rgba(0,0,0,0.28) 100%',
  rounded: 'rgba(0,0,0,0.22) 0%, rgba(255,255,255,0.22) 30%, rgba(255,255,255,0.04) 58%, rgba(0,0,0,0.38) 100%',
  scoop: 'rgba(255,255,255,0.28) 0%, rgba(0,0,0,0.05) 18%, rgba(0,0,0,0.32) 48%, rgba(255,255,255,0.22) 78%, rgba(0,0,0,0.42) 100%',
  bevel: 'rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 45%, rgba(0,0,0,0.08) 55%, rgba(0,0,0,0.3) 100%',
};

function sideBackground(style: FrameStyleDef, color: string, side: Side, angle: number): CSSProperties {
  const l = lightVec(angle);
  const n = SIDE_NORMAL[side];
  const lit = n.x * l.x + n.y * l.y;
  const light = lit > 0 ? `rgba(255,255,255,${(lit * 0.12).toFixed(3)})` : `rgba(0,0,0,${(-lit * 0.2).toFixed(3)})`;
  const dir = SIDE_DIR[side];
  const horizontal = side === 'top' || side === 'bottom';
  const layers: string[] = [`linear-gradient(${light}, ${light})`, `linear-gradient(${dir}, ${PROFILE_STOPS[style.profile]})`];
  const sizes: string[] = ['100% 100%', '100% 100%'];

  switch (style.finish) {
    case 'satin':
      layers.push(`linear-gradient(${dir}, transparent 20%, rgba(255,255,255,0.09) 32%, transparent 46%)`);
      sizes.push('100% 100%');
      break;
    case 'wood':
      layers.push(woodGrain(horizontal ? 'h' : 'v', side === 'top' ? 3 : side === 'left' ? 5 : side === 'bottom' ? 7 : 9));
      sizes.push(horizontal ? `${px(5.5)}px 100%` : `100% ${px(5.5)}px`);
      break;
    case 'gold':
      layers.push(
        `linear-gradient(${dir}, color-mix(in oklab, ${color}, #4a2f06 45%) 0%, color-mix(in oklab, ${color}, #fff1b8 55%) 22%, color-mix(in oklab, ${color}, #e8b84a 30%) 42%, color-mix(in oklab, ${color}, #5a3a08 35%) 60%, color-mix(in oklab, ${color}, #ffe9a0 45%) 82%, color-mix(in oklab, ${color}, #3d2604 50%) 100%)`,
      );
      sizes.push('100% 100%');
      break;
    case 'ornate':
      layers.push(ornateTile(side));
      sizes.push(horizontal ? `auto 100%` : `100% auto`);
      layers.push(
        `linear-gradient(${dir}, color-mix(in oklab, ${color}, #4a2f06 40%) 0%, color-mix(in oklab, ${color}, #fff0b0 50%) 18%, color-mix(in oklab, ${color}, #e3ad3c 35%) 40%, color-mix(in oklab, ${color}, #5a3a08 30%) 62%, color-mix(in oklab, ${color}, #ffe39a 45%) 84%, color-mix(in oklab, ${color}, #3d2604 45%) 100%)`,
      );
      sizes.push('100% 100%');
      break;
    case 'brushed':
      layers.push(
        `repeating-linear-gradient(${horizontal ? 'to bottom' : 'to right'}, rgba(255,255,255,0.07) 0 1px, rgba(0,0,0,0.05) 1px 2px, transparent 2px 3px)`,
        `linear-gradient(${dir}, color-mix(in oklab, ${color}, white 30%), ${color} 40%, color-mix(in oklab, ${color}, black 25%))`,
      );
      sizes.push('100% 100%', '100% 100%');
      break;
  }
  return { backgroundColor: color, backgroundImage: layers.join(', '), backgroundSize: sizes.join(', ') };
}

function Moulding({ style, color, face, angle }: { style: FrameStyleDef; color: string; face: number; angle: number }) {
  const f = px(face);
  const common: CSSProperties = { position: 'absolute', transition: 'background-color 250ms, width 250ms, height 250ms' };
  const sides: Record<Side, CSSProperties> = {
    top: { left: 0, top: 0, width: '100%', height: f, clipPath: `polygon(0 0, 100% 0, calc(100% - ${f}px) 100%, ${f}px 100%)` },
    bottom: { left: 0, bottom: 0, width: '100%', height: f, clipPath: `polygon(${f}px 0, calc(100% - ${f}px) 0, 100% 100%, 0 100%)` },
    left: { left: 0, top: 0, width: f, height: '100%', clipPath: `polygon(0 0, 100% ${f}px, 100% calc(100% - ${f}px), 0 100%)` },
    right: { right: 0, top: 0, width: f, height: '100%', clipPath: `polygon(0 ${f}px, 100% 0, 100% 100%, 0 calc(100% - ${f}px))` },
  };
  const shine = style.finish === 'gold' || style.finish === 'ornate' || style.finish === 'brushed' || style.finish === 'satin';
  return (
    <>
      {(Object.keys(sides) as Side[]).map((s) => (
        <div key={s} className={`gw-side gw-side-${s} ${shine ? 'gw-shine' : ''}`} style={{ ...common, ...sides[s], ...sideBackground(style, color, s, angle) }} />
      ))}
    </>
  );
}

function Placeholder({ tint }: { tint?: string }) {
  return (
    <div className="gw-placeholder" style={tint ? { background: tint } : undefined}>
      <ImagePlus className="gw-placeholder-icon" strokeWidth={1.4} />
    </div>
  );
}

function Cell({ photo, approxPx, loading, cellId }: { photo: PhotoPlacement | null; approxPx: number; loading?: boolean; cellId?: string }) {
  return (
    <div className="gw-cell" data-cell-id={cellId}>
      {photo ? <PhotoCell photo={photo} approxPx={approxPx} /> : <Placeholder />}
      {loading && <div className="gw-loading" />}
    </div>
  );
}

function Grid({ content, approxPx, background }: { content: GridContent; approxPx: number; background: string }) {
  return (
    <div
      className="gw-grid"
      style={{
        gridTemplateColumns: content.colSizes.map((s) => `${s}fr`).join(' '),
        gridTemplateRows: content.rowSizes.map((s) => `${s}fr`).join(' '),
        gap: px(content.gutter),
        background: content.gutterColor ?? background,
      }}
    >
      {content.cells.map((c) => (
        <div key={c.id} style={{ gridColumn: `${c.c + 1} / span ${c.cs}`, gridRow: `${c.r + 1} / span ${c.rs}`, position: 'relative', minWidth: 0, minHeight: 0 }}>
          <Cell photo={c.photo} cellId={c.id} approxPx={(approxPx * c.cs) / content.cols} />
        </div>
      ))}
    </div>
  );
}

function Content({ item, approxPx, matColor, loading }: { item: FrameItem; approxPx: number; matColor: string; loading?: boolean }) {
  if (item.content.kind === 'grid') return <Grid content={item.content} approxPx={approxPx} background={matColor} />;
  return <Cell photo={item.content.photo} approxPx={approxPx} loading={loading} cellId="single" />;
}

/** Visual of a framed piece at 96 px/inch, filling its (outer-sized) parent. */
export const FrameView = memo(function FrameView({ item, lightAngle, zoom, loading }: FrameViewProps) {
  const met = frameMetrics(item);
  const { style } = met;
  const color = item.color ?? style.color;
  const art = { w: met.outer.w - 2 * met.artInset, h: met.outer.h - 2 * met.artInset };
  const mat = matLayout(item, art);
  const content = contentRect(item);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const approxPx = px(content.w) * zoom * dpr;
  const l = lightVec(lightAngle);
  const innerShadow = `inset ${(l.x * -px(0.06)).toFixed(1)}px ${(-l.y * px(0.08)).toFixed(1)}px ${px(0.16)}px rgba(0,0,0,0.38)`;
  const matColor = item.mat.color;

  // ---- frameless variants ----
  if (style.variant === 'metal' || style.variant === 'acrylic' || style.variant === 'canvas' || style.variant === 'clip' || style.variant === 'poster') {
    return (
      <div className={`gw-frame gw-${style.variant}`} style={{ boxShadow: dropShadow(style.depth, lightAngle, style.variant === 'poster' ? 0.55 : 1) }}>
        {style.variant === 'poster' && <PosterRails color={color} />}
        <div className="gw-art" style={{ inset: 0 }}>
          {mat ? (
            <MatLayer item={item} mat={mat} art={art} matColor={matColor} innerShadow="none" approxPx={approxPx} loading={loading} />
          ) : (
            <Content item={item} approxPx={approxPx} matColor="#101012" loading={loading} />
          )}
        </div>
        {style.variant === 'metal' && (
          <>
            <div className="gw-metal-spec" />
            <div className="gw-metal-sweep" />
          </>
        )}
        {style.variant === 'acrylic' && <div className="gw-acrylic-edge" />}
        {style.variant === 'canvas' && <div className="gw-canvas-weave" style={{ backgroundImage: fineNoise(0.05, 1.2) }} />}
        {style.variant === 'clip' && <Clips />}
        {(style.variant === 'acrylic' || style.variant === 'clip') && item.glare && <div className="gw-glare" />}
      </div>
    );
  }

  return (
    <div className={`gw-frame gw-${style.variant}`} style={{ boxShadow: dropShadow(style.depth, lightAngle) }}>
      {style.variant === 'float' && <div className="gw-float-gap" style={{ inset: px(met.face) }} />}
      <div
        className="gw-art"
        style={{
          inset: px(met.artInset),
          boxShadow: style.variant === 'float' ? `0 ${px(0.05)}px ${px(0.12)}px rgba(0,0,0,0.5)` : undefined,
          transition: 'inset 250ms',
        }}
      >
        {mat ? (
          <MatLayer item={item} mat={mat} art={art} matColor={matColor} innerShadow={innerShadow} approxPx={approxPx} loading={loading} />
        ) : (
          <>
            <Content item={item} approxPx={approxPx} matColor="#111" loading={loading} />
            {style.variant !== 'float' && <div className="gw-inner-shadow" style={{ boxShadow: innerShadow }} />}
          </>
        )}
        {style.variant === 'shadowbox' && <div className="gw-inner-shadow" style={{ boxShadow: `${innerShadow}, inset 0 0 ${px(0.6)}px rgba(0,0,0,0.35)` }} />}
        {style.glass && item.glare && <div className="gw-glare" />}
      </div>
      {met.face > 0 && <Moulding style={style} color={color} face={met.face} angle={lightAngle} />}
    </div>
  );
});

function MatLayer({
  item,
  mat,
  art,
  matColor,
  innerShadow,
  approxPx,
  loading,
}: {
  item: FrameItem;
  mat: NonNullable<ReturnType<typeof matLayout>>;
  art: { w: number; h: number };
  matColor: string;
  innerShadow: string;
  approxPx: number;
  loading?: boolean;
}) {
  const b = mat.borders;
  const dbl = item.mat.double.enabled ? item.mat.double : null;
  const reveal = dbl ? dbl.reveal : 0;
  // Uniform mats are pinned to the edges (so they resize live); fixed openings are centred.
  const pos = (grow: number): CSSProperties =>
    mat.mode === 'uniform'
      ? { top: px(b.top - grow), left: px(b.left - grow), right: px(b.right - grow), bottom: px(b.bottom - grow) }
      : {
          left: `calc(50% - ${px(mat.opening.w / 2 + grow)}px)`,
          top: `calc(50% - ${px(mat.opening.h / 2 + grow + (b.bottom - b.top) / 2)}px)`,
          width: px(mat.opening.w + 2 * grow),
          height: px(mat.opening.h + 2 * grow),
        };
  void art;
  return (
    <div className="gw-mat" style={{ backgroundColor: matColor, backgroundImage: fineNoise(0.035, 0.85) }}>
      {dbl && <div className="gw-mat-window" style={{ ...pos(reveal), backgroundColor: dbl.color }}>
        <div className="gw-bevel" />
      </div>}
      <div className="gw-mat-window" style={pos(0)}>
        <Content item={item} approxPx={approxPx} matColor={matColor} loading={loading} />
        <div className="gw-bevel" />
      </div>
      <div className="gw-inner-shadow" style={{ boxShadow: innerShadow }} />
    </div>
  );
}

function PosterRails({ color }: { color: string }) {
  const rail: CSSProperties = {
    position: 'absolute',
    left: -px(0.3),
    right: -px(0.3),
    height: px(0.75),
    borderRadius: px(0.12),
    backgroundColor: color,
    backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.25), transparent 40%, rgba(0,0,0,0.3)), ${woodGrain('h', 4)}`,
    backgroundSize: `100% 100%, ${px(5)}px 100%`,
    boxShadow: `0 ${px(0.08)}px ${px(0.2)}px rgba(0,0,0,0.35)`,
    zIndex: 2,
  };
  return (
    <>
      <svg className="gw-poster-string" viewBox="0 0 100 20" preserveAspectRatio="none">
        <path d="M6 20 L50 0 L94 20" fill="none" stroke="rgba(30,25,20,0.75)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ ...rail, top: -px(0.4) }} />
      <div style={{ ...rail, bottom: -px(0.4) }} />
    </>
  );
}

function Clips() {
  const clip = (s: CSSProperties) => <div className="gw-clip" style={s} />;
  const c = px(0.9);
  return (
    <>
      {clip({ top: -px(0.05), left: '22%', width: c })}
      {clip({ top: -px(0.05), right: '22%', width: c })}
      {clip({ bottom: -px(0.05), left: '22%', width: c })}
      {clip({ bottom: -px(0.05), right: '22%', width: c })}
    </>
  );
}
