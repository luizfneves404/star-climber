# Free-Fly Player Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Earth-center orbit camera with a free-fly, real-meter player camera that drives the existing seamless tier swap, proving the coordinate bridge and depth precision needed for the eventual physics-driven player character.

**Architecture:** Player state lives in meters (Earth-centered, float64) in a zustand store. A `PlayerRig` component integrates free-fly input each frame, converts the player's meter position into canonical render space (Earth radius = 1) for the camera, and feeds `dc = position.length() / EARTH_RADIUS` to the existing scale store — leaving the tier/cross-fade logic untouched. Scroll wheel sets movement speed multiplicatively.

**Tech Stack:** React 19, TypeScript, three.js, @react-three/fiber, zustand, Vite, pnpm.

**Verification note:** No automated test runner exists in this project and real-time 3D behavior (jitter, seam seamlessness, depth precision) is verified manually. Each task gates on `pnpm tsc --noEmit`; the final integration task runs `pnpm lint` and the five manual browser checks from the spec. The dev server is already running (`pnpm dev`, http://localhost:5174/) with HMR.

**Spec:** `docs/superpowers/specs/2026-06-07-free-fly-player-bridge-design.md`
**Seam invariants (must not break):** `docs/tier-system.md`

---

## Pre-flight: checkpoint the current work (requires user go-ahead on commits)

The working tree has the uncommitted tier-system milestone. Before starting, commit it as a clean checkpoint. We are on `master`; create a feature branch first.

- [ ] **Step 1: Create a branch and commit the tier-system milestone + specs**

```bash
git checkout -b feat/free-fly-player-bridge
git add src/ docs/ public/ package.json pnpm-lock.yaml
git status   # review what is staged
git commit -m "feat: discrete normalized tier system with seamless Earth<->Solar swap

Canonical-space (Earth radius = 1) tiers with cross-fade seam, ScaleManager
store, HUD, Everest at real coordinates. Invariants in docs/tier-system.md.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Expected: clean checkpoint commit on `feat/free-fly-player-bridge`. (Do not commit unrelated pre-existing `README.md`/`ATTRIBUTION.md` edits unless intended — review `git status` first.)

---

## Task 1: Player store (meter-space state + manual speed)

**Files:**
- Create: `src/player/playerStore.ts`

- [ ] **Step 1: Write the store**

```ts
import { Quaternion, Vector3 } from "three";
import { create } from "zustand";
import {
	EARTH_RADIUS_M,
	EVEREST_HEIGHT_M,
	EVEREST_LAT,
	EVEREST_LON,
	latLonToUnitVector,
} from "../scale/constants";

const EYE_HEIGHT_M = 1.7;

// Initial position: standing on Everest's summit, expressed in Earth-centered meters.
const summitDir = new Vector3(...latLonToUnitVector(EVEREST_LAT, EVEREST_LON));
const initialPosition = summitDir
	.clone()
	.multiplyScalar(EARTH_RADIUS_M + EVEREST_HEIGHT_M + EYE_HEIGHT_M);

export const MIN_SPEED_MPS = 1; // m/s — slow enough to inspect the mountain
export const MAX_SPEED_MPS = 1e9; // m/s — fast enough to cross to the Sun in minutes
const INITIAL_SPEED_MPS = 5; // m/s — a brisk walk

interface PlayerState {
	/** Position in meters, Earth-centered (float64). Mutated in place each frame. */
	position: Vector3;
	/** Camera orientation. Mutated in place each frame. */
	orientation: Quaternion;
	/** Movement speed in m/s, set by the player via the scroll wheel. */
	speed: number;
	/** Multiply speed by `factor` (>1 faster, <1 slower), clamped to the range. */
	stepSpeed: (factor: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
	position: initialPosition,
	orientation: new Quaternion(),
	speed: INITIAL_SPEED_MPS,
	stepSpeed: (factor) =>
		set({
			speed: Math.min(
				MAX_SPEED_MPS,
				Math.max(MIN_SPEED_MPS, get().speed * factor),
			),
		}),
}));
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: `No errors found`.

- [ ] **Step 3: Commit**

```bash
git add src/player/playerStore.ts
git commit -m "feat: player meter-space store with manual speed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Free-fly input (pointer-lock look, WASD/QE, wheel speed)

**Files:**
- Create: `src/player/freeFlyControls.ts`

- [ ] **Step 1: Write the input hook**

```ts
import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import { usePlayerStore } from "./playerStore";

const SPEED_STEP = 1.4; // multiplicative per wheel notch
const LOOK_SENSITIVITY = 0.0022; // radians per pixel of mouse movement

