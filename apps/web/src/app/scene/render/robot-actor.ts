import type { Robot, Room } from '@hivefloor/schema';
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  restClip,
  tagContent,
  type ClipRole,
  type Motion,
  type Pose,
  type Target,
} from '../behaviour';
import type { ArmRig, BoneTilt } from '../character';
import { typingSeed, typingSwing } from '../typing';
import { SUBAGENT_LIGHTEN, SUBAGENT_SCALE } from '../character';
import { advance, route } from '../navigation';
import type { Plan, Point, SpotPlan } from '../plan';
import type { CharacterTemplate } from './character-loader';
import { renderTag } from './tags';

/** Walking speed in metres per second. */
const SPEED = 1.7;
const FADE = 0.3;

/** The local axis that lifts and lowers a forearm. */
const FOREARM_AXIS = new THREE.Vector3(1, 0, 0);

/** Reused every frame, so that typing allocates nothing. */
const BLEND = new THREE.Quaternion();

/** One arm's bones, and how it turns to reach the keyboard. */
interface Arm {
  readonly side: 'left' | 'right';
  readonly upper: THREE.Object3D;
  readonly lower: THREE.Object3D;
  readonly upperTilt: THREE.Quaternion;
  readonly lowerTilt: THREE.Quaternion;
  /** The clip's pose under the typing, saved so it can be put back. */
  readonly upperClipPose: THREE.Quaternion;
  readonly lowerClipPose: THREE.Quaternion;
}

/**
 * One robot in the scene (W2, W3): a tinted clone of the character, its
 * animations, its walk along a planned path and its floating tag (W4).
 */
export class RobotActor {
  /** The robot's model. */
  readonly object: THREE.Object3D;
  /** Its floating tag. */
  readonly tag: CSS2DObject;
  private readonly tagElement: HTMLElement;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: Record<ClipRole, THREE.AnimationAction>;
  private readonly materials: THREE.Material[] = [];
  private readonly size: number;
  private current: THREE.AnimationAction | undefined;
  private after: ClipRole | undefined;
  private position: Point;
  private path: readonly Point[] = [];
  private yaw = 0;
  private motion: Motion = 'resting';
  private pose: Pose = 'stand';
  private target: Target | undefined;
  private atSpot: SpotPlan | undefined;
  private outside = false;
  private leaving = false;
  private done = false;
  private frames = 0;
  private pendingDt = 0;
  private tagKey = '';
  private badgeText: string | undefined;
  private rendered = false;
  private changed = false;
  private tagState = '';
  private readonly arms: readonly Arm[];
  private readonly typingSeed: number;
  private typingTime = 0;
  /** From 0 (hands in the sitting pose) to 1 (on the keyboard). */
  private typingBlend = 0;
  private handsPosed = false;

