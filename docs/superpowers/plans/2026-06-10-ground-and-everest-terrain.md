# Ground Texture + Everest DEM Terrain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the solid-color ground with a tiling texture and the placeholder Everest cone with a real Copernicus GLO-30 DEM mesh, diorama-style (milestones 1–2 of `docs/superpowers/specs/2026-06-10-content-roadmap-design.md`).

**Architecture:** The ground stays the existing 60 km flat plane, gaining a CC0 tiling rock texture (material-only change, extracted into `Ground.tsx`). Everest becomes a 513×513 displaced grid built at load from a raw 16-bit heightmap (`public/terrain/everest_heightmap.bin`, uint16 meters), generated offline by a Node script from 4 Copernicus GLO-30 tiles on AWS Open Data. Heights are **true elevation above sea level** (summit stays at 8,849 m above the plane); the patch borders feather to zero so the massif rises out of the flat plane like a museum diorama. Elevation-based vertex colors (rock→snow), `computeVertexNormals`, no LOD, no curvature, no shaders.

**Tech Stack:** React 19 + TypeScript + Three.js/R3F (existing), `geotiff` (devDependency, build script only), Copernicus GLO-30 DEM (AWS public bucket, verified live), Poly Haven `rocky_trail` texture (CC0, URL verified live).

**Verification model:** This project has **no test runner by design** (see CLAUDE.md): `pnpm build` + `pnpm lint` are the static gates, and scale/rendering correctness is verified visually via Playwright MCP + `window.__debug`. Steps below follow that instead of TDD. Lint note: `pnpm lint` through the rtk wrapper can report a bogus `preserve-caught-error` error from a stale global eslint — if so, verify with `rtk proxy pnpm lint` (exit 0 = pass).

**Two intentional deviations from the spec** (folded into Task 6 doc updates):
1. Heightmap format is **raw uint16 `.bin`**, not 16-bit PNG — browser canvas decoding quantizes PNG to 8 bits (~35 m terracing) and exact decoding would need an extra runtime dep; the raw buffer is exact, one `fetch` + `Uint16Array`, and similar size (~526 KB).
2. **No base-elevation subtraction** — the spec's "subtract base elevation" and "true-scale summit preserved" conflict (subtracting would put the summit at ~5–6 km above the plane). Heights stay absolute; the plane *is* sea level, which is geographically honest. The feather skirt absorbs the ~2–5 km edge elevations over a ~6.75 km band (≈25–35° slope, reads as a plinth).
3. `SITE_CLEARANCE_M` grows from 13 km to 17.5 km east — the old site point would sit *inside* the 30 km terrain patch footprint (half-extent 15 km).

---

### Task 1: Ground texture asset

**Files:**
- Create: `public/textures/rocky_trail_diff_2k.jpg` (downloaded)
- Modify: `ATTRIBUTION.md`

- [ ] **Step 1: Download the texture (URL verified live, ~4.2 MB)**

```bash
curl -sSfL "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rocky_trail/rocky_trail_diff_2k.jpg" \
  -o public/textures/rocky_trail_diff_2k.jpg
ls -l public/textures/rocky_trail_diff_2k.jpg   # expect ~4,208,713 bytes
```

If the URL 404s, pick any seamless rocky-ground texture from polyhaven.com/textures (all CC0), download its `*_diff_2k.jpg`, keep the filename above.

- [ ] **Step 2: Add the attribution entry**

Append to `ATTRIBUTION.md` before the closing `---` section:

```markdown
## Ground Texture

**File:** `public/textures/rocky_trail_diff_2k.jpg`

- **Title:** Rocky Trail (2k diffuse)
- **Creator:** [Poly Haven](https://polyhaven.com/a/rocky_trail)
- **License:** [CC0 1.0 (Public Domain)](https://creativecommons.org/publicdomain/zero/1.0/)
- **Modifications:** None. Tiled via `RepeatWrapping` on the flat ground plane (`Ground` component).
```

- [ ] **Step 3: Commit**

```bash
git add public/textures/rocky_trail_diff_2k.jpg ATTRIBUTION.md
git commit -m "feat: add CC0 ground texture asset (Poly Haven rocky_trail)"
```

---

