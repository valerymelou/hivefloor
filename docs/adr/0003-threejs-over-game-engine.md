# 0003. Render the office with Three.js, not a game engine

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

The office is a 3D scene with animated robots, rooms that grow and shrink, floating labels and an orbit camera, embedded in a web page with an accessible overlay. Which rendering technology should it use?

## Decision drivers

- Initial transfer under 1.5 MB compressed, including the 3D library and one character model.
- 60 fps on a 2020 laptop and 30 fps on a mid-range phone with 10 robots.
- Works inside an Angular app and an embed, alongside regular DOM for accessibility.
- Easy for web developers to read and contribute to.

## Considered options

1. Three.js with GLTFLoader, SkeletonUtils, CSS2DRenderer and OrbitControls.
2. Babylon.js.
3. A game engine exporting to WebGL (Unity, Godot, PlayCanvas).
4. A framework wrapper (for example a declarative scene layer).

## Decision outcome

Chosen option: **Three.js**, because it is mature, small when tree-shaken, very well documented and familiar to web developers. Everything Hivefloor needs (skinned glTF characters, instancing, CSS labels, orbit controls) is in the core or its examples. The scene code stays plain, framework-agnostic TypeScript under `apps/web/src/app/scene/`, wrapped by one Angular component.

### Consequences

- Good: small bundle, fast start, no proprietary runtime or editor.
- Good: scene logic is testable TypeScript; contributors need only web skills.
- Bad: we write our own simple navigation (waypoints) and animation state handling instead of using an engine's.
- Bad: we must dispose every geometry, material and texture ourselves; this is a code-review rule.

## More information

- PRD: Office web app requirements W1–W13, Web performance, Tech stack.
