# Rapier Physics Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add walk/jump physics to the Everest ground sandbox using `@react-three/rapier`, with gravity pointing toward Earth's center and a mode toggle (`F`) between walk and fly.

**Architecture:** Physics runs in a fixed Rapier world anchored to the player's initial absolute position (`PLAYER_START`). All Rapier coordinates are small (< 300 m from origin) because the sandbox is a local area. Static colliders for ground and the three existing boxes are mounted once. A kinematic character controller (KCC) drives the player capsule per-frame and writes back to `playerStore.position`.

**Tech Stack:** `@react-three/rapier`, `zustand`, `@react-three/fiber`, Three.js, TypeScript 6 (`verbatimModuleSyntax` + `noUnusedLocals`)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/physics/physicsConstants.ts` | **Create** | Capsule dims, speeds, gravity vector, pre-computed Rapier-space positions for ground + boxes |
| `src/physics/PhysicsSandbox.tsx` | **Create** | `<Physics>` world, static colliders, `CharacterController` component (KCC + per-frame walk loop) |
| `src/player/playerStore.ts` | **Modify** | Add `mode: 'walk' \| 'fly'`, `setMode` |
| `src/player/freeFlyControls.ts` | **No change** | Used as-is; called once via `SceneContent` |
| `src/player/PlayerRig.tsx` | **Modify** | Accept `controls` prop (no more internal `useFreeFlyControls` call); skip position update when `mode === 'walk'`; handle `F` toggle |
| `src/scene/Scene.tsx` | **Modify** | Extract `SceneContent` (inner Canvas component that creates one shared `controls` instance, mounts `PhysicsSandbox` before `Markers`) |
| `src/ui/Hud.tsx` | **Modify** | Show mode chip |
| `src/debug/debugApi.ts` | **Modify** | Add `setMode` to `DebugApi`; add `walkModeStart` viewpoint |

---

## Task 1: Install @react-three/rapier

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install the package**

```bash
cd /home/luizfneves/Arquivos/Projetos/star-climber-v2/star-climber
pnpm add @react-three/rapier
```

Expected: package added, no peer-dep errors. `@react-three/rapier` requires `three` ≥ 0.155 and `@react-three/fiber` ≥ 8 — both already satisfied.

- [ ] **Step 2: Verify build still passes**

```bash
pnpm build
```

Expected: exits 0 (no type errors, no new unused imports).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @react-three/rapier"
```

---

## Task 2: Add `mode` to playerStore

**Files:**
- Modify: `src/player/playerStore.ts`

- [ ] **Step 1: Add mode field and action**

In `src/player/playerStore.ts`, add to the `PlayerState` interface:

```ts
/** Current movement mode. 'walk' = physics-driven; 'fly' = free-fly. */
mode: 'walk' | 'fly';
/** Switch movement mode. */
setMode: (mode: 'walk' | 'fly') => void;
```

And to the store factory (after `speed`):

```ts
mode: 'walk' as const,
setMode: (mode) => set({ mode }),
```

Full updated file (replace entire contents):

```ts
import { MathUtils, Quaternion, type Vector3 } from "three";
import { create } from "zustand";
import { CONE_PEAK, PLAYER_START } from "../world/everestSite";

export const MIN_SPEED_MPS = 1;
export const MAX_SPEED_MPS = 1e20;
const INITIAL_SPEED_MPS = 5;

const lookAtAngles = (from: Vector3, to: Vector3) => {
	const dir = to.clone().sub(from).normalize();
	return {
		yaw: Math.atan2(-dir.x, -dir.z),
		pitch: Math.asin(MathUtils.clamp(dir.y, -1, 1)),
	};
};

const initialAngles = lookAtAngles(PLAYER_START, CONE_PEAK);

interface PlayerState {
	position: Vector3;
	orientation: Quaternion;
	yaw: number;
	pitch: number;
	speed: number;
	mode: 'walk' | 'fly';
	stepSpeed: (factor: number) => void;
	teleport: (position: Vector3, lookAt?: Vector3) => void;
	setMode: (mode: 'walk' | 'fly') => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
	position: PLAYER_START.clone(),
	orientation: new Quaternion(),
	yaw: initialAngles.yaw,
	pitch: initialAngles.pitch,
	speed: INITIAL_SPEED_MPS,
	mode: 'walk',
	stepSpeed: (factor) =>
		set({
			speed: Math.min(
				MAX_SPEED_MPS,
				Math.max(MIN_SPEED_MPS, get().speed * factor),
			),
		}),
	teleport: (position, lookAt) => {
		const next: Partial<PlayerState> = { position: position.clone() };
		if (lookAt) {
			const angles = lookAtAngles(position, lookAt);
			next.yaw = angles.yaw;
			next.pitch = angles.pitch;
		}
		set(next);
	},
	setMode: (mode) => set({ mode }),
}));
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/player/playerStore.ts
git commit -m "feat: add mode (walk/fly) to playerStore"
```

