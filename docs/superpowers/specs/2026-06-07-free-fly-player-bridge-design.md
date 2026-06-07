# Free-Fly Player Bridge — Design

Date: 2026-06-07
Status: approved, ready for implementation plan

## Purpose

De-risk the **player character** by testing its hardest, most confusing
sub-problem in isolation: can a free-moving, real-meter player camera —
decoupled from the Earth-center orbit the tier system was built around — coexist
with the canonical-space tiers and still trigger the **seamless tier swap**?

This spike deliberately **excludes Rapier physics, gravity, jumping, and
collision** (a separate, more-known risk). It validates the coordinate bridge
and the camera, which everything else depends on.

## Background / what's already true

- The tier system renders in **canonical space (Earth radius = 1)** and is fully
  documented, with invariants, in `docs/tier-system.md`. The Earth↔Solar seam is
  verified seamless.
- Until now the camera **orbited Earth's center**: `dc =
  camera.position.length()` (target at origin), and panning was disabled because
  moving the target broke the dolly limits.
- Key precision fact: three.js composes model-view matrices in **float64 on the
  CPU**, downcasting to float32 only for the GPU. Render precision is therefore
  relative to the **camera**, not the world origin. So a small ground patch
  positioned near Everest renders crisply when the camera is near it — **no
  explicit float64 re-basing is needed for rendering** in this spike. (Explicit
  floating-origin re-basing is a *Rapier* requirement, deferred with physics.)

## What this spike actually stress-tests

1. A **free, meter-space camera** (free-look + free movement, not orbit-locked)
   still driving the seamless swap via `dc`.
2. **Depth precision across a human-to-orbit range** — a ~0.1 m near plane while
   the curved Earth / whole planet is visible in the same frame, relying on
   `logarithmicDepthBuffer`.

## Architecture

### Player state — the bridge's source of truth
- Position in **meters, Earth-centered, float64** (a plain three `Vector3`; JS
  numbers are float64). This is the physics-ready representation Rapier plugs
  into later.
- Orientation as a quaternion (yaw/pitch accumulated from mouse-look).
- A scalar **speed** (meters/second), set manually by the player.
- Lives in a small zustand store (`src/player/playerStore.ts`), separate from the
  scale store.

### `PlayerRig` — the bridge (runs every frame)
- `camera.position = playerMeters * (1 / EARTH_RADIUS_M)` → canonical.
- `camera.quaternion = orientation`.
- `dc = playerMeters.length() / EARTH_RADIUS_M` → calls the existing scale
  store's `update(dc, …)`. **The seam/tier logic is unchanged.**
- Sets `camera.near` / `camera.far` dynamically each frame so the visible range
  is covered with margin (near ≈ human scale clamped to a small floor; far ≈
  generous multiple of current distance, capped at the solar envelope), letting
  `logarithmicDepthBuffer` span it. **Note:** `ScaleTracker`'s job (reading the
  camera distance) is now done by `PlayerRig`; `ScaleTracker` is removed/folded
  in so there is exactly one writer of `dc`.

### Free-fly controls (`src/player/freeFlyControls.ts` + input handling)
- **Pointer-lock mouse-look**: click canvas to capture; mouse moves yaw/pitch
  (pitch clamped to ±~89°). Esc releases.
- **Movement**: WASD = forward/back/strafe relative to look direction; Q/E (or
  Ctrl/Space) = down/up. Movement integrates `playerMeters` at the set speed
  each frame (`+= direction * speed * dt`).
- **Speed**: **scroll wheel sets speed, multiplicatively** (≈ ×1.3 per notch up,
  ÷1.3 down), clamped to a wide range (≈ 1 m/s … a few thousand km/s). No
  altitude scaling. WASD/QE always move at exactly the current speed.

### Local ground (`src/scene/Ground.tsx`)
- A small ground patch (~a few hundred meters) at Everest's summit, authored in
  meters inside the existing **Earth tier** (so it inherits the tier's
  canonical scale). Provides a human-scale reference to confirm jitter-free
  rendering. Everest's cone is already present.

### Start state
- Player positioned at Everest's summit + eye height, oriented looking out
  toward the horizon (tangent to the surface).

### Scene wiring
- `Scene.tsx` replaces `<OrbitControls>` with `<PlayerRig>` and renders
  `<Ground>` in the Earth tier. Tiers, `Tier.tsx`, and the scale store's
  tier/transition logic are untouched.
- HUD gains a **speed** readout (and keeps altitude / tier / "1 px ≈ X km").

### Unchanged & protected
The canonical tiers, the cross-fade, `Tier.tsx`, and the seam invariants in
`docs/tier-system.md`. We are only changing **what drives `dc`** — from an orbit
camera to a free player camera — which is itself a thing to validate.

## Out of scope (explicitly deferred)
- Rapier physics, gravity, collision, jumping, "artificial ground" collider.
- Explicit floating-origin re-basing (a Rapier need).
- Planet/star labels, additional planets, galaxy/universe tiers.
- Climb mechanics; the manual-speed model applies to the *exploration* phase
  only — the future climb phase will be governed by jump velocity + gravity.

## Success criteria
1. Standing on Everest at human scale: ground and mountain render crisply with a
   ~0.1 m near plane — **no z-fighting, no jitter**.
2. Free-look and fly straight up: the **seam swaps seamlessly**, now driven by a
   free camera rather than an orbit.
3. Fly out to whole-Earth view (Everest a speck), continue into the Solar tier,
   and **round-trip back** to standing on Everest.
4. **No near/far clipping pops** anywhere across the human-to-orbit range.
5. Scroll-wheel speed control feels usable from mountain-walk pace to
   interplanetary cruise, with the HUD reflecting the set speed.

## Manual verification
No automated tests cover real-time 3D. Verification is the five success criteria
above, performed in the browser.
