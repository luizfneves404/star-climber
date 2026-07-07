import { usePlayerStore } from "../player/playerStore";
import { ACTIVE_WORLD } from "../world/activeWorld";
import { BODIES } from "../world/bodies";
import { fmtDist } from "./format";
import { useHudMarkersStore } from "./hudMarkersStore";

// Side panel listing every notable body with its live distance. The checkbox
// toggles that body's on-screen label; clicking the name flies to it. This is
// how off-screen bodies are discovered (no edge arrows — fly-to is the answer).
// pointerEvents:auto on a separate element, so its clicks never reach the canvas
// (no accidental pointer-lock).
export function BodyPanel() {
	const markers = useHudMarkersStore((s) => s.markers);
	const enabled = useHudMarkersStore((s) => s.enabled);
	const toggle = useHudMarkersStore((s) => s.toggle);
	const startFlyTo = usePlayerStore((s) => s.startFlyTo);
	const flyToTarget = usePlayerStore((s) => s.flyToTarget);

	const distById = new Map(markers.map((m) => [m.id, m.distanceM]));

	return (
		<div
			style={{
				position: "fixed",
				top: 12,
				right: 12,
				padding: "8px 10px",
				font: "12px/1.5 ui-monospace, monospace",
				color: "#e8e8e8",
				background: "rgba(0,0,0,0.55)",
				borderRadius: 8,
				pointerEvents: "auto",
				minWidth: 220,
			}}
		>
			<div style={{ opacity: 0.6, marginBottom: 4, letterSpacing: 0.3 }}>
				bodies — click to fly
			</div>
			{BODIES.map((body) => {
				const dist = distById.get(body.id);
				const isTarget = flyToTarget?.id === body.id;
				return (
					<div
						key={body.id}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							padding: "1px 0",
						}}
					>
						<input
							type="checkbox"
							checked={enabled.has(body.id)}
							onChange={() => toggle(body.id)}
							title="show label"
							style={{ cursor: "pointer", margin: 0 }}
						/>
						<button
							type="button"
							onClick={() => startFlyTo(body)}
							style={{
								flex: 1,
								display: "flex",
								justifyContent: "space-between",
								gap: 12,
								background: "none",
								border: "none",
								padding: 0,
								font: "inherit",
								color: isTarget ? "#8fd0ff" : "#e8e8e8",
								cursor: "pointer",
								textAlign: "left",
							}}
						>
							<span>{body.name}</span>
							<span style={{ opacity: 0.7 }}>
								{dist === undefined ? "—" : fmtDist(dist)}
							</span>
						</button>
					</div>
				);
			})}
			<div style={{ marginTop: 6, opacity: 0.6 }}>
				{ACTIVE_WORLD === "sizes" ? (
					<a href="?world=universe" style={{ color: "#8fd0ff" }}>
						→ universe
					</a>
				) : (
					<a href="?world=sizes" style={{ color: "#8fd0ff" }}>
						→ size comparison
					</a>
				)}
			</div>
		</div>
	);
}