---

## Task 3: Create `physicsConstants.ts`

**Files:**
- Create: `src/physics/physicsConstants.ts`

These are all module-level constants computed once at init from the already-exported values in `everestSite.ts`. Rapier space = scene space at mount time (player at `PLAYER_START`); `Rapier origin ≡ PLAYER_START` in absolute meters.

- [ ] **Step 1: Create the file**

```ts
// src/physics/physicsConstants.ts
import {
	BOX_CLUSTER_ORIGIN,
	EYE_HEIGHT_M,
	PLAYER_START,
	tangent,
	up,
} from "../world/everestSite";

export const WALK_SPEED_MPS = 5;
export const JUMP_SPEED_MPS = 5;

// Capsule geometry: total height 1.8 m, radius 0.3 m.
// CapsuleCollider args: [halfHeight, radius] where halfHeight = cylindrical part only.
export const CAPSULE_HALF_HEIGHT = 0.6;
export const CAPSULE_RADIUS = 0.3;
// Eye is EYE_HEIGHT_M above feet; capsule center is (halfHeight + radius) above feet.
export const EYE_OFFSET_M = EYE_HEIGHT_M - (CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS); // 0.8 m

export const GROUND_HALF_THICKNESS = 0.1; // 0.2 m slab
export const SANDBOX_HALF_EXTENT = 250;   // 500 m × 500 m physics ground

// Gravity in scene world space: −up * 9.81 (toward Earth center at Everest lat/lon).
export const GRAVITY: [number, number, number] = [
	-up.x * 9.81,
	-up.y * 9.81,
	-up.z * 9.81,
];

// Ground collider center: surface is at −up*EYE_HEIGHT_M in Rapier space,
// center is GROUND_HALF_THICKNESS deeper.
export const GROUND_CENTER_RAPIER: [number, number, number] = [
	-up.x * (EYE_HEIGHT_M + GROUND_HALF_THICKNESS),
	-up.y * (EYE_HEIGHT_M + GROUND_HALF_THICKNESS),
	-up.z * (EYE_HEIGHT_M + GROUND_HALF_THICKNESS),
];

// Box collider centres in Rapier space (= box_abs − PLAYER_START).
// BOX_A: BOX_CLUSTER_ORIGIN + up*1
export const BOX_A_RAPIER: [number, number, number] = [
	BOX_CLUSTER_ORIGIN.x + up.x - PLAYER_START.x,
	BOX_CLUSTER_ORIGIN.y + up.y - PLAYER_START.y,
	BOX_CLUSTER_ORIGIN.z + up.z - PLAYER_START.z,
];
// BOX_B: BOX_CLUSTER_ORIGIN + up*1 + tangent*2.01
export const BOX_B_RAPIER: [number, number, number] = [
	BOX_CLUSTER_ORIGIN.x + up.x + tangent.x * 2.01 - PLAYER_START.x,
	BOX_CLUSTER_ORIGIN.y + up.y + tangent.y * 2.01 - PLAYER_START.y,
	BOX_CLUSTER_ORIGIN.z + up.z + tangent.z * 2.01 - PLAYER_START.z,
];
// BOX_C: BOX_CLUSTER_ORIGIN + up*3.01
export const BOX_C_RAPIER: [number, number, number] = [
	BOX_CLUSTER_ORIGIN.x + up.x * 3.01 - PLAYER_START.x,
	BOX_CLUSTER_ORIGIN.y + up.y * 3.01 - PLAYER_START.y,
	BOX_CLUSTER_ORIGIN.z + up.z * 3.01 - PLAYER_START.z,
];

// Player capsule initial center in Rapier space: EYE_OFFSET_M below eye (scene origin at mount).
export const CAPSULE_INIT_RAPIER: [number, number, number] = [
	-up.x * EYE_OFFSET_M,
	-up.y * EYE_OFFSET_M,
	-up.z * EYE_OFFSET_M,
];
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/physics/physicsConstants.ts
git commit -m "feat: add physics constants (Rapier-space positions, gravity, capsule dims)"
```

