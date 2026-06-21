// The Milky Way — the first instance of the shared makeGalaxy() generator. The
// galaxy center sits ~8 kpc from the Sun along -X with the disk in the world XZ
// plane, so the Sun is embedded in the disk: the cloud reads as a band across the
// sky from inside (near Earth/Sun) and as a spiral from outside. A gentle
// distance-from-Sun ramp brightens it as you fly out (the spec's fade-in), while
// keeping it dim — not absent — near the local HYG star bubble.
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { usePlayerStore } from "../player/playerStore";
import { PARSEC_M, SUN_POS } from "./constants";
import { FloatingGroup } from "./FloatingGroup";
import { makeGalaxy } from "./galaxy";
import { makeStarPointsMaterial } from "./StarPoints";

const R_SUN_GAL = 8000 * PARSEC_M; // Sun's distance from the galactic center
const MW_RADIUS = 15000 * PARSEC_M; // visible disk radius (~15 kpc)

// Center 8 kpc from the Sun, disk in the world XZ plane → Sun sits in the disk.
const MW_CENTER = SUN_POS.clone().sub(new Vector3(R_SUN_GAL, 0, 0));

const geometry = makeGalaxy({
	type: "spiral",
	radiusM: MW_RADIUS,
	particleCount: 100_000,
	palette: { core: "#fff3c8", edge: "#9bb8ff" },
	seed: 1,
});

const material = makeStarPointsMaterial({
	refDistM: MW_RADIUS,
	opacity: 0.6,
});

const scratch = new Vector3();

export function MilkyWay() {
	useFrame(() => {
		const dist = scratch
			.subVectors(usePlayerStore.getState().position, SUN_POS)
			.length();
		const t = Math.min(1, dist / MW_RADIUS);
		material.uniforms.uOpacity.value = 0.5 + 0.5 * t;
	});
	return (
		<FloatingGroup absolute={MW_CENTER}>
			<points geometry={geometry} material={material} />
		</FloatingGroup>
	);
}
