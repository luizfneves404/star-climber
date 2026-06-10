import { useFrame, useThree } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import { useHudStore } from "../ui/hudStore";
import { useFreeFlyControls } from "./freeFlyControls";
import { usePlayerStore } from "./playerStore";

// Scratch objects reused every frame to avoid allocation.
const forward = new Vector3();
const right = new Vector3();
const camUp = new Vector3();
const move = new Vector3();
const scratchQ = new Quaternion();
const LOCAL_Y = new Vector3(0, 1, 0);
const LOCAL_X = new Vector3(1, 0, 0);
const LOCAL_NEG_Z = new Vector3(0, 0, -1);

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

		// --- mouse-look: incremental local-space rotations ---
		const look = controls.consumeLook();
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
		if (look.yaw !== 0 || look.pitch !== 0 || look.roll !== 0) {
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
	}, -1);

	return null;
}