export interface FreeFlyInput {
	/** Currently-held key codes (e.g. "KeyW", "Space"). */
	keys: Set<string>;
	/** Accumulated, not-yet-consumed mouse-look deltas, in radians. */
	yawDelta: number;
	pitchDelta: number;
}

/**
 * Wires pointer-lock mouse-look, movement keys, and scroll-wheel speed control to
 * the given canvas element. Returns a mutable input object that PlayerRig reads
 * (and zeroes the look deltas on) each frame.
 */
export function useFreeFlyControls(
	domElement: HTMLElement | null,
): MutableRefObject<FreeFlyInput> {
	const input = useRef<FreeFlyInput>({
		keys: new Set(),
		yawDelta: 0,
		pitchDelta: 0,
	});

	useEffect(() => {
		if (!domElement) return;
		const state = input.current;

		const onKeyDown = (e: KeyboardEvent) => state.keys.add(e.code);
		const onKeyUp = (e: KeyboardEvent) => state.keys.delete(e.code);
		const onBlur = () => state.keys.clear();
		const onClick = () => domElement.requestPointerLock();
		const onMouseMove = (e: MouseEvent) => {
			if (document.pointerLockElement !== domElement) return;
			state.yawDelta -= e.movementX * LOOK_SENSITIVITY;
			state.pitchDelta -= e.movementY * LOOK_SENSITIVITY;
		};
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			usePlayerStore
				.getState()
				.stepSpeed(e.deltaY < 0 ? SPEED_STEP : 1 / SPEED_STEP);
		};

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", onBlur);
		window.addEventListener("mousemove", onMouseMove);
		domElement.addEventListener("click", onClick);
		domElement.addEventListener("wheel", onWheel, { passive: false });

		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onBlur);
			window.removeEventListener("mousemove", onMouseMove);
			domElement.removeEventListener("click", onClick);
			domElement.removeEventListener("wheel", onWheel);
		};
	}, [domElement]);

	return input;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: `No errors found`.

- [ ] **Step 3: Commit**

```bash
git add src/player/freeFlyControls.ts
git commit -m "feat: free-fly input (pointer-lock look, WASD/QE, wheel speed)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: PlayerRig — the coordinate bridge

This component folds in the old `ScaleTracker`'s job, so there is exactly one writer of `dc`.

**Files:**
- Create: `src/player/PlayerRig.tsx`

- [ ] **Step 1: Write the bridge component**

```tsx
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Euler, MathUtils, PerspectiveCamera, Vector3 } from "three";
import { dcToMeters, EARTH_RADIUS_M } from "../scale/constants";
import { useScaleStore } from "../scale/store";
import { useFreeFlyControls } from "./freeFlyControls";
import { usePlayerStore } from "./playerStore";

const CANON_PER_METER = 1 / EARTH_RADIUS_M;
const PITCH_LIMIT = MathUtils.degToRad(89);

// Scratch objects reused every frame to avoid allocation.
const forward = new Vector3();
const right = new Vector3();
const worldUp = new Vector3(0, 1, 0);
const move = new Vector3();
const euler = new Euler(0, 0, 0, "YXZ");

/**
 * Bridges the player's meter-space state to the canonical render camera and the
 * tier system. Yaw/pitch use Earth's +Y as "up" (no roll) — predictable for a
 * spike; mouse-look adjusts the initial framing.
 */
