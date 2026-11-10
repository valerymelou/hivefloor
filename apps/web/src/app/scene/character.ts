import type { ClipRole } from './behaviour';

/**
 * A pluggable character set (W13): a glTF model plus the names of its clips for
 * each animation role. Swap the model by providing another set.
 */
export interface CharacterSet {
  /** The model's URL, relative to the page's base URL. */
  readonly url: string;
  /** How tall a main-session robot stands, in metres. Subagents are smaller. */
  readonly height: number;
  /** The material that takes the room's colour. */
  readonly tintMaterial: string;
  /** The bone used to place a sitting robot on its seat. */
  readonly hips: string;
  /** The clip for each animation role. */
  readonly clips: Readonly<Record<ClipRole, string>>;
  /** How to reach for the keyboard. Without it, working robots keep the sitting pose. */
  readonly typing?: Readonly<Record<'left' | 'right', ArmRig>>;
}

/** Rotations in radians, on each axis, added to a bone's sitting pose. */
export type BoneTilt = readonly [x: number, y: number, z: number];

/** The bones of one arm, and how each turns from sitting to typing. */
export interface ArmRig {
  readonly upper: string;
  readonly lower: string;
  readonly upperTilt: BoneTilt;
  readonly lowerTilt: BoneTilt;
}

/**
 * The default character: RobotExpressive by Tomás Laulhé (Quaternius), CC0 1.0,
 * as modified by Don McCurdy for the three.js examples. Quantized with
 * glTF-Transform (docs/adr/0015-3d-office.md).
 */
export const ROBOT_EXPRESSIVE: CharacterSet = {
  url: 'models/robot-expressive.glb',
  height: 1.32,
  tintMaterial: 'Main',
  hips: 'Hips',
  clips: { idle: 'Idle', walk: 'Walking', sit: 'Sitting', wave: 'Wave' },
  typing: {
    left: {
      upper: 'UpperArmL',
      lower: 'LowerArmL',
      upperTilt: [0.305, 0, -0.807],
      lowerTilt: [-0.208, 0.705, -0.193],
    },
    right: {
      upper: 'UpperArmR',
      lower: 'LowerArmR',
      upperTilt: [-0.023, 0, 0.766],
      lowerTilt: [-0.42, 0.586, 0.328],
    },
  },
};

/** Subagents are smaller "contractor" robots (W2). */
export const SUBAGENT_SCALE = 0.78;

/** How much lighter than the room colour a subagent is (W2). */
export const SUBAGENT_LIGHTEN = 0.35;
