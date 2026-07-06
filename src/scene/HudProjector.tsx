import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { usePlayerStore } from "../player/playerStore";
import { type BodyMarker, useHudMarkersStore } from "../ui/hudMarkersStore";
import { BODIES } from "../world/bodies";

// Module scratch — reused every frame, no allocation in the math hot path.
const rel = new Vector3();
const forward = new Vector3();

/**
 * Projects every notable body to screen space each frame and writes the result
 * to hudMarkersStore. Lives inside the canvas (needs the camera); the DOM
 * overlays (HudMarkers, BodyPanel) read what it writes.
 *
 * The camera is pinned at render origin, so a body's render-space position is
 * exactly `absolutePosition − playerPosition` (float64) — the same subtraction
 * FloatingGroup does — which is also its world position from the camera's point
 * of view, so `Vector3.project(camera)` gives correct NDC.
 */
export function HudProjector() {
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const setMarkers = useHudMarkersStore((s) => s.setMarkers);

	useFrame(() => {
		const player = usePlayerStore.getState();

		// PlayerRig (priority -1) just set camera.position/quaternion this frame;
		// refresh the matrices project() reads so labels don't lag a frame.
		camera.updateMatrixWorld();
		camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

		forward.set(0, 0, -1).applyQuaternion(camera.quaternion);

		const markers: BodyMarker[] = BODIES.map((body) => {
			rel.subVectors(body.position, player.position);
			const distanceM = rel.length();
			const inFront = rel.dot(forward) > 0;
			rel.project(camera);
			const onScreen = inFront && Math.abs(rel.x) <= 1 && Math.abs(rel.y) <= 1;
			return {
				id: body.id,
				name: body.name,
				distanceM,
				x: (rel.x * 0.5 + 0.5) * size.width,
				y: (-rel.y * 0.5 + 0.5) * size.height,
				onScreen,
			};
		});

		setMarkers(markers);
	});

	return null;
}