export function PlayerRig() {
	const camera = useThree((s) => s.camera);
	const gl = useThree((s) => s.gl);
	const height = useThree((s) => s.size.height);
	const input = useFreeFlyControls(gl.domElement);

	const yaw = useRef(0);
	const pitch = useRef(MathUtils.degToRad(-20)); // start looking slightly down the slope

	useFrame((_, dt) => {
		const player = usePlayerStore.getState();
		const i = input.current;

		// --- mouse-look ---
		yaw.current += i.yawDelta;
		pitch.current = MathUtils.clamp(
			pitch.current + i.pitchDelta,
			-PITCH_LIMIT,
			PITCH_LIMIT,
		);
		i.yawDelta = 0;
		i.pitchDelta = 0;
		euler.set(pitch.current, yaw.current, 0);
		player.orientation.setFromEuler(euler);

		// --- movement in meters ---
		forward.set(0, 0, -1).applyQuaternion(player.orientation);
		right.set(1, 0, 0).applyQuaternion(player.orientation);
		move.set(0, 0, 0);
		const k = i.keys;
		if (k.has("KeyW")) move.add(forward);
		if (k.has("KeyS")) move.sub(forward);
		if (k.has("KeyD")) move.add(right);
		if (k.has("KeyA")) move.sub(right);
		if (k.has("KeyE") || k.has("Space")) move.add(worldUp);
		if (k.has("KeyQ") || k.has("ControlLeft")) move.sub(worldUp);
		if (move.lengthSq() > 0) {
			move.normalize();
			player.position.addScaledVector(move, player.speed * dt);
		}

		// --- bridge: meters -> canonical render space ---
		camera.position.copy(player.position).multiplyScalar(CANON_PER_METER);
		camera.quaternion.copy(player.orientation);

		// --- drive the tier system (the single writer of dc) ---
		const dc = camera.position.length();
		const distanceMeters = dcToMeters(dc);
		const fovRad = MathUtils.degToRad(
			camera instanceof PerspectiveCamera ? camera.fov : 60,
		);
		const metersPerPixel = (distanceMeters * fovRad) / height;
		useScaleStore.getState().update(dc, metersPerPixel);
	});

	return null;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: `No errors found`.

- [ ] **Step 3: Commit**

```bash
git add src/player/PlayerRig.tsx
git commit -m "feat: PlayerRig bridges meter-space player to canonical tiers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Ground — human-scale reference geometry

A platform plus 2 m boxes at Everest's summit so any float jitter is obvious when standing among them.

**Files:**
- Create: `src/scene/Ground.tsx`

- [ ] **Step 1: Write the Ground component**

```tsx
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";
import {
	EARTH_RADIUS_M,
	EVEREST_HEIGHT_M,
	EVEREST_LAT,
	EVEREST_LON,
	latLonToUnitVector,
} from "../scale/constants";

const UP = new Vector3(0, 1, 0);
const PLATFORM_RADIUS_M = 200;

// Human-scale boxes (local tangent-plane x,z offsets in meters) whose crisp edges
// make any sub-meter float jitter immediately visible.
const BOX_OFFSETS: ReadonlyArray<[number, number]> = [
	[10, 5],
	[-8, 12],
	[20, -6],
	[-15, -10],
	[4, 22],
	[30, 14],
	[-25, 8],
];

/** Human-scale reference geometry at Everest's summit (Earth tier, meters). */
export function Ground() {
	const { position, quaternion } = useMemo(() => {
		const dir = new Vector3(...latLonToUnitVector(EVEREST_LAT, EVEREST_LON));
		return {
			position: dir.clone().multiplyScalar(EARTH_RADIUS_M + EVEREST_HEIGHT_M),
			quaternion: new Quaternion().setFromUnitVectors(UP, dir),
		};
	}, []);

	return (
		<group position={position} quaternion={quaternion}>
			{/* Platform lying in the local tangent (x,z) plane; normal is local +Y (radial). */}
			<mesh rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[PLATFORM_RADIUS_M, 64]} />
				<meshStandardMaterial color="#6b6f73" />
			</mesh>
			{BOX_OFFSETS.map(([x, z], idx) => (
				<mesh key={idx} position={[x, 1, z]}>
					<boxGeometry args={[2, 2, 2]} />
					<meshStandardMaterial color="#c24b3a" />
				</mesh>
			))}
		</group>
	);
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: `No errors found`.

- [ ] **Step 3: Commit**

```bash
git add src/scene/Ground.tsx
git commit -m "feat: human-scale reference ground at Everest summit

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Wire it together — swap controls, set depth range, update HUD, remove ScaleTracker

**Files:**
- Modify: `src/scene/Scene.tsx` (replace `OrbitControls`/`ScaleTracker` with `PlayerRig`; add `Ground`; set human-to-orbit near/far)
- Modify: `src/ui/Hud.tsx` (add speed readout)
- Delete: `src/scene/ScaleTracker.tsx` (its job is now in `PlayerRig`)

- [ ] **Step 1: Replace `src/scene/Scene.tsx` with the player-driven scene**

```tsx
import { Canvas } from "@react-three/fiber";
import { PlayerRig } from "../player/PlayerRig";
import { EARTH_RADIUS_M } from "../scale/constants";
import { EarthGlobe } from "./Earth";
import { Ground } from "./Ground";
import { Mountain } from "./Mountain";
import { SolarSystem } from "./SolarSystem";
import { Tier } from "./Tier";

// Direction of the Sun, used to light the Earth tier consistently with Solar.
const SUN_DIR: [number, number, number] = [0, 0, -1];

// Canonical units (Earth radius = 1). Near ~0.05 m (human scale); far out past the
// Solar tier. logarithmicDepthBuffer must span this range without z-fighting.
const NEAR = 0.05 / EARTH_RADIUS_M; // ~7.85e-9
const FAR = 1e5;

export function Scene() {
	return (
		<Canvas
			camera={{ near: NEAR, far: FAR, fov: 60 }}
			gl={{ logarithmicDepthBuffer: true }}
			style={{ width: "100vw", height: "100vh", background: "#05060a" }}
		>
			<ambientLight intensity={0.25} />
			<directionalLight position={SUN_DIR} intensity={1.4} />

			{/* Earth tier: 1 unit = 1 m. */}
			<Tier id="earth" metersPerUnit={1}>
				<EarthGlobe radius={EARTH_RADIUS_M} />
				<Mountain />
				<Ground />
			</Tier>

			{/* Solar tier: 1 unit = 1000 km. */}
			<Tier id="solar" metersPerUnit={1e6}>
				<SolarSystem />
			</Tier>

			<PlayerRig />
		</Canvas>
	);
}
```

- [ ] **Step 2: Delete the now-redundant ScaleTracker**

```bash
git rm src/scene/ScaleTracker.tsx
```

Expected: file removed. (Confirm nothing else imports it: `grep -rn ScaleTracker src` should return nothing.)

- [ ] **Step 3: Add the speed readout to `src/ui/Hud.tsx`**

Add the import near the other store import:

```tsx
import { usePlayerStore } from "../player/playerStore";
```

Add this formatter next to `fmtKm`:

```tsx
const fmtSpeed = (mps: number) => {
	if (mps >= 1000)
		return `${(mps / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km/s`;
	return `${mps.toFixed(1)} m/s`;
};
```

Read the speed inside the component, alongside the other selectors:

```tsx
const speed = usePlayerStore((s) => s.speed);
```

Add a line to the readout block, right after the `1 px ≈` line:

```tsx
<div>speed: {fmtSpeed(speed)}</div>
```

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc --noEmit`
Expected: `No errors found`.

Run: `pnpm lint`
Expected: no errors (warnings acceptable if pre-existing).

- [ ] **Step 5: Manual browser verification (the actual test of this spike)**

Open http://localhost:5174/ (dev server already running with HMR). Click the canvas to capture the mouse (Esc releases). Verify all five spec success criteria:

1. **Human scale, no jitter:** On load you're standing among the red 2 m boxes on the summit platform. Mouse-look around and use WASD to walk between boxes. Box edges stay crisp and stable — **no z-fighting, no vertex swimming/jitter** at this ~0.05 m near plane.
2. **Free camera drives a seamless swap:** Scroll up a few notches to raise speed, press E/Space to fly straight up while looking back down. As you pass ~25,000 km altitude the HUD flips `Earth → Solar System` and the cross-fade is **seamless** — no pop, no double-Earth — even though a free camera (not an orbit) is driving it.
3. **Round-trip:** Continue out until Earth is a speck in the Solar tier (Moon, then Sun visible), then fly back in (Q/Ctrl or look down + W) and return to the summit with the boxes/mountain crisp again.
4. **No clipping pops:** Across the whole human→orbit→solar range, nothing clips at the near or far plane (no geometry vanishing/appearing at view edges as you move).
5. **Speed control:** Scroll wheel changes speed multiplicatively; HUD `speed:` reflects it; it's usable from walking pace near the boxes up to interplanetary cruise.

If criterion 1 or 4 fails (jitter or depth pops), the fix is dynamic per-frame near/far in `PlayerRig` (near scaled to nearest content, far to current distance) rather than the fixed `NEAR`/`FAR` — note it and we'll iterate. If 2 fails, re-check the seam invariants in `docs/tier-system.md`.

- [ ] **Step 6: Commit**

```bash
git add src/scene/Scene.tsx src/ui/Hud.tsx
git commit -m "feat: free-fly player camera drives the tier system

Swap OrbitControls for PlayerRig, add human-scale Ground reference, widen
camera depth range to human..orbit, show speed on HUD, remove ScaleTracker
(its dc-writing job moved into PlayerRig).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done

The free-fly player bridge is built and manually verified against the five
success criteria. Next milestone (separate spec/plan): add Rapier physics — the
explicit floating-origin re-basing, kinematic capsule, artificial ground
collider, gravity, and jump-driven climb — plugging into `playerStore`'s
meter-space position.

## Self-review (completed during authoring)

- **Spec coverage:** player meter-space state (Task 1) · free-fly look/move/speed
  (Task 2) · bridge + dc + dynamic-readiness (Task 3) · local ground reference
  (Task 4) · scene wiring, depth range, HUD speed, ScaleTracker removal, all five
  success criteria (Task 5). Manual-speed (no altitude scaling), wheel-multiplicative,
  OrbitControls fully replaced — all present.
- **Placeholder scan:** none — every code step is complete.
- **Type consistency:** `usePlayerStore` fields (`position`, `orientation`,
  `speed`, `stepSpeed`) and `FreeFlyInput` (`keys`, `yawDelta`, `pitchDelta`) are
  used identically across Tasks 1–3; `useScaleStore.update(dc, metersPerPixel)`
  matches the existing store signature.
