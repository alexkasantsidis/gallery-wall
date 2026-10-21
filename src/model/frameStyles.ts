import type { HangerKind } from './types';

export type Finish = 'matte' | 'satin' | 'wood' | 'gold' | 'ornate' | 'brushed' | 'none';
export type Profile = 'flat' | 'rounded' | 'scoop' | 'bevel';
export type Variant = 'standard' | 'float' | 'shadowbox' | 'metal' | 'acrylic' | 'canvas' | 'poster' | 'clip';

export interface FrameStyleDef {
  id: string;
  name: string;
  group: 'Modern' | 'Wood' | 'Metallic' | 'Classic' | 'Frameless' | 'Specialty';
  /** Visible moulding face width. */
  face: number;
  /** Rabbet lip overlapping the art; negative = float gap between moulding and art. */
  lip: number;
  /** Physical depth, drives the shadow. */
  depth: number;
  finish: Finish;
  profile: Profile;
  color: string;
  variant: Variant;
  glass: boolean;
  defaultMat: boolean;
  presetSet: 'frame' | 'metal';
  hanger: { kind: HangerKind; drop: number };
  /** Colours offered in the inspector for this style. */
  swatches: string[];
}

const BLACKS = ['#1b1b1d', '#2a2622', '#3a3f45'];
const WHITES = ['#f4f2ee', '#e9e4da', '#d9d6cf'];
const WOODS = ['#c89f6d', '#a87a4c', '#5b3a26', '#3d2a1e', '#d9cbb5', '#8b6b4a'];
const GOLDS = ['#c9a24a', '#b8954f', '#d8bb6a', '#a8843a'];
const SILVERS = ['#b9bcc2', '#9aa0a8', '#d6d8dc'];

const base = {
  lip: 0.25,
  glass: true,
  defaultMat: true,
  presetSet: 'frame' as const,
  variant: 'standard' as Variant,
  hanger: { kind: 'wire' as HangerKind, drop: 2.5 },
};

export const FRAME_STYLES: FrameStyleDef[] = [
  { ...base, id: 'thin-black', name: 'Thin Black', group: 'Modern', face: 0.75, depth: 0.9, finish: 'matte', profile: 'flat', color: '#1b1b1d', swatches: BLACKS },
  { ...base, id: 'thin-white', name: 'Thin White', group: 'Modern', face: 0.75, depth: 0.9, finish: 'matte', profile: 'flat', color: '#f4f2ee', swatches: WHITES },
  { ...base, id: 'gallery-black', name: 'Gallery Black', group: 'Modern', face: 1.1, depth: 1.6, finish: 'satin', profile: 'bevel', color: '#18181a', swatches: BLACKS },
  { ...base, id: 'oak', name: 'Natural Oak', group: 'Wood', face: 1, depth: 1.1, finish: 'wood', profile: 'flat', color: '#c89f6d', swatches: WOODS },
  { ...base, id: 'walnut', name: 'Walnut', group: 'Wood', face: 1, depth: 1.1, finish: 'wood', profile: 'flat', color: '#5b3a26', swatches: WOODS },
  { ...base, id: 'ash', name: 'Whitewashed Ash', group: 'Wood', face: 0.9, depth: 1, finish: 'wood', profile: 'flat', color: '#d9cbb5', swatches: WOODS },
  { ...base, id: 'rounded-oak', name: 'Rounded Oak', group: 'Wood', face: 1.2, depth: 1.3, finish: 'wood', profile: 'rounded', color: '#b98c5a', swatches: WOODS },
  { ...base, id: 'gold-ornate', name: 'Gold Ornate', group: 'Classic', face: 3, depth: 2.2, finish: 'ornate', profile: 'scoop', color: '#c9a24a', swatches: GOLDS, hanger: { kind: 'd-rings', drop: 3 } },
  { ...base, id: 'gold-leaf', name: 'Gold Leaf Scoop', group: 'Classic', face: 1.4, depth: 1.5, finish: 'gold', profile: 'scoop', color: '#c9a24a', swatches: GOLDS },
  { ...base, id: 'brass', name: 'Brushed Brass', group: 'Metallic', face: 0.5, depth: 0.9, finish: 'brushed', profile: 'flat', color: '#b8954f', swatches: GOLDS },
  { ...base, id: 'silver', name: 'Brushed Silver', group: 'Metallic', face: 0.6, depth: 0.9, finish: 'brushed', profile: 'bevel', color: '#b9bcc2', swatches: SILVERS },
  { ...base, id: 'float-black', name: 'Float Frame Black', group: 'Specialty', face: 0.4, lip: -0.3, depth: 1.6, finish: 'satin', profile: 'flat', color: '#1d1d1f', variant: 'float', glass: false, defaultMat: false, swatches: BLACKS, hanger: { kind: 'd-rings', drop: 2 } },
  { ...base, id: 'float-oak', name: 'Float Frame Oak', group: 'Specialty', face: 0.4, lip: -0.3, depth: 1.6, finish: 'wood', profile: 'flat', color: '#c89f6d', variant: 'float', glass: false, defaultMat: false, swatches: WOODS, hanger: { kind: 'd-rings', drop: 2 } },
  { ...base, id: 'shadowbox', name: 'Shadow Box', group: 'Specialty', face: 1.25, depth: 2.2, finish: 'matte', profile: 'flat', color: '#efece6', variant: 'shadowbox', swatches: [...WHITES, ...BLACKS] },
  { ...base, id: 'metal-print', name: 'Metal Print', group: 'Frameless', face: 0, lip: 0, depth: 0.75, finish: 'none', profile: 'flat', color: '#cccccc', variant: 'metal', glass: false, defaultMat: false, presetSet: 'metal', swatches: [], hanger: { kind: 'sawtooth', drop: 1 } },
  { ...base, id: 'acrylic', name: 'Acrylic Face-Mount', group: 'Frameless', face: 0, lip: 0, depth: 0.9, finish: 'none', profile: 'flat', color: '#ffffff', variant: 'acrylic', glass: false, defaultMat: false, presetSet: 'metal', swatches: [], hanger: { kind: 'sawtooth', drop: 1 } },
  { ...base, id: 'canvas', name: 'Canvas Gallery Wrap', group: 'Frameless', face: 0, lip: 0, depth: 1.5, finish: 'none', profile: 'flat', color: '#ffffff', variant: 'canvas', glass: false, defaultMat: false, swatches: [], hanger: { kind: 'wire', drop: 3 } },
  { ...base, id: 'poster', name: 'Poster Hanger', group: 'Frameless', face: 0, lip: 0, depth: 0.5, finish: 'wood', profile: 'flat', color: '#c89f6d', variant: 'poster', glass: false, defaultMat: false, swatches: WOODS, hanger: { kind: 'sawtooth', drop: -2 } },
  { ...base, id: 'clip', name: 'Clip Frame', group: 'Frameless', face: 0, lip: 0, depth: 0.4, finish: 'none', profile: 'flat', color: '#ffffff', variant: 'clip', glass: true, defaultMat: false, swatches: [], hanger: { kind: 'sawtooth', drop: 0.75 } },
];

export const STYLE_GROUPS: FrameStyleDef['group'][] = ['Modern', 'Wood', 'Metallic', 'Classic', 'Specialty', 'Frameless'];

export const styleById = (id: string): FrameStyleDef => FRAME_STYLES.find((s) => s.id === id) ?? FRAME_STYLES[0];

export const isFrameless = (s: FrameStyleDef) => s.face === 0;
