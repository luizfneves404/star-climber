// The "hero" galaxies: ~8 real, named galaxies promoted from catalog blobs to full
// procedural star clouds, so you can fly to one and watch it resolve into stars.
// Each is a makeGalaxy() instance placed at its real RA/Dec/distance. Sizes,
// distances, and inclinations are public values (NED/Wikipedia), rounded — the
// generated stars are impressionistic, so exactness past "right spot, right shape,
// right tilt" buys nothing. The catalog layer (later) excludes these by name.
import { Vector3 } from "three";
import { LIGHT_YEAR_M, raDecToUnitVector, SUN_POS } from "./constants";
import type { GalaxyParams } from "./galaxy";

const MLY = 1e6 * LIGHT_YEAR_M;
const KLY = 1e3 * LIGHT_YEAR_M;

export interface HeroGalaxy extends GalaxyParams {
	/** Lowercase, used as the __debug viewpoint key. */
	name: string;
	raHours: number;
	decDeg: number;
	distM: number;
}

const SPIRAL_PALETTE = { core: "#fff3c8", edge: "#9bb8ff" };
const IRREGULAR_PALETTE = { core: "#cfe0ff", edge: "#8fb4ff" };
const RED_PALETTE = { core: "#ffe9c0", edge: "#ffcaa0" };

export const HERO_GALAXIES: HeroGalaxy[] = [
	{
		name: "andromeda",
		raHours: 0.712,
		decDeg: 41.27,
		distM: 2.5 * MLY,
		type: "spiral",
		radiusM: 110 * KLY,
		inclinationDeg: 77,
		positionAngleDeg: 35,
		palette: SPIRAL_PALETTE,
		particleCount: 90_000,
		armCount: 2,
		seed: 31,
	},
	{
		name: "triangulum",
		raHours: 1.564,
		decDeg: 30.66,
		distM: 2.7 * MLY,
		type: "spiral",
		radiusM: 30 * KLY,
		inclinationDeg: 54,
		positionAngleDeg: 23,
		palette: SPIRAL_PALETTE,
		particleCount: 45_000,
		armCount: 2,
		seed: 33,
	},
	{
		name: "lmc",
		raHours: 5.39,
		decDeg: -69.76,
		distM: 0.163 * MLY,
		type: "irregular",
		radiusM: 7 * KLY,
		inclinationDeg: 35,
		positionAngleDeg: 10,
		palette: IRREGULAR_PALETTE,
		particleCount: 30_000,
		seed: 11,
	},
	{
		name: "smc",
		raHours: 0.877,
		decDeg: -72.83,
		distM: 0.2 * MLY,
		type: "irregular",
		radiusM: 3.5 * KLY,
		inclinationDeg: 50,
		positionAngleDeg: 45,
		palette: IRREGULAR_PALETTE,
		particleCount: 18_000,
		seed: 12,
	},
	{
		name: "whirlpool",
		raHours: 13.497,
		decDeg: 47.2,
		distM: 31 * MLY,
		type: "spiral",
		radiusM: 38 * KLY,
		inclinationDeg: 20,
		positionAngleDeg: 10,
		palette: SPIRAL_PALETTE,
		particleCount: 55_000,
		armCount: 2,
		seed: 51,
	},
	{
		name: "sombrero",
		raHours: 12.666,
		decDeg: -11.62,
		distM: 31 * MLY,
		type: "elliptical",
		radiusM: 25 * KLY,
		inclinationDeg: 84,
		positionAngleDeg: 90,
		palette: RED_PALETTE,
		particleCount: 45_000,
		seed: 104,
	},
	{
		name: "m81",
		raHours: 9.926,
		decDeg: 69.07,
		distM: 11.8 * MLY,
		type: "spiral",
		radiusM: 45 * KLY,
		inclinationDeg: 60,
		positionAngleDeg: 65,
		palette: SPIRAL_PALETTE,
		particleCount: 55_000,
		armCount: 2,
		seed: 81,
	},
	{
		name: "pinwheel",
		raHours: 14.053,
		decDeg: 54.35,
		distM: 21 * MLY,
		type: "spiral",
		radiusM: 85 * KLY,
		inclinationDeg: 18,
		positionAngleDeg: 0,
		palette: SPIRAL_PALETTE,
		particleCount: 70_000,
		armCount: 4,
		seed: 101,
	},
];

/** Absolute Earth-centered position of a hero galaxy's center. */
export function heroAnchor(g: HeroGalaxy): Vector3 {
	const [x, y, z] = raDecToUnitVector(g.raHours, g.decDeg);
	return new Vector3(x, y, z).multiplyScalar(g.distM).add(SUN_POS);
}
