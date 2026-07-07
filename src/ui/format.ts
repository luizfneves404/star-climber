// Shared HUD formatters — used by the readout, the body labels, and the panel.
import { LIGHT_YEAR_M } from "../world/constants";

/** Distance in meters → human-readable string (m / km / M km / ly / Mly / Gly). */
export const fmtDist = (m: number) => {
	const ly = m / LIGHT_YEAR_M;
	if (ly >= 1e8)
		return `${(ly / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })} Gly`;
	if (ly >= 1e5)
		return `${(ly / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })} Mly`;
	if (ly >= 0.1)
		return `${ly.toLocaleString(undefined, { maximumFractionDigits: 2 })} ly`;
	const km = m / 1000;
	if (km >= 1e6)
		return `${(km / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}M km`;
	if (km >= 1)
		return `${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
	return `${m.toFixed(0)} m`;
};

/** Speed in m/s → human-readable string (m/s / km/s). */
export const fmtSpeed = (mps: number) => {
	if (mps >= 1e6)
		return `${(mps / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km/s`;
	if (mps >= 1000)
		return `${(mps / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km/s`;
	return `${mps.toFixed(1)} m/s`;
};
