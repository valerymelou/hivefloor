import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { ClipRole } from '../behaviour';
import type { CharacterSet } from '../character';

/** A loaded character, ready to clone once per robot. */
export interface CharacterTemplate {
  readonly set: CharacterSet;
  readonly scene: THREE.Object3D;
  readonly clips: Readonly<Record<ClipRole, THREE.AnimationClip>>;
  /** Scale that makes a main robot `set.height` tall. */
  readonly scale: number;
  /** Where the hips sit in the sitting pose, facing +x, at full size. */
  readonly hips: THREE.Vector3;
  /** Frees the model's geometry and materials. */
  dispose(): void;
}

/**
 * Loads a character set (W13) and calibrates sitting: it poses a probe in the
 * sitting clip and measures where the hips land, so seated robots end up on
 * their seat whatever the model's proportions.
 *
 * @param set - The character set.
 * @param baseUrl - The page's base URL; the model URL is relative to it.
 * @returns The template.
 */
export async function loadCharacter(
  set: CharacterSet,
  baseUrl: string,
): Promise<CharacterTemplate> {
  const gltf = await new GLTFLoader().loadAsync(new URL(set.url, baseUrl).href);
  const byName = new Map(gltf.animations.map((clip) => [clip.name, clip]));
  const clip = (role: ClipRole): THREE.AnimationClip => {
    const found = byName.get(set.clips[role]);
    if (found === undefined) throw new Error(`The character has no "${set.clips[role]}" clip`);
    return found;
  };
  const clips = { idle: clip('idle'), walk: clip('walk'), sit: clip('sit'), wave: clip('wave') };

  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const scale = set.height / (bounds.max.y - bounds.min.y);

  const probe = SkeletonUtils.clone(gltf.scene);
  probe.scale.setScalar(scale);
  probe.rotation.y = Math.PI / 2;
  const mixer = new THREE.AnimationMixer(probe);
  mixer.clipAction(clips.sit).play();
  mixer.update(0.6);
  probe.updateMatrixWorld(true);
  const hips = new THREE.Vector3();
  probe.getObjectByName(set.hips)?.getWorldPosition(hips);
  mixer.stopAllAction();
  mixer.uncacheRoot(probe);

  return {
    set,
    scene: gltf.scene,
    clips,
    scale,
    hips,
    dispose: () => {
      gltf.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          (node.geometry as THREE.BufferGeometry).dispose();
          const materials: THREE.Material[] = Array.isArray(node.material)
            ? (node.material as THREE.Material[])
            : [node.material as THREE.Material];
          for (const m of materials) m.dispose();
        }
      });
    },
  };
}
