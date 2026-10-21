/** Procedurally painted sample artworks so a fresh wall looks like a real gallery wall. */

type Painter = (g: CanvasRenderingContext2D, w: number, h: number) => void;

const sunset: Painter = (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2d3a63');
  sky.addColorStop(0.45, '#d9826b');
  sky.addColorStop(0.62, '#f2c38b');
  sky.addColorStop(1, '#f6ddb4');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,236,200,0.95)';
  g.beginPath();
  g.arc(w * 0.62, h * 0.52, w * 0.13, 0, Math.PI * 2);
  g.fill();
  const ridges = ['#7a5368', '#5b3f58', '#3c2c45', '#241c30'];
  ridges.forEach((c, i) => {
    g.fillStyle = c;
    g.beginPath();
    const base = h * (0.58 + i * 0.1);
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 60) {
      const y = base - Math.sin(x / (w * (0.18 + i * 0.05)) + i * 1.7) * h * 0.05 - Math.sin(x / (w * 0.07) + i) * h * 0.012;
      g.lineTo(x, y);
    }
    g.lineTo(w, h);
    g.fill();
  });
};

const bauhaus: Painter = (g, w, h) => {
  g.fillStyle = '#efe6d2';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#d4a02c';
  g.beginPath();
  g.arc(w * 0.35, h * 0.32, w * 0.24, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#b4492f';
  g.fillRect(w * 0.48, h * 0.18, w * 0.34, h * 0.38);
  g.fillStyle = '#1f3a5a';
  g.beginPath();
  g.arc(w * 0.5, h * 0.78, w * 0.32, Math.PI, 0);
  g.fill();
  g.strokeStyle = '#1b1b1b';
  g.lineWidth = w * 0.012;
  g.beginPath();
  g.moveTo(w * 0.12, h * 0.6);
  g.lineTo(w * 0.88, h * 0.6);
  g.stroke();
  g.fillStyle = '#1b1b1b';
  g.beginPath();
  g.arc(w * 0.78, h * 0.68, w * 0.04, 0, Math.PI * 2);
  g.fill();
};

const waves: Painter = (g, w, h) => {
  const cols = ['#e9e1d3', '#c9d6d2', '#8fb3ae', '#4f8a8b', '#2c5d6b', '#1d3c4a'];
  g.fillStyle = cols[0];
  g.fillRect(0, 0, w, h);
  cols.slice(1).forEach((c, i) => {
    g.fillStyle = c;
    g.beginPath();
    const base = h * (0.25 + i * 0.15);
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) g.lineTo(x, base + Math.sin(x / (w * 0.12) + i * 0.9) * h * 0.035);
    g.lineTo(w, h);
    g.fill();
  });
};

const botanical: Painter = (g, w, h) => {
  g.fillStyle = '#f4efe6';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#2f4a3a';
  g.lineCap = 'round';
  const stem = (x0: number, curve: number, len: number, leaves: number) => {
    g.lineWidth = w * 0.006;
    g.beginPath();
    g.moveTo(x0, h * 0.95);
    g.quadraticCurveTo(x0 + curve, h * 0.95 - len * 0.5, x0 + curve * 0.6, h * 0.95 - len);
    g.stroke();
    for (let i = 1; i <= leaves; i++) {
      const t = i / (leaves + 1);
      const x = x0 + curve * (2 * t * (1 - t)) + curve * 0.6 * t * t;
      const y = h * 0.95 - len * t;
      const side = i % 2 ? 1 : -1;
      g.save();
      g.translate(x, y);
      g.rotate(side * 0.9 - 0.2);
      g.fillStyle = i % 3 ? '#4e7a5a' : '#7da383';
      g.beginPath();
      g.ellipse(side * w * 0.06, 0, w * 0.07, w * 0.022, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  };
  stem(w * 0.45, w * 0.1, h * 0.75, 9);
  stem(w * 0.55, -w * 0.12, h * 0.6, 7);
  stem(w * 0.35, -w * 0.05, h * 0.45, 5);
};

const colorField: Painter = (g, w, h) => {
  g.fillStyle = '#7a2f2a';
  g.fillRect(0, 0, w, h);
  const block = (y: number, hh: number, c: string) => {
    g.save();
    g.filter = `blur(${w * 0.01}px)`;
    g.fillStyle = c;
    g.fillRect(w * 0.08, y, w * 0.84, hh);
    g.restore();
  };
  block(h * 0.07, h * 0.38, '#d36b3b');
  block(h * 0.5, h * 0.08, '#3b1d22');
  block(h * 0.62, h * 0.31, '#e3a85b');
};

const moons: Painter = (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#14213b');
  bg.addColorStop(1, '#0b1222');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  const n = 5;
  for (let i = 0; i < n; i++) {
    const cx = w * (0.14 + (i * 0.72) / (n - 1));
    const cy = h * 0.5;
    const r = w * 0.065;
    g.fillStyle = '#efe6c8';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#101a30';
    g.beginPath();
    g.arc(cx + r * (1.6 - i * 0.8), cy, r, 0, Math.PI * 2);
    g.fill();
  }
};

const ocean: Painter = (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#9fc3d8');
  sky.addColorStop(1, '#e9eef0');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h * 0.55);
  const sea = g.createLinearGradient(0, h * 0.55, 0, h);
  sea.addColorStop(0, '#4f8fb0');
  sea.addColorStop(1, '#1d4f6e');
  g.fillStyle = sea;
  g.fillRect(0, h * 0.55, w, h * 0.45);
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 40; i++) {
    const y = h * 0.58 + Math.random() * h * 0.4;
    const x = Math.random() * w;
    g.lineWidth = 1 + (y / h) * 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w * 0.06 * (y / h), y);
    g.stroke();
  }
};

const arches: Painter = (g, w, h) => {
  g.fillStyle = '#f1e4d3';
  g.fillRect(0, 0, w, h);
  const cols = ['#c56a45', '#e3a072', '#9b4b33', '#e8c39e'];
  const cx = w / 2;
  const base = h * 0.82;
  cols.forEach((c, i) => {
    const r = w * (0.38 - i * 0.085);
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(cx - r, base);
    g.arc(cx, base - r * 0.6, r, Math.PI, 0);
    g.lineTo(cx + r, base);
    g.fill();
  });
  g.fillStyle = '#c56a45';
  g.beginPath();
  g.arc(w * 0.78, h * 0.18, w * 0.07, 0, Math.PI * 2);
  g.fill();
};

export const SAMPLE_ART: { name: string; w: number; h: number; paint: Painter }[] = [
  { name: 'Dusk Ridge', w: 1600, h: 2000, paint: sunset },
  { name: 'Bauhaus No. 3', w: 1600, h: 2000, paint: bauhaus },
  { name: 'Tidal', w: 2100, h: 1500, paint: waves },
  { name: 'Fern Study', w: 1500, h: 2100, paint: botanical },
  { name: 'Ember Field', w: 1600, h: 2000, paint: colorField },
  { name: 'Phases', w: 2400, h: 1200, paint: moons },
  { name: 'Horizon', w: 2000, h: 1600, paint: ocean },
  { name: 'Arches', w: 1600, h: 1600, paint: arches },
];

export async function renderSample(i: number): Promise<File> {
  const s = SAMPLE_ART[i];
  const c = document.createElement('canvas');
  c.width = s.w;
  c.height = s.h;
  s.paint(c.getContext('2d')!, s.w, s.h);
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.92));
  return new File([blob], `${s.name}.jpg`, { type: 'image/jpeg' });
}
