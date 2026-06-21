// A tiny, allocation-free frame-time probe. PlayerRig calls recordFrame(dt) once
// per frame (it already has dt); debugApi exposes readFrameStats() on
// window.__debug so Playwright can read an N-frame average before/after adding a
// render layer and attribute its FPS cost. No store, no React — just a ring buffer
// of recent frame deltas read on demand.

const SAMPLES = 120;
const deltasMs = new Float64Array(SAMPLES);
let count = 0; // total frames recorded (caps the averaging window before the ring fills)
let cursor = 0;

/** Record one frame's duration. `dtSeconds` is the value useFrame passes. */
export function recordFrame(dtSeconds: number): void {
	deltasMs[cursor] = dtSeconds * 1000;
	cursor = (cursor + 1) % SAMPLES;
	count++;
}

export interface FrameStats {
	avgFrameMs: number;
	fps: number;
	/** How many frames the average is over (ramps up to SAMPLES). */
	samples: number;
}

/** Average over the most recent up-to-SAMPLES frames. */
export function readFrameStats(): FrameStats {
	const n = Math.min(count, SAMPLES);
	if (n === 0) return { avgFrameMs: 0, fps: 0, samples: 0 };
	let sum = 0;
	for (let i = 0; i < n; i++) sum += deltasMs[i];
	const avgFrameMs = sum / n;
	return {
		avgFrameMs,
		fps: avgFrameMs > 0 ? 1000 / avgFrameMs : 0,
		samples: n,
	};
}
