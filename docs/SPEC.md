# Gallery Wall Planner: Technical Plan & Spec Sheet

## Context

You want to plan a "chaos" gallery wall (mixed frame shapes, sizes and styles) before putting nails in the wall. Paper templates and generic design tools are clumsy for this. The app should feel like Obsidian Canvas: pan, zoom, drag, drop and resize should be instant and smooth. Frames should snap to real-world sizes. Frame styles should be animated and realistic, including frameless metal prints. You should be able to upload and crop your own photos, build multi-photo grids inside one frame, and style the wall behind the frames.

**Your decisions**
- Code lives in `C:\Projects\gallery-wall`, outside the vault.
- Data is local-first: everything is stored in the browser (IndexedDB), with export/import as a `.wall` file. No server and no accounts. The app is an installable PWA.
- Units default to inches, with a toggle to cm. Presets include both US and metric frame sizes.
- Target is desktop browsers, with full touch/pen support so it works on an iPad.

**Prerequisite:** Node.js isn't installed on this machine. Implementation step 0 installs Node 22 LTS (`winget install OpenJS.NodeJS.LTS`) and enables pnpm through corepack. I'll confirm with you before running it.

---

## 1. Technology Choices

| Concern | Choice | Why |
|---|---|---|
| Build / dev | **Vite 6 + TypeScript (strict)** | Fast HMR and a simple PWA plugin |
| UI framework | **React 19** | Largest ecosystem; best animation and gesture libraries |
| Rendering model | **DOM + CSS transforms on one camera layer** (the same approach Obsidian Canvas uses) | A gallery wall has 5–60 objects, which DOM handles easily at 60fps. CSS gives realistic frames (gradients, box-shadow, clip-path mitres, SVG textures) far more cheaply than drawing on a `<canvas>`. Images stay crisp at every zoom. |
| Animation | **Motion** (motion.dev, formerly Framer Motion) | Springs, layout animations, shared-element transitions (a frame expanding into the crop editor), and `MotionValue`s that update without React re-renders, which is what makes direct manipulation fast |
| Gestures | **@use-gesture/react** | One API for pointer drag, wheel, trackpad pinch and touch pinch, with momentum |
| State | **Zustand + immer**, **zundo** for undo/redo | Per-item selectors avoid re-rendering the whole wall; undo history is cheap |
| Styling / UI kit | **Tailwind CSS v4 + shadcn/ui (Radix primitives) + lucide-react icons** | Sleek, accessible panels, popovers, sliders and colour pickers |
| Colour picker | **react-colorful** | Tiny and works with touch |
| Persistence | **Dexie** (IndexedDB) | Stores wall documents and photo blobs; can save multi-GB |
| Image pipeline | **Web Worker + OffscreenCanvas + createImageBitmap**; **heic2any** loaded only when needed | Builds downscaled previews off the main thread; supports iPhone HEIC photos |
| File export | **fflate** (zip for `.wall`), **modern-screenshot** (PNG), **pdf-lib** (hanging guide and paper templates) | All run in the browser |
| PWA | **vite-plugin-pwa** | Install to desktop or dock; works offline |
| Tests | **Vitest** (geometry, snapping, crop math), **Playwright** (drag, resize, upload end-to-end) | |

---

## 2. Architecture

### 2.1 Coordinate system
- **World units are inches** (floats). Everything is stored in inches. cm exists only at display and input time (1 in = 2.54 cm), so switching units never loses precision.
- Camera: `{ x, y, zoom }`. Screen position = `(world − cam) × zoom × 96` (96 px per inch at 100%).
- The wall is a rectangle in world space starting at (0, 0), with y increasing downward. "Height from floor" is computed as `wall.height − y` for the hanging guide.

### 2.2 Render tree
```
<Viewport>                      ← pointer/wheel/pinch handlers, background dot grid
  <CameraLayer style=transform> ← ONE transform updated via ref/MotionValue (no React render on pan/zoom)
    <WallSurface/>              ← paint/texture/wallpaper/photo, baseboard, lighting overlay
    <FurnitureLayer/>           ← sofa/console/bed silhouettes for scale (non-hangable)
    <ItemLayer>                 ← <FrameItem/> × N (React.memo, subscribes to its own id only)
    <GuidesLayer/>              ← snap lines, spacing chips, eye-level line
  </CameraLayer>
  <SelectionOverlay/>           ← handles drawn in SCREEN space so they stay the same size at any zoom
  <Marquee/> <Minimap/> <ZoomControls/>
</Viewport>
<Toolbar/> <FramePalette/> <Inspector/> <WallPanel/> <LayersPanel/>
```

