# Rapier Physics Sandbox Design

**Date:** 2026-06-08  
**Status:** Approved

## Overview

Add `@react-three/rapier` physics to the Everest sandbox area. When physics mode is active, the player walks and jumps with gravity pointing toward Earth's center. Gravity only applies near the ground sandbox; free-fly mode remains available via `F` toggle. The floating-origin architecture is preserved: physics simulation runs in a fixed coordinate space anchored to the initial player position, and results are converted back to absolute Earth-centered meters.

## Scope

- Walk/jump on the flat ground plane beside the cone
- Stand on and jump between the three existing 2×2×2 box markers
- `F` key toggles walk ↔ fly mode
- No collider on the Everest cone mesh yet
- No dynamic rigid bodies (boxes stay fixed)

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/physics/physicsConstants.ts` | Capsule dims, walk speed, jump speed, eye offset |
| `src/physics/PhysicsSandbox.tsx` | `<Physics>` world, static colliders, player capsule, KCC per-frame loop |

### Modified files

| File | Change |
|------|--------|
| `src/player/playerStore.ts` | Add `mode: 'walk' \| 'fly'`, `setMode(mode)` |
| `src/player/freeFlyControls.ts` | Expose `F` key for mode toggle |
| `src/player/PlayerRig.tsx` | Skip position update in walk mode; handle `F` toggle |
| `src/scene/Scene.tsx` | Mount `<PhysicsSandbox />` |
| `src/ui/Hud.tsx` | Show current mode |
| `src/debug/debugApi.ts` | Add `walkMode` viewpoint; expose `setMode` on `window.__debug` |

---

## Coordinate Bridge

`<Physics>` mounts once at app start when `playerStore.position = PLAYER_START`. From this moment, **Rapier space is frozen to scene space at mount time**.

```
Rapier origin (0,0,0)  ≡  PLAYER_START in absolute meters
```

### Static body positions (in Rapier/scene space at mount)

| Body | Rapier position | Orientation | Collider |
|------|----------------|-------------|---------|
| Ground | `groundAnchor − PLAYER_START ≈ −up × 1.7` | `groundQuat` | Box 60 km × 0.2 m × 60 km |
| BOX_A | `BOX_A_abs − PLAYER_START` | `surfaceQuat` | Box 2 × 2 × 2 m |
| BOX_B | `BOX_B_abs − PLAYER_START` | `surfaceQuat` | Box 2 × 2 × 2 m |
| BOX_C | `BOX_C_abs − PLAYER_START` | `surfaceQuat` | Box 2 × 2 × 2 m |

### Player capsule

- `RigidBody type="kinematic-position-based"`
- `CapsuleCollider args={[0.6, 0.3]}` → total height 1.8 m (half-height 0.6, radius 0.3)
- Initial Rapier position: `−up × 0.8` (capsule center is 0.8 m below eye)
  - Capsule bottom = center − up × 0.9 = −up × 1.7 = exactly ground level ✓
- Eye offset from capsule center: `EYE_OFFSET_M = 0.8`

### Position conversion (per-frame)

```ts
// After physics step — capsule body translation is in Rapier space:
const cp = capsuleBody.translation()                         // Rapier {x,y,z}
player.position.set(
  cp.x + up.x * EYE_OFFSET_M + PLAYER_START.x,
  cp.y + up.y * EYE_OFFSET_M + PLAYER_START.y,
  cp.z + up.z * EYE_OFFSET_M + PLAYER_START.z,
)
```

### Gravity

```ts
gravity={[-up.x * 9.81, -up.y * 9.81, -up.z * 9.81]}
// ≈ [-0.49, -4.61, -8.64] at Everest lat/lon
```

---

## Per-frame Walk Loop (in PhysicsSandbox useFrame)

```
1. Read WASD + Space from freeFlyControls
2. Project camera forward/right onto the surface plane (perpendicular to `up`), normalize
3. If not grounded: vertVelocity -= 9.81 * dt
4. If Space pressed AND grounded: vertVelocity = JUMP_SPEED (+5 m/s)
5. desiredMove = (horizontal WASD × WALK_SPEED × dt) + up × vertVelocity × dt
6. controller.computeColliderMovement(collider, desiredMove)
7. capsuleBody.setNextKinematicTranslation(currentPos + correctedMove)
8. Write new eye_abs to playerStore.position (formula above)
```

Constants (in `physicsConstants.ts`):
- `WALK_SPEED_MPS = 5`
- `JUMP_SPEED_MPS = 5`
- `CAPSULE_HALF_HEIGHT = 0.6`
- `CAPSULE_RADIUS = 0.3`
- `EYE_OFFSET_M = 0.8` (eye above capsule center)

---

## Mode Toggle

- `F` key cycles `walk → fly → walk`
- `playerStore.mode` defaults to `'walk'`
- `PlayerRig`: in walk mode, only processes yaw/pitch (mouse-look); in fly mode, full existing behaviour
- HUD: "WALK" / "FLY" chip in top-right
- `window.__debug.setMode('fly' | 'walk')` for Playwright automation

---

## Testing Plan

Via Playwright + `window.__debug`:

1. Navigate to ground level viewpoint, screenshot — player should be standing on ground (no falling through)
2. Call `window.__debug.teleport(viewpoints.boxCluster)` — player should land on BOX_A
3. Verify player can't fall through BOX_C (top box)
4. `window.__debug.setMode('fly')` → verify free-fly resumes
