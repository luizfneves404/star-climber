import { Canvas } from "@react-three/fiber";
import type { CSSProperties } from "react";
import { NearRig } from "../player/NearRig";
import { PlayerRig } from "../player/PlayerRig";
import { EARTH_RADIUS_M } from "../scale/constants";
import { EarthGlobe } from "./Earth";
import { Ground } from "./Ground";
import { Mountain } from "./Mountain";
import { SolarSystem } from "./SolarSystem";
import { Tier } from "./Tier";

// Direction of the Sun, used to light the Earth tier consistently with Solar.
const SUN_DIR: [number, number, number] = [0, 0, -1];

// Canonical units (Earth radius = 1).
const NEAR = 0.05 / EARTH_RADIUS_M; // ~0.05 m
const FAR_LAYER_FAR = 1e5; // out past the Solar tier
const NEAR_LAYER_FAR = 1e-2; // ~64 km — the near layer only holds local geometry

const layer: CSSProperties = {
	position: "absolute",
	inset: 0,
	width: "100%",
	height: "100%",
};

function Lights() {
	return (
		<>
			<ambientLight intensity={0.25} />
			<directionalLight position={SUN_DIR} intensity={1.4} />
		</>
	);
}

/**
 * Two stacked render layers, because logarithmicDepthBuffer is a global renderer
 * flag and no single depth buffer is precise across both human and astronomical
 * scales (see docs/tier-system.md):
 *  - FAR layer  (logarithmic depth): Earth, mountain, and the solar tiers.
 *  - NEAR layer (normal depth): the player's human-scale local surroundings,
 *    transparent so it composites on top. It ignores pointer events so the far
 *    canvas (which owns input) receives clicks and the scroll wheel.
 */
export function Scene() {
	return (
		<div style={{ position: "fixed", inset: 0 }}>
			<Canvas
				camera={{ near: NEAR, far: FAR_LAYER_FAR, fov: 60 }}
				gl={{ logarithmicDepthBuffer: true }}
				style={{ ...layer, background: "#05060a" }}
			>
				<Lights />
				<Tier id="earth" metersPerUnit={1}>
					<EarthGlobe radius={EARTH_RADIUS_M} />
					<Mountain />
				</Tier>
				<Tier id="solar" metersPerUnit={1e6}>
					<SolarSystem />
				</Tier>
				<PlayerRig />
			</Canvas>

			<Canvas
				camera={{ near: NEAR, far: NEAR_LAYER_FAR, fov: 60 }}
				gl={{ logarithmicDepthBuffer: false, alpha: true }}
				style={{ ...layer, background: "transparent", pointerEvents: "none" }}
			>
				<Lights />
				<Tier id="earth" metersPerUnit={1}>
					<Ground />
				</Tier>
				<NearRig />
			</Canvas>
		</div>
	);
}
