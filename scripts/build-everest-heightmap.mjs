// Builds public/terrain/everest_heightmap.bin: a GRID×GRID grid of uint16
// heights (meters above sea level, platform/little-endian, row 0 = north
// edge, west→east within each row) covering SIZE_M centered on Everest's
// summit. Source: Copernicus GLO-30 DEM via the AWS Open Data bucket.
//
// Usage: node scripts/build-everest-heightmap.mjs
// Tiles (~25–50 MB each) are cached in scripts/.dem-cache/ across runs.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fromArrayBuffer } from "geotiff";

// Keep in sync with EVEREST_LAT/LON in src/world/constants.ts and
// TERRAIN_SIZE_M / TERRAIN_GRID in src/world/{constants,everestTerrain}.ts.
const EVEREST_LAT = 27.988056;
const EVEREST_LON = 86.925278;
const SIZE_M = 30_000;
const GRID = 513;

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON = 111_320 * Math.cos((EVEREST_LAT * Math.PI) / 180);
const halfLat = SIZE_M / 2 / M_PER_DEG_LAT;
const halfLon = SIZE_M / 2 / M_PER_DEG_LON;
const latMin = EVEREST_LAT - halfLat;
const latMax = EVEREST_LAT + halfLat;
const lonMin = EVEREST_LON - halfLon;
const lonMax = EVEREST_LON + halfLon;

const CACHE_DIR = "scripts/.dem-cache";
const OUT_FILE = "public/terrain/everest_heightmap.bin";

const pad = (n, w) => String(n).padStart(w, "0");

/** One 1°×1° GLO-30 tile, addressed by its SW corner (integer degrees). */
async function loadTile(latSW, lonSW) {
	const name = `Copernicus_DSM_COG_10_N${pad(latSW, 2)}_00_E${pad(lonSW, 3)}_00_DEM`;
	const file = path.join(CACHE_DIR, `${name}.tif`);
	let buf;
	try {
		buf = await readFile(file);
	} catch {
		const url = `https://copernicus-dem-30m.s3.amazonaws.com/${name}/${name}.tif`;
		console.log(`downloading ${url}`);
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
		buf = Buffer.from(await res.arrayBuffer());
		await mkdir(CACHE_DIR, { recursive: true });
		await writeFile(file, buf);
	}
	const tiff = await fromArrayBuffer(
		buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
	);
	const image = await tiff.getImage();
	const data = (await image.readRasters())[0];
	const width = image.getWidth();
	const height = image.getHeight();
	return {
		// Nearest-neighbor sample at (lat, lon); tile spans [latSW, latSW+1] × [lonSW, lonSW+1].
		sample(lat, lon) {
			const row = Math.min(
				height - 1,
				Math.max(0, Math.floor((latSW + 1 - lat) * height)),
			);
			const col = Math.min(
				width - 1,
				Math.max(0, Math.floor((lon - lonSW) * width)),
			);
			return data[row * width + col];
		},
	};
}

const tiles = new Map();
for (const lat of [Math.floor(latMin), Math.floor(latMax)]) {
	for (const lon of [Math.floor(lonMin), Math.floor(lonMax)]) {
		const key = `${lat},${lon}`;
		if (!tiles.has(key)) tiles.set(key, await loadTile(lat, lon));
	}
}

const out = new Uint16Array(GRID * GRID);
let hMin = Infinity;
let hMax = -Infinity;
for (let row = 0; row < GRID; row++) {
	const lat = latMax - (row / (GRID - 1)) * (latMax - latMin); // row 0 = north
	for (let col = 0; col < GRID; col++) {
		const lon = lonMin + (col / (GRID - 1)) * (lonMax - lonMin);
		const tile = tiles.get(`${Math.floor(lat)},${Math.floor(lon)}`);
		const raw = tile.sample(lat, lon);
		const h = Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
		out[row * GRID + col] = h;
		if (h < hMin) hMin = h;
		if (h > hMax) hMax = h;
	}
}

await mkdir(path.dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, Buffer.from(out.buffer));
console.log(`${OUT_FILE}: ${GRID}×${GRID}, min ${hMin} m, max ${hMax} m`);
