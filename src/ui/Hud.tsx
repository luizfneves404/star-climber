import { usePlayerStore } from "../player/playerStore";
import { EARTH_RADIUS_M } from "../world/constants";
import { useHudStore } from "./hudStore";

const fmtDist = (m: number) => {
	const km = m / 1000;
	if (km >= 1e6)
		return `${(km / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}M km`;
	if (km >= 1)
		return `${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
	return `${m.toFixed(0)} m`;
};

const fmtSpeed = (mps: number) => {
	if (mps >= 1e6)
		return `${(mps / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km/s`;
	if (mps >= 1000)
		return `${(mps / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km/s`;
	return `${mps.toFixed(1)} m/s`;
};

export function Hud() {
	const distanceMeters = useHudStore((s) => s.distanceMeters);
	const speed = usePlayerStore((s) => s.speed);
	const altitude = Math.max(0, distanceMeters - EARTH_RADIUS_M);

	return (
		<div
			style={{
				position: "fixed",
				top: 12,
				left: 12,
				padding: "10px 14px",
				font: "13px/1.5 ui-monospace, monospace",
				color: "#e8e8e8",
				background: "rgba(0,0,0,0.55)",
				borderRadius: 8,
				pointerEvents: "none",
				letterSpacing: 0.3,
			}}
		>
			<div>altitude: {fmtDist(altitude)}</div>
			<div>dist from center: {fmtDist(distanceMeters)}</div>
			<div>speed: {fmtSpeed(speed)}</div>
		</div>
	);
}
