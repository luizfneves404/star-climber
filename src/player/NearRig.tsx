import { useFrame, useThree } from "@react-three/fiber";
import { syncCameraToPlayer } from "./cameraBridge";
import { usePlayerStore } from "./playerStore";

/**
 * Drives the near (normal-depth) layer's camera. It only mirrors the player pose
 * written by PlayerRig — all input, movement, and tier logic stay in PlayerRig so
 * there is a single source of truth.
 */
export function NearRig() {
	const camera = useThree((s) => s.camera);

	useFrame(() => {
		const player = usePlayerStore.getState();
		syncCameraToPlayer(camera, player.position, player.orientation);
	});

	return null;
}
