import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Quaternion, Vector3 } from "three";
import { recordFrame } from "../debug/frameProbe";
import { useHudStore } from "../ui/hudStore";
import type { Body } from "../world/bodies";
import { flyToViewpoint } from "../world/bodies";
import { useFreeFlyControls } from "./freeFlyControls";
import { lookAtQuaternion, usePlayerStore } from "./playerStore";

// Scratch objects reused every frame to avoid allocation.
const forward = new Vector3();
const right = new Vector3();
const camUp = new Vector3();
const move = new Vector3();
const scratchQ = new Quaternion();
const LOCAL_Y = new Vector3(0, 1, 0);
const LOCAL_X = new Vector3(1, 0, 0);
const LOCAL_NEG_Z = new Vector3(0, 0, -1);

// --- fly-to glide (milestone 6) ---
// Split into discrete phases so the player is always looking the way they're
// moving: turn to face the travel direction (stationary), then accelerate /
// cruise / decelerate straight along that heading (no turning), then — only
// if the body's framed viewpoint isn't dead ahead on that line — a final
// turn in place to look at it.
const SEC_PER_DECADE = 1; // ~1 s per order of magnitude of distance closed
const MIN_FLY_S = 3;
const MAX_FLY_S = 10;
const TURN_RATE = 1.2; // rad/s — angular speed for the heading-only turn phases
const MIN_TURN_S = 0.4;
const MAX_TURN_S = 2.5;
const TURN_EPS = 0.01; // ~0.6°; skip a turn phase this small
const ACCEL_FRACTION = 0.3; // share of the travel phase spent speeding up
const DECEL_FRACTION = 0.3; // share spent slowing down; the rest is cruise
const MOVE_KEYS = [
	"KeyW",
	"KeyS",
	"KeyA",
	"KeyD",
	"Space",
	"ShiftLeft",
	"ShiftRight",
] as const;

const smoothstep = (s: number) => s * s * (3 - 2 * s);

/** Trapezoidal velocity profile: ramps up over `a`, holds, ramps down over `d`. */
function trapezoidProgress(t: number, a: number, d: number): number {
	const c = 1 - a - d;
	const vp = 1 / (c + (a + d) / 2); // peak (cruise) rate, normalized so area = 1
	if (t <= a) return (vp * t * t) / (2 * a);
	if (t <= a + c) return (vp * a) / 2 + vp * (t - a);
	const t2 = t - (a + c);
	return (vp * a) / 2 + vp * c + vp * t2 - (vp * t2 * t2) / (2 * d);
}

function turnDuration(from: Quaternion, to: Quaternion): number {
	const angle = from.angleTo(to);
	if (angle < TURN_EPS) return 0;
	return MathUtils.clamp(angle / TURN_RATE, MIN_TURN_S, MAX_TURN_S);
}

type FlyPhase = "turn1" | "travel" | "turn2";

interface FlyProgress {
	target: Body; // identity check against the store's flyToTarget
	viewpoint: Vector3; // where the glide ends (absolute meters)
	diff: Vector3; // startPos − viewpoint, the straight path back to the start
	qStart: Quaternion; // orientation when the glide began
	qTravel: Quaternion; // heading that faces straight down the travel line
	qFinal: Quaternion; // heading that faces the target from the viewpoint
	d0: number; // start distance to the viewpoint
	dMin: number; // distance floor (log glide can't reach 0)
	phase: FlyPhase;
	phaseElapsed: number;
	turn1Duration: number;
	travelDuration: number;
	turn2Duration: number;
}

let fly: FlyProgress | null = null;

function initFly(
	target: Body,
	startPos: Vector3,
	startQuat: Quaternion,
): FlyProgress {
	const { position: viewpoint, lookAt } = flyToViewpoint(target, startPos);
	const d0 = startPos.distanceTo(viewpoint);
	const dMin = Math.min(Math.max(1, target.radius * 1e-3), d0 || 1);
	const decades = d0 > dMin ? Math.log10(d0 / dMin) : 0;
	const travelDuration =
		d0 > 0
			? MathUtils.clamp(decades * SEC_PER_DECADE, MIN_FLY_S, MAX_FLY_S)
			: 0;
	const qFinal = lookAtQuaternion(viewpoint, lookAt);
	// Already at the viewpoint: there's no travel leg to aim down, so collapse
	// to a single turn straight at the target instead of turn1 + (zero) travel.
	const qTravel = d0 > 0 ? lookAtQuaternion(startPos, viewpoint) : qFinal;
	const turn1Duration = turnDuration(startQuat, qTravel);
	const turn2Duration = travelDuration > 0 ? turnDuration(qTravel, qFinal) : 0;
	const phase: FlyPhase =
		turn1Duration > 0 ? "turn1" : travelDuration > 0 ? "travel" : "turn2";
	return {
		target,
		viewpoint: viewpoint.clone(),
		diff: startPos.clone().sub(viewpoint),
		qStart: startQuat.clone(),
		qTravel: qTravel.clone(),
		qFinal,
		d0,
		dMin,
		phase,
		phaseElapsed: 0,
		turn1Duration,
		travelDuration,
		turn2Duration,
	};
}

/**
 * The only input integrator. Moves the player through absolute meter space and
 * drives the camera. With floating origin the camera is pinned at render-space
 * origin (0,0,0) — the world is drawn relative to the player position by
 * FloatingGroup — so the rig only sets the camera's orientation.
 *
 * Orientation is maintained as a quaternion incremented each frame via local-space
 * rotations (no euler decomposition, no world-up assumption). Roll accumulates
 * only when R is held during mouse X movement.
 *
 * Up/down movement (Space / Shift) is relative to the camera's current orientation.
 *
 * A fly-to glide (milestone 6) takes over the frame when active: turn to face
 * the travel direction, accelerate/cruise/decelerate along it, then turn to
 * the target if its framed viewpoint isn't already dead ahead. Any movement
 * or mouse-look input cancels it and hands control straight back.
 */
