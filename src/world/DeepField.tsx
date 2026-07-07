// The observable universe, in simple form: one point cloud where each point is a
// WHOLE GALAXY, out to the 46 Gly comoving radius ("the observable universe is
// 93 billion light-years across" — the number the HUD confirms at the rim).
// Farther galaxies are tinted redder (baked redshift ramp). Fades in as the
// player leaves the Milky Way so it never clutters the near sky.
//
// Accepted simplifications, on purpose: the field is static (no expansion or
// lookback), its galaxies never resolve into stars (points forever), and flying
// into one does nothing. Past the rim, forward goes black — the edge of the
// observable universe is the payoff moment, not a bug.
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
import { MW_RADIUS } from "./galaxyClouds";
import { makeStarPointsMaterial } from "./StarPoints";

const MLY = 1e6 * LIGHT_YEAR_M;
/** Comoving radius of the observable universe. Fits inside FAR_M = 1e27. */
export const DEEP_FIELD_RADIUS = 46e9 * LIGHT_YEAR_M;
const R_MIN = 50 * MLY; // inner hole: the hero-galaxy neighborhood stays theirs
const GALAXY_COUNT = 200_000;

const NEAR_COLOR = new Color("#dfe6ff");
const FAR_COLOR = new Color("#ffb089"); // baked redshift tint

function buildGeometry(): BufferGeometry {
	const rng = mulberry32(7);
	const positions = new Float32Array(GALAXY_COUNT * 3);
	const colors = new Float32Array(GALAXY_COUNT * 3);
	const lums = new Float32Array(GALAXY_COUNT);
	const c = new Color();

	for (let i = 0; i < GALAXY_COUNT; i++) {
		// Uniform in comoving volume: r ∝ cbrt(u), floored at the inner hole.
		const r = Math.max(R_MIN, DEEP_FIELD_RADIUS * Math.cbrt(rng()));
		const u = rng() * 2 - 1;
		const phi = rng() * Math.PI * 2;
		const s = Math.sqrt(1 - u * u);
		// Float32 relative to the Sun: at these distances the ~1e-7 relative
		// error is far below a pixel.
		positions[i * 3] = r * s * Math.cos(phi);
		positions[i * 3 + 1] = r * u;
		positions[i * 3 + 2] = r * s * Math.sin(phi);

		let lum = 0.1 + rng() ** 2 * 1.4;
		if (rng() < 0.01) lum *= 4; // bright cluster ellipticals
		lums[i] = lum;

		c.copy(NEAR_COLOR).lerp(FAR_COLOR, (r / DEEP_FIELD_RADIUS) ** 1.2);
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
	refDistM: DEEP_FIELD_RADIUS,
	brightnessCoef: 3,
	basePx: 1.8,
	bloomPx: 1,
});

const scratch = new Vector3();

export function DeepField() {
	const pointsRef = useRef<Points>(null);
	useFrame(() => {
		const dSun = scratch
			.subVectors(usePlayerStore.getState().position, SUN_POS)
			.length();
		// Invisible from inside the Milky Way; fully in by ~5 MW radii out.
		const opacity = Math.min(
			1,
			Math.max(0, (dSun - MW_RADIUS) / (4 * MW_RADIUS)),
		);
		material.uniforms.uOpacity.value = opacity;
		if (pointsRef.current) pointsRef.current.visible = opacity > 0;
	});
	return (
		<FloatingGroup absolute={SUN_POS}>
			<points ref={pointsRef} geometry={geometry} material={material} />
		</FloatingGroup>
	);
}
