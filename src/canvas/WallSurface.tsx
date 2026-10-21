import { memo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { WallDoc } from '../model/types';
import { PPI } from '../model/units';
import { wallLayers, woodGrain, useTextureVersion } from '../frames/textures';
import { kelvinToRgb } from '../model/wallStyles';
import { useAssetUrl } from '../photos/assets';

const px = (v: number) => v * PPI;

function WallPhotoLayer({ photo }: { photo: NonNullable<WallDoc['wall']['style']['photo']> }) {
  const url = useAssetUrl(photo.assetId, 2048);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      style={{ position: 'absolute', left: px(photo.x), top: px(photo.y), width: px(photo.width), height: 'auto', opacity: photo.opacity, pointerEvents: 'none', maxWidth: 'none' }}
    />
  );
}

function Wainscot({ wall }: { wall: WallDoc['wall'] }) {
  const s = wall.style;
  const railFromFloor = 36;
  const panelTop = wall.height - railFromFloor + 2.5;
  const panelBottom = wall.height - (s.baseboard.enabled ? s.baseboard.height : 0) - 3;
  const count = Math.max(1, Math.round(wall.width / 30));
  const pw = wall.width / count;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: px(wall.height - railFromFloor),
          height: px(2.5),
          background: `linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0.1) 40%, rgba(0,0,0,0.18) 100%), ${s.accent}`,
          boxShadow: `0 ${px(0.3)}px ${px(0.5)}px rgba(0,0,0,0.15)`,
        }}
      />
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: px(i * pw + 3),
            width: px(pw - 6),
            top: px(panelTop + 3),
            height: px(Math.max(1, panelBottom - panelTop - 3)),
            boxShadow: `inset ${px(0.15)}px ${px(0.15)}px 0 rgba(255,255,255,0.45), inset -${px(0.15)}px -${px(0.15)}px 0 rgba(0,0,0,0.16), ${px(0.12)}px ${px(0.12)}px ${px(0.2)}px rgba(0,0,0,0.12)`,
            borderRadius: px(0.2),
          }}
        />
      ))}
    </>
  );
}

export const WallSurface = memo(function WallSurface({ wall }: { wall: WallDoc['wall'] }) {
  useTextureVersion((t) => t.v);
  const s = wall.style;
  const layers = wallLayers(s.texture, s.color, s.accent, s.textureScale);
  const [r, g, b] = kelvinToRgb(s.light.temperature);
  const la = (s.light.angle * Math.PI) / 180;
  const lx = 50 + Math.sin(la) * 55;
  const ly = 50 - Math.cos(la) * 70;
  const floorH = 14;
  return (
    <>
      <div className="gw-wall" style={{ width: px(wall.width), height: px(wall.height), backgroundColor: s.color }} data-wall>
        <AnimatePresence initial={false}>
          <motion.div
            key={`${s.texture}-${s.color}-${s.accent}-${s.textureScale}`}
            className="gw-wall-tex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          >
            {layers.map((l, i) => (
              <div
                key={i}
                className={s.texture === 'limewash' && i === 0 ? 'gw-wall-layer gw-limewash' : 'gw-wall-layer'}
                style={{ backgroundImage: l.image, backgroundSize: l.size, opacity: l.opacity ?? 1, mixBlendMode: (l.blend as any) ?? 'normal' }}
              />
            ))}
            {s.texture === 'wainscot' && <Wainscot wall={wall} />}
          </motion.div>
        </AnimatePresence>
        {s.photo && <WallPhotoLayer photo={s.photo} />}

        {/* Lighting: warm/cool wash from the light direction + vignette */}
        <div
          className="gw-wall-light"
          style={{
            // Plain alpha (no blend modes): blend modes over a wall-sized layer are expensive to paint.
            background: `radial-gradient(ellipse 90% 85% at ${lx}% ${ly}%, rgba(${r},${g},${b},${0.2 * s.light.intensity}) 0%, rgba(${r},${g},${b},${0.07 * s.light.intensity}) 45%, rgba(0,0,0,0) 70%)`,
          }}
        />
        <div className="gw-wall-light" style={{ background: `radial-gradient(ellipse 120% 110% at ${lx}% ${ly}%, transparent 45%, rgba(0,0,0,${0.32 * s.light.vignette}) 100%)` }} />

        {/* Ceiling crown + baseboard + floor */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: px(1.2), background: `linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(255,255,255,0.25) 40%, rgba(0,0,0,0.05))` }} />
        {s.baseboard.enabled && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: px(s.baseboard.height),
              background: `linear-gradient(to bottom, rgba(255,255,255,0.55) 0, rgba(255,255,255,0.1) ${px(0.4)}px, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0.14) 100%), ${s.baseboard.color}`,
              boxShadow: `0 -${px(0.15)}px ${px(0.4)}px rgba(0,0,0,0.12)`,
            }}
          />
        )}
      </div>
      <div
        className="gw-floor"
        style={{
          top: px(wall.height),
          width: px(wall.width),
          height: px(floorH),
          backgroundColor: s.floor.color,
          backgroundImage:
            s.floor.kind === 'wood'
              ? `linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0) 30%), repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 2px, transparent 2px ${px(36)}px), ${woodGrain('h', 12)}`
              : s.floor.kind === 'carpet'
                ? `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0) 30%)`
                : `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0) 30%), linear-gradient(90deg, rgba(255,255,255,0.05), rgba(0,0,0,0.05))`,
          backgroundSize: s.floor.kind === 'wood' ? `100% 100%, ${px(36)}px 100%, ${px(9)}px 100%` : undefined,
        }}
      />
    </>
  );
});