export function PlayerRig() {
	const camera = useThree((s) => s.camera);
	const gl = useThree((s) => s.gl);
	const controls = useFreeFlyControls(gl.domElement);

	// Priority -1: must run before every FloatingGroup's useFrame (default
	// priority 0). FloatingGroup subscriptions are sorted by priority with a
	// stable sort, so equal-priority order = mount order — and Mountain
	// subscribes late (its FloatingGroup mounts only after its heightmap fetch
	// resolves). Without this, Mountain would read this frame's *new*
	// player.position while Ground (mounted synchronously, subscribed first)
	// reads the *old* one, offsetting Mountain from Ground by this frame's
	// movement delta — visible as the terrain sinking/rising relative to the
	// ground plane while flying, proportional to speed.
	useFrame((_, dt) => {
		const player = usePlayerStore.getState();

		// Consume mouse-look once; both the fly-to cancel check and manual
		// control below read this same delta.
		const look = controls.consumeLook();
		const lookInput = look.yaw !== 0 || look.pitch !== 0 || look.roll !== 0;
		const moveInput = MOVE_KEYS.some((k) => controls.isDown(k));

		// --- fly-to glide ---
		const target = player.flyToTarget;
		if (target) {
			if (!fly || fly.target !== target) {
				fly = initFly(target, player.position, player.orientation);
			}
			if (moveInput || lookInput) {
				// Player took control — cancel and fall through to manual handling
				// (the look delta captured above is applied below).
				player.cancelFlyTo();
				fly = null;
			} else {
				const f = fly;
				f.phaseElapsed += dt;
				if (f.phase === "turn1") {
					const s =
						f.turn1Duration > 0
							? MathUtils.clamp(f.phaseElapsed / f.turn1Duration, 0, 1)
							: 1;
					player.orientation.slerpQuaternions(
						f.qStart,
						f.qTravel,
						smoothstep(s),
					);
					if (s >= 1) {
						player.orientation.copy(f.qTravel);
						f.phase = f.travelDuration > 0 ? "travel" : "turn2";
						f.phaseElapsed = 0;
					}
				} else if (f.phase === "travel") {
					const t =
						f.travelDuration > 0
							? MathUtils.clamp(f.phaseElapsed / f.travelDuration, 0, 1)
							: 1;
					const s = trapezoidProgress(t, ACCEL_FRACTION, DECEL_FRACTION);
					// Log-distance glide: remaining distance to the viewpoint shrinks
					// by an equal factor per unit of the accel/cruise/decel progress
					// above, so each decade closes within that shape rather than at a
					// flat rate.
					const dv = f.d0 * (f.dMin / f.d0) ** s;
					player.position.copy(f.viewpoint).addScaledVector(f.diff, dv / f.d0);
					if (t >= 1) {
						player.position.copy(f.viewpoint);
						f.phase = "turn2";
						f.phaseElapsed = 0;
					}
				} else {
					const s =
						f.turn2Duration > 0
							? MathUtils.clamp(f.phaseElapsed / f.turn2Duration, 0, 1)
							: 1;
					player.orientation.slerpQuaternions(
						f.qTravel,
						f.qFinal,
						smoothstep(s),
					);
					if (s >= 1) {
						player.orientation.copy(f.qFinal);
						player.cancelFlyTo();
						fly = null;
					}
				}
				camera.position.set(0, 0, 0);
				camera.quaternion.copy(player.orientation);
				useHudStore.getState().update(player.position.length());
				recordFrame(dt);
				return;
			}
		}

		// --- mouse-look: incremental local-space rotations ---
		if (look.yaw !== 0) {
			scratchQ.setFromAxisAngle(LOCAL_Y, look.yaw);
			player.orientation.multiply(scratchQ);
		}
		if (look.pitch !== 0) {
			scratchQ.setFromAxisAngle(LOCAL_X, look.pitch);
			player.orientation.multiply(scratchQ);
		}
		if (look.roll !== 0) {
			scratchQ.setFromAxisAngle(LOCAL_NEG_Z, look.roll);
			player.orientation.multiply(scratchQ);
		}
		if (lookInput) {
			player.orientation.normalize();
		}

		// --- movement in absolute meters (float64) ---
		forward.set(0, 0, -1).applyQuaternion(player.orientation);
		right.set(1, 0, 0).applyQuaternion(player.orientation);
		camUp.set(0, 1, 0).applyQuaternion(player.orientation);
		move.set(0, 0, 0);
		if (controls.isDown("KeyW")) move.add(forward);
		if (controls.isDown("KeyS")) move.sub(forward);
		if (controls.isDown("KeyD")) move.add(right);
		if (controls.isDown("KeyA")) move.sub(right);
		if (controls.isDown("Space")) move.add(camUp);
		if (controls.isDown("ShiftLeft") || controls.isDown("ShiftRight"))
			move.sub(camUp);
		if (move.lengthSq() > 0) {
			move.normalize();
			player.position.addScaledVector(move, player.speed * dt);
		}

		// --- camera: pinned at render origin, orientation only (floating origin) ---
		camera.position.set(0, 0, 0);
		camera.quaternion.copy(player.orientation);

		// --- HUD readout ---
		useHudStore.getState().update(player.position.length());

		// --- perf probe (window.__debug.frameStats()) ---
		recordFrame(dt);
	}, -1);

	return null;
}
