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
};

/** Subagents are smaller "contractor" robots (W2). */
export const SUBAGENT_SCALE = 0.78;

/** How much lighter than the room colour a subagent is (W2). */
export const SUBAGENT_LIGHTEN = 0.35;
