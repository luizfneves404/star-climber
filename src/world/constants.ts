// Physical constants (SI meters). Everything in the world is authored and
// simulated in absolute, Earth-centered meters (float64); see FloatingGroup.tsx
// for how those huge coordinates become precise camera-relative render coords.
export const EARTH_RADIUS_M = 6_371_000;
export const MOON_RADIUS_M = 1_737_000;
export const SUN_RADIUS_M = 696_340_000;
export const MOON_DIST_M = 384_400_000;
export const AU_M = 149_597_870_700;

export const EVEREST_HEIGHT_M = 8849;
export const EVEREST_BASE_RADIUS_M = 10_000;
export const EVEREST_LAT = 27.988056;
export const EVEREST_LON = 86.925278;

/** Side length of the square DEM terrain patch centered on the summit. Must match scripts/build-everest-heightmap.mjs. */
export const TERRAIN_SIZE_M = 30_000;

// Outer test markers — the point is the magnitude spread, not realism.
const LIGHT_YEAR_M = 9.461e15;
export const STAR_DIST_M = 4.0 * LIGHT_YEAR_M; // ~Proxima, ~3.8e16 m
export const GALAXY_DIST_M = 2.6e20; // ~galactic center, ~27,000 ly

// Render frustum (meters). Logarithmic depth spans this whole range.
export const NEAR_M = 0.05;
export const FAR_M = 1e21; // out past the galaxy marker

/**
 * Unit vector for a geographic (lat, lon) on the globe, aligned to three.js'
 * default SphereGeometry UVs and a standard equirectangular daymap (prime
 * meridian at texture center, longitude increasing eastward). Multiply by a
 * radius to get a surface position; the same vector is the local "up".
 */
export const latLonToUnitVector = (
	latDeg: number,
	lonDeg: number,
): [number, number, number] => {
	const lat = (latDeg * Math.PI) / 180;
	const lon = (lonDeg * Math.PI) / 180;
	const cosLat = Math.cos(lat);
	return [cosLat * Math.cos(lon), Math.sin(lat), -cosLat * Math.sin(lon)];
};
