# 0015. Draw the office from pure geometry, with one Three.js edge

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

M6 draws the office: an elastic building, robots that walk and sit, floating tags, a camera and a robot card. The shared `layout` function says which room and desk everything has, but not where that is in metres, how a robot gets there or how to keep the page fast.

## Decision drivers

- Pure core, thin edges: geometry and walking must be unit-testable without WebGL.
- First render of the overlay under 1.5 s on 4G; initial transfer under 1.5 MB compressed.
- 60 fps on a laptop and 30 fps on a mid-range phone with 10 robots.
- A strict Content Security Policy.
- Every visitor sees the same robot in the same place.

## Decision outcome

**Pure modules, one edge.** `scene/plan` turns the layout into metres, `scene/navigation` plans walks from any position, `scene/behaviour` decides what a robot does and what its tag says, and `scene/camera` handles framing, orbiting and picking. Only `scene/render/` imports Three.js, and one Angular component wraps it. The render code is covered by the Playwright scenarios rather than unit coverage.

**The building.** The corridor runs along x from the exit. The west end of every floor is a lobby, with a coffee corner on one side and stairs on the other; rooms sit in bays east of it. Desk rows grow away from the corridor, so a seated robot never moves when a room grows (H14). Each floor has its own coffee corner, so a break doesn't mean a walk between floors.

**Lazy loading.** The scene and Three.js are a separate chunk, loaded after the overlay. Initial JavaScript and CSS are about 100 KB compressed, the scene chunk about 150 KB and the model about 98 KB: about 350 KB in total.

**Quantization, not meshopt.** The PRD suggested meshopt, which saves another 19 KB compressed but needs a WebAssembly decoder and `'wasm-unsafe-eval'` in the Content Security Policy. The saving isn't worth weakening the policy.

**Bounded GPU work.** Desks, chairs, monitors and stools are instanced (E9). Monitors use per-instance colour. Rooms show their lights through floor colour, and a fixed pool of six desk lights goes to robots at work, so the shader doesn't recompile as robots come and go. Distant robots update their animation less often.

**Low power.** Phones and browsers without a GPU get no shadows, no desk lights and at most 1.5× resolution. A frame may advance time by at most 0.5 s, so robots keep real time at low frame rates.

**Status mapping.** Working robots sit. Thinking and waiting robots stand by their desk, while subagents keep their seat when thinking. Idle robots go for coffee. Away robots leave the building and walk back in on their next event (H9).

**Compact tags.** Desks are 2 m apart, so a three-line tag collides with its neighbour's. A tag is a small bulb with the icon for the kind of work, and opens to the full text on hover. It also opens for about 3 s when a robot's activity changes, one robot per room at a time, so a visitor who isn't touching anything still sees what is happening. Phones have no hover, so a tap opens the robot card. The project name is on the room label and goals are in Building in public, so nothing is lost from the default view.

**Picking.** A click counts for the nearest robot within 24 pixels of the line from its feet to its tag, because small far-away robots are hard to hit exactly.

**Testing.** Playwright runs against the production build with the production headers, so a policy violation fails a test. `#demo-crowd` starts ten sessions for the frame-rate script. WebGL needs software rendering on CI, so walking scenarios use generous timeouts and two workers.

### Consequences

- Good: geometry, walking, tags and the camera are unit-tested without a browser.
- Good: the overlay doesn't wait for Three.js, and the list view still works if the scene fails to load.
- Good: the Content Security Policy didn't change.
- Bad: with several floors, an upper slab hides part of the floor below from steep angles; visitors can orbit, and the list view shows everyone.
- Bad: an icon alone says less than text; a visitor learns the icons from the moments they open.
- Bad: when a room grows, its walls rise over 600 ms, but its furniture appears at once.

## Alternatives considered

- **Meshopt or Draco compression.** Smaller, but needs WebAssembly in the Content Security Policy.
- **Lifts instead of stairs.** Simpler to walk, but the PRD asks for a stair.
- **One point light per desk, as in the prototype.** Fine for 14 desks, not for 144.
- **A raycast against the robot meshes for picking.** Precise, but costly on skinned meshes and hard to hit on phones.
