import { memo, type ReactNode } from 'react';
import type { FurnitureItem } from '../model/types';

const shade = (hex: string, amt: number) => `color-mix(in oklab, ${hex}, ${amt > 0 ? 'white' : 'black'} ${Math.abs(amt) * 100}%)`;

/** Simple front-elevation silhouettes, drawn in inches so proportions stay true at any size. */
export const FurnitureView = memo(function FurnitureView({ item }: { item: FurnitureItem }) {
  const { w, h, color: c } = item;
  let body: ReactNode = null;
  switch (item.type) {
    case 'sofa': {
      const arm = Math.min(9, w * 0.12);
      const seatY = h * 0.55;
      const leg = Math.min(4, h * 0.12);
      const cushions = Math.max(2, Math.round((w - 2 * arm) / 28));
      const cw = (w - 2 * arm) / cushions;
      body = (
        <>
          <rect x={arm * 0.6} y={0} width={w - arm * 1.2} height={seatY + 2} rx={4} fill={shade(c, -0.08)} />
          {Array.from({ length: cushions }, (_, i) => (
            <rect key={i} x={arm + i * cw + 0.6} y={3} width={cw - 1.2} height={seatY - 4} rx={3.5} fill={shade(c, 0.06)} />
          ))}
          <rect x={arm - 1} y={seatY - 2} width={w - 2 * arm + 2} height={h - seatY - leg - 4} rx={3} fill={c} />
          <rect x={0} y={h * 0.32} width={arm} height={h - h * 0.32 - leg} rx={4} fill={shade(c, -0.04)} />
          <rect x={w - arm} y={h * 0.32} width={arm} height={h - h * 0.32 - leg} rx={4} fill={shade(c, -0.04)} />
          <rect x={2} y={h - leg - 5} width={w - 4} height={5} rx={1.5} fill={shade(c, -0.18)} />
          <rect x={4} y={h - leg} width={2} height={leg} fill="#3a2d22" />
          <rect x={w - 6} y={h - leg} width={2} height={leg} fill="#3a2d22" />
        </>
      );
      break;
    }
    case 'console':
    case 'desk': {
      const top = 1.5;
      body = (
        <>
          <rect x={0} y={0} width={w} height={top} rx={0.4} fill={shade(c, 0.08)} />
          {item.type === 'desk' && <rect x={w * 0.6} y={top} width={w * 0.38} height={h * 0.3} fill={shade(c, -0.05)} />}
          <rect x={2} y={top} width={1.6} height={h - top} fill={shade(c, -0.15)} />
          <rect x={w - 3.6} y={top} width={1.6} height={h - top} fill={shade(c, -0.15)} />
          {item.type === 'console' && <rect x={2} y={h * 0.72} width={w - 4} height={1} fill={shade(c, -0.1)} />}
        </>
      );
      break;
    }
    case 'sideboard': {
      const doors = Math.max(2, Math.round(w / 18));
      const dw = (w - 2) / doors;
      body = (
        <>
          <rect x={0} y={0} width={w} height={h - 6} rx={0.6} fill={c} />
          {Array.from({ length: doors }, (_, i) => (
            <g key={i}>
              <rect x={1 + i * dw + 0.4} y={1.6} width={dw - 0.8} height={h - 9} fill={shade(c, 0.05)} />
              <rect x={1 + i * dw + dw / 2 - 0.3} y={h * 0.35} width={0.6} height={4} rx={0.3} fill="#c9a24a" />
            </g>
          ))}
          <rect x={3} y={h - 6} width={1.4} height={6} fill="#2c2420" />
          <rect x={w - 4.4} y={h - 6} width={1.4} height={6} fill="#2c2420" />
        </>
      );
      break;
    }
    case 'bed': {
      body = (
        <>
          <rect x={0} y={0} width={w} height={h * 0.62} rx={3} fill={c} />
          <rect x={2} y={2} width={w - 4} height={h * 0.62 - 4} rx={2.5} fill={shade(c, 0.07)} />
          <rect x={w * 0.08} y={h * 0.42} width={w * 0.38} height={h * 0.16} rx={3} fill="#f5f3ee" />
          <rect x={w * 0.54} y={h * 0.42} width={w * 0.38} height={h * 0.16} rx={3} fill="#f5f3ee" />
          <rect x={-2} y={h * 0.55} width={w + 4} height={h * 0.3} rx={2} fill="#e8e3da" />
          <rect x={-1} y={h * 0.85} width={w + 2} height={h * 0.08} fill={shade(c, -0.2)} />
        </>
      );
      break;
    }
    case 'armchair': {
      body = (
        <>
          <rect x={w * 0.12} y={0} width={w * 0.76} height={h * 0.62} rx={5} fill={shade(c, 0.04)} />
          <rect x={0} y={h * 0.38} width={w * 0.2} height={h * 0.5} rx={4} fill={shade(c, -0.05)} />
          <rect x={w * 0.8} y={h * 0.38} width={w * 0.2} height={h * 0.5} rx={4} fill={shade(c, -0.05)} />
          <rect x={w * 0.16} y={h * 0.55} width={w * 0.68} height={h * 0.3} rx={3} fill={c} />
          <rect x={w * 0.12} y={h * 0.88} width={1.2} height={h * 0.12} fill="#3a2d22" />
          <rect x={w * 0.85} y={h * 0.88} width={1.2} height={h * 0.12} fill="#3a2d22" />
        </>
      );
      break;
    }
    case 'plant': {
      const potH = h * 0.22;
      const leaves = Array.from({ length: 11 }, (_, i) => {
        const a = -150 + i * 12 + (i % 2 ? 6 : 0);
        const len = h * (0.45 + ((i * 37) % 10) / 40);
        const rad = (a * Math.PI) / 180;
        const x2 = w / 2 + Math.cos(rad) * len * 0.55;
        const y2 = h - potH - Math.abs(Math.sin(rad)) * len;
        return (
          <g key={i}>
            <path d={`M${w / 2} ${h - potH} Q ${(w / 2 + x2) / 2} ${y2 + len * 0.2} ${x2} ${y2}`} stroke={shade(c, -0.25)} strokeWidth={0.5} fill="none" />
            <ellipse cx={x2} cy={y2} rx={w * 0.13} ry={w * 0.05} transform={`rotate(${a + 180} ${x2} ${y2})`} fill={i % 3 ? c : shade(c, 0.12)} />
          </g>
        );
      });
      body = (
        <>
          {leaves}
          <path d={`M${w * 0.28} ${h - potH} L${w * 0.72} ${h - potH} L${w * 0.66} ${h} L${w * 0.34} ${h} Z`} fill="#c9b9a4" />
        </>
      );
      break;
    }
    case 'lamp': {
      body = (
        <>
          <path d={`M${w * 0.1} ${h * 0.22} L${w * 0.25} 0 L${w * 0.75} 0 L${w * 0.9} ${h * 0.22} Z`} fill="#efe6d4" stroke={shade('#efe6d4', -0.15)} strokeWidth={0.3} />
          <rect x={w / 2 - 0.4} y={h * 0.22} width={0.8} height={h * 0.76} fill={c} />
          <ellipse cx={w / 2} cy={h - 0.6} rx={w * 0.3} ry={0.8} fill={c} />
        </>
      );
      break;
    }
    case 'tv': {
      body = (
        <>
          <rect x={0} y={0} width={w} height={h} rx={0.5} fill={c} />
          <rect x={0.6} y={0.6} width={w - 1.2} height={h - 1.2} fill="url(#tvgrad)" />
        </>
      );
      break;
    }
    case 'switch':
    case 'outlet': {
      body = (
        <>
          <rect x={0} y={0} width={w} height={h} rx={0.25} fill={c} stroke="rgba(0,0,0,0.18)" strokeWidth={0.06} />
          {item.type === 'switch' ? (
            <rect x={w / 2 - 0.35} y={h / 2 - 0.6} width={0.7} height={1.2} rx={0.1} fill={shade(c, -0.08)} />
          ) : (
            <>
              <rect x={w / 2 - 0.65} y={h * 0.2} width={1.3} height={1.1} rx={0.35} fill={shade(c, -0.06)} />
              <rect x={w / 2 - 0.65} y={h * 0.58} width={1.3} height={1.1} rx={0.35} fill={shade(c, -0.06)} />
            </>
          )}
        </>
      );
      break;
    }
  }
  return (
    <svg className="gw-furniture" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" overflow="visible">
      <defs>
        <linearGradient id="tvgrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d222a" />
          <stop offset="0.5" stopColor="#0c0e12" />
          <stop offset="1" stopColor="#15181d" />
        </linearGradient>
      </defs>
      {body}
    </svg>
  );
});
