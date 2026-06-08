import { useFrame, useThree } from "@react-three/fiber";
import { Euler, MathUtils, Vector3 } from "three";
import { useHudStore } from "../ui/hudStore";
import { useFreeFlyControls } from "./freeFlyControls";
import { usePlayerStore } from "./playerStore";

const PITCH_LIMIT = MathUtils.degToRad(89);

// Scratch objects reused every frame to avoid allocation.
const forward = new Vector3();
const right = new Vector3();
const worldUp = new Vector3(0, 1, 0);
const move = new Vector3();
const euler = new Euler(0, 0, 0, "YXZ");

/**
 * The only input integrator. Moves the player through absolute meter space and
 * drives the camera. With floating origin the camera is pinned at render-space
 * origin (0,0,0) — the world is drawn relative to the player position by
 * FloatingGroup — so the rig only sets the camera's orientation.
 * Yaw/pitch live in the player store (world +Y up, no roll) so external code
 * (e.g. the debug teleport API) can drive look direction too; this rig is the
 * only thing that advances them frame-to-frame via mouse-look.
 */
export function PlayerRig() {
	const camera = useThree((s) => s.camera);
	const gl = useThree((s) => s.gl);
	const controls = useFreeFlyControls(gl.domElement);

	useFrame((_, dt) => {
		const player = usePlayerStore.getState();

		// --- mouse-look ---
		const look = controls.consumeLook();
		player.yaw += look.yaw;
		player.pitch = MathUtils.clamp(
			player.pitch + look.pitch,
			-PITCH_LIMIT,
			PITCH_LIMIT,
		);
		euler.set(player.pitch, player.yaw, 0);
		player.orientation.setFromEuler(euler);

		// --- movement in absolute meters (float64) ---
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

		// --- camera: pinned at render origin, orientation only (floating origin) ---
		camera.position.set(0, 0, 0);
		camera.quaternion.copy(player.orientation);

		// --- HUD readout ---
		useHudStore.getState().update(player.position.length());
	});

	return null;
}
