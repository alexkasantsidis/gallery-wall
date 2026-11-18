import clsx from 'clsx';
import { ImageUp, Ruler, Trash2 } from 'lucide-react';
import { useDoc, commit } from '../store/docStore';
import { ui, toast, useUi, setRulers } from '../store/uiStore';
import { resizeWall } from '../store/actions';
import { fitWall } from './Navigator';
import { wallPresetsFor, matchWallPreset, formatWallLength, formatWallSize, MIN_WALL_W, MIN_WALL_H } from '../model/wallPresets';
import { PAINT_SWATCHES, TEXTURES, kelvinToRgb } from '../model/wallStyles';
import { wallLayers, useTextureVersion } from '../frames/textures';
import { Section, Row, Slider, Swatches, LengthInput, Toggle, Segmented, Button } from '../components/ui';
import { openFilePicker } from '../photos/filePicker';
import { ingest } from '../photos/assets';
import type { WallDoc, WallStyle } from '../model/types';

const ACCENTS = ['#d8cfc0', '#b9a78f', '#ffffff', '#8f9e8b', '#2b3a4f', '#c27a5a', '#9a6b4b', '#3a3a3c', '#e7cfc4', '#c9a25b'];

const setStyle = (fn: (s: WallStyle) => void, key = 'wall-style') =>
  commit((d) => {
    fn(d.wall.style);
  }, { key });

const setWall = (fn: (w: WallDoc['wall']) => void, key = 'wall') =>
  commit((d) => {
    fn(d.wall);
  }, { key });

/** Tiny proportional wall outline for the preset buttons. */
function WallGlyph({ w, h, active }: { w: number; h: number; active: boolean }) {
  const k = 22 / Math.max(w, h);
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center">
      <span className={clsx('block rounded-[2px] border', active ? 'border-accent-soft bg-accent/25' : 'border-ink-400 bg-white/5')} style={{ width: w * k, height: h * k }} />
    </span>
  );
}