### 2.3 The "fluid like Canvas" mechanism (most important)
1. **Transient vs committed state.** During a drag or resize, the item's `x/y/w/h` live in Motion `MotionValue`s and are written directly to the DOM transform each frame. React does not re-render and the store does not change. On pointer-up, the final values are **committed** to the Zustand store in one transaction, which also creates one undo entry.
2. **Camera** pan/zoom writes one CSS `transform` on `CameraLayer` through a MotionValue. Zoom is centred on the cursor or pinch point, ranges from 5% to 800%, and wheel zoom is eased with a short spring. Trackpad two-finger scroll pans and pinch (ctrl+wheel) zooms, the same as Obsidian.
3. **Momentum:** releasing a pan with velocity continues it with inertial decay, like Obsidian.
4. `will-change: transform` is applied only while an item is moving, and pointer capture is used so drags never drop.
5. **Image level of detail:** each photo has previews at 512, 1024 and 2048 px. The frame chooses the smallest preview that is at least its on-screen size × devicePixelRatio, and swaps after the zoom settles.
6. Snapping and hit-testing use a simple spatial index (a uniform grid bucket), so each frame of a drag is O(nearby items).

### 2.4 State shape (TypeScript)
```ts
type Inches = number;

interface WallDoc {
  id: string; name: string; updatedAt: number;
  wall: { width: Inches; height: Inches; style: WallStyle; eyeLine: Inches | null /* default 57" from floor */ };
  items: Record<string, FrameItem>;
  order: string[];                       // z-order
  furniture: FurnitureItem[];
  prefs: { units: 'in' | 'cm'; snap: SnapPrefs };
}

interface FrameItem {
  id: string; name?: string; locked?: boolean;
  x: Inches; y: Inches;                  // outer top-left
  nominal: { w: Inches; h: Inches };     // "frame size" as sold (= artwork/glass size), what snapping targets
  style: FrameStyleRef;                  // style id + overrides (colour, moulding width, finish)
  mat: MatSpec | null;                   // width (uniform or bottom-weighted), colour, double mat, reveal
  content: SingleContent | GridContent;  // photo(s) inside the opening
  hanger: { kind: 'wire' | 'sawtooth' | 'd-rings'; dropFromTop: Inches; ringSpacing?: Inches };
  rotation?: 0 | 90;                     // portrait/landscape swap
}

interface PhotoPlacement {               // resolution-independent crop
  assetId: string;
  cx: number; cy: number;                // focal point in the image, normalised 0..1
  zoom: number;                          // ≥1, multiplier over "cover" fit
  rotate: 0 | 90 | 180 | 270; flipX?: boolean;
  tone?: 'none' | 'bw' | 'sepia' | 'warm';
}

interface GridContent {
  kind: 'grid';
  template: 'rows-cols' | 'custom';
  rows: number; cols: number; gutter: Inches; // gutter is shown as mat between cells
  cells: { id: string; rect: { x: number; y: number; w: number; h: number } /* normalised within the opening */; photo?: PhotoPlacement }[];
}
```
**Outer size is derived:** `outer = nominal + 2 × (moulding width − rabbet lip 0.25")`. Metal, acrylic and canvas prints have outer = nominal.

### 2.5 Photo crop math (`geometry/crop.ts`)
- For an opening with aspect `A` and an image with aspect `a`, the cover scale is `s = max(openW/imgW, openH/imgH) × zoom`.
- The image is translated so that the focal point `(cx, cy)` sits at the opening centre. That position is then clamped so the image always covers the opening (no gaps).
- Placement is stored as focal point + zoom, never as pixels. **Resizing the frame or changing its aspect re-runs the same function, so the photo rescales automatically** and keeps the chosen subject centred. The crop editor and the wall both use this one function, so the crop editor always matches what appears on the wall.

