# Character sets

A character set is a glTF model plus a map of its animation clips to the four things a robot does. The default is RobotExpressive (CC0 1.0).

## The format

A set is a `CharacterSet` object (`apps/web/src/app/scene/character.ts`):

| Field          | Meaning                                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `url`          | The model, relative to the page, usually under `apps/web/public/models/`.                                                               |
| `height`       | How tall a main-session robot stands, in metres. Subagents are drawn at 78% of this.                                                    |
| `tintMaterial` | The name of the material that takes the room's colour.                                                                                  |
| `hips`         | The bone used to place a sitting robot on its seat.                                                                                     |
| `clips`        | The clip names for `idle`, `walk`, `sit` and `wave`. `wave` plays once, the others loop.                                                |
| `typing`       | Optional. The arm bones, and the rotations from the sitting pose that reach the desk. Without it, working robots keep the sitting pose. |

The model must face +z. To use your own set, pass it as `character` when the scene is created in `apps/web/src/app/office/office-canvas.ts`.

## Licensing

Only use a model whose licence allows redistribution, and credit it in `THIRD_PARTY_NOTICES.md`. The model file is served to every visitor.

## Optimising a model

The Content Security Policy doesn't allow WebAssembly, so use quantization rather than meshopt or Draco, which need a WebAssembly decoder:

```bash
pnpm dlx @gltf-transform/cli@4.5.1 optimize input.glb output.glb --compress quantize --texture-compress false --simplify false
```

Check afterwards that `tintMaterial` still exists, for example with `gltf-transform inspect`.
