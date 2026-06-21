// Procedural galaxy generator. ONE function builds the star-cloud geometry for
// the Milky Way and every hero galaxy — the Milky Way is just its first instance,
// there is no special-case path. Three density functions (spiral / elliptical /
// irregular) cover the morphologies; a seeded PRNG keeps each cloud stable across
// reloads; color comes from a 2-color core→edge palette. Output is a BufferGeometry
// with `position` (meters, relative to the galaxy center), `color`, and `aSize`
// (per-point LUMINOSITY — the StarPoints material draws every star at a constant
// pixel size and uses this scalar to drive brightness, so bright features read as
// brighter, not bigger).
//
// Deliberately impressionistic: recognition comes from position + overall shape +
// tilt, NOT photographic detail. No dust lanes, HII regions, or tidal tails. Not a
// morphology framework — three functions and a param struct, full stop.
import {
	BufferAttribute,
	BufferGeometry,
	Color,
	Matrix4,
	Vector3,
} from "three";

const DEG = Math.PI / 180;

export type GalaxyType = "spiral" | "elliptical" | "irregular";

export interface GalaxyParams {
	type: GalaxyType;
	/** Disk/half-light radius in meters. */
	radiusM: number;
	particleCount: number;
	/** Inner (bulge/core) and outer (arm/edge) colors. */
	palette: { core: string; edge: string };
	/** Disk tilt about the line of nodes; 0 = face-on, 90 = edge-on. */
	inclinationDeg?: number;
	/** Rotation of the projected major axis. */
	positionAngleDeg?: number;
	seed?: number;
}

/** Small, fast, seedable PRNG. */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** One standard-normal sample (Box–Muller). */
function gaussian(rng: () => number): number {
	let u = 0;
	let v = 0;
	while (u === 0) u = rng();
	while (v === 0) v = rng();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function makeGalaxy(params: GalaxyParams): BufferGeometry {
	const {
		type,
		radiusM,
		particleCount,
		palette,
		inclinationDeg = 0,
		positionAngleDeg = 0,
		seed = 1,
	} = params;

	const rng = mulberry32(seed);
	const positions = new Float32Array(particleCount * 3);
	const colors = new Float32Array(particleCount * 3);
	const lums = new Float32Array(particleCount); // per-point luminosity → aSize

	const core = new Color(palette.core);
	const edge = new Color(palette.edge);
	const c = new Color();

	// Irregulars are a handful of gaussian clumps; precompute their centers.
	const clumps: { x: number; y: number; z: number; r: number }[] = [];
	if (type === "irregular") {
		const n = 4 + Math.floor(rng() * 3);
		for (let k = 0; k < n; k++) {
			clumps.push({
				x: (rng() * 2 - 1) * radiusM * 0.5,
				y: (rng() * 2 - 1) * radiusM * 0.2,
				z: (rng() * 2 - 1) * radiusM * 0.5,
				r: radiusM * (0.15 + rng() * 0.25),
			});
		}
	}

	for (let i = 0; i < particleCount; i++) {
		let x: number;
		let y: number;
		let z: number;
		let t: number; // 0 = core color, 1 = edge color
		let lum: number; // luminosity → drives brightness, not size

		if (type === "spiral") {
			const ARMS = 2;
			const TWIST = 4.0; // radians of winding from center to rim
			if (rng() < 0.25) {
				// central bulge: a rounded gaussian blob, old (core) color
				const br = radiusM * 0.12;
				x = gaussian(rng) * br;
				y = gaussian(rng) * br * 0.7;
				z = gaussian(rng) * br;
				t = 0;
				lum = 1.5 + rng() * 2.0; // bright old core
			} else {
				// disk + arms: denser toward center, points wound onto ARMS arms
				const r = radiusM * Math.sqrt(rng());
				const arm = Math.floor(rng() * ARMS);
				const baseAngle = (arm / ARMS) * Math.PI * 2;
				const scatter = gaussian(rng) * 0.25;
				const theta = baseAngle + (r / radiusM) * TWIST + scatter;
				x = Math.cos(theta) * r;
				z = Math.sin(theta) * r;
				const thickness = radiusM * 0.02 * (1 - (r / radiusM) * 0.7);
				y = gaussian(rng) * thickness;
				t = Math.min(1, r / radiusM + 0.2);
				lum = 0.4 + rng() * 0.8; // ordinary disk star, low baseline
				if (rng() < 0.03) lum *= 5.0; // bright star-forming knot
			}
		} else if (type === "elliptical") {
			// smooth ellipsoid, gaussian radial falloff, slight flattening
			const rmag = Math.min(1.3, Math.abs(gaussian(rng)) * 0.5);
			const r = rmag * radiusM * 0.6;
			const u = rng() * 2 - 1;
			const phi = rng() * Math.PI * 2;
			const s = Math.sqrt(1 - u * u);
			x = r * s * Math.cos(phi);
			y = r * u * 0.7;
			z = r * s * Math.sin(phi);
			t = Math.min(1, rmag * 0.4);
			lum = 0.6 + rng() * 1.2; // brighter toward the dense center
		} else {
			// irregular: scatter around the precomputed clumps, patchy & blue
			const cl = clumps[Math.floor(rng() * clumps.length)];
			x = cl.x + gaussian(rng) * cl.r;
			y = cl.y + gaussian(rng) * cl.r * 0.6;
			z = cl.z + gaussian(rng) * cl.r;
			t = 0.4 + rng() * 0.6;
			lum = 0.4 + rng() * 0.9;
			if (rng() < 0.05) lum *= 5.0; // bright star-forming knot
		}

		c.copy(core).lerp(edge, t);
		colors[i * 3] = c.r;
		colors[i * 3 + 1] = c.g;
		colors[i * 3 + 2] = c.b;
		positions[i * 3] = x;
		positions[i * 3 + 1] = y;
		positions[i * 3 + 2] = z;
		lums[i] = lum;
	}

	// Orient the canonical disk (XZ plane, +Y thin axis): incline about X, then
	// rotate the major axis about Y. Baked in so the component stays dumb.
	const m = new Matrix4()
		.makeRotationY(positionAngleDeg * DEG)
		.multiply(new Matrix4().makeRotationX(inclinationDeg * DEG));
	const v = new Vector3();
	for (let i = 0; i < particleCount; i++) {
		v.fromArray(positions, i * 3)
			.applyMatrix4(m)
			.toArray(positions, i * 3);
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	geometry.setAttribute("color", new BufferAttribute(colors, 3));
	geometry.setAttribute("aSize", new BufferAttribute(lums, 1));
	return geometry;
}
