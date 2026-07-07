// Every full galaxy star cloud in one array — the Milky Way (moved here from the
// old MilkyWay.tsx) plus the 8 hero galaxies — and their shared far-distance
// impostor cloud. The impostor is the fix for "galaxies fade to black": each
// cloud's points dim as 1/d² at constant pixel size, so past ~100 galaxy radii
// the whole cloud sums to nothing. Physically an unresolved galaxy's light lands
// in one point — so each galaxy gets one bright point here, cross-faded against
// its cloud by distance (the loop lives in GalaxyClouds.tsx).
import {
	BufferAttribute,
	BufferGeometry,
	Color,
	type ShaderMaterial,
	Vector3,
} from "three";
import { LIGHT_YEAR_M, PARSEC_M, SUN_POS } from "./constants";
import { makeGalaxy } from "./galaxy";
import { HERO_GALAXIES, heroAnchor } from "./heroGalaxies";
import { makeStarPointsMaterial } from "./StarPoints";

const MLY = 1e6 * LIGHT_YEAR_M;

const R_SUN_GAL = 8000 * PARSEC_M; // Sun's distance from the galactic center
export const MW_RADIUS = 15000 * PARSEC_M; // visible disk radius (~15 kpc)

// Center 8 kpc from the Sun, disk in the world XZ plane → Sun sits in the disk.
export const MW_CENTER = SUN_POS.clone().sub(new Vector3(R_SUN_GAL, 0, 0));

const MW_PALETTE = { core: "#fff3c8", edge: "#9bb8ff" };

export interface GalaxyCloud {
	name: string;
	anchor: Vector3;
	radiusM: number;
	geometry: BufferGeometry;
	material: ShaderMaterial;
	/** Designed impostor brightness as seen from the Sun (before the 1/d² law). */
	impostorBrightness: number;
}

/** Designed apparent impostor brightness from the Sun, per hero galaxy. Above 1
 * saturates at the Sun and buys headroom farther out — heroes should punch
 * through the deep-field background. */
const HERO_IMPOSTOR_B: Record<string, number> = {
	andromeda: 1.8,
	lmc: 1.6,
	smc: 1.2,
	triangulum: 1.2,
	whirlpool: 0.9,
	sombrero: 0.9,
	m81: 0.9,
	pinwheel: 0.9,
};

export const GALAXY_CLOUDS: GalaxyCloud[] = [
	{
		name: "milkyway",
		anchor: MW_CENTER,
		radiusM: MW_RADIUS,
		geometry: makeGalaxy({
			type: "spiral",
			radiusM: MW_RADIUS,
			particleCount: 150_000,
			palette: MW_PALETTE,
			armCount: 4,
			seed: 1,
		}),
		// bloomPx below default: from INSIDE the disk nearby stars saturate, and the
		// default bloom turned them into chunky balls instead of a milky band.
		material: makeStarPointsMaterial({
			refDistM: MW_RADIUS,
			opacity: 0.6,
			bloomPx: 1.2,
		}),
		impostorBrightness: 0, // computed below via fixed aSize, see IMPOSTOR notes
	},
	...HERO_GALAXIES.map(
		(g): GalaxyCloud => ({
			name: g.name,
			anchor: heroAnchor(g),
			radiusM: g.radiusM,
			geometry: makeGalaxy(g),
			material: makeStarPointsMaterial({ refDistM: g.radiusM, opacity: 1 }),
			impostorBrightness: HERO_IMPOSTOR_B[g.name] ?? 0.45,
		}),
	),
];

// ---------------------------------------------------------------------------
// Impostor cloud: one point per galaxy, anchored at SUN_POS. Positions are
// float32 RELATIVE to the Sun (max ~2.9e23 m → relative error ~1e-7, sub-pixel
// for a far point of light). aSize is derived so that, viewed from the Sun, a
// galaxy's impostor has its designed brightness B:
//   brightness = aSize · coef / s², s = dist/IMPOSTOR_REF  ⇒  aSize = B·s²/coef
// Beyond the Sun it keeps dimming as 1/d² like any point source. The Milky Way's
// impostor gets a fixed aSize (its "distance from the Sun" is inside the galaxy,
// so the formula is meaningless): brightness 1 when seen from 10 Mly out.
// bloomPx MUST stay 0 — these aSize values are not 0–5 luminosities, and the
// bloom term would blow every impostor up to the 12 px clamp.
// ---------------------------------------------------------------------------

const IMPOSTOR_REF = 10 * MLY;
const IMPOSTOR_COEF = 4;
const MW_IMPOSTOR_ASIZE = 0.5;

function buildImpostorGeometry(): BufferGeometry {
	const n = GALAXY_CLOUDS.length;
	const positions = new Float32Array(n * 3);
	const colors = new Float32Array(n * 3);
	const sizes = new Float32Array(n);
	const scratch = new Vector3();
	const core = new Color();
	const edge = new Color();

	GALAXY_CLOUDS.forEach((cloud, i) => {
		scratch.copy(cloud.anchor).sub(SUN_POS);
		positions[i * 3] = scratch.x;
		positions[i * 3 + 1] = scratch.y;
		positions[i * 3 + 2] = scratch.z;

		if (cloud.name === "milkyway") {
			sizes[i] = MW_IMPOSTOR_ASIZE;
			core.set(MW_PALETTE.core).lerp(edge.set(MW_PALETTE.edge), 0.5);
		} else {
			const hero = HERO_GALAXIES.find((g) => g.name === cloud.name);
			if (!hero) throw new Error(`impostor: no hero named ${cloud.name}`);
			const s = hero.distM / IMPOSTOR_REF;
			sizes[i] = (cloud.impostorBrightness * s * s) / IMPOSTOR_COEF;
			core.set(hero.palette.core).lerp(edge.set(hero.palette.edge), 0.5);
		}
		colors[i * 3] = core.r;
		colors[i * 3 + 1] = core.g;
		colors[i * 3 + 2] = core.b;
	});

	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	geometry.setAttribute("color", new BufferAttribute(colors, 3));
	geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
	geometry.setAttribute(
		"aFade",
		new BufferAttribute(new Float32Array(n), 1), // starts 0; driven per frame
	);
	return geometry;
}

export const IMPOSTOR_GEOMETRY = buildImpostorGeometry();

/** Per-frame fade attribute (1 − cloudFade per galaxy); written by GalaxyClouds. */
export const IMPOSTOR_FADE = IMPOSTOR_GEOMETRY.getAttribute(
	"aFade",
) as BufferAttribute;

export const IMPOSTOR_MATERIAL = makeStarPointsMaterial({
	refDistM: IMPOSTOR_REF,
	brightnessCoef: IMPOSTOR_COEF,
	basePx: 3.2, // slightly larger than field/deep-field points so heroes stand out
	bloomPx: 0,
	perPointFade: true,
});
