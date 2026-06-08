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
origin is now **Earth's center**. A free-fly player camera (Milestone 4) moves
through Earth-centered meter space and drives the zoom; there is no orbit camera
and no panning. `dc` is simply the camera's distance from Earth's center, so
re-basing that origin would break the seam math — see the invariants doc.

## Planned scene layout (from the original design discussion)

> **Partly superseded.** This is the *original* sketch. The coordinate decisions
> below (origin at the mountain base, Earth centered at `(0,-6371000,0)`) were
> replaced by the tier system: the origin is **Earth's center**, Earth sits at the
> tier origin, and Everest is placed at its **real lat/lon** on the sphere via
> `latLonToUnitVector` (see `src/scene/Mountain.tsx`). The non-coordinate ideas
> here (meadow/trees, physics collider, climb/flight modes) are still unbuilt and
> still roughly the plan.

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
  `<OrbitControls>` *(OrbitControls later replaced by the free-fly `PlayerRig` in
  Milestone 4; Scene is now a two-layer setup — see below)*
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
  *(Removed in Milestone 4 — its job moved into `PlayerRig`, the single writer
  of `dc`.)*
- `src/ui/Hud.tsx` — tier / altitude / "1 px ≈ X km" overlay.
- `src/scene/Scene.tsx` — two `<Tier>`s, one camera orbiting Earth's center,
  **panning disabled** (invariant). *(The orbit camera was replaced by the
  free-fly `PlayerRig` in Milestone 4.)*
- Added `zustand`.

**Verified manually:** zooming out from Everest past ~25,000 km hands off
Earth→Solar with no visible pop, and the round-trip back is smooth. Seam
confirmed seamless.

## What's been built so far (Milestone 4 — free-fly player bridge)

The orbit camera is gone; you now **fly the scene yourself** in real meters. This
spike de-risked the eventual physics player by proving its hardest sub-problem in
isolation: a free, meter-space camera — decoupled from the Earth-center orbit the
tier system was built around — still drives the seamless tier swap. Physics
(Rapier), gravity, and collision are deliberately **out of scope** (a separate,
more-known risk). See `docs/superpowers/specs/2026-06-07-free-fly-player-bridge-design.md`
and `docs/superpowers/plans/2026-06-07-free-fly-player-bridge.md`.

- `src/player/playerStore.ts` — the **source of truth**: player `position`
  (Earth-centered meters, float64 — the representation Rapier plugs into later)
  and `orientation`, both mutated in place each frame, plus a manual `speed`
  (m/s) set by the scroll wheel. Starts on Everest's summit at its real lat/lon.
- `src/player/freeFlyControls.ts` — input hook: pointer-lock mouse-look (click to
  capture, Esc releases), WASD/QE (+Space/Ctrl) movement, wheel = multiplicative
  speed. Exposes `isDown`/`consumeLook`; all mutable input lives in a ref, never
  touched during render.
- `src/player/PlayerRig.tsx` — the bridge and the **single writer of `dc`**.
  Integrates input → moves the player in meters → converts to canonical render
  space → updates the scale store. Folds in the old `ScaleTracker`.
- `src/player/cameraBridge.ts` — the one meters→canonical conversion
  (`syncCameraToPlayer`, `× 1/EARTH_RADIUS_M`), shared by both render layers so
  their cameras stay pose-locked.
- `src/player/NearRig.tsx` — mirrors the player pose onto the near layer's camera;
  integrates **no** input (single source of truth stays in `PlayerRig`).
- `src/scene/Scene.tsx` — now **two stacked `<Canvas>` layers** (far: logdepth,
  owns input, holds the tiers; near: normal depth, transparent, human-scale
  `Ground` only). This two-layer split — and why one depth buffer can't span both
  human and astronomical scale — is documented in `docs/tier-system.md`.
- `src/scene/Ground.tsx` — human-scale reference platform + 2 m boxes at the
  summit (near layer), so any sub-meter float jitter is immediately visible.
- `src/ui/Hud.tsx` — gained a **speed** readout.

**Verified manually:** standing among the summit boxes renders crisp with a
~0.05 m near plane (no jitter); flying straight up past ~25,000 km swaps
Earth→Solar seamlessly even though a free camera (not an orbit) drives it; the
round-trip back lands you on the summit with no near/far clipping pops.

## Suggested next milestones

Roughly in order of dependency:

1. ~~**Earth sphere**~~ — done, see Milestone 2 above.
2. ~~**Free-fly player camera in meter space**~~ — done, see Milestone 4 above.
3. **Rapier physics + walkable character** — install `@react-three/rapier`, give
   the mountain a collider (heightfield or trimesh once it's not just a cone),
   and add a kinematic-capsule character controller for climbing. Plugs into
   `playerStore`'s meter-space `position`. This is also where **explicit
   floating-origin re-basing** lands (a Rapier need, deferred from Milestone 4) —
   mind invariant #1 in `docs/tier-system.md`: the origin must stay Earth-centered
   for `dc` to hold.
4. **Mode-switching state machine** — zustand store toggling between "climb"
   (physics-driven) and "flight" (the existing camera-driven free-fly), triggered
   at the summit.
5. **Replace the placeholder cone** with a real heightmap-based Everest mesh
   once the surrounding architecture (physics, camera, modes) is proven out.

## Useful repo context

- Stack: Vite + React 19 + TypeScript, package manager `pnpm`. State via
  `zustand` (scale store + player store).
- 3D stack added in Milestone 1: `three`, `@react-three/fiber`,
  `@react-three/drei` (Rapier not yet installed — it arrives with the physics
  milestone). `drei`'s `OrbitControls` was used through Milestone 3 and dropped in
  Milestone 4 for the free-fly `PlayerRig`.
- No automated test suite exists (`pnpm build` / `pnpm lint` are the available
  sanity checks; the scale/seam behavior cannot be unit-tested and needs manual
  browser verification — see `docs/tier-system.md`)
- Git repo was initialized as part of Milestone 1. Early work was on `master`;
  later milestones use feature branches (e.g. `feat/free-fly-player-bridge`).
