# The Tier System — read before touching the zoom/scale code

This is the load-bearing mechanism of Star Climber: a **seamless zoom across
orders of magnitude** by handing off between discrete, individually-normalized
coordinate "tiers" (Earth surface → solar system → galaxy → …). The Earth↔Solar
handoff is built and **the seam is invisible**. That seamlessness is not robust
by accident — it rests on a few invariants. Breaking any of them brings back the
visible jump/pop. **If you change the scale code, re-read this first.**

Files: `src/scale/constants.ts`, `src/scale/store.ts`, `src/scene/Tier.tsx`,
`src/scene/Scene.tsx`, and the player rig that now drives `dc`:
`src/player/PlayerRig.tsx` (+ `cameraBridge.ts`, `freeFlyControls.ts`,
`playerStore.ts`). The load-bearing invariants below are also echoed as short
header comments in those modules — this doc is the full explanation, the
comments are the in-context reminder that points back here.

## Why this exists (and why NOT one true-scale space)

Human-to-universe spans ~27 orders of magnitude. float32 gives ~7 significant
digits, so a single coordinate space covers maybe ~7 orders usefully. You cannot
hold 1 m mountain detail and 10²⁶ m cosmic structure in one float space. So each
tier is its own normalized scene (numbers always comfortably mid-range), and we
**hand off** between them. (An earlier milestone used one true-scale meter space;
that was correct for *Earth alone* but provably can't reach the outer tiers. We
deliberately pivoted. Do not "simplify" back to one space.)

## The core trick: canonical space (Earth radius = 1)

Every tier declares `metersPerUnit` (how many meters one of its authored units
is). `Tier.tsx` scales that tier's group by:

```
canonScale = metersPerUnit / EARTH_RADIUS_M
```

This maps **every tier's Earth onto a canonical sphere of radius 1**. The
consequence that makes the seam work: for *any* tier, the camera's canonical
distance `dc` corresponds to the same real distance-from-Earth-center
(`dc * EARTH_RADIUS_M`). So **one camera and one dolly drive every tier**, and at
the seam both tiers draw Earth at the *identical* size and position. The
cross-fade between two pixel-identical Earths is therefore invisible.

- Earth tier: `metersPerUnit = 1` (authored in meters).
- Solar tier: `metersPerUnit = 1e6` (authored in 1000-km units).

## The seam

- `SEAM_M = 2.5e7` m (~25,000 km from center) — Earth fills a comfortable frame.
- `Tier.tsx` cross-fades opacity over `dc ∈ [FADE_LO_DC, FADE_HI_DC] = [3, 6]`,
  driven by `store.transition` (a `smoothstep`). Below the window: pure Earth
  tier. Above: pure Solar tier. The inactive tier is hidden (`group.visible`).
- `PlayerRig.tsx` reads `dc = camera.position.length()` each frame and updates
  the store (`tier`, `transition`, HUD readouts). It is the **single writer of
  `dc`** — it folded in the old `ScaleTracker`, so input, camera, and the seam
  all flow from one place.

## INVARIANTS — do not break these

1. **`dc` is measured from Earth's center — keep the camera in Earth-centered
   coordinates.** `dc = camera.position.length()` only means "distance from
   Earth's center" because `cameraBridge.syncCameraToPlayer` places the camera at
   the player's **Earth-centered** meter position scaled into canonical space
   (`× 1/EARTH_RADIUS_M`); `playerStore.position` is the source of truth and is
   Earth-centered. Anything that re-bases that origin away from Earth's center (a
   floating-origin shift for physics, a pan, a "recenter on the player") breaks
   both the dolly limits *and* the handoff. (This was a real bug under the old
   orbit camera: enabling `OrbitControls` panning moved the target and made it
   impossible to dolly closer than ~3000 km. The free-fly rig has no pan, but the
   same invariant holds — don't move the origin off Earth's center.)
2. **Both tiers draw an identical Earth at the seam** — same `EARTH_RADIUS_M`,
   same texture (`earth_daymap.jpg`), same center (tier origin), same
   orientation. If you change Earth in one tier, change it in both, or the seam
   becomes a visible double-image. (The Earth tier currently adds the mountain on
   top; that's fine because the mountain fades out with its tier before the seam
   matters.)
3. **`canonScale` normalization is sacred.** If you change how a tier maps to
   canonical space, the "Earth radius = 1 ⇒ shared dolly" identity must still
   hold for every tier.