### Task 2: Textured `Ground` component

**Files:**
- Create: `src/world/Ground.tsx`
- Modify: `src/world/Markers.tsx` (replace the inline ground-plane JSX, lines ~76–82)

- [ ] **Step 1: Create `src/world/Ground.tsx`**

```tsx
import { useTexture } from "@react-three/drei";
import { RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { GROUND_SIZE_M, groundAnchor, groundQuat } from "./everestSite";
import { FloatingGroup } from "./FloatingGroup";

/** One texture repeat covers this many meters of ground — ~2 cm/texel at 2k. */
const TEXTURE_TILE_M = 40;

const configure = (texture: Texture | Texture[]) => {
	for (const t of Array.isArray(texture) ? texture : [texture]) {
		t.wrapS = RepeatWrapping;
		t.wrapT = RepeatWrapping;
		t.repeat.setScalar(GROUND_SIZE_M / TEXTURE_TILE_M);
		t.anisotropy = 16;
		t.colorSpace = SRGBColorSpace;
	}
};

/** Flat sea-level ground plane tangent to Earth at Everest's lat/lon, with a tiling rock texture so altitude reads visually. */
export function Ground() {
	const texture = useTexture("/textures/rocky_trail_diff_2k.jpg", configure);
	return (
		<FloatingGroup absolute={groundAnchor}>
			<mesh quaternion={groundQuat}>
				<planeGeometry args={[GROUND_SIZE_M, GROUND_SIZE_M]} />
				<meshStandardMaterial map={texture} />
			</mesh>
		</FloatingGroup>
	);
}
```

- [ ] **Step 2: Use it in `Markers.tsx`**

Replace the inline ground block:

```tsx
{/* Flat ground plane tangent to Earth at Everest's true lat/lon (sea level) — large enough to hold the cone and the player/box area beside it */}
<FloatingGroup absolute={groundAnchor}>
	<mesh quaternion={groundQuat}>
		<planeGeometry args={[GROUND_SIZE_M, GROUND_SIZE_M]} />
		<meshStandardMaterial color="#7a7060" />
	</mesh>
</FloatingGroup>
```

with:

```tsx
{/* Flat textured ground plane tangent to Earth at Everest's true lat/lon (sea level) */}
<Ground />
```

Add `import { Ground } from "./Ground";` and remove the now-unused imports from `./everestSite` (`GROUND_SIZE_M`, `groundAnchor`, `groundQuat` — keep the ones still used by the box helpers: `BOX_CLUSTER_ORIGIN`, `surfaceQuat`, `tangent`, `up`). `noUnusedLocals` will fail the build if any import is left dangling.

- [ ] **Step 3: Static gates**

```bash
pnpm build && rtk proxy pnpm lint
```

Expected: build succeeds, lint exit 0.

- [ ] **Step 4: Visual check**

With `pnpm dev` running, via Playwright MCP on `http://localhost:5173` (click the canvas region is unnecessary — `__debug` works without pointer lock):

```js
() => {
	const { teleport, viewpoints } = window.__debug;
	teleport(viewpoints.playerStart, viewpoints.conePeak);
}
```

Screenshot 1: ground should show rock texture detail at standing height.
Then teleport 3 km up to confirm altitude now reads visually:

```js
() => {
	const { teleport, viewpoints } = window.__debug;
	const p = viewpoints.playerStart;
	const c = viewpoints.earthCenter;
	const up = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
	const len = Math.hypot(...up);
	const lifted = p.map((v, i) => v + (up[i] / len) * 3000);
	teleport(lifted, p);
}
```

Screenshot 2: tiled texture from 3 km — repetition will be visible; that's accepted (spec: anti-tiling is optional later polish).

- [ ] **Step 5: Commit**

```bash
git add src/world/Ground.tsx src/world/Markers.tsx
git commit -m "feat: tiling rock texture on the ground plane (milestone 1)"
```

---

### Task 3: Heightmap build script + data

**Files:**
- Create: `scripts/build-everest-heightmap.mjs`
- Create: `public/terrain/everest_heightmap.bin` (generated, committed)
- Modify: `package.json` (devDependency + script), `.gitignore`, `ATTRIBUTION.md`

