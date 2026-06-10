# Star Climber

A three-dimensional visualization experience that shows the scale of the universe by starting at a true-scale Mount Everest and zooming out to see the whole Earth from orbit.

**Stack:** React 19 + TypeScript + Vite + Three.js + React Three Fiber/Drei

## Overview

Star Climber renders:
- A true-scale Mount Everest (8,849m tall) using a cone geometry
- A true-scale Earth sphere (6,371,000m radius) textured with a 8k daymap
- Both objects in a single coordinate space with logarithmic depth buffering for precise rendering at planetary scales

## Current state & what's next

The floating-origin base is verified and clean (Milestone 5). The scene currently holds minimal placeholder content. Next work in rough order:

1. **Replace placeholder cone** with a heightmap-based Everest mesh.
2. textured ground to give the sense of height when flying up. with a solid color, everything looks the same from 1 km up.
3. **Add more landmarks to the ground close to everest**: burj khalifa, normal building, human, blue whale, etc.
4. **Add rich content to space** — Solar system bodies. stars. galaxies. superclusters. real data as much as possible. perhaps break this step down. how to make it look good from a distance? are stars going to subside into void, or form a coherent cloud? do i need to artifically draw a cloud to mimic the galaxy feel? what problems to rendering billions of stars at the same time? LOD necessary? need to ground this in objective tests, FPS, etc.
5. **Better HUD** — show important bodies with a marker on the HUD, with distance. perhaps toggle to show or not show each of them.
6. **Quick movement** - cool "move to" landmark. moves in a smooth way to show the target, or to a specific position, like "above the galaxy"

Decouple content from logic!!! logic works perfect, adding content should not mess logic.

I tried to add physics for the first part, but there is a trade off:
- Use rapier, and accept complexity + limiting physics to the first part only
- Hand code the kinematics, since its just platforms and stuff. possible, tried it, but wasn't that fun. in the end, flying around is already pretty fun.

Decided against adding any physics.


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
