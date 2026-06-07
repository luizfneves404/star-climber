# Milestone 1: True-scale Everest, viewable

## Purpose

Star Climber's core conceit is conveying cosmic scale by starting the player on a
true-to-scale Mount Everest and later letting them pull back to see the whole Earth,
then beyond. Before building any gameplay, we need to confirm the foundational
assumption: that a single true-scale (meters) Three.js coordinate space, combined
with a logarithmic depth buffer, renders correctly both at human-walking distance
and from far enough away to see the mountain shrink — with no z-fighting or
precision artifacts.

This milestone is a throwaway visual scaffold: a placeholder cone-shaped mountain
at Everest's true height, viewable with an orbit camera. It proves the rendering
approach works before any physics, character, or detail work is invested.

## Scope

**In scope:**
- Add `@react-three/fiber`, `@react-three/drei`, and `three` as dependencies
- A `<Canvas>` configured with `near: 0.1`, `far: 5e7`, and `logarithmicDepthBuffer: true`
- A placeholder `<Mountain />` component: a `ConeGeometry` with height 8849m and a
  base radius of roughly 10000m, positioned so its base sits at world origin (y=0)
- Basic lighting: one directional light (sun) plus a low-intensity ambient light
- `drei`'s `<OrbitControls />`, initialized so the camera starts a few hundred
  meters from the mountain's base, with the orbit target near `[0, 500, 0]`

**Out of scope (deferred to later milestones):**
- The Earth sphere and the dolly-out "reveal" sequence
- Rapier physics, the character controller, and any movement
- Real heightmap-based terrain, textures, or any visual detail beyond a flat-shaded cone
- Mode switching (climb vs. flight) or any state machine

## Coordinate system

World origin `(0, 0, 0)` = the base of the mountain, Y = up. All distances are in
meters and use real-world Everest scale (8849m height). This origin placement keeps
every coordinate the player will interact with under ~10,000 — well within the
range where float32 GPU precision is sub-millimeter, per the scale analysis that
motivated this whole approach.

## What "done" looks like

Running the dev server and opening the app shows a cone-shaped mountain, true to
Everest's height, lit by a directional light. Dragging with the mouse orbits the
camera around it; scrolling zooms in toward the base and out far enough to see the
whole mountain shrink to a small shape with no flickering, z-fighting, or texture
swimming at any zoom level.

## Testing approach

This is a visual scaffold — there's no logic to unit test. Verification is manual:
run `pnpm dev`, load the page, and visually confirm the mountain renders cleanly
at both close range (looking up from the base) and from far away (zoomed out
enough to see it as a small shape against the background), with stable rendering
throughout the zoom range.