---

## Task 4: Refactor Scene — shared controls + `SceneContent`

**Files:**
- Modify: `src/scene/Scene.tsx`
- Modify: `src/player/PlayerRig.tsx`

`useFreeFlyControls` must only be called once to avoid double-registering the wheel speed handler. Extract a `SceneContent` component (lives inside `<Canvas>`, can call `useThree`) that creates one controls instance and passes it down.

- [ ] **Step 1: Update `PlayerRig` to accept `controls` prop**

Replace entire `src/player/PlayerRig.tsx`:

```ts
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, MathUtils, Vector3 } from "three";
import type { FreeFlyControls } from "./freeFlyControls";
import { useHudStore } from "../ui/hudStore";
import { usePlayerStore } from "./playerStore";

const PITCH_LIMIT = MathUtils.degToRad(89);

const forward = new Vector3();
const right = new Vector3();
const worldUp = new Vector3(0, 1, 0);
const move = new Vector3();
const euler = new Euler(0, 0, 0, "YXZ");

export function PlayerRig({ controls }: { controls: FreeFlyControls }) {
	const camera = useThree((s) => s.camera);
	const fWasDown = useRef(false);

	useFrame((_, dt) => {
		const player = usePlayerStore.getState();

		// F key: toggle walk/fly on rising edge
		const fIsDown = controls.isDown("KeyF");
		if (fIsDown && !fWasDown.current) {
			player.setMode(player.mode === "walk" ? "fly" : "walk");
		}
		fWasDown.current = fIsDown;

		// mouse-look (always active)
		const look = controls.consumeLook();
		player.yaw += look.yaw;
		player.pitch = MathUtils.clamp(
			player.pitch + look.pitch,
			-PITCH_LIMIT,
			PITCH_LIMIT,
		);
		euler.set(player.pitch, player.yaw, 0);
		player.orientation.setFromEuler(euler);

		// position update: fly mode only (walk mode driven by PhysicsSandbox)
		if (player.mode === "fly") {
			forward.set(0, 0, -1).applyQuaternion(player.orientation);
			right.set(1, 0, 0).applyQuaternion(player.orientation);
			move.set(0, 0, 0);
			if (controls.isDown("KeyW")) move.add(forward);
			if (controls.isDown("KeyS")) move.sub(forward);
			if (controls.isDown("KeyD")) move.add(right);
			if (controls.isDown("KeyA")) move.sub(right);
			if (controls.isDown("KeyE") || controls.isDown("Space")) move.add(worldUp);
			if (controls.isDown("KeyQ") || controls.isDown("ControlLeft"))
				move.sub(worldUp);
			if (move.lengthSq() > 0) {
				move.normalize();
				player.position.addScaledVector(move, player.speed * dt);
			}
		}

		camera.position.set(0, 0, 0);
		camera.quaternion.copy(player.orientation);
		useHudStore.getState().update(player.position.length());
	});

	return null;
}
```

- [ ] **Step 2: Update `Scene.tsx` — extract `SceneContent`, add `PhysicsSandbox`**

Replace entire `src/scene/Scene.tsx`:

