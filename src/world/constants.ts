// Physical constants (SI meters). Everything in the world is authored and
// simulated in absolute, Earth-centered meters (float64); see FloatingGroup.tsx
// for how those huge coordinates become precise camera-relative render coords.
import { Vector3 } from "three";

export const EARTH_RADIUS_M = 6_371_000;
export const MOON_RADIUS_M = 1_737_000;
export const SUN_RADIUS_M = 696_340_000;
export const MOON_DIST_M = 384_400_000;
export const AU_M = 149_597_870_700;

/** Absolute position of the Sun: along +X at 1 AU (the scene's fixed sun direction). */
export const SUN_POS = new Vector3(AU_M, 0, 0);

export const LIGHT_YEAR_M = 9.461e15;
export const PARSEC_M = 3.0857e16;

export const EVEREST_HEIGHT_M = 8849;
export const EVEREST_LAT = 27.988056;
export const EVEREST_LON = 86.925278;

/** Side length of the square DEM terrain patch centered on the summit. Must match scripts/build-everest-heightmap.mjs. */
export const TERRAIN_SIZE_M = 30_000;

// Outer test markers — the point is the magnitude spread, not realism.
export const STAR_DIST_M = 4.0 * LIGHT_YEAR_M; // ~Proxima, ~3.8e16 m

// Render frustum (meters). Logarithmic depth spans this whole range — with a log
// buffer the far plane costs almost no near-field precision (relative precision is
// ~uniform), so we push it out to observable-universe scale for the space content
// (Andromeda ~2.4e22, the outer-galaxy catalog ~1e25). The cm-apart summit canary
// boxes verify the near field still resolves at this range.
export const NEAR_M = 0.05;
export const FAR_M = 1e27;

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

/**
 * Unit vector for a celestial (right ascension, declination) direction.
 *
 * SIMPLIFICATION: we treat the world axes as the ICRS equatorial frame — RA acts
 * as longitude, Dec as latitude — reusing {@link latLonToUnitVector}. The Sun
 * already sits at a fixed `+X` direction (RA 0h, Dec 0°), so the starfield is NOT
 * registered to Everest's horizon or to a real date/sidereal time. That mismatch
 * is invisible once you leave Earth; modeling axial tilt / sidereal rotation isn't
 * worth it. A celestial position is `SUN_POS + raDecToUnitVector(...) * distanceM`.
 */
export const raDecToUnitVector = (
	raHours: number,
	decDeg: number,
): [number, number, number] => latLonToUnitVector(decDeg, raHours * 15);