- [ ] **Step 1: Add the `geotiff` devDependency**

```bash
pnpm add -D geotiff
```

- [ ] **Step 2: Ignore the DEM tile cache**

Append to `.gitignore`:

```
scripts/.dem-cache/
```

- [ ] **Step 3: Write `scripts/build-everest-heightmap.mjs`**

```js
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
const EVEREST_LAT = 27.986065;
const EVEREST_LON = 86.922623;
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
			const row = Math.min(height - 1, Math.max(0, Math.floor((latSW + 1 - lat) * height)));
			const col = Math.min(width - 1, Math.max(0, Math.floor((lon - lonSW) * width)));
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
```

- [ ] **Step 4: Add the npm script**

In `package.json` `"scripts"`:

```json
"build:heightmap": "node scripts/build-everest-heightmap.mjs"
```

- [ ] **Step 5: Run it and sanity-check**

```bash
pnpm build:heightmap
ls -l public/terrain/everest_heightmap.bin
```

Expected: file is exactly **526,338 bytes** (513×513×2); printed **max ≈ 8,700–8,900 m** (Everest summit; GLO-30 is a surface model so a few meters off 8,849 is normal), **min ≈ 1,000–4,000 m** (valleys at the patch edge). If max is wildly off (e.g. < 8,000), the sampling grid is misaligned — check the tile/row/col math before proceeding.

- [ ] **Step 6: Attribution**

Append to `ATTRIBUTION.md`:

```markdown
## Everest Heightmap

**File:** `public/terrain/everest_heightmap.bin` (generated by `scripts/build-everest-heightmap.mjs`)

- **Source data:** Copernicus DEM GLO-30, via the [AWS Open Data registry](https://registry.opendata.aws/copernicus-dem/)
- **Credit:** Produced using Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA; all rights reserved.
- **Modifications:** Clipped to ~30×30 km around the Everest summit, resampled to a 513×513 uint16 grid (meters above sea level).
```

- [ ] **Step 7: Commit**

```bash
git add scripts/build-everest-heightmap.mjs public/terrain/everest_heightmap.bin package.json pnpm-lock.yaml .gitignore ATTRIBUTION.md
git commit -m "feat: Copernicus GLO-30 heightmap build script + Everest data"
```

---

### Task 4: Terrain geometry builder

**Files:**
- Modify: `src/world/constants.ts` (add `TERRAIN_SIZE_M`)
- Create: `src/world/everestTerrain.ts`

- [ ] **Step 1: Add the terrain extent constant**

In `src/world/constants.ts`, after `EVEREST_LON`:

```ts
/** Side length of the square DEM terrain patch centered on the summit. Must match scripts/build-everest-heightmap.mjs. */
export const TERRAIN_SIZE_M = 30_000;
```

- [ ] **Step 2: Create `src/world/everestTerrain.ts`**

```ts
// Builds the Everest diorama mesh from the offline-generated heightmap
// (public/terrain/everest_heightmap.bin — see scripts/build-everest-heightmap.mjs).
// Geometry is in the local site frame used with `surfaceQuat`: +X east,
// +Y up (height above sea level), +Z north, origin at groundAnchor.
// Heights are TRUE elevation — the summit sits 8,849 m above the sea-level
// ground plane — and the patch borders feather to zero so the massif rises
// out of the flat plane like a museum diorama.
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
			color.lerpColors(ROCK, SNOW, smoothstep(SNOW_LINE_LOW_M, SNOW_LINE_HIGH_M, h));
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
		throw new Error(`heightmap has ${heights.length} samples, expected ${expected}`);
	}
	return buildTerrainGeometry(heights);
}
```

(Triangle winding gives +Y-facing front faces: for unit quad NW=(0,0,1) NE=(1,0,1) SW=(0,0,0) SE=(1,0,0), (NW,NE,SW) and (NE,SE,SW) both have CCW normals pointing up.)

- [ ] **Step 3: Static gates + commit**

```bash
pnpm build && rtk proxy pnpm lint
git add src/world/constants.ts src/world/everestTerrain.ts
git commit -m "feat: Everest terrain geometry builder (diorama feather + elevation colors)"
```

