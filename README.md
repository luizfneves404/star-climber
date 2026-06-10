# Star Climber

A three-dimensional visualization experience that shows the scale of the universe by starting at a true-scale Mount Everest and zooming out to see the whole Earth from orbit.

**Stack:** React 19 + TypeScript + Vite + Three.js + React Three Fiber/Drei

## Overview

Star Climber renders:
- A true-scale Mount Everest diorama built from the Copernicus GLO-30 DEM, summit at its real elevation, edges feathered into the surrounding ground
- A textured sea-level ground plane (60 km, tiling rock texture) that the Everest diorama rises out of
- A true-scale Earth sphere (6,371,000m radius) textured with a 8k daymap
- Both objects in a single coordinate space with logarithmic depth buffering for precise rendering at planetary scales

## Current state & what's next

The floating-origin base is verified and clean (Milestone 5). The approach for every upcoming item is decided — see `docs/superpowers/specs/2026-06-10-content-roadmap-design.md` for the full design.

Done so far (milestones 1–2): the ground plane has a tiling texture, and Mount Everest is a real Copernicus GLO-30 DEM diorama (true-scale summit, edges feathered into the ground).

Remaining build order (each step independently shippable):

1. **Ground landmarks** — size-comparison exhibit near the player start: boxes for generic structures, primitive-stack Burj Khalifa, CC0 glTF human and blue whale.
2. **Space content** — layered point clouds: textured solar-system spheres, HYG star catalog (~120k real stars, one `Points` cloud), an artificial particle-cloud Milky Way it dissolves into, and a real galaxy catalog beyond. Distance-driven opacity fades, no tiers, FPS measured per layer via a `__debug` frame-time probe.
3. **HUD markers** — projected labels + distance for in-view bodies, side panel with toggles for all of them.
4. **Fly-to** — log-distance glide (equal time per order of magnitude) to auto-derived or hand-authored viewpoints, cancelled by any movement input.

Content stays decoupled from logic the boring way: plain data arrays mapped in ordinary JSX, components split by domain as they grow. A generic content registry was considered and rejected (JSX already is the declarative content format). Physics was also considered and rejected — flying around is already the fun part.


## Building and Running

```bash
pnpm install
pnpm dev      # Start dev server
pnpm build    # Build for production
pnpm lint     # Check code quality
```

## Project Structure

See `docs/PROJECT_NOTES.md` for high-level context, and `docs/superpowers/` for detailed design specs and implementation plans for each milestone.

## Attributions & Licenses

This project uses third-party assets. See **[ATTRIBUTION.md](./ATTRIBUTION.md)** for full details, including:

- **Earth Texture:** CC-BY 4.0 from Solar System Scope (via Wikimedia Commons)
