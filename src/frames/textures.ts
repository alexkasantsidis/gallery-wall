import { create } from 'zustand';

/**
 * Procedural textures as SVG data URIs (no downloads), memoised by parameters.
 * Textures that use SVG filters are re-rendered once to PNG: filter SVGs are slow to rasterise at
 * large sizes and render incorrectly inside DOM-to-image exports. Until the PNG is ready the SVG is used.
 */
const cache = new Map<string, string>();

/** Bumped whenever a texture finishes rasterising, so renderers can pick up the PNG. */
export const useTextureVersion = create<{ v: number }>(() => ({ v: 0 }));

function rasterize(key: string, cssUrl: string) {
  if (typeof document === 'undefined') return;
  const src = cssUrl.slice(5, -2); // url("…")
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      cache.set(key, `url("${URL.createObjectURL(b)}")`);
      useTextureVersion.setState((s) => ({ v: s.v + 1 }));
    }, 'image/png');
  };
  img.src = src;
}

const memo = (key: string, make: () => string) => {
  let v = cache.get(key);
  if (!v) {
    v = make();
    cache.set(key, v);
    if (v.includes('%3Cfilter')) rasterize(key, v);
  }
  return v;
};

export const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** Dark wood-grain streaks (alpha only) to lay over a base colour. */
export const woodGrain = (dir: 'h' | 'v', seed = 3) =>
  memo(`wood-${dir}-${seed}`, () => {
    const [w, h, f] = dir === 'h' ? [520, 72, '0.0035 0.24'] : [72, 520, '0.24 0.0035'];
    return svgUrl(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><filter id='g' x='0' y='0'><feTurbulence type='fractalNoise' baseFrequency='${f}' numOctaves='4' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.03  1.25 0 0 0 -0.42'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`,
    );
  });

/** Fine noise used for paper, mats and canvas. */
export const fineNoise = (opacity = 0.06, freq = 0.9) =>
  memo(`noise-${opacity}-${freq}`, () =>
    svgUrl(
      `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${opacity * 4} ${-opacity * 1.5}'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
    ),
  );

/**
 * Ornate moulding tile, drawn horizontally with the OUTER edge at y=0, then re-oriented per side.
 * Tile is 40 (along) x 100 (across).
 */
const ORNATE_BODY = `
  <rect width='40' height='100' fill='none'/>
  <g fill='rgba(255,240,190,0.55)' stroke='rgba(70,45,10,0.55)' stroke-width='0.8'>
    ${[4, 14, 24, 34].map((x) => `<circle cx='${x + 1}' cy='7' r='3.6'/>`).join('')}
  </g>
  <path d='M0 13 H40' stroke='rgba(60,40,10,0.6)' stroke-width='1.4'/>
  <path d='M0 16 H40' stroke='rgba(255,240,200,0.5)' stroke-width='1'/>
  <g stroke='rgba(70,45,10,0.6)' stroke-width='1.1' fill='rgba(255,236,170,0.35)'>
    <path d='M2 52 C 8 22, 26 22, 20 40 C 16 50, 8 44, 12 36'/>
    <path d='M22 52 C 28 22, 46 22, 40 40 C 36 50, 28 44, 32 36'/>
    <path d='M0 60 C 10 50, 30 50, 40 60' fill='none'/>
  </g>
  <path d='M0 66 H40' stroke='rgba(60,40,10,0.55)' stroke-width='1.2'/>
  <g fill='rgba(70,45,10,0.35)'>${[0, 10, 20, 30].map((x) => `<path d='M${x} 70 l5 8 l5 -8 z'/>`).join('')}</g>
  <path d='M0 82 H40' stroke='rgba(255,240,200,0.55)' stroke-width='1.6'/>
  <g fill='rgba(255,240,190,0.5)' stroke='rgba(70,45,10,0.5)' stroke-width='0.6'>
    ${[3, 11, 19, 27, 35].map((x) => `<ellipse cx='${x + 1}' cy='90' rx='3' ry='2.2'/>`).join('')}
  </g>
  <path d='M0 97 H40' stroke='rgba(50,30,5,0.7)' stroke-width='2'/>
`;

export type Side = 'top' | 'right' | 'bottom' | 'left';

export const ornateTile = (side: Side) =>
  memo(`ornate-${side}`, () => {
    if (side === 'top') return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='100' viewBox='0 0 40 100' preserveAspectRatio='none'>${ORNATE_BODY}</svg>`);
    if (side === 'bottom')
      return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='100' viewBox='0 0 40 100' preserveAspectRatio='none'><g transform='translate(0 100) scale(1 -1)'>${ORNATE_BODY}</g></svg>`);
    const m = side === 'left' ? 'matrix(0 1 1 0 0 0)' : 'matrix(0 1 -1 0 100 0)';
    return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='100' height='40' viewBox='0 0 100 40' preserveAspectRatio='none'><g transform='${m}'>${ORNATE_BODY}</g></svg>`);
  });

