// Physical constants (SI meters)
export const EARTH_RADIUS_M = 6_371_000;
export const MOON_RADIUS_M = 1_737_000;
export const SUN_RADIUS_M = 696_340_000;
export const MOON_DIST_M = 384_400_000;
export const AU_M = 149_597_870_700;

export const EVEREST_HEIGHT_M = 8849;
export const MOUNTAIN_BASE_M = 10_000;
export const EVEREST_LAT = 27.986065;
export const EVEREST_LON = 86.922623;

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

// --- Canonical render space ---
// Every tier is normalized so that Earth's radius == 1 canonical unit.
// A tier authored in units where `1 unit = metersPerUnit meters` is placed in a
// group scaled by `metersPerUnit / EARTH_RADIUS_M`, which maps that tier's Earth
// to canonical radius 1. Because of this, the camera's canonical distance maps to
// real meters-from-Earth-center identically for every tier — so a single camera
// and a single dolly drive all tiers continuously.
export const canonScale = (metersPerUnit: number) =>
	metersPerUnit / EARTH_RADIUS_M;

// canonical distance <-> real meters from Earth center
export const dcToMeters = (dc: number) => dc * EARTH_RADIUS_M;
export const metersToDc = (m: number) => m / EARTH_RADIUS_M;

// --- Tier seam ---
// Earth fills a comfortable fraction of the frame at ~25,000 km from center.
export const SEAM_M = 2.5e7;
export const SEAM_DC = metersToDc(SEAM_M); // ~3.92

// Cross-fade window (in canonical distance) centered on the seam.
export const FADE_LO_DC = 3.0;
export const FADE_HI_DC = 6.0;

// Dolly limits (canonical distance from Earth center).
export const MIN_DC = metersToDc(EARTH_RADIUS_M + 30_000); // ~30 km above surface
export const MAX_DC = metersToDc(2.5 * AU_M); // out past Earth's orbit

export const smoothstep = (lo: number, hi: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
	return t * t * (3 - 2 * t);
};
