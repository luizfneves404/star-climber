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

## Core technical decision: discrete normalized tiers (SUPERSEDES the old single-space plan)

> **Pivot (Milestone 3).** An earlier version of this section argued for **one
> true-scale meter coordinate space, no scaled space**. That was correct for
> *Earth alone*, but it provably cannot reach the outer tiers (solar system →
> galaxy → universe spans ~27 orders of magnitude; float32 holds ~7). We have
> **deliberately pivoted** to a discrete, individually-normalized **tier system**
> with a seamless cross-fade handoff between tiers. **Do not "simplify" back to a
> single coordinate space.**

The mechanism is the heart of the project and is documented in full — with its
load-bearing invariants — in **[`docs/tier-system.md`](./tier-system.md). Read
that before touching any scale/zoom/camera code.** In short:

- Each tier is its own scene, normalized so **Earth's radius = 1 canonical unit**
  (`canonScale = metersPerUnit / EARTH_RADIUS_M`). This makes one camera/dolly
  drive every tier, and makes the seam between tiers invisible.
- The **logarithmic depth buffer** (`gl={{ logarithmicDepthBuffer: true }}`)
  remains non-negotiable.
- The Earth↔Solar handoff is built and the seam is **verified seamless**.

The "world origin at the mountain base" idea from the old plan is gone — the
origin is now **Earth's center**, the camera orbits it, and **panning is disabled**
(panning breaks the seam math — see the invariants doc).

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

## What's been built so far (Milestone 2)

The Earth sphere — the next milestone suggested below, validating the
highest remaining technical risk: rendering a ~10km mountain and a
~12,742km planet together in one true-scale coordinate space. See
`docs/superpowers/specs/2026-06-07-earth-sphere-design.md` and
`docs/superpowers/plans/2026-06-07-earth-sphere.md` for the full spec/plan.

- `src/scene/Earth.tsx` — textured `SphereGeometry`, true Earth radius
  (6,371,000m), 64x64 segments, positioned at `(0, -6371000, 0)` so its
  surface meets the mountain's base at the world origin. Visual only, no
  physics collider.
- `public/textures/earth_daymap.jpg` — 2k Earth daymap texture (CC-BY 4.0,
  Solar System Scope, obtained via Wikimedia Commons)
- `src/scene/Scene.tsx` — now also renders `<Earth />` alongside `<Mountain />`

**Verified manually:** orbiting and zooming continuously from the mountain's
base out to a whole-Earth view shows no z-fighting/flickering/swimming — the
true-scale + log-depth-buffer approach holds at planetary scale.

## What's been built so far (Milestone 3 — the tier system)

The seamless multi-scale zoom — the project's load-bearing mechanism. Full
details and **invariants** in [`docs/tier-system.md`](./tier-system.md).

- `src/scale/constants.ts` — physical constants, the canonical-space math
  (`canonScale`, `dc`↔meters), seam/fade thresholds, dolly limits, and
  `latLonToUnitVector` (places Everest at its real coordinates: 27.986065,
  86.922623).
- `src/scale/store.ts` — the `ScaleManager` (zustand): `dc`, `tier`,
  `transition`, HUD readouts.
- `src/scene/Tier.tsx` — wraps a tier, applies its canonical scale, cross-fades
  opacity at the seam.
- `src/scene/Earth.tsx` — `EarthGlobe` reused by both tiers at their own scale.
- `src/scene/SolarSystem.tsx` — Solar tier (1 unit = 1000 km): Earth-dot, Moon,
  Sun at 1 AU.
- `src/scene/ScaleTracker.tsx` — feeds the store from the live camera distance.
- `src/ui/Hud.tsx` — tier / altitude / "1 px ≈ X km" overlay.
- `src/scene/Scene.tsx` — two `<Tier>`s, one camera orbiting Earth's center,
  **panning disabled** (invariant).
- Added `zustand`.

**Verified manually:** zooming out from Everest past ~25,000 km hands off
Earth→Solar with no visible pop, and the round-trip back is smooth. Seam
confirmed seamless.

## Suggested next milestones

Roughly in order of dependency:

1. ~~**Earth sphere**~~ — done, see Milestone 2 above.
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
