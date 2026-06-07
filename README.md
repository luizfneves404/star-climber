# Star Climber

A three-dimensional visualization experience that shows the scale of the universe by starting at a true-scale Mount Everest and zooming out to see the whole Earth from orbit.

**Stack:** React 19 + TypeScript + Vite + Three.js + React Three Fiber/Drei

## Overview

Star Climber renders:
- A true-scale Mount Everest (8,849m tall) using a cone geometry
- A true-scale Earth sphere (6,371,000m radius) textured with a 2k daymap
- Both objects in a single coordinate space with logarithmic depth buffering for precise rendering at planetary scales

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
