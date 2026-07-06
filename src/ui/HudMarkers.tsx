import { fmtDist } from "./format";
import { useHudMarkersStore } from "./hudMarkersStore";

// Screen-projected labels for the bodies whose label is enabled (opt-in via the
// side panel). Positions come from HudProjector each frame. pointerEvents:none
// so labels never steal clicks / pointer-lock from the canvas.
export function HudMarkers() {
	const markers = useHudMarkersStore((s) => s.markers);
	const enabled = useHudMarkersStore((s) => s.enabled);

	return (
		<div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
			{markers.map((m) =>
				enabled.has(m.id) && m.onScreen ? (
					<div
						key={m.id}
						style={{
							position: "absolute",
							left: m.x,
							top: m.y,
							transform: "translate(-50%, -50%)",
							font: "12px/1.3 ui-monospace, monospace",
							color: "#e8e8e8",
							textShadow: "0 0 4px #000, 0 0 4px #000",
							whiteSpace: "nowrap",
							textAlign: "center",
						}}
					>
						<div style={{ fontSize: 18, lineHeight: 1, opacity: 0.85 }}>⊹</div>
						<div>{m.name}</div>
						<div style={{ opacity: 0.7 }}>{fmtDist(m.distanceM)}</div>
					</div>
				) : null,
			)}
		</div>
	);
}
