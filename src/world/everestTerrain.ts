// Builds the Everest diorama mesh from the offline-generated heightmap
// (public/terrain/everest_heightmap.bin — see scripts/build-everest-heightmap.mjs).
// Geometry is in the local site frame used with `surfaceQuat`: +X east,
// +Y up (height above sea level), +Z north, origin at groundAnchor.
// Heights are TRUE elevation — the summit sits at its real height above the
// sea-level ground plane — and the patch borders feather to zero so the
// massif rises out of the flat plane like a museum diorama.
import { BufferAttribute, BufferGeometry, Color } from "three";
import { TERRAIN_SIZE_M } from "./constants";

/** Vertices per side. Must match GRID in scripts/build-everest-heightmap.mjs. */
export const TERRAIN_GRID = 513;

/** Fraction of the half-extent where the diorama edge skirt starts feathering to zero. */
const FEATHER_START = 0.55;

/** Elevation band over which rock blends into snow. */
const SNOW_LINE_LOW_M = 5_200;
const SNOW_LINE_HIGH_M = 6_000;

const ROCK = new Color("#6b6258");
const SNOW = new Color("#f4f6f8");

const smoothstep = (e0: number, e1: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
	return t * t * (3 - 2 * t);
};

/**
 * Heights are uint16 meters above sea level, row 0 = north edge, west→east
 * within each row (the build script's layout).
 */
export function buildTerrainGeometry(
	heights: Uint16Array,
	grid = TERRAIN_GRID,
	sizeM = TERRAIN_SIZE_M,
): BufferGeometry {
	const half = sizeM / 2;
	const positions = new Float32Array(grid * grid * 3);
	const colors = new Float32Array(grid * grid * 3);
	const color = new Color();
	for (let row = 0; row < grid; row++) {
		for (let col = 0; col < grid; col++) {
			const i = row * grid + col;
			const x = (col / (grid - 1) - 0.5) * sizeM; // east
			const z = (0.5 - row / (grid - 1)) * sizeM; // north
			const h = heights[i];
			const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
			const feather = 1 - smoothstep(FEATHER_START, 1, edge);
			positions[i * 3] = x;
			positions[i * 3 + 1] = h * feather;
			positions[i * 3 + 2] = z;
			color.lerpColors(
				ROCK,
				SNOW,
				smoothstep(SNOW_LINE_LOW_M, SNOW_LINE_HIGH_M, h),
			);
			colors[i * 3] = color.r;
			colors[i * 3 + 1] = color.g;
			colors[i * 3 + 2] = color.b;
		}
	}
	const index = new Uint32Array((grid - 1) * (grid - 1) * 6);
	let k = 0;
	for (let row = 0; row < grid - 1; row++) {
		for (let col = 0; col < grid - 1; col++) {
			const a = row * grid + col; // NW
			const b = a + 1; // NE
			const c = a + grid; // SW
			const d = c + 1; // SE
			index[k++] = a;
			index[k++] = b;
			index[k++] = c;
			index[k++] = b;
			index[k++] = d;
			index[k++] = c;
		}
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	geometry.setAttribute("color", new BufferAttribute(colors, 3));
	geometry.setIndex(new BufferAttribute(index, 1));
	geometry.computeVertexNormals();
	return geometry;
}

/** Fetch the heightmap and build the diorama geometry (call once; ~263k vertices). */
export async function loadEverestTerrainGeometry(): Promise<BufferGeometry> {
	const res = await fetch("/terrain/everest_heightmap.bin");
	if (!res.ok) throw new Error(`heightmap fetch failed: HTTP ${res.status}`);
	const buffer = await res.arrayBuffer();
	const expected = TERRAIN_GRID * TERRAIN_GRID;
	const heights = new Uint16Array(buffer);
	if (heights.length !== expected) {
		throw new Error(
			`heightmap has ${heights.length} samples, expected ${expected}`,
		);
	}
	return buildTerrainGeometry(heights);
}
