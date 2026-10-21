# Gallery Wall

Plan a gallery ("chaos") wall before you put a single nail in. Drag, drop and resize real-world frame sizes on an infinite canvas that feels like Obsidian Canvas, style frames and the wall, drop in your own photos, then export nail positions and 1:1 paper templates.

Everything is stored locally in your browser (IndexedDB). Nothing is uploaded anywhere.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (snapping, crop math, arrange, hanging, units)
npm run build      # production build in dist/ (installable PWA)
```

Requires Node 20+.

## Using it

| Action | How |
|---|---|
| Pan | Space + drag, middle mouse, two-finger scroll, or one finger on touch |
| Zoom | Ctrl/⌘ + scroll, pinch, or the +/- controls |
| New frame | Double-click the wall, press **F**, or drag a size tile from the left panel |
| Resize | Drag a handle. Sizes snap to real frame sizes (11×14, A3, …); **Shift** keeps aspect, **Alt** resizes from centre, **Ctrl** disables snapping |
| Add photos | Drop image files on a frame (or a grid cell), on empty wall to create frames, or paste with Ctrl V |
| Crop | Double-click a photo: drag to reposition, scroll/pinch to zoom, rotate, flip, B&W/sepia |
| Picture grid | Inspector → Layout (2×2, 1×3, …); drag dividers for uneven cells |
| Arrange | Toolbar → Arrange → Salon shuffle / Grid / Row |
| Hang | Toolbar ruler icon: step through frames with nail heights; export PDF guide and 1:1 templates |

Press **?** in the app for all shortcuts.

## Project layout

```
src/model      types, units, size presets, frame & wall styles
src/geometry   snapping, crop model, auto-arrange, hanging maths (pure, unit-tested)
src/store      document store with undo/redo, UI store, camera, IndexedDB persistence
src/canvas     viewport (pan/zoom/drag/resize state machine), items, wall, guides
src/frames     frame renderer (mitred mouldings, mats, metal/acrylic/canvas variants), textures
src/photos     photo ingest worker, LOD object URLs, crop editor
src/panels     toolbar, left panel, inspector, modals, hang mode
src/export     PNG, PDF hanging guide, paper templates, .wall files, shopping list
```

See [docs/SPEC.md](docs/SPEC.md) for the full technical plan and spec sheet.