// ---------------- Wall textures ----------------

export interface WallLayer {
  image: string;
  size: string;
  blend?: string;
  opacity?: number;
}

const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function wallLayers(texture: string, color: string, accent: string, scale: number): WallLayer[] {
  const s = (inches: number) => inches * 96 * scale;
  switch (texture) {
    case 'plaster':
      return [
        {
          image: memo('plaster', () =>
            svgUrl(
              `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='640'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.006' numOctaves='5' seed='11' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -2.2 1.2'/></filter><rect width='100%' height='100%' filter='url(#p)'/></svg>`,
            ),
          ),
          size: `${s(18)}px ${s(18)}px`,
          opacity: 0.5,
        },
        { image: fineNoise(0.05, 0.75), size: `${s(3)}px ${s(3)}px` },
      ];
    case 'limewash':
      return [
        {
          image: memo(`lime-${accent}`, () =>
            svgUrl(
              `<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900'><filter id='l'><feTurbulence type='fractalNoise' baseFrequency='0.0028' numOctaves='4' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.6 -1.1'/><feComponentTransfer><feFuncA type='linear' slope='0.9'/></feComponentTransfer><feFlood flood-color='${accent}'/><feComposite in2='SourceGraphic' operator='in'/></filter><rect width='100%' height='100%' filter='url(#l)'/></svg>`,
            ),
          ),
          size: `${s(46)}px ${s(46)}px`,
          opacity: 0.85,
        },
        { image: fineNoise(0.035, 0.6), size: `${s(4)}px ${s(4)}px` },
      ];
    case 'concrete':
      return [
        {
          image: memo('concrete', () =>
            svgUrl(
              `<svg xmlns='http://www.w3.org/2000/svg' width='500' height='500'><filter id='c'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='5' seed='21' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 -1.6 0.95'/></filter><rect width='100%' height='100%' filter='url(#c)'/></svg>`,
            ),
          ),
          size: `${s(22)}px ${s(22)}px`,
          opacity: 0.35,
        },
        {
          image: memo('pores', () =>
            svgUrl(
              `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='q'><feTurbulence type='turbulence' baseFrequency='0.35' numOctaves='1' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -6 0 0 0 1.9'/></filter><rect width='100%' height='100%' filter='url(#q)'/></svg>`,
            ),
          ),
          size: `${s(9)}px ${s(9)}px`,
          opacity: 0.25,
        },
        { image: fineNoise(0.06, 0.8), size: `${s(3)}px ${s(3)}px` },
      ];
    case 'brick': {
      const bw = 8;
      const bh = 2.25;
      const m = 0.4;
      const rows = 4;
      let rects = '';
      const shades = [0.0, 0.08, -0.06, 0.12, -0.1, 0.04, -0.03, 0.1];
      let k = 0;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? -(bw + m) / 2 : 0;
        for (let c = -1; c < 3; c++) {
          const x = off + c * (bw + m);
          const y = r * (bh + m);
          const sh = shades[k++ % shades.length];
          const shade = sh >= 0 ? `rgba(255,255,255,${sh})` : `rgba(0,0,0,${-sh})`;
          const box = `x='${x}' y='${y}' width='${bw}' height='${bh}' rx='0.15'`;
          rects += `<rect ${box} fill='${color}'/><rect ${box} fill='${shade}'/>`;
        }
      }
      const tw = 2 * (bw + m);
      const th = rows * (bh + m);
      return [
        {
          image: memo(`brick-${color}-${accent}`, () =>
            svgUrl(
              `<svg xmlns='http://www.w3.org/2000/svg' width='${tw * 10}' height='${th * 10}' viewBox='0 0 ${tw} ${th}'><rect width='${tw}' height='${th}' fill='${accent}'/>${rects}</svg>`,
            ),
          ),
          size: `${s(tw)}px ${s(th)}px`,
        },
        {
          image: memo('brick-grit', () =>
            svgUrl(
              `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.05' numOctaves='4' seed='9' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.15  0 0 0 0 0.08  0 0 0 0 0.05  0 0 0 -1.8 1.0'/></filter><rect width='100%' height='100%' filter='url(#b)'/></svg>`,
            ),
          ),
          size: `${s(11)}px ${s(11)}px`,
          opacity: 0.55,
        },
      ];
    }
    case 'woodslat':
      return [
        { image: `linear-gradient(90deg, rgba(0,0,0,0.55) 0 ${s(0.5)}px, rgba(255,255,255,0.08) ${s(0.5)}px ${s(0.7)}px, transparent ${s(0.7)}px ${s(2.3)}px, rgba(0,0,0,0.12) ${s(2.5)}px)`, size: `${s(2.5)}px 100%` },
        { image: woodGrain('v', 8), size: `${s(2.5)}px ${s(24)}px`, opacity: 0.8 },
      ];
    case 'boardbatten':
      return [
        {
          image: `linear-gradient(90deg, transparent 0 ${s(13)}px, rgba(0,0,0,0.10) ${s(13)}px ${s(13.15)}px, rgba(255,255,255,0.35) ${s(13.15)}px ${s(13.4)}px, rgba(255,255,255,0.06) ${s(13.4)}px ${s(15.6)}px, rgba(0,0,0,0.22) ${s(15.6)}px ${s(16)}px, rgba(0,0,0,0.06) ${s(16)}px ${s(16.6)}px, transparent ${s(16.6)}px)`,
          size: `${s(16)}px 100%`,
        },
        { image: fineNoise(0.03, 0.7), size: `${s(3)}px ${s(3)}px` },
      ];
    case 'wainscot':
      return [{ image: fineNoise(0.035, 0.7), size: `${s(3)}px ${s(3)}px` }];
    case 'stripes':
      return [
        { image: `linear-gradient(90deg, ${accent} 0 ${s(3)}px, transparent ${s(3)}px ${s(3.2)}px, ${hexA(accent, 0.35)} ${s(3.2)}px ${s(3.35)}px, transparent ${s(3.35)}px)`, size: `${s(7)}px 100%` },
        { image: fineNoise(0.03, 0.7), size: `${s(3)}px ${s(3)}px` },
      ];
    case 'grasscloth':
      return [
        {
          image: memo(`grass-${accent}`, () =>
            svgUrl(
              `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.002 0.16' numOctaves='4' seed='14' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 3 -1.2'/><feFlood flood-color='${accent}'/><feComposite in2='SourceGraphic' operator='in'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`,
            ),
          ),
          size: `${s(36)}px ${s(10)}px`,
        },
        { image: `linear-gradient(90deg, rgba(0,0,0,0.08) 0 1px, transparent 1px)`, size: `${s(36)}px 100%` },
      ];
    case 'geometric':
      return [
        {
          image: memo(`geo-${accent}`, () =>
            svgUrl(
              `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='${accent}' stroke-width='2.2'>${[0, 1].map((r) => [0, 1].map((c) => {
                const cx = c * 60 + (r % 2 ? 30 : 0);
                const cy = r * 60 + 60;
                return [-120, 0].map((ox) => [28, 21, 14, 7].map((rad) => `<path d='M${cx + ox - rad} ${cy} A ${rad} ${rad} 0 0 1 ${cx + ox + rad} ${cy}'/>`).join('')).join('');
              }).join('')).join('')}</g></svg>`,
            ),
          ),
          size: `${s(10)}px ${s(10)}px`,
          opacity: 0.85,
        },
      ];
    case 'botanical':
      return [
        {
          image: memo(`bot-${color}-${accent}`, () => {
            const leaf = (x: number, y: number, r: number, sc: number) =>
              `<g transform='translate(${x} ${y}) rotate(${r}) scale(${sc})'><path d='M0 0 C 10 -14, 30 -14, 40 0 C 30 14, 10 14, 0 0 Z' fill='${accent}'/><path d='M0 0 L 38 0' stroke='${color}' stroke-width='1.2' opacity='0.6'/></g>`;
            const stem = (x: number, y: number, r: number) =>
              `<g transform='translate(${x} ${y}) rotate(${r})'><path d='M0 0 C 20 -30, 30 -60, 26 -100' stroke='${accent}' stroke-width='2' fill='none'/>${leaf(8, -20, -40, 0.8)}${leaf(20, -45, 210, 0.75)}${leaf(24, -70, -50, 0.7)}${leaf(26, -96, 230, 0.6)}</g>`;
            return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>${stem(30, 150, 0)}${stem(130, 90, 25)}${stem(150, 220, -15)}${stem(-50, 90, 25)}${stem(30, -50, 0)}</svg>`);
          }),
          size: `${s(16)}px ${s(16)}px`,
          opacity: 0.75,
        },
        { image: fineNoise(0.03, 0.7), size: `${s(3)}px ${s(3)}px` },
      ];
    default:
      return [{ image: fineNoise(0.025, 0.7), size: `${s(3)}px ${s(3)}px` }];
  }
}
