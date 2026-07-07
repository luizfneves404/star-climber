// The solar neighborhood: a ~2000 ly bubble of individual stars around the Sun.
// The Milky Way cloud spreads 150k points over a 15 kpc disk, so almost none land
// near the Sun — without this bubble the sky from the solar system is just the
// galactic band, with nothing above or below. Impressionistic, not a catalog:
// uniform density, power-law luminosities, weighted stellar colors. Fades out as
// the player leaves the neighborhood so it doesn't read as a glowing ball from
// outside (the Milky Way cloud takes over at that scale).
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import {
	BufferAttribute,
	BufferGeometry,
	Color,
	type Points,
	Vector3,
} from "three";
import { usePlayerStore } from "../player/playerStore";
import { LIGHT_YEAR_M, SUN_POS } from "./constants";
import { FloatingGroup } from "./FloatingGroup";
import { mulberry32 } from "./galaxy";
import { makeStarPointsMaterial } from "./StarPoints";

const R_BUBBLE = 2000 * LIGHT_YEAR_M;
const STAR_COUNT = 25_000;

// Weighted stellar palette, red/orange common → blue-white rare.
const PALETTE: { color: string; weight: number }[] = [
	{ color: "#ffcc8f", weight: 0.35 },
	{ color: "#ffe4b5", weight: 0.25 },
	{ color: "#fff4ea", weight: 0.2 },
	{ color: "#f8f7ff", weight: 0.12 },
	{ color: "#cad8ff", weight: 0.08 },
];

function buildGeometry(): BufferGeometry {
	const rng = mulberry32(42);
	const positions = new Float32Array(STAR_COUNT * 3);
	const colors = new Float32Array(STAR_COUNT * 3);
	const lums = new Float32Array(STAR_COUNT);
	const palette = PALETTE.map((p) => new Color(p.color));

	for (let i = 0; i < STAR_COUNT; i++) {
		// Uniform density in the sphere: direction uniform, r ∝ cbrt(u).
		const u = rng() * 2 - 1;
		const phi = rng() * Math.PI * 2;
		const s = Math.sqrt(1 - u * u);
		const r = R_BUBBLE * Math.cbrt(rng());
		positions[i * 3] = r * s * Math.cos(phi);
		positions[i * 3 + 1] = r * u;
		positions[i * 3 + 2] = r * s * Math.sin(phi);

		// Power-law luminosity: mostly dim, a thin bright tail (capped).
		lums[i] = Math.min(4, 0.05 * rng() ** -0.8);

		let pick = rng();
		let c = palette[palette.length - 1];
		for (let k = 0; k < PALETTE.length; k++) {
			pick -= PALETTE[k].weight;
			if (pick <= 0) {
				c = palette[k];
				break;
			}
		}
		colors[i * 3] = c.r;
		colors[i * 3 + 1] = c.g;
		colors[i * 3 + 2] = c.b;
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	geometry.setAttribute("color", new BufferAttribute(colors, 3));
	geometry.setAttribute("aSize", new BufferAttribute(lums, 1));
	return geometry;
}

const geometry = buildGeometry();

const material = makeStarPointsMaterial({
	refDistM: R_BUBBLE,
	brightnessCoef: 0.3, // low — the fragment clamp turns a high coef into a flat white sky
	bloomPx: 0.6, // bright stars bloom to ~4 px; at 2 they were chunky 10 px blobs
});

const scratch = new Vector3();

export function LocalStars() {
	const pointsRef = useRef<Points>(null);
	useFrame(() => {
		const dSun = scratch
			.subVectors(usePlayerStore.getState().position, SUN_POS)
			.length();
		// Full inside the bubble; gone by ~8 bubble radii (the MW cloud takes over).
		const opacity =
			1 - Math.min(1, Math.max(0, (dSun - 2 * R_BUBBLE) / (6 * R_BUBBLE)));
		material.uniforms.uOpacity.value = opacity;
		if (pointsRef.current) pointsRef.current.visible = opacity > 0;
	});
	return (
		<FloatingGroup absolute={SUN_POS}>
			<points ref={pointsRef} geometry={geometry} material={material} />
		</FloatingGroup>
	);
}
