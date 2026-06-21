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
  coverage than SRTM) around the summit into a raw 16-bit binary heightmap
  (`.bin`, not PNG — browser canvas decodes PNG at 8 bits, so a raw uint16
  buffer is needed for exact meter values). One-time offline step
  (OpenTopography download or a small GDAL script kept in the repo); the
  `.bin` file lives in `public/`.
- **Mesh**: at load, displace a flat ~512² grid (~500 k tris) by the
  heightmap. Flat, not curved — it sits on the flat ground plane like the
  cone does today.
- **Diorama edge treatment**: real terrain around Everest sits at 4–5 km
  elevation, so a raw patch on a sea-level plane has 4 km cliffs at its
  edges. Heights stay true elevation above the sea-level ground plane (the
  plane being sea level is geographically honest, and the summit lands at its
  real height); only the patch borders feather to zero so the massif rises
  out of the flat ground like a museum model. Site clearance moves to 17.5 km
  east of the patch center so the player/box area clears the 15 km patch
  half-extent.
- **Coloring**: elevation-based vertex colors (snow above ~6,000 m, rock
  below). No satellite imagery, no custom shaders.
- **Not doing**: curvature, LOD, runtime height queries (`heightAt`). The
  player start and landmarks stay on the flat ground beside the massif.

`Mountain.tsx` becomes the DEM mesh component; `everestSite.ts` keeps the same
layout-point structure (cone-era names become `TERRAIN_CENTER`/`SUMMIT`).

## Milestone 3: Ground landmarks

A size-comparison exhibit on the flat ground near the player start, driven by
a `LANDMARKS` data array:

- Generic structures (building, bus, …): plain boxes with true dimensions.
- Burj Khalifa: code-built primitive stack (3–4 tapered boxes/cylinders) —
  the silhouette is the landmark.
- Human and blue whale: CC0 low-poly glTF models (Quaternius / Kenney /
  Poly Haven), licenses recorded in `ATTRIBUTION.md`.

## Milestone 4: Space content

Layered point clouds: real per-star/-galaxy data where it exists, procedural
star clouds where it doesn't. Real per-star data only covers our stellar
neighborhood, so the standard approach (Gaia Sky, Space Engine) is catalog
stars near, invented galaxy stars far. We already invent the Milky Way's bulk
stars from a density function — so the same generator, reused, lets a handful
of **nearby galaxies resolve from fuzzy blobs into fields of individual stars
as you fly to them**, which is the headline payoff of this milestone.

| Layer | Data | Rendering |
|---|---|---|
| Solar system | real distances, fixed epoch | textured spheres mapped from a `PLANETS` array (Solar System Scope texture pack, same CC-BY as the Earth daymap) |
| Stars | HYG catalog (~120 k real stars: positions, magnitudes, colors, names; few-MB CSV preprocessed to a binary buffer) | **one** `THREE.Points` cloud with a single float64 anchor at the Sun; point brightness/size from magnitude |
| Milky Way | procedural: ~100 k particles from a spiral density function (arms + central bulge + thin disk) | the first instance of the shared `makeGalaxy()` generator; additive core-glow sprite for the bulge |
| Local Group / hero galaxies | ~8–12 real, named galaxies (M31 Andromeda, M33 Triangulum, LMC, SMC, M51 Whirlpool, M104 Sombrero, M81, M101 Pinwheel) at real position/size/inclination; **stars are procedural** (no per-star data exists for them) | more `makeGalaxy()` instances, one float64 anchor each; always-on Points cloud + glow sprite, no distance swap in v1 |
| Outer galaxies | real catalog (~30 k brightest galaxies from a redshift survey) — superclusters emerge for free from real positions; **hero galaxies excluded** to avoid double-rendering | one Points cloud, the cosmic-web backdrop |

- **`makeGalaxy()` — the shared generator**: `makeGalaxy({ type, radius,
  particleCount, palette, inclination, positionAngle, anchor, seed }) →
  THREE.Points`. The Milky Way is just its first instance; there is no
  special-case Milky-Way path. Three density functions cover the morphologies
  — **spiral** (arms + bulge + thin disk), **elliptical** (smooth radial
  falloff), **irregular** (lumpy blob, for the Magellanic Clouds) — picked by
  `type`. A **seeded PRNG per galaxy** keeps each cloud stable across reloads.
  **Color by stellar population** inside the density function (bluer arms,
  yellow-red bulge) does most of the "looks like a galaxy" work for free.
  Recognition comes from real position + overall shape + tilt, *not*
  photographic detail — explicitly no dust lanes, HII regions, or tidal tails.
  Not a morphology framework: three functions and a param struct, full stop.
- **Why only ~10 hero galaxies, not the whole universe**: the bottleneck is
  storage, not frame rate. ~2 trillion galaxies / ~10²² stars cannot be held
  in GPU memory (even galaxies-as-points would be ~24 TB); a true procedural
  universe must *store nothing* and generate-on-demand with chunk streaming and
  impostor LOD cascades — a whole engine, and one that would only invent
  fictional galaxies you can't fly into. Beyond a certain distance a procedural
  galaxy is indistinguishable from a catalog blob, and the catalog blobs have
  the advantage of being *real*. So: invent stars only where you can actually
  fly in and see them; use real blobs for everything else.
- **Transitions**: catalog stars genuinely shrink into a clump as you fly out;
  the Milky-Way cloud fades in via distance-from-Sun-driven opacity (a per-frame
  uniform). No tiers, no cross-fade canvases — one continuous scene. Hero
  galaxies are always-on in v1 (their additive points overlap into a smudge
  from far, the sprite supplies the glow); the **fallback** if overdraw is too
  costly is a distance-driven sprite↔cloud crossfade reusing that same uniform.
- **Floating origin preserved**: one float64 subtract per *cloud/galaxy anchor*
  per frame, not per star. Within a galaxy, stars are light-years apart, so
  float32-relative positions resolve them — float32 error is invisible at the
  view scales where a cloud is on screen.
- **No LOD**: point counts in the 100 k range (and ~10 of them) don't need it —
  but this is the one place perf can bite (overdraw when zoomed out).
- **Objective perf gate**: before adding layers, add a frame-time probe to
  `window.__debug` (N-frame average, readable via Playwright). Every layer —
  and every hero galaxy — lands with a measured FPS cost.
- **Shared body shape**: hero galaxies carry the same
  `{ name, position, radius, viewpoint }` shape the HUD (milestone 5) and
  fly-to (milestone 6) consume, so "fly to Andromeda" works for free. Size that
  shape with galaxies in mind when it's formalized.

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
4. `__debug` frame-time probe → solar system → stars → Milky Way (via
   `makeGalaxy()`) → hero galaxies (Andromeda first to prove the generator +
   transition, then the rest) → outer-galaxy catalog
5. HUD panel + labels
6. Fly-to

## Out of scope (decided against)

- Content registry / generic content renderer (see above)
- Physics (decided previously; flying is the game)
- Orbital motion / ephemerides — positions are static at a fixed epoch
- Terrain LOD, curved terrain, satellite imagery, runtime height queries
- Gaia-scale star data (HYG is enough; it's the actual night sky)
- A full procedural universe (generate-on-demand all ~2 trillion galaxies with
  chunk streaming / impostor LOD) — storage makes a stored version impossible
  and the on-demand version is a whole engine that only invents galaxies you
  can't fly into. Hero galaxies get procedural *stars* near; real catalog blobs
  cover the rest. Procedural galaxies are deliberately impressionistic — no
  photographic morphology, dust lanes, or tidal tails — not real per-star
  catalogs.