  /**
   * @param template - The loaded character.
   * @param robot - The robot's record.
   * @param color - Its room's colour.
   * @param lane - Its corridor lane.
   * @param shadows - Whether it casts shadows.
   * @param start - Where it appears.
   * @param arriving - Whether it walks in (its tag says "Arriving").
   */
  constructor(
    private readonly template: CharacterTemplate,
    private robot: Robot,
    private readonly color: string,
    private readonly lane: number,
    shadows: boolean,
    start: Point,
    arriving: boolean,
  ) {
    if (arriving) this.motion = 'arriving';
    const subagent = robot.parent !== undefined;
    this.size = subagent ? SUBAGENT_SCALE : 1;
    this.object = SkeletonUtils.clone(template.scene);
    this.object.scale.setScalar(template.scale * this.size);
    const tint = new THREE.Color(color);
    if (subagent) tint.lerp(new THREE.Color(0xffffff), SUBAGENT_LIGHTEN);
    this.object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = shadows;
      node.receiveShadow = shadows;
      const original = node.material as THREE.Material;
      if (
        original.name === template.set.tintMaterial &&
        original instanceof THREE.MeshStandardMaterial
      ) {
        const tinted = original.clone();
        tinted.color = tint;
        tinted.roughness = 0.45;
        node.material = tinted;
        this.materials.push(tinted);
      }
    });
    this.mixer = new THREE.AnimationMixer(this.object);
    this.actions = {
      idle: this.mixer.clipAction(template.clips.idle),
      walk: this.mixer.clipAction(template.clips.walk),
      sit: this.mixer.clipAction(template.clips.sit),
      wave: this.mixer.clipAction(template.clips.wave),
    };
    this.actions.wave.setLoop(THREE.LoopOnce, 1);
    this.actions.wave.clampWhenFinished = true;
    this.mixer.addEventListener('finished', () => {
      if (this.after !== undefined && this.motion === 'resting') this.play(this.after);
      this.after = undefined;
    });

    this.arms = this.findArms();
    this.typingSeed = typingSeed(robot.key);

    this.tagElement = document.createElement('div');
    this.tagElement.className = 'hf-tag';
    this.tagElement.dataset['robot'] = robot.key;
    const wrapper = document.createElement('div');
    wrapper.className = 'hf-tag-anchor';
    wrapper.append(this.tagElement);
    this.tag = new CSS2DObject(wrapper);
    this.position = start;
    this.place(start);
  }

  /** The robot's key. */
  get key(): string {
    return this.robot.key;
  }

  /** Whether it is in the building and drawn. */
  get visible(): boolean {
    return !this.outside && !this.done;
  }

  /** Whether it is sitting at its desk, working. */
  get workingAtDesk(): Target['desk'] {
    return this.motion === 'resting' && this.pose === 'sit' && this.robot.status === 'working'
      ? this.target?.desk
      : undefined;
  }

  /** Whether it is standing at its desk, thinking or waiting. */
  get standingAtDesk(): Target['desk'] {
    return this.motion === 'resting' && this.pose === 'stand' ? this.target?.desk : undefined;
  }

  /** Where the robot is heading: one robot per zone shows text at a time. */
  get zone(): string {
    const destination = this.target?.destination;
    if (destination === undefined || destination.kind === 'exit') return 'exit';
    return destination.kind === 'room'
      ? destination.room.id
      : `coffee:${String(destination.coffee.floor)}`;
  }

  /**
   * Tells whether its activity changed since the last call.
   *
   * @returns `true` once per change.
   */
  takeChanged(): boolean {
    const changed = this.changed;
    this.changed = false;
    return changed;
  }

  /**
   * Opens or closes the tag. An open tag shows the details instead of the bulb,
   * and is drawn above the others; a hovered one above everything.
   *
   * @param flashing - Whether its new activity is showing for a moment.
   * @param hovered - Whether the pointer is on the robot.
   */
  setOpen(flashing: boolean, hovered: boolean): void {
    const open = flashing || hovered;
    const state = `${String(open)}:${String(hovered)}`;
    if (state === this.tagState) return;
    this.tagState = state;
    this.tagElement.dataset['open'] = String(open);
    this.tag.element.classList.toggle('hf-raised', open);
    this.tag.element.classList.toggle('hf-hovered', hovered);
  }

  /** Where it is now. */
  get where(): Point {
    return this.position;
  }

  /** Where its tag is. */
  get tagPosition(): THREE.Vector3 {
    return this.tag.position;
  }

  /**
   * Updates the robot's record, for its tag.
   *
   * @param robot - The latest record.
   */
  setRobot(robot: Robot): void {
    this.robot = robot;
  }

  /**
   * Sends the robot somewhere (W3). It re-plans from wherever it is, leaving its
   * current spot the way it came in. A robot coming back from outside walks in
   * from the exit (H9).
   *
   * @param target - Where to go and what to do there.
   * @param plan - The building.
   * @param instant - Skip the walk (first load, reduced motion).
   */
  retarget(target: Target, plan: Plan, instant: boolean): void {
    if (this.leaving) return;
    const sameDestination = this.target?.id === target.id;
    this.target = target;
    this.pose = target.pose;
    if (instant) {
      this.path = [];
      this.outside = false;
      this.arrive(plan);
      return;
    }
    if (sameDestination && !this.outside) {
      if (this.motion === 'resting') this.arrive(plan);
      return;
    }
    let arriving = this.motion === 'arriving';
    if (this.outside) {
      if (target.pose === 'away') return;
      this.outside = false;
      this.object.visible = true;
      this.tag.visible = true;
      this.place(plan.exit);
      arriving = true;
    }
    const from = this.motion === 'resting' ? this.atSpot : undefined;
    this.path = route(plan, this.position, target.destination, this.lane, from);
    this.atSpot = undefined;
    this.motion = target.pose === 'away' ? 'leaving' : arriving ? 'arriving' : 'walking';
    this.after = undefined;
    if (this.path.length === 0) this.arrive(plan);
    else this.play('walk');
  }

  /**
   * Makes the robot walk out of the building for good (a `leave` message).
   *
   * @param plan - The building.
   * @param instant - Remove it at once.
   */
  leave(plan: Plan, instant: boolean): void {
    if (this.leaving) return;
    this.leaving = true;
    if (instant || this.outside) {
      this.done = true;
      return;
    }
    const from = this.motion === 'resting' ? this.atSpot : undefined;
    this.path = route(plan, this.position, { kind: 'exit' }, this.lane, from);
    this.atSpot = undefined;
    this.motion = 'leaving';
    this.pose = 'away';
    this.play('walk');
  }

  /**
   * Advances the robot by one frame.
   *
   * @param dt - Seconds since the last frame.
   * @param stride - Advance the animation every n-th frame (E9).
   * @param plan - The building.
   * @param rooms - The open rooms, for the tag.
   * @param reducedMotion - Keep hands still on the keyboard.
   * @returns `true` once it has left the building for good.
   */
  step(
    dt: number,
    stride: number,
    plan: Plan,
    rooms: readonly Room[],
    reducedMotion: boolean,
  ): boolean {
    if (this.done) return true;
    this.frames++;
    this.pendingDt += dt;
    if (this.frames % stride === 0) {
      this.releaseHands();
      this.mixer.update(this.pendingDt);
      this.poseHands(this.pendingDt, reducedMotion);
      this.pendingDt = 0;
    }
    if (this.motion !== 'resting' && !this.outside) {
      const next = advance(this.position, this.path, SPEED * dt);
      this.path = next.path;
      if (next.yaw !== undefined) {
        const diff = Math.atan2(Math.sin(next.yaw - this.yaw), Math.cos(next.yaw - this.yaw));
        this.yaw += diff * Math.min(1, dt * 10);
      }
      this.place(next.position);
      if (this.path.length === 0) this.arrive(plan);
    }
    return this.finish(rooms);
  }

  private findArms(): readonly Arm[] {
    const typing = this.template.set.typing;
    if (typing === undefined) return [];
    const arm = (rig: ArmRig, side: Arm['side']): Arm[] => {
      const upper = this.object.getObjectByName(rig.upper);
      const lower = this.object.getObjectByName(rig.lower);
      if (upper === undefined || lower === undefined) return [];
      const tilt = (t: BoneTilt): THREE.Quaternion =>
        new THREE.Quaternion().setFromEuler(new THREE.Euler(t[0], t[1], t[2]));
      return [
        {
          side,
          upper,
          lower,
          upperTilt: tilt(rig.upperTilt),
          lowerTilt: tilt(rig.lowerTilt),
          upperClipPose: new THREE.Quaternion(),
          lowerClipPose: new THREE.Quaternion(),
        },
      ];
    };
    return [...arm(typing.left, 'left'), ...arm(typing.right, 'right')];
  }

  /**
   * Puts the arms back as the clip left them. The mixer only writes a bone when
   * its value changes, so without this typing would add up from frame to frame.
   */
  private releaseHands(): void {
    if (!this.handsPosed) return;
    for (const arm of this.arms) {
      arm.upper.quaternion.copy(arm.upperClipPose);
      arm.lower.quaternion.copy(arm.lowerClipPose);
    }
    this.handsPosed = false;
  }

  /** Adds typing on top of the sitting clip. */
  private poseHands(dt: number, reducedMotion: boolean): void {
    if (this.arms.length === 0) return;
    const change = dt / FADE;
    this.typingBlend =
      this.workingAtDesk === undefined
        ? Math.max(0, this.typingBlend - change)
        : Math.min(1, this.typingBlend + change);
    if (this.typingBlend === 0) return;
    this.typingTime += dt;
    const swing = reducedMotion
      ? { left: 0, right: 0 }
      : typingSwing(this.typingTime, this.typingSeed);
    this.handsPosed = true;
    for (const arm of this.arms) {
      arm.upperClipPose.copy(arm.upper.quaternion);
      arm.lowerClipPose.copy(arm.lower.quaternion);
      arm.upper.quaternion.multiply(BLEND.identity().slerp(arm.upperTilt, this.typingBlend));
      arm.lower.quaternion
        .multiply(BLEND.identity().slerp(arm.lowerTilt, this.typingBlend))
        .multiply(BLEND.setFromAxisAngle(FOREARM_AXIS, swing[arm.side] * this.typingBlend));
    }
  }

  private finish(rooms: readonly Room[]): boolean {
    if (this.done) return true;
    this.updateTag(rooms);
    return false;
  }

  /** Frees what the robot created. */
  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.object);
    for (const m of this.materials) m.dispose();
    this.tag.removeFromParent();
    this.tag.element.remove();
    this.object.removeFromParent();
  }

  private arrive(plan: Plan): void {
    this.path = [];
    if (this.leaving) {
      this.done = true;
      return;
    }
    const target = this.target;
    if (target === undefined) return;
    this.motion = 'resting';
    if (target.destination.kind === 'exit') {
      // Away: out of the building until the next event (H9).
      this.outside = true;
      this.atSpot = undefined;
      this.object.visible = false;
      this.tag.visible = false;
      this.place(plan.exit);
      return;
    }
    this.object.visible = true;
    this.tag.visible = true;
    const spot = target.destination.spot;
    this.atSpot = spot;
    this.yaw = spot.yaw;
    const { clip, then } = restClip(target.pose, this.robot.status);
    if (target.pose === 'sit' && spot.chair !== undefined) {
      this.position = spot.stand;
      this.object.position.copy(this.seated(spot.chair, spot.yaw));
      this.object.rotation.y = spot.yaw;
      this.play('sit', FADE);
    } else {
      this.place(spot.stand);
      this.play(clip === 'sit' ? 'idle' : clip);
    }
    this.after = then;
  }

  /** Where the model goes so its hips land on the seat. */
  private seated(chair: Point, yaw: number): THREE.Vector3 {
    const k = this.size;
    const hips = this.template.hips;
    const offset = new THREE.Vector3(0.06 - hips.x * k, 0.6 - hips.y * k, -hips.z * k);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw - Math.PI / 2);
    return new THREE.Vector3(chair.x, chair.y, chair.z).add(offset);
  }

  private place(p: Point): void {
    this.position = p;
    this.object.position.set(p.x, p.y, p.z);
    this.object.rotation.y = this.yaw;
  }

  private play(role: ClipRole, fade = FADE): void {
    const next = this.actions[role];
    if (this.current === next && role !== 'wave') return;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current !== undefined && this.current !== next) this.current.fadeOut(fade);
    this.current = next;
  }

  private updateTag(rooms: readonly Room[]): void {
    const sitting = this.motion === 'resting' && this.pose === 'sit';
    const height = (sitting ? 1.42 : 1.72) * this.size + (this.size < 1 ? 0.05 : 0);
    const base = this.object.position;
    this.tag.position.set(base.x, (sitting ? this.position.y : base.y) + height, base.z);
    const content = tagContent(this.robot, rooms, this.motion, this.pose);
    const key = JSON.stringify([content, this.motion, this.pose, this.robot.status]);
    if (key === this.tagKey) return;
    this.tagKey = key;
    renderTag(this.tagElement, content, this.color);
    const text = content.badge?.text;
    // A robot on screen from the start has nothing new to announce.
    this.changed = this.rendered ? text !== this.badgeText : this.motion === 'arriving';
    this.rendered = true;
    this.badgeText = text;
    this.tagElement.dataset['motion'] = this.motion;
    this.tagElement.dataset['pose'] = this.pose;
    this.tagElement.dataset['status'] = this.robot.status;
  }
}