### 2.6 Persistence
- Dexie tables: `walls` (WallDoc JSON), `assets` (`{id, sha256, blob, w, h, mime, previews: {512,1024,2048}}`). Assets are deduplicated by hash.
- The wall autosaves 500 ms after each committed change (debounced). Image previews are cached as object URLs in an LRU.
- A `.wall` file is a zip containing `wall.json`, the original images and a `thumbnail.png`. Importing it restores everything.
- On first launch the app calls `navigator.storage.persist()` so the browser doesn't evict your photos.

---

## 3. Spec Sheet

### 3.1 Canvas interactions

| Action | Mouse / trackpad | Touch | Keys |
|---|---|---|---|
| Pan | Space + drag, middle-drag, two-finger scroll | Two-finger drag | Arrow keys with nothing selected |
| Zoom | Ctrl/⌘ + wheel, trackpad pinch | Pinch | `Ctrl +` / `Ctrl −`, `Shift+1` fit wall, `Shift+2` fit selection |
| New frame | Double-click empty wall (Obsidian-style); drag a size from the palette | Long-press empty wall | `F` |
| Select | Click; Shift-click to add; marquee drag on empty space | Tap; marquee with one finger on empty space after long-press | `Ctrl A`, `Esc` |
| Move | Drag (snaps) | Drag | Arrows ⅛", Shift+arrows 1" |
| Resize | 8 handles. Shift locks aspect. Alt resizes from centre. Ctrl/⌘ turns off snapping | Handles (44px touch targets) | Inspector fields |
| Duplicate | Alt-drag | — | `Ctrl D` |
| Rotate 90° (portrait/landscape) | Inspector button | — | `R` |
| Layers | Inspector / context menu | — | `]` `[` forward/back |
| Undo / redo | — | Three-finger tap / swipe | `Ctrl Z` / `Ctrl Shift Z` |
| Drop photo files | Onto empty wall creates a frame at the nearest preset for the image's aspect. Onto a frame or cell fills it. | Upload button | — |
| Context menu | Right-click: duplicate, lock, delete, style, crop, set as grid | Long-press on item | `Del` |

### 3.2 Snapping (`geometry/snapping.ts`)
Snap thresholds are **8 screen px** (converted to inches using the current zoom), so snapping feels the same at any zoom level.
1. **Real-world size presets** (resize): the nominal size snaps to the nearest preset in either orientation. A badge springs in showing *"11×14 · outer 12.5×15.5"*. Between presets, sizes snap to ¼" (or 0.5 cm).
   - **US (in):** 4×6, 5×5, 5×7, 6×8, 8×8, 8×10, 8.5×11, 9×12, 10×10, 11×14, 12×12, 12×16, 12×18, 16×16, 16×20, 18×24, 20×20, 20×24, 20×30, 24×30, 24×36, 30×40
   - **Metric (cm):** 10×15, 13×18, 15×20, 18×24, 20×20, 20×25, 21×29.7 (A4), 24×30, 30×30, 29.7×42 (A3), 30×40, 40×50, 42×59.4 (A2), 50×50, 50×70, 59.4×84.1 (A1), 61×91, 70×100
   - Metal print presets: 8×8, 8×10, 8×12, 10×10, 11×14, 12×12, 12×18, 16×20, 16×24, 20×30, 24×36, 30×40, 30×45