4. **The far layer uses `logarithmicDepthBuffer: true`** (see the two-layer
   rendering section below). Without it, drawing nearby geometry and a
   planet-or-larger object in one frame z-fights catastrophically.
5. **Fade window must bracket the seam** (`FADE_LO_DC < SEAM_DC < FADE_HI_DC`)
   and both tiers must be renderable across that whole window.
6. **Never render more than ~2 adjacent tiers at once.** The cross-fade hides
   non-adjacent tiers; this keeps the far layer's depth range inside what the
   logarithmic depth buffer can resolve. Three visible tiers would blow past it.

## Two-layer rendering: human scale vs. astronomical scale

A single depth buffer cannot stay precise across both a 2 m box underfoot and a
planet seen from orbit, and `logarithmicDepthBuffer` is a **global renderer flag**
(can't be mixed per-object in one canvas). So `Scene.tsx` stacks **two `<Canvas>`
layers** sharing one player pose (`syncCameraToPlayer`):

- **FAR layer** — `logarithmicDepthBuffer: true`, opaque background. Holds the
  tiers: Earth sphere, mountain, solar system. `PlayerRig` lives here and is the
  **single source of truth** (input → `playerStore`, drives the camera, writes
  `dc`/tier). Logdepth keeps astronomical content crisp; convex bodies (the cone)
  never self-z-fight, so they stay crisp up close too.
- **NEAR layer** — `logarithmicDepthBuffer: false` (normal depth, whose precision
  sits right at the camera), `alpha: true`, transparent, `pointerEvents: "none"`
  so the far canvas still receives clicks/scroll. Holds the player's human-scale
  local surroundings (`Ground` — overlapping surfaces centimeters apart that
  logdepth *cannot* resolve in canonical units). `NearRig` only mirrors the pose.

**Why two layers and not one:** with logdepth on, `vFragDepth = 1.0 + gl_Position.w`
is evaluated in float32; in canonical units a 2 m box has `w ≈ 1e-6`, so depth
differences below ~1 ULP-of-1.0 (≈0.76 m) collapse and z-fight — independent of
near/far. Normal depth doesn't add 1.0, so it resolves human scale near the
camera, but loses all precision far away. Each layer is used only where it is
precise. (Confirmed empirically by toggling logdepth: boxes crisp ⇄ distant cone
crisp.)

**This stays exactly two layers regardless of tier count.** The near layer is
"the surface you're standing on," re-anchored when you land somewhere new — not
one-per-tier. In open space it isn't needed at all.

### Invariants (two-layer)
- The two cameras must stay pose-locked via `syncCameraToPlayer` — only
  `PlayerRig` integrates input; `NearRig` mirrors. Two input integrators would
  desync the layers.
- The near canvas stays transparent + `pointerEvents: "none"`; the far canvas
  owns input.
- Human-scale, surface-overlapping geometry goes in the NEAR layer. Convex /
  large / distant geometry goes in the FAR layer.

## Adding the next tier (galaxy, etc.) — the pattern repeats

1. Author the tier's content in convenient units; pick `metersPerUnit` so its
   contents sit in a comfortable numeric range.
2. Wrap it in `<Tier metersPerUnit={…}>` — `canonScale` handles the rest.
3. Add the tier id to the store and generalize `tier`/`transition` from a single
   boolean seam to an ordered list of seams (each with its own `SEAM`/fade
   window). The two-tier code is intentionally the minimal shape of this.
4. The dolly limits (`MIN_DC`/`MAX_DC`) extend outward; the canonical identity
   keeps the camera math unchanged.
5. Rendering is unchanged: new tiers are FAR-layer content. The two-layer split
   does not grow with tiers. A new NEAR layer is only added if the player can
   *stand* somewhere new (another planet) — re-anchor its local origin there.
6. Each new seam still has to be built and *felt* — the math generalizes, but a
   specific seam isn't verified seamless until it exists.

## Manual verification (no automated test covers this)

Free-fly out from Everest past ~25,000 km (click the canvas to capture the mouse,
scroll to raise speed, fly straight up): HUD flips `Earth → Solar System`, Earth
shrinks into the solar scene (Moon, then Sun) **with no pop**. Fly back in: smooth
return, mountain and ground boxes reappear crisp. Watch the HUD `(handoff %)`
during the seam — there must be no visible jump or double-Earth.
