// Renders every galaxy star cloud (Milky Way + heroes) plus the shared impostor
// point cloud, and runs the one per-frame cross-fade loop: near a galaxy you see
// its full particle cloud; past ~40 galaxy radii the cloud fades toward a single
// bright point of light, complete by ~120 radii — so distant galaxies read as
// stars instead of fading to black. Fully faded clouds are hidden (visible=false),
// which also culls their fill-rate cost. The Milky Way keeps its old gentle
// brighten-as-you-leave-the-Sun ramp on top of the cross-fade.
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { type Object3D, Vector3 } from "three";
import { usePlayerStore } from "../player/playerStore";
import { SUN_POS } from "./constants";
import { FloatingGroup } from "./FloatingGroup";
import {
	GALAXY_CLOUDS,
	IMPOSTOR_FADE,
	IMPOSTOR_GEOMETRY,
	IMPOSTOR_MATERIAL,
	MW_RADIUS,
} from "./galaxyClouds";

// Cross-fade window in units of k = distance / galaxy radius.
const FADE_START_K = 40;
const FADE_END_K = 120;

const smoothstep = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

const scratch = new Vector3();
const scratchSun = new Vector3();

export function GalaxyClouds() {
	const cloudRefs = useRef<(Object3D | null)[]>([]);

	useFrame(() => {
		const player = usePlayerStore.getState().position;
		const dSun = scratchSun.subVectors(player, SUN_POS).length();
		// The old MilkyWay.tsx ramp: dim (not absent) near the Sun, full outside.
		const mwRamp = 0.5 + 0.5 * Math.min(1, dSun / MW_RADIUS);

		for (let i = 0; i < GALAXY_CLOUDS.length; i++) {
			const cloud = GALAXY_CLOUDS[i];
			const k =
				scratch.subVectors(player, cloud.anchor).length() / cloud.radiusM;
			const cloudFade = 1 - smoothstep(FADE_START_K, FADE_END_K, k);
			const extra = cloud.name === "milkyway" ? mwRamp : 1;
			cloud.material.uniforms.uOpacity.value = cloudFade * extra;
			const points = cloudRefs.current[i];
			if (points) points.visible = cloudFade > 0;
			IMPOSTOR_FADE.array[i] = 1 - cloudFade;
		}
		IMPOSTOR_FADE.needsUpdate = true;
	});

	return (
		<>
			{GALAXY_CLOUDS.map((cloud, i) => (
				<FloatingGroup key={cloud.name} absolute={cloud.anchor}>
					<points
						ref={(el) => {
							cloudRefs.current[i] = el;
						}}
						geometry={cloud.geometry}
						material={cloud.material}
					/>
				</FloatingGroup>
			))}
			<FloatingGroup absolute={SUN_POS}>
				<points geometry={IMPOSTOR_GEOMETRY} material={IMPOSTOR_MATERIAL} />
			</FloatingGroup>
		</>
	);
}
