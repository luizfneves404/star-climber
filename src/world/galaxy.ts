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
	/** Spiral only: number of arms. */
	armCount?: number;
	/** Spiral only: radians of arm winding from center to rim. */
	twistRad?: number;
	/** Spiral only: base azimuthal scatter σ (radians) around the arm ridge. */
	armScatterRad?: number;
	/** Spiral only: fraction of points in the central bulge. */
	bulgeFrac?: number;
	/** Spiral only: fraction in the diffuse (armless) thin disk — keeps the
	 * inter-arm region glowing so arms read as ridges, not isolated ribbons. */
	diffuseFrac?: number;
	/** Spiral only: fraction in the thick disk (~3.5× thin-disk height). */
	thickDiskFrac?: number;
	/** Spiral only: fraction in the spherical stellar halo (0.1R–2R). */
	haloFrac?: number;
}

/** Small, fast, seedable PRNG. Also used by the deep field (DeepField.tsx). */
export function mulberry32(seed: number): () => number {
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
		armCount = 2,
		twistRad = 4.5,
		armScatterRad = 0.12,
		bulgeFrac = 0.15,
		diffuseFrac = 0.25,
		thickDiskFrac = 0.13,
		haloFrac = 0.05,
	} = params;

	// Cumulative population thresholds for the spiral branch; arms take the rest.
	const BULGE_T = bulgeFrac;
	const DIFFUSE_T = BULGE_T + diffuseFrac;
	const THICK_T = DIFFUSE_T + thickDiskFrac;
	const HALO_T = THICK_T + haloFrac;

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
			// Five populations picked on one draw: bulge, diffuse thin disk (armless —
			// makes the arms read as bright ridges on a continuous disk instead of
			// isolated streaks), thick disk, spherical halo, and the arms themselves.
			const pop = rng();
			if (pop < BULGE_T) {
				// central bulge: a rounded gaussian blob, old (core) color
				const br = radiusM * 0.15;
				x = gaussian(rng) * br;
				y = gaussian(rng) * br * 0.75;
				z = gaussian(rng) * br;
				t = 0;
				lum = 1.5 + rng() * 2.0; // bright old core
			} else if (pop < DIFFUSE_T) {
				// diffuse thin disk: same radial law as the arms, no azimuthal preference
				const r = radiusM * Math.sqrt(rng());
				const theta = rng() * Math.PI * 2;
				x = Math.cos(theta) * r;
				z = Math.sin(theta) * r;
				y = gaussian(rng) * radiusM * 0.025;
				t = Math.min(1, r / radiusM + 0.2);
				lum = 0.35 + rng() * 0.55;
			} else if (pop < THICK_T) {
				// thick disk: puffier (~3.5× thin), older/warmer stars
				const r = radiusM * Math.sqrt(rng());
				const theta = rng() * Math.PI * 2;
				x = Math.cos(theta) * r;
				z = Math.sin(theta) * r;
				y = gaussian(rng) * radiusM * 0.09;
				t = 0.15;
				lum = 0.25 + rng() * 0.4;
			} else if (pop < HALO_T) {
				// spherical stellar halo: log-uniform radius 0.1R–2R (≈ r⁻³ density),
				// old stars — from inside, this is what puts stars above/below the disk
				const r = radiusM * 0.1 * 20 ** rng();
				const u = rng() * 2 - 1;
				const phi = rng() * Math.PI * 2;
				const sxz = Math.sqrt(1 - u * u);
				x = r * sxz * Math.cos(phi);
				y = r * u;
				z = r * sxz * Math.sin(phi);
				t = 0.05;
				lum = 0.2 + rng() * 0.3;
			} else {
				// arms: denser toward center, wound onto armCount log-ish arms; scatter
				// grows outward so inner arms are tight and rims fray naturally
				const r = radiusM * Math.sqrt(rng());
				const arm = Math.floor(rng() * armCount);
				const baseAngle = (arm / armCount) * Math.PI * 2;
				const sigma = armScatterRad * (0.4 + 0.9 * (r / radiusM));
				const theta =
					baseAngle + (r / radiusM) * twistRad + gaussian(rng) * sigma;
				x = Math.cos(theta) * r;
				z = Math.sin(theta) * r;
				y = gaussian(rng) * radiusM * 0.025;
				t = Math.min(1, r / radiusM + 0.2);
				lum = 0.5 + rng() * 0.7;
				if (rng() < 0.05) lum *= 5.0; // bright star-forming knot
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
