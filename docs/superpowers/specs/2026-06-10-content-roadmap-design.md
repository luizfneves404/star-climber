# Content Roadmap — Design

## Goal

Decide the approach for every item on the README's "what's next" list — Everest
mesh, textured ground, ground landmarks, space content, HUD markers, and
fly-to — so each later milestone can go straight to an implementation plan.
The guiding constraint throughout: err on the side of simplicity. This spec
records decisions, not implementation detail; each numbered milestone gets its
own design/plan when it's built.

## Content organization: no registry

A data-driven "content registry" (entries with declarative render specs,
interpreted by a generic renderer) was considered and rejected. R3F JSX is
already a declarative content description language — `{ kind: "sphere",
texture }` interpreted by a switch is strictly worse than `<TexturedSphere />`
(same information, minus type-checked props and composition). And the
interesting content (terrain, star clouds, galaxy) would all need a
component escape hatch anyway; when most entries need the escape hatch, the
abstraction has failed.

Instead, content is organized as ordinary code:

- Plain data arrays (`PLANETS`, `LANDMARKS`, …) live next to the components
  that render them and are mapped in ordinary JSX, so homogeneous content is
  still a one-line addition.
- `Markers.tsx` splits into a few focused files (`SolarSystem.tsx`,
  `EverestSite.tsx`, …) when it grows. Boring modularity, no framework.
- HUD and fly-to both need to enumerate notable bodies
  (`{ name, position, radius, viewpoint }`). That small shared shape is
  formalized when the HUD is built (milestone 5) — sized by actual need, not
  speculation.
- The decoupling that matters already exists and must be preserved: content
  never touches `FloatingGroup` / `PlayerRig` / camera logic. Adding content
  must not modify logic files.

## Milestone 1: Textured ground

Keep the existing 60 km flat plane in `Markers.tsx`. Replace the solid color
with a seamless tiling texture (`RepeatWrapping`, high repeat count) so flying
up gives a sense of height. Known artifact: visible tiling from altitude; if
it bothers, the cheap fix is sampling the same texture at a second, much
larger scale and multiplying. A material-only change — no new logic.

## Milestone 2: Everest DEM mesh (diorama style)

Replace the placeholder cone with a real-data Everest:

- **Data**: clip ~30×30 km of Copernicus GLO-30 (30 m DEM; better Himalaya
  coverage than SRTM) around the summit into a 16-bit PNG heightmap. One-time
  offline step (OpenTopography download or a small GDAL script kept in the
  repo); the PNG lives in `public/`.
- **Mesh**: at load, displace a flat ~512² grid (~500 k tris) by the
  heightmap. Flat, not curved — it sits on the flat ground plane like the
  cone does today.
- **Diorama edge treatment**: real terrain around Everest sits at 4–5 km
  elevation, so a raw patch on a sea-level plane has 4 km cliffs at its
  edges. Subtract the base elevation and feather patch borders to zero so the
  massif rises out of the flat ground like a museum model, true-scale summit
  height preserved.
- **Coloring**: elevation-based vertex colors (snow above ~6,000 m, rock
  below). No satellite imagery, no custom shaders.
- **Not doing**: curvature, LOD, runtime height queries (`heightAt`). The
  player start and landmarks stay on the flat ground beside the massif.

`Mountain.tsx` becomes the DEM mesh component; `everestSite.ts` layout points
are unchanged.

## Milestone 3: Ground landmarks

A size-comparison exhibit on the flat ground near the player start, driven by
a `LANDMARKS` data array:

- Generic structures (building, bus, …): plain boxes with true dimensions.
- Burj Khalifa: code-built primitive stack (3–4 tapered boxes/cylinders) —
  the silhouette is the landmark.
- Human and blue whale: CC0 low-poly glTF models (Quaternius / Kenney /
  Poly Haven), licenses recorded in `ATTRIBUTION.md`.

## Milestone 4: Space content

Layered, mostly-real point clouds. Nobody renders "billions of stars" — real
per-star data only exists for our stellar neighborhood, so the standard
approach (Gaia Sky, Space Engine) is catalog stars near, hand-drawn galaxy
far:

| Layer | Data | Rendering |
|---|---|---|
| Solar system | real distances, fixed epoch | textured spheres mapped from a `PLANETS` array (Solar System Scope texture pack, same CC-BY as the Earth daymap) |
| Stars | HYG catalog (~120 k real stars: positions, magnitudes, colors, names; few-MB CSV preprocessed to a binary buffer) | **one** `THREE.Points` cloud with a single float64 anchor at the Sun; point brightness/size from magnitude |
| Milky Way | artificial particle cloud: ~100 k particles generated at load from a spiral density function (arms + central bulge + thin disk) | one more Points cloud; optional later polish: additive core-glow sprite |
| Outer galaxies | real catalog (~30 k brightest galaxies from a redshift survey) — superclusters emerge for free from real positions | second Points cloud |

- **Transitions**: catalog stars genuinely shrink into a clump as you fly
  out; the artificial galaxy fades in via distance-from-Sun-driven opacity
  (a per-frame uniform). No tiers, no cross-fade canvases — one continuous
  scene.
- **Floating origin preserved**: one float64 subtract per *cloud anchor* per
  frame, not per star. Float32 error within a cloud is invisible at the view
  scales where the cloud is on screen.
- **No LOD**: point counts in the 100 k range don't need it.
- **Objective perf gate**: before adding layers, add a frame-time probe to
  `window.__debug` (N-frame average, readable via Playwright). Every layer
  lands with a measured FPS cost.

## Milestone 5: HUD markers

- Bodies visible in the viewport get a screen-projected label with name and
  live distance.
- A side panel lists all HUD-enabled bodies with live distances and toggle
  checkboxes — the panel is how off-screen bodies are discovered. No edge
  arrows (fly-to is the real "take me there" answer).
- The shared bodies list (`{ name, position, radius, viewpoint }`) is
  formalized here, consumed by HUD, fly-to, and `__debug.viewpoints`.

## Milestone 6: Fly-to

- **Motion**: log-distance glide — interpolate distance-to-target in log
  space so each order of magnitude takes equal time (~1 s per decade, total
  clamped to ~3–10 s) while the camera slerps to face the target. Straight
  path. This is the Google-Earth zoom feel and doubles as the
  scale-of-the-universe storytelling device.
- **Targets**: auto-derived viewpoints ("stand at k × radius away, look at
  center") with optional hand-authored overrides (e.g. "above the galaxy",
  "Everest base looking up").
- **Trigger / cancel**: click a body in the HUD panel; any movement input
  cancels the glide.

## Build order

Each step independently shippable, in this order:

1. Ground texture
2. Everest DEM mesh
3. Landmarks
4. `__debug` frame-time probe → solar system → stars → galaxy → outer galaxies
5. HUD panel + labels
6. Fly-to

## Out of scope (decided against)

- Content registry / generic content renderer (see above)
- Physics (decided previously; flying is the game)
- Orbital motion / ephemerides — positions are static at a fixed epoch
- Terrain LOD, curved terrain, satellite imagery, runtime height queries
- Gaia-scale star data (HYG is enough; it's the actual night sky)