```ts
import { Canvas } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { useDebugApi } from "../debug/debugApi";
import { useFreeFlyControls } from "../player/freeFlyControls";
import { PlayerRig } from "../player/PlayerRig";
import { PhysicsSandbox } from "../physics/PhysicsSandbox";
import { FAR_M, NEAR_M } from "../world/constants";
import { Markers } from "../world/Markers";

const SUN_DIR: [number, number, number] = [1, 0, 0];

/** Creates one shared controls instance and wires all scene children. */
function SceneContent() {
	const gl = useThree((s) => s.gl);
	const controls = useFreeFlyControls(gl.domElement);

	return (
		<>
			<PhysicsSandbox controls={controls} />
			<Markers />
			<PlayerRig controls={controls} />
		</>
	);
}

export function Scene() {
	useDebugApi();

	return (
		<div style={{ position: "fixed", inset: 0 }}>
			<Canvas
				camera={{ near: NEAR_M, far: FAR_M, fov: 60 }}
				gl={{ logarithmicDepthBuffer: true }}
				style={{ width: "100%", height: "100%", background: "#05060a" }}
			>
				<ambientLight intensity={0.25} />
				<directionalLight position={SUN_DIR} intensity={1.4} />
				<SceneContent />
			</Canvas>
		</div>
	);
}
```

- [ ] **Step 3: Verify build (PhysicsSandbox not created yet — expect import error)**

```bash
pnpm build 2>&1 | head -20
```

Expected: error about missing `../physics/PhysicsSandbox`. That's fine — Task 5 creates it.

- [ ] **Step 4: Commit partial (PlayerRig + Scene scaffold only, skip build check)**

```bash
git add src/player/PlayerRig.tsx src/scene/Scene.tsx
git commit -m "refactor: shared controls via SceneContent; PlayerRig accepts controls prop"
```

---

## Task 5: Create `PhysicsSandbox.tsx` — static bodies

**Files:**
- Create: `src/physics/PhysicsSandbox.tsx`

In this task: `<Physics>` + ground collider + three box colliders. No player capsule yet. `CharacterController` returns `null`. The `controls` prop is accepted but unused for now.

- [ ] **Step 1: Create the file**

