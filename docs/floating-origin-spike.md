# Floating-Origin Spike — read before touching scale/camera/render code

This **replaces** the tier system (see `tier-system.md`, now superseded). The
old approach (canonical `Earth radius = 1` normalization + discrete tiers +
opacity cross-fade + two stacked canvases) worked for Earth↔Solar but provably
cannot reach galaxy scale: a single Earth-radius unit pushes far coordinates to
~1e14 and blows float32. This spike is the standard alternative —
**floating origin + logarithmic depth over one continuous scene**.

## The mechanism (the one rule that matters)

Render space is **meters**. The camera is pinned at render-space origin
`(0,0,0)`; only its orientation changes (`PlayerRig.tsx`). Every object is drawn
camera-relative:

```
renderPosition = absolutePositionMeters − playerPositionMeters
```

This subtraction happens **in JS (float64), per object, every frame**
(`world/FloatingGroup.tsx`), and the small result is assigned to the object's
local position. **It must not** be expressed as one large translation on a
shared parent group — that bakes the huge offset into a float32 matrix and
destroys precision before the GPU subtracts. Doing the subtract at float64 first
is the whole point: near-camera objects come out at ~meters (precise), far ones
come out huge but sub-pixel (their imprecision is invisible). Precision
automatically concentrates at the camera. No tiers, no normalization, no "what
am I looking at" guessing.

- `world/constants.ts` — physical constants, `latLonToUnitVector`, render
  `NEAR_M`/`FAR_M`.
- `world/FloatingGroup.tsx` — the camera-relative transform.
- `world/Markers.tsx` — minimal true-scale test content.
- `player/playerStore.ts` — absolute Earth-centered meters (float64), the render
  origin. `player/PlayerRig.tsx` — the only input integrator; pins the camera at
  origin. `player/freeFlyControls.ts` — input (reused unchanged).
- `scene/Scene.tsx` — the single canvas. `ui/Hud.tsx` + `ui/hudStore.ts` — overlay.

## The OPEN QUESTION this spike exists to answer

> **Does ONE `logarithmicDepthBuffer` canvas, rendering in meters, resolve a
> cluster of 2 m boxes 1 cm apart on the Everest summit AND the Sun at 1 AU in
> the same frame — with no z-fighting and no jitter?**

The old code needed *two* canvases because canonical units made near-surface `w`
≈ 1e-6, collapsing log-depth precision. Rendering in meters, a 2 m box has
`w ≈ 2`, which log-depth should resolve. The summit canary boxes in
`Markers.tsx` (`BOX_A/B/C`, 1 cm apart) exist precisely to test this.

- **If they stay crisp:** the single-canvas simplification holds. Done.
- **If they z-fight/flicker:** the documented fallback is to add back a *second*
  normal-depth canvas for human-scale local geometry only — still floating
  origin, still no tiers/cross-fade. Record which way it went here.

### Result (fill in after manual verification)

_Not yet verified — run `pnpm dev` and complete the checklist below._

## Manual verification (no automated test covers this)

Click the canvas to capture the mouse; scroll to change speed; WASD/QE to move.

1. **Single-canvas test:** stand among the summit boxes (1 cm apart). Crisp at
   rest; no jitter while moving. (Pass/fail → the open question above.)
Result: it works!
2. **Continuous out:** fly straight up — Earth shrinks smoothly, no surface
   swimming/z-fight, and **no pop anywhere** (there are no tiers).
Result: it works!
3. **Magnitude spread:** turn toward +X and fly past Moon → Sun → star → galaxy
   marker; coordinates don't explode, the body you approach shows no vertex
   swimming.
Result: it works!
4. **Round trip:** fly back to the summit; land among the boxes, still crisp.
Result: it works!
5. **Numeric sanity:** the HUD "dist from center" is ~6,380 km at the summit and
   climbs smoothly; nothing snaps.
Result: it works! Fixed — `EVEREST_HEIGHT_M` (8,849 m) was defined in
`world/constants.ts` but never applied: `playerStore.ts`'s `initialPosition` and
`Markers.tsx`'s `summitSurface` both placed the summit at sea-level radius
(`EARTH_RADIUS_M`) instead of `EARTH_RADIUS_M + EVEREST_HEIGHT_M`. That's why the
ground/boxes sat at sea level rather than the true Everest elevation, and the HUD
read "dist from center: 6,371 km" / "altitude: 2 m" instead of "~6,380 km" /
"~9 km". Adding `EVEREST_HEIGHT_M` to both radii fixes it — verified via
Playwright (HUD now reads "dist from center: 6,380 km", "altitude: 9 km", boxes
still crisp at the summit).

## What is deliberately out of scope

No textures, no LOD/angular-size, no per-body reference frames, no physics. Those
are deferred until this precision/continuity claim is proven. The galaxy marker
is oversized so it's visible — the test is that the coordinates work, not
photometric accuracy.