2. **Mat openings:** the mat opening snaps to standard sizes that fit inside the nominal size (an 11×14 frame offers 8×10 or 5×7 openings).
3. **Alignment** (move and resize): edges and centres snap to other frames' edges and centres, to the wall centre and to the eye-level line. Magenta guide lines are drawn.
4. **Equal spacing** (Figma-style): when the gap to a neighbour matches an existing gap, snap to it and show distance chips (*"2¼""*). This is how a chaos wall gets consistent gaps.
5. **Distance chips:** while dragging, the distance to the nearest neighbour on each side is shown live.

### 3.3 Frame styles (`frames/frameStyles.ts`, data-driven)
Each style is defined as data: profile, moulding width, depth, finish, default mat and glass. You can change colour and moulding width per frame. Mouldings are drawn as **four mitred sides using clip-path trapezoids**, so wood grain runs along each side and the corner mitres are visible.

| Style | Moulding | Look / animation |
|---|---|---|
| Modern Thin Black / White | 0.5"–0.75" flat | Matte; subtle bevel highlight |
| Gallery Black (deep) | 1" × 1.5" deep | Deeper drop shadow |
| Natural Oak / Walnut / Ash | 0.75"–1.25" | SVG feTurbulence wood-grain texture per side |
| Rounded Oak | 1" rounded profile | Radial-gradient profile shading |
| Gold Ornate | 2.5"–3.5" | SVG ornament plus a slow gold-leaf shimmer sweep on hover |
| Brushed Brass / Silver | 0.5"–1" | Anisotropic brushed gradient with a moving glint |
| Floating Frame (for canvas) | 0.4" with a 0.25" gap | Canvas floats inside with a shadow gap |
| Shadow Box | 1.5" deep | Inner shadow around the artwork |
| **Frameless Metal Print** | none, 1/16" radius corners | High-gloss specular highlight that follows the cursor or drag direction; 0.75" standoff shadow (float mount) |
| Acrylic Face-Mount | none | Glassy bevel edge refraction and a thick-edge highlight |
| Canvas Gallery Wrap | 1.5" depth | Visible side face (mirrored or colour edge) based on light angle |
| Poster Hanger | top/bottom wood rails | Slight sway on hover |
| Clip Frame / Borderless glass | none | Corner clips; glass glare |

**Global animations:** frames spring in when created; changing style morphs moulding width and colour with a 250 ms spring; snapping a size gives a small overshoot "thunk" and the badge pops; optional glass glare; shadows respond to the wall's light angle. Everything respects `prefers-reduced-motion` through `MotionConfig reducedMotion="user"`.

### 3.4 Mats
- Mats can be on or off. Width is uniform, or **bottom-weighted** (the bottom border is wider, a gallery convention).
- Colours: white, off-white, cream, black and custom. Optional double mat with a reveal (¼") and an accent colour.
- The mat window has a V-groove/bevel highlight line (light inner edge).

### 3.5 Picture grids inside a frame
- Templates: 1×2, 2×1, 2×2, 1×3, 3×1, 2×3, 3×3, plus **Custom**, where you drag dividers to split cells and merge cells.
- The gutter between cells is shown as mat (or as a black separator for frameless prints).
- Each cell has its own photo and its own crop. Cells reflow and photos re-cover automatically when the frame is resized.
- "Fill from folder" places multiple dropped photos into cells, in order.

### 3.6 Photos & crop editor
- Upload with the button, drag and drop, or paste (`Ctrl V`). Supported formats: JPEG, PNG, WebP, AVIF, HEIC.
- **Crop editor (modal):** the frame thumbnail expands into the editor through a Motion shared-layout transition. The editor shows the actual opening aspect with a rule-of-thirds overlay. You can drag to pan, use the wheel, pinch or a slider to zoom, rotate 90°, flip, and apply tone (B&W, sepia, warm).
  - "Fit frame to photo" button: changes the frame's nominal size to the preset closest to the photo's aspect.
  - **Print quality meter:** effective PPI = cropped pixels ÷ printed inches. ≥240 good, 150–240 OK, <150 warns. A small badge also appears on the frame on the wall.
- Resizing the frame on the wall keeps each crop's focal point and rescales the photo (see §2.5).

### 3.7 Wall styling
- Wall dimensions in in or cm (default 120" × 96"). Optional ceiling line, baseboard (height and colour) and floor strip.
- Background types:
  - **Paint:** curated swatches (warm white, greige, sage, navy, terracotta, charcoal…) plus a custom colour.
  - **Textures** (procedural SVG and noise, so no image downloads): plaster, limewash (subtle animated mottling), concrete, exposed brick, wood slat, board-and-batten, wainscoting, picture-rail moulding.
  - **Wallpaper:** stripes, grasscloth, geometric and botanical patterns, with a scale control.
  - **Photo of your real wall:** upload a photo, then **calibrate scale** by drawing a line over a known distance (for example a 30" console). Frames then render at true scale over your room.
- **Lighting:** colour temperature (2700K–6500K), intensity, light angle (which sets shadow direction) and an optional "picture light" or spotlight glow on selected frames.
- Wall style changes crossfade.

---

## 4. Extra Features I'm Adding

1. **Chaos auto-arrange ("Shuffle").** Packs the selected frames into a balanced salon cluster centred on the eye-level line (57") with a target gap (2–3"). It uses rectangle packing plus a balance score (visual weight per quadrant), and each press of Shuffle produces a new variation. Frames animate to their new positions with Motion layout springs. Grid, row and "anchor + satellites" modes are also included.
2. **Hanging guide.** For each frame, shows the nail position measured from the floor and from the left edge, adjusted for the hanger type (wire drop, sawtooth, or two D-ring nails with their spacing). It has an interactive "Hang mode" that highlights one frame at a time, and can be exported to PDF.
3. **1:1 paper templates.** Each frame outline is printed at true size, tiled across Letter or A4 pages, with the nail point marked. You tape these to the wall before drilling.
4. **Shopping list.** Totals of frame sizes × style, mat openings, metal print sizes and hardware count. Can be copied or exported.
5. **Furniture and fixtures for scale.** Sofa, console, bed, sideboard, TV, light switch and outlet silhouettes, with editable sizes. They snap to the floor line.
6. **Minimap** (bottom-right) and **zoom-to-fit**.
7. **Multiple walls / versions.** A gallery of saved walls with thumbnails; duplicate a wall to try variations.
8. **Export** a PNG at 1×, 2× or 4×, optionally with dimension annotations.

---

## 5. Project Structure (`C:\Projects\gallery-wall`)
```
docs/SPEC.md                    ← this plan, copied into the repo
src/
  main.tsx  App.tsx
  model/      types.ts  units.ts  sizePresets.ts  frameStyles.ts  wallStyles.ts  defaults.ts
  store/      wallStore.ts (zustand+immer+zundo)  uiStore.ts (selection, tool, camera)  db.ts (dexie)
  canvas/     Viewport.tsx  CameraLayer.tsx  WallSurface.tsx  ItemLayer.tsx  SelectionOverlay.tsx
              ResizeHandles.tsx  GuidesLayer.tsx  Marquee.tsx  Minimap.tsx  useCamera.ts  useItemGestures.ts
  geometry/   snapping.ts  spatialIndex.ts  crop.ts  arrange.ts  hanging.ts
  frames/     FrameItem.tsx  Moulding.tsx  Mat.tsx  PhotoCell.tsx  GridEditor.tsx  textures/*.svg.ts
              variants/ MetalPrint.tsx  CanvasWrap.tsx  Acrylic.tsx  PosterHanger.tsx
  photos/     assets.ts  imageWorker.ts  CropEditor.tsx  ingest.ts (drop/paste/HEIC)
  panels/     Toolbar.tsx  FramePalette.tsx  Inspector/*.tsx  WallPanel.tsx  LayersPanel.tsx  WallsGallery.tsx
  export/     wallFile.ts  exportPng.ts  hangingGuidePdf.ts  paperTemplatesPdf.ts  shoppingList.ts
  components/ui/  (shadcn)
tests/unit/*.test.ts   tests/e2e/*.spec.ts
```

---

## 6. Implementation Milestones

| # | Milestone | Done when |
|---|---|---|
| 0 | Install Node 22 + pnpm; scaffold Vite/React/TS/Tailwind/shadcn; copy spec to `docs/SPEC.md`; init git | `pnpm dev` serves an empty shell |
| 1 | **Canvas core:** camera pan/zoom/momentum, wall rectangle, frames as plain rectangles, create (double-click or palette), select, marquee, move, resize, undo/redo, Dexie autosave | Dragging 50 frames stays at 60fps; matches the Obsidian Canvas feel |
| 2 | **Snapping:** size presets with badge, ¼" increments, alignment guides, equal spacing, distance chips, in/cm toggle | Unit tests for snapping pass; guides render correctly |
| 3 | **Frame styles and mats:** mitred moulding renderer, all styles in §3.3, mat options, shadows, style-change animations, Inspector | Every style renders at 25%–400% zoom without artefacts |
| 4 | **Photos:** ingest (drop/paste/upload/HEIC), worker previews and LOD, crop editor with shared-element transition, auto-rescale on resize, PPI meter | Resizing a frame keeps its crop focal point (unit and e2e tests) |
| 5 | **Picture grids:** templates, custom split and merge, per-cell crop, multi-drop fill | |
| 6 | **Wall styling:** paint, textures, wallpaper, wall photo with scale calibration, baseboard, lighting, furniture | |
| 7 | **Extras:** auto-arrange, hanging guide and Hang mode, paper template PDF, shopping list, PNG export, `.wall` import/export, wall gallery, minimap, PWA | |
| 8 | **Polish:** touch QA on iPad, keyboard shortcut sheet (`?`), reduced motion, empty states and onboarding hints | |

---

## 7. Performance & Quality Targets
- 60fps pan, zoom, drag and resize with 60 frames on screen (mid-range laptop, Chrome/Edge/Safari).
- Pointer-to-paint latency under 16 ms during manipulation (no React renders in the hot path).
- Ingesting a 24 MP photo produces previews within 1.5 s, without blocking the UI (runs in a worker).
- Sizes are precise to 1/16" internally; the UI displays to ⅛" or 1 mm.
- Accessibility: all panels keyboard-navigable (Radix); frames can be focused, moved with arrow keys and are announced by screen readers ("Oak frame 11 by 14, 3 inches from left").

---

## 8. Verification
- **Unit tests (Vitest):** `snapping.ts` (preset choice, orientation, zoom-scaled thresholds, equal spacing), `crop.ts` (cover clamping, focal point kept across aspect changes), `units.ts`, `arrange.ts` (no overlaps, gap respected), `hanging.ts` (nail positions for each hanger type).
- **E2E (Playwright):** create a frame by double-click → drag → resize to snap at 11×14 → upload a fixture photo → crop → resize the frame → assert the photo still covers the opening; undo/redo; reload and confirm persistence; `.wall` export → import round-trip.
- **Manual check in the app's built-in browser pane** (`preview_start` against `pnpm dev`): screenshots of each frame style and wall texture; touch mode checked with mobile/tablet viewport emulation; frame rate measured with the Chrome performance panel during a 50-frame drag.
- Each milestone ends with a demo checkpoint before starting the next one.

---

## 9. Implementation status (first build, 2026-10-19)

**Built and checked in the browser:** canvas pan/zoom/momentum/pinch, create (double-click, F, palette drag), select/marquee, move, resize with preset snapping (US, metric, metal), ¼″ steps, alignment guides, equal-spacing and distance chips, Alt-drag duplicate, undo/redo, autosave to IndexedDB, all 19 frame styles with mitred mouldings, mats (border, fixed opening, bottom weight, double), picture grids with draggable dividers, photo ingest (worker previews, HEIC fallback, dedupe), crop editor (pan/zoom/rotate/flip/tone, PPI meter), fit frame to photo, wall paint/12 finishes/lighting/baseboard/floor, wall photo + scale calibration, furniture, salon/grid/row auto-arrange, hang mode, PDF hanging guide, 1:1 paper templates, PNG export, .wall import/export, wall gallery, shopping list, minimap, context menu, shortcuts, PWA manifest + service worker. 27 unit tests pass.

**Differences from the plan:**
- Node 24 LTS / npm (winget's current LTS; pnpm via corepack needed admin), Vite 8, TypeScript 7, Motion 14.
- Gestures are a custom pointer state machine (no @use-gesture), undo is a small snapshot stack (no zundo), and UI uses Radix + Tailwind directly (no shadcn CLI).
- Live drag/resize write to per-item Motion values via a registry; the document is committed once on release.
- Procedural (SVG-filter) textures are pre-rendered to PNG once, for paint speed and so exports render correctly.

**Not done yet:**
- Playwright end-to-end tests (not set up; verification so far is unit tests + manual checks in the browser).
- Merging grid cells (dividers can be dragged; cells can't be merged).
- 60 fps target not measured on real hardware. The in-app browser pane throttles animation frames while hidden, so frame-rate numbers from it weren't meaningful.
