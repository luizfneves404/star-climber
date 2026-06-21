// Shared additive point-cloud material for every star/galaxy cloud (stars, Milky
// Way, hero galaxies, catalog). A star is a POINT SOURCE: its on-screen size is
// essentially constant (sub-pixel / imaging PSF), and what changes with distance is
// BRIGHTNESS ∝ 1/distance², not size. So this material:
//   - draws each point at a constant small pixel size (aSize gives the brightest a
//     slight bloom), so stars stay crisp pinpoints instead of ballooning into smudges
//   - drives alpha by luminosity / distance², so bright stars are brighter (not
//     bigger) and galaxies glow from afar as thousands of faint points overlap, then
//     separate into crisp dots as you fly in
//   - draws a tight bright core + small faint halo from gl_PointCoord (additive)
//   - exposes uOpacity for distance-driven fades (e.g. the Milky Way fade-in)
//
// FLOAT32 TRAP: brightness ∝ 1/distance² can't be computed from raw meters —
// mvPosition.z is float32 and astronomical distances (~1e21 m) squared overflow
// (>3.4e38 → Inf). We normalize distance by a per-cloud reference radius (uRefDist,
// the cloud's radiusM) BEFORE squaring, keeping every value in float32 range.
//
// GOTCHA: a raw ShaderMaterial does NOT inherit the scene's logarithmic depth
// buffer. Without the logdepthbuf chunks + the USE_LOGDEPTHBUF define, these
// points z-fight against everything else (which IS log-depth). The chunks below
// are mandatory — verify with a near object and a far star both on screen.
import { AdditiveBlending, ShaderMaterial } from "three";

const vertexShader = /* glsl */ `
	attribute float aSize;   // per-point luminosity (see galaxy.ts)
	attribute vec3 color;
	uniform float uRefDist;       // cloud reference radius (meters) for distance normalization
	uniform float uBrightnessCoef; // dimensionless brightness scale
	uniform float uBasePx;        // constant point size in CSS px
	uniform float uBloomPx;       // extra px per unit luminosity (bright stars bloom slightly)
	uniform float uPixelRatio;
	varying vec3 vColor;
	varying float vBrightness;

	#include <common>
	#include <logdepthbuf_pars_vertex>

	void main() {
		vColor = color;
		vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
		gl_Position = projectionMatrix * mvPosition;

		// Constant pinpoint size (NOT distance-divided), with a small luminosity bloom.
		gl_PointSize = clamp((uBasePx + uBloomPx * aSize) * uPixelRatio, 0.0, 12.0 * uPixelRatio);

		// Brightness ∝ luminosity / distance². Divide by uRefDist INSIDE length() so
		// the components are O(1) before they're squared — squaring raw meters (~1e21)
		// overflows float32 (>3.4e38 → Inf), which would zero out brightness.
		float s = length(mvPosition.xyz / uRefDist);
		vBrightness = aSize * uBrightnessCoef / max(s * s, 1e-6);

		#include <logdepthbuf_vertex>
	}
`;

const fragmentShader = /* glsl */ `
	precision highp float;
	uniform float uOpacity;
	varying vec3 vColor;
	varying float vBrightness;

	#include <logdepthbuf_pars_fragment>

	void main() {
		#include <logdepthbuf_fragment>
		float d = length(gl_PointCoord - vec2(0.5));
		if (d > 0.5) discard;
		// Tight bright core + small faint halo → reads as a star, not a uniform fuzz.
		float falloff = smoothstep(0.5, 0.0, d);
		float core = pow(falloff, 6.0);
		float halo = falloff * 0.25;
		float shape = core + halo;
		gl_FragColor = vec4(vColor, clamp(shape * vBrightness * uOpacity, 0.0, 1.0));
	}
`;

export interface StarPointsOptions {
	/** Cloud reference radius in meters (the galaxy's radiusM); normalizes distance. */
	refDistM: number;
	/** Dimensionless brightness scale; at viewing distance ≈ refDistM, alpha ≈ aSize*this. */
	brightnessCoef?: number;
	/** Constant point size in CSS px. */
	basePx?: number;
	/** Extra px per unit luminosity, so the brightest stars bloom slightly. */
	bloomPx?: number;
	/** Initial cloud opacity (animate via material.uniforms.uOpacity.value). */
	opacity?: number;
}

/** Build the shared additive points material. Each cloud gets its own instance. */
export function makeStarPointsMaterial({
	refDistM,
	brightnessCoef = 4,
	basePx = 1.8,
	bloomPx = 3,
	opacity = 1,
}: StarPointsOptions): ShaderMaterial {
	return new ShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms: {
			uRefDist: { value: refDistM },
			uBrightnessCoef: { value: brightnessCoef },
			uBasePx: { value: basePx },
			uBloomPx: { value: bloomPx },
			// Device pixel ratio is sampled once at creation; this app doesn't move
			// windows between displays, so we don't track live DPR changes.
			uPixelRatio: { value: window.devicePixelRatio || 1 },
			uOpacity: { value: opacity },
		},
		defines: { USE_LOGDEPTHBUF: "" },
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending,
	});
}