export function WallPanel() {
  useTextureVersion((t) => t.v);
  const wall = useDoc((s) => s.doc.wall);
  const units = useDoc((s) => s.doc.prefs.units);
  const rulers = useUi((st) => st.rulers);
  const preset = matchWallPreset(wall.width, wall.height, units);
  const s = wall.style;

  const applySize = (w: number, h: number, refit = false) => {
    resizeWall(w, h, { key: refit ? undefined : 'wall-size' });
    // Let the new size render before framing it.
    if (refit) requestAnimationFrame(fitWall);
  };
  const [r, g, b] = kelvinToRgb(s.light.temperature);

  const uploadWallPhoto = () =>
    openFilePicker(async ([file]) => {
      try {
        const m = await ingest(file);
        const width = wall.width;
        setStyle((st) => {
          st.photo = { assetId: m.id, x: 0, y: 0, width, opacity: 1 };
          st.texture = 'none';
        }, 'wall-photo');
        toast('Now calibrate: drag along something you know the length of');
        ui().set({ calibrating: true });
      } catch {
        toast("Couldn't read that photo");
      }
    });

  return (
    <div>
      <Section title="Wall size">
        <div className="mb-2.5 grid grid-cols-2 gap-1.5">
          {wallPresetsFor(units).map((p) => {
            const active = preset?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => applySize(p.w, p.h, true)}
                aria-pressed={active}
                className={clsx(
                  'flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors',
                  active ? 'bg-accent/18 ring-1 ring-accent/60' : 'bg-white/4 hover:bg-white/8',
                )}
              >
                <WallGlyph w={p.w} h={p.h} active={active} />
                <span className="min-w-0">
                  <span className={clsx('block truncate text-[11.5px] font-medium', active ? 'text-white' : 'text-ink-200')}>{p.name}</span>
                  <span className="block truncate text-[10.5px] text-ink-400 tabular-nums">{formatWallSize(p.w, p.h, units)}</span>
                </span>
              </button>
            );
          })}
        </div>
        <Row label="Width">
          <LengthInput value={wall.width} units={units} min={MIN_WALL_W} onChange={(v) => applySize(v, wall.height)} className="w-24" ariaLabel="Wall width" />
        </Row>
        <Row label="Height">
          <LengthInput value={wall.height} units={units} min={MIN_WALL_H} onChange={(v) => applySize(wall.width, v)} className="w-24" ariaLabel="Wall height" />
        </Row>
        <p className="mt-1 mb-2 text-[11px] leading-snug text-ink-400">
          {formatWallLength(wall.width, units)} wide × {formatWallLength(wall.height, units)} high{preset ? ` · ${preset.name}` : ''}. Frames keep their real size and their height off the floor.
        </p>
        <Row label="Rulers">
          <Toggle checked={rulers} onChange={setRulers} />
        </Row>
        <Row label="Eye level line">
          <Toggle checked={wall.showEyeLine} onChange={(v) => setWall((w) => void (w.showEyeLine = v))} />
          <LengthInput value={wall.eyeLine} units={units} min={30} onChange={(v) => setWall((w) => void (w.eyeLine = v))} className="w-20" ariaLabel="Eye level height" />
        </Row>
      </Section>

      <Section title="Paint">
        <Swatches colors={PAINT_SWATCHES.map((p) => p.color)} value={s.color} onChange={(c) => setStyle((st) => void (st.color = c))} />
      </Section>

      <Section title="Finish">
        <div className="grid grid-cols-3 gap-1.5">
          {TEXTURES.map((t) => {
            // Thumbnails show roughly a 5-foot square of wall.
            const layers = wallLayers(t.id, s.color, s.accent, 0.045);
            return (
              <button
                key={t.id}
                onClick={() => setStyle((st) => void (st.texture = t.id))}
                className={clsx('flex flex-col items-stretch gap-1 rounded-xl p-1 text-[10.5px] transition-colors', s.texture === t.id ? 'bg-accent/18 text-white ring-1 ring-accent/60' : 'text-ink-300 hover:bg-white/8')}
              >
                <div
                  className="h-12 rounded-lg ring-1 ring-black/20"
                  style={{
                    backgroundColor: s.color,
                    backgroundImage: layers.map((l) => l.image).join(', '),
                    backgroundSize: layers.map((l) => l.size).join(', '),
                  }}
                />
                {t.name}
              </button>
            );
          })}
        </div>
        {s.texture !== 'none' && (
          <div className="mt-3 space-y-2">
            <Row label="Accent">
              <span />
            </Row>
            <Swatches colors={ACCENTS} value={s.accent} onChange={(c) => setStyle((st) => void (st.accent = c))} size={18} />
            <Row label="Scale">
              <Slider value={s.textureScale} min={0.4} max={2.5} step={0.05} onChange={(v) => setStyle((st) => void (st.textureScale = v))} className="w-32" />
            </Row>
          </div>
        )}
      </Section>

      <Section title="Lighting">
        <Row label={<span className="flex items-center gap-2">Temperature <span className="h-3 w-3 rounded-full" style={{ background: `rgb(${r},${g},${b})` }} /></span>}>
          <Slider value={s.light.temperature} min={2700} max={6500} step={50} onChange={(v) => setStyle((st) => void (st.light.temperature = v))} className="w-32" />
        </Row>
        <Row label="Intensity">
          <Slider value={s.light.intensity} min={0} max={1} step={0.01} onChange={(v) => setStyle((st) => void (st.light.intensity = v))} className="w-32" />
        </Row>
        <Row label="Light direction">
          <Slider value={s.light.angle} min={0} max={359} step={1} onChange={(v) => setStyle((st) => void (st.light.angle = v))} className="w-32" />
        </Row>
        <Row label="Vignette">
          <Slider value={s.light.vignette} min={0} max={1} step={0.01} onChange={(v) => setStyle((st) => void (st.light.vignette = v))} className="w-32" />
        </Row>
        <Row label="Picture lights">
          <Toggle checked={s.light.pictureLights} onChange={(v) => setStyle((st) => void (st.light.pictureLights = v))} />
        </Row>
      </Section>

      <Section title="Baseboard & floor">
        <Row label="Baseboard">
          <Toggle checked={s.baseboard.enabled} onChange={(v) => setStyle((st) => void (st.baseboard.enabled = v))} />
          <LengthInput value={s.baseboard.height} units={units} min={1} onChange={(v) => setStyle((st) => void (st.baseboard.height = v))} className="w-20" ariaLabel="Baseboard height" />
        </Row>
        <div className="my-2">
          <Swatches colors={['#f6f3ee', '#e9e2d6', '#3a3a3c', '#7a5a40']} value={s.baseboard.color} onChange={(c) => setStyle((st) => void (st.baseboard.color = c))} size={18} />
        </div>
        <Row label="Floor">
          <Segmented
            size="sm"
            value={s.floor.kind}
            options={[
              { value: 'wood', label: 'Wood' },
              { value: 'concrete', label: 'Concrete' },
              { value: 'carpet', label: 'Carpet' },
            ]}
            onChange={(v) => setStyle((st) => void (st.floor.kind = v))}
          />
        </Row>
        <div className="mt-2">
          <Swatches colors={['#9a7350', '#c9a77f', '#5a4030', '#8c8c88', '#d7d0c4', '#4a4a52']} value={s.floor.color} onChange={(c) => setStyle((st) => void (st.floor.color = c))} size={18} />
        </div>
      </Section>

      <Section title="Photo of your wall">
        {s.photo ? (
          <div className="space-y-2">
            <Row label="Opacity">
              <Slider value={s.photo.opacity} min={0.1} max={1} step={0.01} onChange={(v) => setStyle((st) => void (st.photo!.opacity = v))} className="w-32" />
            </Row>
            <div className="flex gap-1.5">
              <Button variant="soft" className="flex-1" onClick={() => ui().set({ calibrating: true })}>
                <Ruler size={14} /> Calibrate scale
              </Button>
              <Button variant="danger" onClick={() => setStyle((st) => void (st.photo = null), 'wall-photo')}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-2 text-[11.5px] leading-snug text-ink-400">Use a straight-on photo of your real wall, then measure one known distance so frames appear at true scale.</p>
            <Button variant="soft" className="w-full" onClick={uploadWallPhoto}>
              <ImageUp size={14} /> Upload wall photo
            </Button>
          </>
        )}
      </Section>
    </div>
  );
}