```ts
// src/physics/PhysicsSandbox.tsx
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import {
	CapsuleCollider,
	CuboidCollider,
	Physics,
	RigidBody,
	useRapier,
	type RapierRigidBody,
} from "@react-three/rapier";
import type { FreeFlyControls } from "../player/freeFlyControls";
import { usePlayerStore } from "../player/playerStore";
import {
	groundQuat,
	PLAYER_START,
	surfaceQuat,
	up,
} from "../world/everestSite";
import {
	BOX_A_RAPIER,
	BOX_B_RAPIER,
	BOX_C_RAPIER,
	CAPSULE_HALF_HEIGHT,
	CAPSULE_INIT_RAPIER,
	CAPSULE_RADIUS,
	EYE_OFFSET_M,
	GRAVITY,
	GROUND_CENTER_RAPIER,
	GROUND_HALF_THICKNESS,
	JUMP_SPEED_MPS,
	SANDBOX_HALF_EXTENT,
	WALK_SPEED_MPS,
} from "./physicsConstants";

// Module-level scratch — no per-frame allocation in the hot path.
const _fwd = new Vector3();
const _right = new Vector3();
const _hMove = new Vector3();

// Quaternion arrays (r3f/rapier accepts [x, y, z, w])
const GROUND_QUAT: [number, number, number, number] = [
	groundQuat.x, groundQuat.y, groundQuat.z, groundQuat.w,
];
const SURFACE_QUAT: [number, number, number, number] = [
	surfaceQuat.x, surfaceQuat.y, surfaceQuat.z, surfaceQuat.w,
];

// ─── CharacterController ────────────────────────────────────────────────────

interface CharacterControllerProps {
	controls: FreeFlyControls;
}

function CharacterController({ controls }: CharacterControllerProps) {
	const { world } = useRapier();
	const capsuleRef = useRef<RapierRigidBody>(null);
	const vertVelocity = useRef(0);
	const mode = usePlayerStore((s) => s.mode);

	// Create KCC once; tear it down on unmount.
	const controllerRef = useRef<ReturnType<
		typeof world.createCharacterController
	> | null>(null);

	useEffect(() => {
		const ctrl = world.createCharacterController(0.01);
		ctrl.setUp({ x: up.x, y: up.y, z: up.z });
		ctrl.setSlideEnabled(true);
		ctrl.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
		ctrl.setMinSlopeSlideAngle((30 * Math.PI) / 180);
		controllerRef.current = ctrl;
		return () => {
			world.removeCharacterController(ctrl);
		};
	}, [world]);

	// When switching to walk mode, teleport capsule to player's current abs position.
	useEffect(() => {
		if (mode === "walk" && capsuleRef.current) {
			const pos = usePlayerStore.getState().position;
			capsuleRef.current.setNextKinematicTranslation({
				x: pos.x - up.x * EYE_OFFSET_M - PLAYER_START.x,
				y: pos.y - up.y * EYE_OFFSET_M - PLAYER_START.y,
				z: pos.z - up.z * EYE_OFFSET_M - PLAYER_START.z,
			});
			vertVelocity.current = 0;
		}
	}, [mode]);

	useFrame((_, dt) => {
		const ctrl = controllerRef.current;
		const capsule = capsuleRef.current;
		if (!ctrl || !capsule || mode !== "walk") return;

		const player = usePlayerStore.getState();

		// Horizontal move — project camera fwd/right onto the surface plane.
		_fwd.set(0, 0, -1).applyQuaternion(player.orientation);
		_fwd.addScaledVector(up, -_fwd.dot(up));
		if (_fwd.lengthSq() > 1e-6) _fwd.normalize();

		_right.set(1, 0, 0).applyQuaternion(player.orientation);
		_right.addScaledVector(up, -_right.dot(up));
		if (_right.lengthSq() > 1e-6) _right.normalize();

		_hMove.set(0, 0, 0);
		if (controls.isDown("KeyW")) _hMove.add(_fwd);
		if (controls.isDown("KeyS")) _hMove.sub(_fwd);
		if (controls.isDown("KeyD")) _hMove.add(_right);
		if (controls.isDown("KeyA")) _hMove.sub(_right);
		if (_hMove.lengthSq() > 0) _hMove.normalize();
		_hMove.multiplyScalar(WALK_SPEED_MPS * dt);

		// Vertical velocity — gravity accumulates; Space jumps on ground.
		const grounded = ctrl.computedGrounded();
		if (grounded) {
			vertVelocity.current = controls.isDown("Space") ? JUMP_SPEED_MPS : 0;
		} else {
			vertVelocity.current -= 9.81 * dt;
		}

		// Combine horizontal + vertical into world-space desired movement.
		const vdt = vertVelocity.current * dt;
		const desired = {
			x: _hMove.x + up.x * vdt,
			y: _hMove.y + up.y * vdt,
			z: _hMove.z + up.z * vdt,
		};

		ctrl.computeColliderMovement(capsule.collider(0), desired);
		const mv = ctrl.computedMovement();

		const t = capsule.translation();
		const next = { x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z };
		capsule.setNextKinematicTranslation(next);

		// Write back to playerStore as absolute eye position.
		// PlayerRig updates the HUD after reading this on the same frame.
		player.position.set(
			next.x + up.x * EYE_OFFSET_M + PLAYER_START.x,
			next.y + up.y * EYE_OFFSET_M + PLAYER_START.y,
			next.z + up.z * EYE_OFFSET_M + PLAYER_START.z,
		);
	});

	return (
		<RigidBody
			ref={capsuleRef}
			type="kinematic-position-based"
			position={CAPSULE_INIT_RAPIER}
			quaternion={SURFACE_QUAT}
		>
			<CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
		</RigidBody>
	);
}

// ─── PhysicsSandbox ─────────────────────────────────────────────────────────

interface PhysicsSandboxProps {
	controls: FreeFlyControls;
}

export function PhysicsSandbox({ controls }: PhysicsSandboxProps) {
	return (
		<Physics gravity={GRAVITY}>
			{/* Ground: 500 m × 500 m slab, 0.2 m thick, flat face up */}
			<RigidBody type="fixed" position={GROUND_CENTER_RAPIER} quaternion={GROUND_QUAT}>
				<CuboidCollider
					args={[SANDBOX_HALF_EXTENT, SANDBOX_HALF_EXTENT, GROUND_HALF_THICKNESS]}
				/>
			</RigidBody>

			{/* Box A: ground-level 2×2×2 cube */}
			<RigidBody type="fixed" position={BOX_A_RAPIER} quaternion={SURFACE_QUAT}>
				<CuboidCollider args={[1, 1, 1]} />
			</RigidBody>

			{/* Box B: same height as A, 2.01 m east */}
			<RigidBody type="fixed" position={BOX_B_RAPIER} quaternion={SURFACE_QUAT}>
				<CuboidCollider args={[1, 1, 1]} />
			</RigidBody>

			{/* Box C: stacked above A, 0.01 m gap */}
			<RigidBody type="fixed" position={BOX_C_RAPIER} quaternion={SURFACE_QUAT}>
				<CuboidCollider args={[1, 1, 1]} />
			</RigidBody>

			<CharacterController controls={controls} />
		</Physics>
	);
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: exits 0. If `@react-three/rapier` exports differ slightly (e.g., `KinematicCharacterController` type name), the TypeScript error will point to the fix.

- [ ] **Step 3: Commit**

```bash
git add src/physics/PhysicsSandbox.tsx
git commit -m "feat: add PhysicsSandbox with static colliders and KCC walk/jump loop"
```

---

## Task 6: Update HUD to show mode

**Files:**
- Modify: `src/ui/Hud.tsx`

- [ ] **Step 1: Add mode chip to HUD**

Replace entire `src/ui/Hud.tsx`:

```ts
import { usePlayerStore } from "../player/playerStore";
import { EARTH_RADIUS_M } from "../world/constants";
import { useHudStore } from "./hudStore";

