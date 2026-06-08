import { Canvas } from "@react-three/fiber";
import { useDebugApi } from "../debug/debugApi";
import { PlayerRig } from "../player/PlayerRig";
import { FAR_M, NEAR_M } from "../world/constants";
import { Markers } from "../world/Markers";

// The Sun sits along +X, so light the scene from there.
const SUN_DIR: [number, number, number] = [1, 0, 0];

/**
 * A SINGLE render layer — the explicit floating-origin hypothesis
 * (docs/floating-origin-spike.md): one logarithmic-depth canvas, rendering in
 * meters with the camera pinned at the origin and the world drawn relative to
 * the player (FloatingGroup), should resolve both the 1 cm-apart summit boxes
 * and the Sun at 1 AU in the same frame — no tiers, no cross-fade, no second
 * canvas. If the close boxes z-fight in practice, that's the signal to add a
 * second normal-depth canvas for human-scale geometry (the documented fallback).
 */
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
				<Markers />
				<PlayerRig />
			</Canvas>
		</div>
	);
}
