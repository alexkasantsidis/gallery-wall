/** All world geometry is stored in inches. cm only exists at the display/input boundary. */
export type Inches = number;
export type Units = 'in' | 'cm';

export interface Size {
  w: Inches;
  h: Inches;
}

export interface Rect {
  x: Inches;
  y: Inches;
  w: Inches;
  h: Inches;
}

export type Tone = 'none' | 'bw' | 'sepia' | 'warm' | 'cool';

/**
 * Resolution-independent crop. (ax, ay) is the anchor point of the image (0..1) that stays
 * pinned to the same relative point of the opening (CSS object-position semantics); zoom >= 1
 * scales about that anchor. Because nothing is stored in pixels, resizing the frame re-fits
 * the photo automatically and the image can never leave a gap.
 */
export interface PhotoPlacement {
  assetId: string;
  ax: number;
  ay: number;
  zoom: number;
  rotate: 0 | 90 | 180 | 270;
  flipX: boolean;
  tone: Tone;
}

export interface SingleContent {
  kind: 'single';
  photo: PhotoPlacement | null;
}

export interface GridCell {
  id: string;
  r: number;
  c: number;
  rs: number;
  cs: number;
  photo: PhotoPlacement | null;
}

export interface GridContent {
  kind: 'grid';
  rows: number;
  cols: number;
  /** Relative track sizes (fr units). */
  colSizes: number[];
  rowSizes: number[];
  gutter: Inches;
  gutterColor: string | null;
  cells: GridCell[];
}

export type FrameContent = SingleContent | GridContent;

export interface MatSpec {
  enabled: boolean;
  mode: 'uniform' | 'opening';
  width: Inches;
  opening: Size | null;
  bottomWeight: Inches;
  color: string;
  double: { enabled: boolean; reveal: Inches; color: string };
}

export type HangerKind = 'wire' | 'sawtooth' | 'd-rings';

export interface Hanger {
  kind: HangerKind;
  /** Distance from the top of the frame to the hanging point (taut wire / sawtooth / ring). */
  drop: Inches;
  /** D-rings only: distance of each ring from the side edge. */
  ringInset: Inches;
}

export interface FrameItem {
  kind: 'frame';
  id: string;
  name: string;
  /** Outer top-left corner. */
  x: Inches;
  y: Inches;
  /** Nominal frame size as sold ("an 11x14 frame"): the artwork/glass size. */
  nominal: Size;
  styleId: string;
  color: string | null;
  moulding: Inches | null;
  mat: MatSpec;
  content: FrameContent;
  hanger: Hanger;
  glare: boolean;
  locked: boolean;
}

export type FurnitureKind =
  | 'sofa'
  | 'console'
  | 'sideboard'
  | 'bed'
  | 'armchair'
  | 'tv'
  | 'plant'
  | 'lamp'
  | 'desk'
  | 'switch'
  | 'outlet';

export interface FurnitureItem {
  kind: 'furniture';
  id: string;
  type: FurnitureKind;
  name: string;
  x: Inches;
  y: Inches;
  w: Inches;
  h: Inches;
  color: string;
  locked: boolean;
}

export type Item = FrameItem | FurnitureItem;

export type WallTexture =
  | 'none'
  | 'plaster'
  | 'limewash'
  | 'concrete'
  | 'brick'
  | 'woodslat'
  | 'boardbatten'
  | 'wainscot'
  | 'stripes'
  | 'grasscloth'
  | 'geometric'
  | 'botanical';

export interface WallStyle {
  color: string;
  texture: WallTexture;
  /** Secondary colour used by textures/wallpapers (mortar, stripe, pattern ink). */
  accent: string;
  textureScale: number;
  baseboard: { enabled: boolean; height: Inches; color: string };
  floor: { color: string; kind: 'wood' | 'concrete' | 'carpet' };
  light: {
    /** Kelvin, 2700..6500 */
    temperature: number;
    intensity: number;
    /** Direction the light comes FROM, degrees clockwise from straight up. */
    angle: number;
    vignette: number;
    pictureLights: boolean;
  };
  photo: WallPhoto | null;
}

export interface WallPhoto {
  assetId: string;
  /** Placement of the photo's top-left in wall inches and its rendered width in inches. */
  x: Inches;
  y: Inches;
  width: Inches;
  opacity: number;
}

export interface WallDoc {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  wall: {
    width: Inches;
    height: Inches;
    style: WallStyle;
    /** Eye-level centre line, measured from the floor. */
    eyeLine: Inches;
    showEyeLine: boolean;
  };
  items: Record<string, Item>;
  order: string[];
  prefs: {
    units: Units;
    snap: boolean;
    defaultStyleId: string;
  };
}