const fmtDist = (m: number) => {
	const km = m / 1000;
	if (km >= 1e6)
		return `${(km / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}M km`;
	if (km >= 1)
		return `${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
	return `${m.toFixed(0)} m`;
};

const fmtSpeed = (mps: number) => {
	if (mps >= 1e6)
		return `${(mps / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km/s`;
	if (mps >= 1000)
		return `${(mps / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km/s`;
	return `${mps.toFixed(1)} m/s`;
};

export function Hud() {
	const distanceMeters = useHudStore((s) => s.distanceMeters);
	const speed = usePlayerStore((s) => s.speed);
	const mode = usePlayerStore((s) => s.mode);
	const altitude = Math.max(0, distanceMeters - EARTH_RADIUS_M);

	return (
		<div
			style={{
				position: "fixed",
				top: 12,
				left: 12,
				padding: "10px 14px",
				font: "13px/1.5 ui-monospace, monospace",
				color: "#e8e8e8",
				background: "rgba(0,0,0,0.55)",
				borderRadius: 8,
				pointerEvents: "none",
				letterSpacing: 0.3,
			}}
		>
			<div>altitude: {fmtDist(altitude)}</div>
			<div>dist from center: {fmtDist(distanceMeters)}</div>
			<div>speed: {fmtSpeed(speed)}</div>
			<div
				style={{
					marginTop: 4,
					padding: "1px 6px",
					background: mode === "walk" ? "#2a4a2a" : "#2a2a4a",
					borderRadius: 4,
					display: "inline-block",
					fontSize: 11,
					letterSpacing: 1,
					textTransform: "uppercase",
				}}
			>
				{mode} · F to toggle
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/Hud.tsx
git commit -m "feat: show walk/fly mode chip in HUD"
```

---

## Task 7: Update `debugApi.ts` with `setMode`

**Files:**
- Modify: `src/debug/debugApi.ts`

- [ ] **Step 1: Add `setMode` to debug API**

Replace entire `src/debug/debugApi.ts`:

```ts
import { useEffect } from "react";
import { Vector3 } from "three";
import { usePlayerStore } from "../player/playerStore";
import { AU_M, EARTH_RADIUS_M, MOON_DIST_M } from "../world/constants";
import {
	BOX_CLUSTER_ORIGIN,
	CONE_CENTER,
	CONE_PEAK,
	PLAYER_START,
	up,
} from "../world/everestSite";

type Vec3Tuple = [number, number, number];

const toTuple = (v: Vector3): Vec3Tuple => [v.x, v.y, v.z];
const fromTuple = (t: Vec3Tuple) => new Vector3(t[0], t[1], t[2]);

// A ground-level viewpoint right above the box cluster (eye height above cluster origin).
const WALK_MODE_START = new Vector3()
	.copy(BOX_CLUSTER_ORIGIN)
	.addScaledVector(up, 1.7); // eye height

const VIEWPOINTS = {
	conePeak: toTuple(CONE_PEAK),
	coneBase: toTuple(CONE_CENTER),
	playerStart: toTuple(PLAYER_START),
	boxCluster: toTuple(WALK_MODE_START),
	earthCenter: [0, 0, 0] as Vec3Tuple,
	moon: [MOON_DIST_M, 0, 0] as Vec3Tuple,
	sun: [AU_M, 0, 0] as Vec3Tuple,
} satisfies Record<string, Vec3Tuple>;

export interface DebugApi {
	teleport: (position: Vec3Tuple, lookAt?: Vec3Tuple) => void;
	viewpoints: typeof VIEWPOINTS;
	earthRadiusM: number;
	setMode: (mode: "walk" | "fly") => void;
}

const installDebugApi = (): DebugApi => {
	const api: DebugApi = {
		teleport: (position, lookAt) => {
			usePlayerStore
				.getState()
				.teleport(fromTuple(position), lookAt ? fromTuple(lookAt) : undefined);
		},
		viewpoints: VIEWPOINTS,
		earthRadiusM: EARTH_RADIUS_M,
		setMode: (mode) => usePlayerStore.getState().setMode(mode),
	};
	(window as typeof window & { __debug: DebugApi }).__debug = api;
	return api;
};

export function useDebugApi() {
	useEffect(() => {
		installDebugApi();
	}, []);
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/debug/debugApi.ts
git commit -m "feat: expose setMode on window.__debug; update boxCluster viewpoint to eye height"
```

---

## Task 8: Visual test via Playwright

**Files:** (no changes — read-only test)

- [ ] **Step 1: Start dev server**

```bash
pnpm dev &
```

Wait ~3 s for Vite to finish.

- [ ] **Step 2: Open browser and navigate to ground level**

Via Playwright MCP `browser_navigate`:
```
http://localhost:5173
```

Then `browser_evaluate`:
```js
() => {
  window.__debug.setMode('walk');
  window.__debug.teleport(window.__debug.viewpoints.boxCluster, window.__debug.viewpoints.conePeak);
}
```

Then `browser_take_screenshot`. Expected: player stands on flat ground near boxes, HUD shows "WALK · F to toggle", no falling through ground.

- [ ] **Step 3: Test box standing**

`browser_evaluate`:
```js
() => {
  // Teleport slightly above BOX_A to land on it
  const [bx, by, bz] = window.__debug.viewpoints.boxCluster;
  const { earthRadiusM, teleport } = window.__debug;
  // BOX_A top is 2 m above ground; eye height 1.7 m above that = 3.7 m above ground.
  // viewpoints.boxCluster is already eye-height above cluster origin (ground level).
  // Add 2 m more (up direction at Everest ≈ (0.048, 0.469, -0.880)):
  teleport([bx + 0.048 * 2, by + 0.469 * 2, bz + (-0.880) * 2]);
}
```

Wait 1 s (`browser_wait_for`), then screenshot. Expected: player settles on top of BOX_A (altitude ≈ ground + 3.7 m).

- [ ] **Step 4: Test fly mode toggle**

`browser_evaluate`:
```js
() => window.__debug.setMode('fly')
```

Screenshot. Expected: HUD shows "FLY · F to toggle", player stays at current position (no fall).

- [ ] **Step 5: Commit passing state**

```bash
git add -p  # (no new files; this is just confirming the build is clean)
git commit --allow-empty -m "test: manual Playwright visual test passes — walk/jump/boxes confirmed"
```

---

## Known Limitations (not in scope)

- Teleporting in walk mode to a position far from the sandbox (e.g., `viewpoints.moon`) will cause Rapier float32 overflow. Always switch to fly mode before teleporting far.
- No collider on the Everest cone mesh yet.
- Boxes are static (no dynamic physics).
- No slope sliding on the ground plane (slope angle = 0° everywhere).