(The new module is exported-but-unused for one commit — `noUnusedLocals` doesn't flag module exports.)

---

### Task 5: Wire the terrain in, retire the cone

**Files:**
- Modify: `src/world/everestSite.ts` (renames + site clearance)
- Modify: `src/world/constants.ts` (remove `EVEREST_BASE_RADIUS_M`)
- Modify: `src/world/Mountain.tsx` (full rewrite)
- Modify: `src/player/playerStore.ts` (import rename)
- Modify: `src/debug/debugApi.ts` (viewpoint renames)
- Modify: `src/world/Markers.tsx` (comment only — "cone" wording)

- [ ] **Step 1: Update `src/world/everestSite.ts`**

Rename and re-derive the layout points (the cone is gone; the terrain patch is centered on the summit's lat/lon):

- Import `TERRAIN_SIZE_M` from `./constants`; drop the `EVEREST_BASE_RADIUS_M` import.
- Replace the `CONE_CENTER` / `CONE_PEAK` / `SITE_CLEARANCE_M` block with:

```ts
/** Center of the terrain patch, on the (sea-level) ground, directly below the summit. */
export const TERRAIN_CENTER = groundAnchor.clone();

/** Everest's summit — true height above sea level, directly above the patch center. */
export const SUMMIT = groundAnchor.clone().addScaledVector(up, EVEREST_HEIGHT_M);

/** How far east of the patch center the player/box area sits — clear of the 15 km terrain half-extent by 2.5 km. */
const SITE_CLEARANCE_M = TERRAIN_SIZE_M / 2 + 2_500;
```

- Update the `GROUND_SIZE_M` doc comment: "large enough to hold the 30 km terrain patch and the player/box area beside it".
- Update the file-top comment: "cone" → "terrain patch".

- [ ] **Step 2: Remove `EVEREST_BASE_RADIUS_M` from `src/world/constants.ts`** (the cone was its only consumer).

- [ ] **Step 3: Rewrite `src/world/Mountain.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { BufferGeometry } from "three";
import { groundAnchor, surfaceQuat } from "./everestSite";
import { loadEverestTerrainGeometry } from "./everestTerrain";
import { FloatingGroup } from "./FloatingGroup";

/**
 * True-scale Everest from Copernicus GLO-30 data, diorama style: a 30 km
 * displaced grid anchored at the sea-level ground anchor, summit at true
 * 8,849 m, borders feathered into the flat ground plane. Renders nothing
 * until the heightmap fetch resolves (~526 KB).
 */
export function Mountain() {
	const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
	useEffect(() => {
		let cancelled = false;
		loadEverestTerrainGeometry().then((g) => {
			if (!cancelled) setGeometry(g);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	if (!geometry) return null;
	return (
		<FloatingGroup absolute={groundAnchor}>
			<mesh quaternion={surfaceQuat} geometry={geometry}>
				<meshStandardMaterial vertexColors />
			</mesh>
		</FloatingGroup>
	);
}
```

- [ ] **Step 4: Rename consumers**

`src/player/playerStore.ts` line 3 + 18: `CONE_PEAK` → `SUMMIT` (initial look-at — the player now starts 17.5 km east, gazing at the summit ~27° up; that's the intended opening shot).

`src/debug/debugApi.ts`: import `SUMMIT, TERRAIN_CENTER` instead of `CONE_PEAK, CONE_CENTER`; viewpoints become:

```ts
const VIEWPOINTS = {
	summit: toTuple(SUMMIT),
	terrainCenter: toTuple(TERRAIN_CENTER),
	playerStart: toTuple(PLAYER_START),
	boxCluster: toTuple(BOX_CLUSTER_ORIGIN),
	earthCenter: [0, 0, 0] as Vec3Tuple,
	moon: [MOON_DIST_M, 0, 0] as Vec3Tuple,
	sun: [AU_M, 0, 0] as Vec3Tuple,
} satisfies Record<string, Vec3Tuple>;
```

`src/world/Markers.tsx`: update the two comments mentioning the cone ("True-scale Everest cone…" → "True-scale Everest DEM terrain, anchored at the ground anchor"; the box-cluster comment's "beside the cone" → "beside the terrain patch").

- [ ] **Step 5: Static gates**

```bash
pnpm build && rtk proxy pnpm lint
```

Expected: clean. Most likely failure: a missed `CONE_*` import (`tsc` will name the file).

- [ ] **Step 6: Visual verification (Playwright MCP, `pnpm dev` running)**

Note `viewpoints.conePeak`/`coneBase` no longer exist — use the new names.

1. **Opening shot:** reload the page (initial spawn). Screenshot: real ridgelines west of the player, snowcapped summit, textured ground in the foreground. The terrain takes one fetch to appear — wait for it.
2. **Summit view:**
```js
() => {
	const { teleport, viewpoints } = window.__debug;
	teleport(viewpoints.summit, viewpoints.terrainCenter);
}
```
Screenshot: standing at the true summit looking down (snow vertex colors nearby).
3. **Diorama overview** — 60 km above the patch center, looking down:
```js
() => {
	const { teleport, viewpoints } = window.__debug;
	const c = viewpoints.terrainCenter;
	const e = viewpoints.earthCenter;
	const up = [c[0] - e[0], c[1] - e[1], c[2] - e[2]];
	const len = Math.hypot(...up);
	teleport(c.map((v, i) => v + (up[i] / len) * 60000), c);
}
```
Screenshot: full massif as a plinth on the textured plane; feathered skirt should meet the plane without cliffs or gaps.
4. **Canary regression:**
```js
() => {
	const { teleport, viewpoints } = window.__debug;
	const b = viewpoints.boxCluster;
	teleport([b[0], b[1], b[2]].map((v, i) => v + (i === 0 ? 8 : 0)), b);
}
```
Screenshot: the 2 m boxes still render crisp (1 cm gaps resolved, no z-fighting) with the terrain in frame — the log-depth canary still passes.

If the mountain looks inside-out (dark/missing faces from above), the winding is flipped — swap the two index triplets in `buildTerrainGeometry`.

- [ ] **Step 7: Commit**

```bash
git add src/world/everestSite.ts src/world/constants.ts src/world/Mountain.tsx src/world/Markers.tsx src/player/playerStore.ts src/debug/debugApi.ts
git commit -m "feat: replace placeholder cone with Copernicus DEM Everest diorama (milestone 2)"
```

---

### Task 6: Documentation truth-up

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/superpowers/specs/2026-06-10-content-roadmap-design.md`

- [ ] **Step 1: `CLAUDE.md`**

- File map: `Mountain.tsx` entry → "true-scale Everest terrain from the Copernicus GLO-30 heightmap (diorama: borders feathered into the flat ground), anchored at `groundAnchor`"; `everestSite.ts` entry: named points are now (`TERRAIN_CENTER`, `SUMMIT`, `PLAYER_START`, `BOX_CLUSTER_ORIGIN`, …). Add a line for `everestTerrain.ts` (geometry builder) and `scripts/build-everest-heightmap.mjs` (offline DEM → `public/terrain/everest_heightmap.bin`; rerun via `pnpm build:heightmap`).
- Debug example: `teleport(viewpoints.coneBase, viewpoints.conePeak)` → `teleport(viewpoints.terrainCenter, viewpoints.summit)`, and the viewpoint list `conePeak`, `coneBase` → `summit`, `terrainCenter`.

- [ ] **Step 2: `README.md`**

- Overview bullets: "true-scale Mount Everest (8,849m tall) using a cone geometry" → "a true-scale Mount Everest built from Copernicus GLO-30 elevation data (summit at 8,849 m)"; mention the textured ground plane.
- "What's next" list: mark items 1–2 done or drop them, leaving landmarks as the next step.

- [ ] **Step 3: Spec truth-up** (`docs/superpowers/specs/2026-06-10-content-roadmap-design.md`, Milestone 2 section)

Reword to match what was built: raw 16-bit binary instead of PNG ("browser canvas decodes PNG at 8 bits; raw uint16 is exact"), and feather-only instead of base-subtraction ("heights stay true elevation above the sea-level plane — the summit is at real 8,849 m; only the borders feather to zero"). Note the site clearance moved to 17.5 km to clear the patch footprint.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md docs/superpowers/specs/2026-06-10-content-roadmap-design.md
git commit -m "docs: update file map, README, and spec for ground texture + DEM Everest"
```
