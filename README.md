# Star Climber

A three-dimensional visualization experience that shows the scale of the universe: start standing on a true-scale Mount Everest and free-fly outward until the whole Earth — then the solar system, the Milky Way, and other galaxies — comes into view.

**Stack:** React 19 + TypeScript + Vite + Three.js + React Three Fiber/Drei

**Live demo:** https://star-climber.pages.dev

## Overview

Star Climber renders, in one continuous coordinate space with logarithmic depth buffering (no tiers, no cross-fade):
- A true-scale Mount Everest diorama built from the Copernicus GLO-30 DEM, summit at its real elevation, edges feathered into the surrounding ground
- A textured sea-level ground plane (60 km, tiling rock texture) that the Everest diorama rises out of
- A size-comparison landmark exhibit (human → bus → whale → 10-storey building → Burj Khalifa)
- A true-scale Earth sphere textured with an 8k daymap, plus a textured Moon and Sun
- The Milky Way — a procedurally generated galaxy (seeded, density-function-based: 4 arms, diffuse disk, thick disk, bulge, stellar halo) with the Sun embedded in its disk, plus a local-star bubble so the sky is filled in every direction from the solar system
- 8 real named hero galaxies (Andromeda, Triangulum, the Magellanic Clouds, Whirlpool, Sombrero, M81, Pinwheel) at their real right ascension / declination / distance — each cross-fades to a single point of light past ~40–120 galaxy radii, the way real unresolved galaxies look
- The observable universe in simple form: a 200k-point deep field out to the 46 Gly comoving radius (each point one galaxy, redshift-tinted), fading in as you leave the Milky Way; at the rim, forward goes black
- A second world at `?world=sizes`: the same engine, but true-scale objects lined up in increasing size (human → bus → whale → Burj Khalifa → Everest → Moon → Earth → Jupiter → Sun → Betelgeuse → Neptune's orbit → the Milky Way)

The core engineering challenge is rendering seamlessly across ~27 orders of magnitude when float32 only holds ~7 digits of precision — solved with a floating-origin camera (see `CLAUDE.md` for details).

## Current state & what's next

The content roadmap is closed: floating-origin base, layered space content out to the edge of the observable universe, HUD markers, fly-to, and the size-comparison world (`?world=sizes`, switched by a URL param read once at load — a page reload, not a router). See `CLAUDE.md`'s file map for how the pieces fit together.

Content stays decoupled from logic the boring way: plain data arrays mapped in ordinary JSX, components split by domain as they grow. A generic content registry was considered and rejected (JSX already is the declarative content format). Physics was also considered and rejected — flying around is already the fun part.

Remaining ideas:
1. on load page popup: attribution, instructions, etc



## Building and Running

```bash
pnpm install
pnpm dev      # Start dev server
pnpm build    # Build for production
pnpm lint     # Check code quality
pnpm deploy   # Build and deploy to Cloudflare Pages (requires `wrangler login`)
```

## Project Structure

See `docs/PROJECT_NOTES.md` for high-level context, and `docs/superpowers/` for detailed design specs and implementation plans for each milestone.

## Attributions & Licenses

This project uses third-party assets. See **[ATTRIBUTION.md](./ATTRIBUTION.md)** for full details, including:

- **Earth Texture:** CC-BY 4.0 from Solar System Scope (via Wikimedia Commons)
