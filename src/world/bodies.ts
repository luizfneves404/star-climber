// The single source of truth for "notable bodies" — the things the HUD labels,
// the side panel lists, and fly-to targets. The shape `{ name, position, radius,
// viewpoint }` is shared by HUD (milestone 5), fly-to (milestone 6), and
// __debug.viewpoints, so they can't drift. Everything is in absolute
// Earth-centered meters (float64); see FloatingGroup.tsx.
import { Vector3 } from "three";
import {
	AU_M,
	EARTH_RADIUS_M,
	MOON_DIST_M,
	MOON_RADIUS_M,
	STAR_DIST_M,
	SUN_RADIUS_M,
} from "./constants";
import { PLAYER_START, SUMMIT } from "./everestSite";
import { HERO_GALAXIES, heroAnchor } from "./heroGalaxies";

/** Visible marker radius for Proxima — its true radius is sub-pixel, so the
 * test marker (and the fly-to framing distance) use this oversized value. */
export const STAR_MARKER_R = 5e9;

const along = (d: number) => new Vector3(d, 0, 0);

// Body positions, also imported by Markers.tsx so the rendered meshes and the
// metadata can't disagree.
export const EARTH_POS = new Vector3(0, 0, 0);
export const MOON_POS = along(MOON_DIST_M);
export const SUN_POS = along(AU_M);
export const STAR_POS = along(STAR_DIST_M);

export interface Body {
	/** Stable lowercase key (matches the hero-galaxy name where applicable). */
	id: string;
	/** Display label. */
	name: string;
	/** Absolute Earth-centered position, meters (float64). */
	position: Vector3;
	/** Visual extent in meters; fly-to stops at a multiple of this. */
	radius: number;
	/** Optional fixed fly-to override; otherwise a dynamic straight approach is used. */
	viewpoint?: { position: Vector3; lookAt: Vector3 };
}

/** Pretty display names for the hero galaxies (keys are their lowercase ids). */
const GALAXY_DISPLAY: Record<string, string> = {
	andromeda: "Andromeda",
	triangulum: "Triangulum",
	lmc: "Large Magellanic Cloud",
	smc: "Small Magellanic Cloud",
	whirlpool: "Whirlpool",
	sombrero: "Sombrero",
	m81: "M81",
	pinwheel: "Pinwheel",
};

export const BODIES: Body[] = [
	{ id: "earth", name: "Earth", position: EARTH_POS, radius: EARTH_RADIUS_M },
	{ id: "moon", name: "Moon", position: MOON_POS, radius: MOON_RADIUS_M },
	{ id: "sun", name: "Sun", position: SUN_POS, radius: SUN_RADIUS_M },
	{
		id: "proxima",
		name: "Proxima Centauri",
		position: STAR_POS,
		radius: STAR_MARKER_R,
	},
	...HERO_GALAXIES.map(
		(g): Body => ({
			id: g.name,
			name: GALAXY_DISPLAY[g.name] ?? g.name,
			position: heroAnchor(g),
			radius: g.radiusM,
		}),
	),
	{
		id: "everest",
		name: "Everest summit",
		position: SUMMIT,
		radius: 5000,
		// Return to the starting vantage: standing beside the patch, looking up.
		viewpoint: { position: PLAYER_START.clone(), lookAt: SUMMIT.clone() },
	},
];

export const bodyById = (id: string): Body | undefined =>
	BODIES.find((b) => b.id === id);

/** Multiple of a body's radius to stop at when auto-deriving a viewpoint. */
const FLYTO_K = 3;

/**
 * Where fly-to should end up. Uses the body's fixed override if present;
 * otherwise a dynamic straight approach — stand `FLYTO_K × radius` from the
 * center along the line from `fromPos`, looking at the center.
 */
export function flyToViewpoint(
	body: Body,
	fromPos: Vector3,
): { position: Vector3; lookAt: Vector3 } {
	if (body.viewpoint) return body.viewpoint;
	const dir = fromPos.clone().sub(body.position);
	// Degenerate case (already at the center): pick an arbitrary stable axis.
	if (dir.lengthSq() === 0) dir.set(1, 0, 0);
	dir.normalize();
	const position = body.position
		.clone()
		.addScaledVector(dir, FLYTO_K * body.radius);
	return { position, lookAt: body.position.clone() };
}
