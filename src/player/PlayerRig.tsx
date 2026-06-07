import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Euler, MathUtils, PerspectiveCamera, Vector3 } from "three";
import { dcToMeters } from "../scale/constants";
import { useScaleStore } from "../scale/store";
import { syncCameraToPlayer } from "./cameraBridge";
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
 * Bridges the player's meter-space state to the canonical render camera and the
 * tier system. Yaw/pitch use Earth's +Y as "up" (no roll) — predictable for a
 * spike; mouse-look adjusts the initial framing.
 */
export function PlayerRig() {
	const camera = useThree((s) => s.camera);
	const gl = useThree((s) => s.gl);
	const height = useThree((s) => s.size.height);
	const controls = useFreeFlyControls(gl.domElement);

	const yaw = useRef(0);
	const pitch = useRef(MathUtils.degToRad(-20)); // start looking slightly down the slope

	useFrame((_, dt) => {
		const player = usePlayerStore.getState();

		// --- mouse-look ---
		const look = controls.consumeLook();
		yaw.current += look.yaw;
		pitch.current = MathUtils.clamp(
			pitch.current + look.pitch,
			-PITCH_LIMIT,
			PITCH_LIMIT,
		);
		euler.set(pitch.current, yaw.current, 0);
		player.orientation.setFromEuler(euler);

		// --- movement in meters ---
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

		// --- bridge: meters -> canonical render space ---
		syncCameraToPlayer(camera, player.position, player.orientation);

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
