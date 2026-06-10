# Earth Sphere — Design

## Goal

Add a true-scale Earth sphere beneath the mountain to validate that a
true-scale 8,849m mountain and a 12,742km-diameter sphere can render together
— at any zoom level, from close to the mountain to far enough away to see the
whole planet — without z-fighting or float-precision artifacts.

This is the next milestone suggested in `docs/PROJECT_NOTES.md`, and it's also
the highest-risk technical unknown remaining: it's the first time the scene
combines an extremely small-scale object (the mountain, ~10km across) with an
extremely large one (Earth, ~12,742km across) in a single true-scale coordinate
space. If the log-depth-buffer + float64 model-view-matrix approach (see
"Core technical decision" in the project notes) doesn't hold up at this combined
scale, this is where it would show.

## Architecture

One new component, `src/scene/Earth.tsx`, mirroring the existing
`src/scene/Mountain.tsx`:

- `SphereGeometry` with radius `6,371,000` meters (Earth's mean radius)
- 64×64 segments — enough to avoid visible faceting at the horizon when viewed
  from near the mountain, without over-engineering placeholder geometry. The
  texture's polar seams won't be visible since gameplay never approaches the
  sphere's surface directly.
- Positioned at `(0, -6371000, 0)` so the sphere's surface is tangent to the
  world origin `(0,0,0)` — i.e., the mountain's base sits exactly on the
  Earth's surface, per the planned scene layout in the project notes
- Textured with a real Earth daymap (see Texture Asset below) via drei's
  `useTexture` hook and `meshStandardMaterial map={texture}`
- Visual only — no physics collider, matching the project notes
  ("you only ever see it from far away, so its ~0.5m vertex quantization is
  invisible")

## Texture Asset

- File: `Solarsystemscope_texture_8k_earth_daymap.jpg` (2048×1024), licensed
  CC-BY 4.0 by Solar System Scope (solarsystemscope.com/textures), obtained via
  Wikimedia Commons
- Saved to `public/textures/earth_daymap.jpg`
- Loaded at runtime with `useTexture("/textures/earth_daymap.jpg")`

## Scene Wiring

Add `<Earth />` to `src/scene/Scene.tsx` alongside the existing `<Mountain />`.
No changes to `<OrbitControls>` or the camera — the existing setup
(`near: 0.1`, `far: 5e7`, no `OrbitControls` distance limits) already supports
zooming from close to the mountain out to a vantage point where the whole Earth
is visible.

## Verification

Manual, the same approach used to validate Milestone 1's placeholder cone:
orbit and zoom continuously from close range (near the mountain's base, where
the Earth's curvature is barely visible) out to far range (where the whole
sphere and the mountain are both tiny in frame), watching for z-fighting,
flickering, or vertex swimming at any point along that range.

## Out of Scope

- No flight mode, camera-driven free-fly, or "launch from the summit" sequence
  (that's a later milestone per the project notes)
- No physics/collider for the Earth sphere
- No higher-resolution texture, cloud layer, or night-side lighting — a single
  daymap is sufficient to validate rendering at scale
