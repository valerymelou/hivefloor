# 0017. Make the office the landing page, with a labelled demo while empty

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

The first version of the site put a heading, a boxed office and feature cards on a white page, and the office app put its panels in a solid column beside the scene. Both hid the thing the project is about. The landing page also shows the owner's real sessions, so whenever nobody is working a visitor finds an empty building.

## Decision drivers

- A visitor should see the office, working, in the first second.
- Simulated robots must never be mistaken for real work, or appear beside real ones.
- A dropped connection or a gap between two sessions shouldn't swap every robot on screen.
- No new dependencies, and no hand edits to Ndop UI's copied-in source.

## Considered options

1. Keep the landing page strictly live, and accept an empty building.
2. Always show the simulator on the landing page, and link to the real office.
3. Show the real office whenever anyone is in it, and the labelled simulator otherwise.

## Decision outcome

Chosen option: 3, because the page is alive at any hour and stays honest about what it shows.

- The office fills the page from a laptop up, and its panels float over it as translucent glass. On phones they stack under the scene as before. Devices that count as low power get near-solid panels, since blurring a moving 3D scene costs frames.
- The landing page is an iframe of `/office/#showcase` filling the screen, with the project's name, links and credits drawn over it by the site. A pre-rendered shot of the office shows until it loads.
- `#showcase` keeps the relay connected and feeds the page from `ShowcaseSource`. Real robots win at once. The simulator starts when the first snapshot is empty or the relay can't be reached, and takes over from a real office only after 30 seconds without agents. Every switch clears the view and the feed, so the two never mix, and a badge reads "Demo: simulated robots" while the simulator runs.
- `/office/` never falls back: empty there means empty. `/office/#demo` stays as a direct link.
- Guides are laid out by `pages/docs.page.ts`, because Analog makes every Markdown file in `src/content` a route of its own, and those routes take precedence over a `[slug]` page.

### Consequences

- Good: the landing page is never empty, and it needs no copy to explain what the project does.
- Good: the simulator is the same one `#demo` uses, so no new code paths produce robots.
- Bad: "Today" now totals each room, so the breakdown by kind of work is no longer shown.
- Bad: visitors to the landing page hold a WebSocket even while watching the simulator, as they did before.
- Bad: panels cover part of the scene on smaller laptops. They are translucent, and the camera can be moved.

## More information

- `apps/web/src/app/core/showcase.ts` holds the rule, `core/showcase-source.ts` the wiring.
- Supersedes the landing page layout described in [ADR 0016](0016-site-and-release.md).
