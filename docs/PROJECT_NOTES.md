# Star Climber — Project Notes

High-level context for picking up this project. Read this before diving into
specs/plans in `docs/superpowers/`.

## The big idea

Star Climber is meant to give players an intuitive sense of the size of the
universe by starting small and zooming out by orders of magnitude:

1. **Climb a true-to-scale Mount Everest** (8,849m) — the human-scale starting point.
2. **Reach the summit and "launch"** — fly out and look back to see the mountain
   shrink to nothing against the Earth.
3. **See the whole Earth** (radius 6,371,000m) from orbit — the next order-of-magnitude jump.
4. (Beyond that: presumably the solar system, galaxy, etc., though those phases
   haven't been designed yet.)

The detail level is intentionally shallow: no centimeter-level detail of the
whole Earth is needed, and we explicitly want to avoid building multiple levels
of detail (LOD). One true-scale local scene + one Earth sphere is the target
architecture — see "Core technical decision" below.

## Core technical decision: one true-scale coordinate space

Early design discussion considered a "floating origin" / scaled-space approach
(common in space games to deal with float precision at planetary scales) but
**rejected it as unnecessary** for this game. Reasoning:

- Three.js computes the model-view matrix in float64 on the CPU and only
  downcasts to float32 for the GPU — objects render precisely whenever the
  camera is near them, and lose precision only when far away (which is when you
  can't see the error anyway).
- **Placing the world origin at the base of the mountain** (not Earth's center)
  keeps every coordinate the player interacts with under ~10,000 — comfortably
  within float32's sub-millimeter precision range.
- The **logarithmic depth buffer** (`gl={{ logarithmicDepthBuffer: true }}`) is
  the one non-negotiable setting — without it, rendering both nearby terrain and
  a 12,700km-wide planet in the same frame causes catastrophic z-fighting.

This means: **no floating origin, no LOD hierarchy, no scaled space.** Just one
real-meters coordinate system, origin at the mountain's base, Y-up, with a wide
`near`/`far` camera range and the log depth buffer turned on.

## Planned scene layout (from the original design discussion)

- **Origin `(0,0,0)`** = base of Everest
- **Everest**: true-scale mesh (~8,849m tall) with a physics collider
- **Meadow**: a small local ground patch (~2km) + instanced trees, for near-camera detail
- **Earth**: a single `SphereGeometry`, radius 6,371,000m, centered at
  `(0, -6371000, 0)` so its surface meets the mountain's base. Visual only —
  textured, **no physics collider**. You only ever see it from far away, so its
  ~0.5m vertex quantization is invisible.
- **Two modes** in a small state machine (zustand recommended): "climb" (Rapier
  physics on, gravity `[0,-9.81,0]`, kinematic capsule character) and "flight"
  (physics off, camera driven directly, free-fly outward from the summit)

None of the Earth sphere, physics, character, or mode-switching exists yet —
they're the natural next milestones.

## What's been built so far (Milestone 1)

A throwaway visual scaffold proving the core technical decision above actually
works. See `docs/superpowers/specs/2026-06-07-everest-milestone1-design.md` and
`docs/superpowers/plans/2026-06-07-everest-milestone1.md` for the full spec/plan.

- `src/scene/Mountain.tsx` — placeholder `ConeGeometry`, height 8849m, base
  radius 10000m, positioned with its base circle at y=0
- `src/scene/Scene.tsx` — the `<Canvas>` (with `near: 0.1`, `far: 5e7`,
  `logarithmicDepthBuffer: true`), lighting, the mountain, and drei's
  `<OrbitControls>`
- `src/App.tsx` — now just renders `<Scene />`
- Removed all of the Vite/React starter template's UI, CSS, and assets (they
  conflicted with a full-viewport 3D canvas — see gotchas below)

**Verified manually:** orbiting and zooming the cone from close range to far
away shows no z-fighting/flickering/swimming — the true-scale + log-depth-buffer
approach is sound.

## Gotchas hit during Milestone 1 (useful for next phases)

1. **Camera placement must respect true-scale geometry.** The first camera
   position (`[0, 200, 600]`) put the camera *inside* the mountain's
   10,000m-radius base, producing a screen full of a single shaded face with no
   recognizable shape. True-scale scenes need camera distances that make sense
   relative to object size — always sanity-check "is the camera outside the
   thing it's looking at?" Final working position: `[0, 6000, 30000]` looking at
   target `[0, 3000, 0]`.

2. **The Vite/React starter template's CSS actively fights a full-viewport 3D
   canvas.** `#root` had a fixed `width: 1126px`, centered with
   `border-inline: 1px solid var(--border)` — this clipped/offset the canvas and
   showed up as two mysterious vertical lines on screen. We replaced all of
   `index.css` with a minimal full-viewport reset (`#root { width: 100vw; height:
   100vh }`, `body { margin: 0 }`, `:root { color-scheme: dark }`) and deleted
   `App.css` and the starter's logo/hero/icon assets entirely (verify nothing
   references a file before deleting — `grep -rl <name> src/ public/ index.html`).

3. **Faceted/"pyramid-like" appearance is normal low-poly shading, not a
   precision bug.** `coneGeometry`'s third argument is the radial segment count
   (currently `32`); a low count produces visible flat faces whose shading shifts
   as you orbit relative to the light — this is ordinary per-face Lambertian
   shading, not z-fighting or float jitter. Real precision artifacts look like
   *flickering/swimming/popping geometry*, not just faceted shading. Bump the
   segment count (e.g. 64–128) in `src/scene/Mountain.tsx` if a smoother
   silhouette is wanted — purely cosmetic, not architectural.

4. **No headless browser available in this environment** (sandbox blocks
   installing Playwright/Chromium). Visual verification of R3F scenes currently
   requires the human to open `pnpm dev`'s URL and look — factor this into how
   you plan verification steps for visual milestones.

## Suggested next milestones

Roughly in order of dependency:

1. **Earth sphere** — add the textured `SphereGeometry` beneath the mountain;
   validates the "look out and see the whole Earth" payoff visually before any
   gameplay is built on top.
2. **Rapier physics + walkable character** — install `@react-three/rapier`, give
   the mountain a collider (heightfield or trimesh once it's not just a cone),
   and add a kinematic-capsule character controller for climbing.
3. **Mode-switching state machine** — zustand store toggling between "climb"
   (physics-driven) and "flight" (camera-driven free-fly), triggered at the summit.
4. **Replace the placeholder cone** with a real heightmap-based Everest mesh
   once the surrounding architecture (physics, camera, modes) is proven out.

## Useful repo context

- Stack: Vite + React 19 + TypeScript, package manager `pnpm`
- 3D stack added in Milestone 1: `three`, `@react-three/fiber`,
  `@react-three/drei` (Rapier not yet installed)
- No automated test suite exists (`pnpm build` / `pnpm lint` are the available
  sanity checks; visual work needs manual verification — see gotcha #4)
- Git repo was initialized as part of Milestone 1 (it didn't exist before);
  all work so far is directly on `master`
