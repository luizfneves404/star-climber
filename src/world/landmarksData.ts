// Data and layout for the size-comparison exhibit (see Landmarks.tsx for rendering).
// Kept in a separate .ts file so Landmarks.tsx only exports a component,
// satisfying the react-refresh/only-export-components ESLint rule.
import {
	binormal,
	EYE_HEIGHT_M,
	SITE_GROUND_POINT,
	tangent,
	up,
} from "./everestSite";

// ─── Exhibit anchor ────────────────────────────────────────────────────────────

/**
 * Ground-level anchor for the size-comparison exhibit.
 * 100 m in the +binormal direction from the player-start clearing.
 */
export const LANDMARKS_EXHIBIT_ORIGIN =
	SITE_GROUND_POINT.clone().addScaledVector(binormal, 100);

// ─── Landmark definitions ──────────────────────────────────────────────────────

export interface LandmarkDef {
	label: string;
	/** Width along the east (+local X) axis, meters. */
	w: number;
	/** Height along the up (+local Y) axis, meters. */
	h: number;
	/** Depth along the north (+local Z) axis, meters. */
	d: number;
	color: string;
}

/** Gap between adjacent objects along the east axis, meters. */
export const LANDMARK_GAP_M = 10;

/**
 * True-scale size-comparison objects, ordered smallest → largest.
 *
 * Human and blue whale are box stand-ins for now.
 * Replace with CC0 low-poly glTF models (Quaternius / Kenney / Poly Haven)
 * and record the license in ATTRIBUTION.md.
 */
export const LANDMARKS: LandmarkDef[] = [
	// ~average adult human (box stand-in)
	{ label: "Human", w: 0.6, h: 1.75, d: 0.25, color: "#e8c89a" },
	// typical city double-decker (London Routemaster proportions)
	{ label: "Double-decker bus", w: 13.5, h: 4.4, d: 2.55, color: "#cc2200" },
	// blue whale, longest animal (~30 m); box stand-in
	{ label: "Blue whale", w: 30, h: 4.0, d: 7.0, color: "#3a6080" },
	// generic 10-storey commercial block (~3 m per floor)
	{ label: "10-storey building", w: 20, h: 30, d: 20, color: "#7a8eaa" },
];

/**
 * Burj Khalifa silhouette: four tapered sections, total 828 m.
 * Dimensions are approximate — the silhouette is the landmark.
 */
export const BURJ_SECTIONS: { w: number; d: number; h: number }[] = [
	{ w: 50, d: 50, h: 300 }, // lower body
	{ w: 35, d: 35, h: 250 }, // mid taper
	{ w: 20, d: 20, h: 200 }, // upper taper
	{ w: 8, d: 8, h: 78 }, //   needle   (300+250+200+78 = 828 ✓)
];

// ─── Layout (computed once at module load) ─────────────────────────────────────

type P3 = [number, number, number];

function buildLayout() {
	let cursor = 0;

	const landmarks = LANDMARKS.map((lm) => {
		cursor += lm.w / 2;
		const east = cursor;
		cursor += lm.w / 2 + LANDMARK_GAP_M;
		return {
			lm,
			position: [east, lm.h / 2, 0] as P3,
			args: [lm.w, lm.h, lm.d] as P3,
		};
	});

	// Extra 100 m clearance before the Burj Khalifa base.
	const burjEast = cursor + 100 + BURJ_SECTIONS[0].w / 2;

	let y = 0;
	const burj = BURJ_SECTIONS.map((sec) => {
		const cy = y + sec.h / 2;
		y += sec.h;
		return {
			position: [burjEast, cy, 0] as P3,
			args: [sec.w, sec.h, sec.d] as P3,
		};
	});

	return { landmarks, burjEast, burj };
}

export const LAYOUT = buildLayout();

// ─── Debug viewpoints ──────────────────────────────────────────────────────────

/**
 * Stand 300 m in front of the exhibit (–binormal), at eye height.
 * From here the entire row is visible left-to-right, with the Burj Khalifa
 * tower dominating the right side of the view.
 */
export const LANDMARKS_VIEWPOINT = LANDMARKS_EXHIBIT_ORIGIN.clone()
	.addScaledVector(binormal, -300)
	.addScaledVector(up, EYE_HEIGHT_M);

/**
 * Look-at target paired with LANDMARKS_VIEWPOINT: the Burj Khalifa at 100 m
 * height, giving a diagonal sightline across the whole exhibit row.
 */
export const LANDMARKS_LOOK_AT = LANDMARKS_EXHIBIT_ORIGIN.clone()
	.addScaledVector(tangent, LAYOUT.burjEast)
	.addScaledVector(up, 100);
