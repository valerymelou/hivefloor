import {
  layout,
  OTHER_ROOM_ID,
  PRIVATE_ROOM_ID,
  type LayoutRobot,
  type OfficeConfig,
  type Robot,
  type Room,
} from '@hivefloor/schema';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { OfficeView } from '../../core/office-view';
import { STRINGS } from '../../core/strings';
import { targetsFor } from '../behaviour';
import {
  animationStride,
  defaultOffset,
  FIELD_OF_VIEW,
  frame,
  clampToBuilding,
  keyOrbit,
  NARROW_WIDTH,
  orbit,
  pick,
  POLAR_LIMITS,
  type PickTarget,
} from '../camera';
import { ROBOT_EXPRESSIVE, type CharacterSet } from '../character';
import { isFlashing, NO_FLASHES, requestFlash } from '../flash';
import { laneFor } from '../navigation';
import { buildPlan, DIMENSIONS, type Plan } from '../plan';
import { Building, type RoomLook } from './building';
import { loadCharacter, type CharacterTemplate } from './character-loader';
import { RobotActor } from './robot-actor';

/** What the 3D office needs from the page. */
export interface OfficeSceneOptions {
  /** Gets the WebGL canvas. */
  readonly stage: HTMLElement;
  /** Gets the floating tags and room labels. */
  readonly labels: HTMLElement;
  /** The page's base URL, for the model. */
  readonly baseUrl: string;
  /** `prefers-reduced-motion`: no auto-rotate, robots move instantly (W10). */
  readonly reducedMotion: boolean;
  /** Phones: no shadows, no desk lights, lower resolution (W10). */
  readonly lowPower: boolean;
  /** The character set (W13). */
  readonly character?: CharacterSet;
  /** Called when a robot is clicked or tapped, or the background is (W9). */
  readonly onPick: (key: string | undefined) => void;
}

const OTHER_COLOR = '#6b7290';
const DESK_LIGHTS = 6;
const EASE_SECONDS = 0.6;
const SCREEN_REFRESH_SECONDS = 0.25;
/** The longest step a frame may take, so walking keeps real time at low frame rates. */
const MAX_FRAME_SECONDS = 0.5;

function toLayoutRobot(robot: Robot): LayoutRobot[] {
  const base = { key: robot.key, room: robot.room, lastActiveAt: robot.since };
  if (robot.desk !== undefined) return [{ ...base, desk: robot.desk }];
  if (robot.seat !== undefined) return [{ ...base, seat: robot.seat }];
  return [];
}

function people(robots: readonly Robot[]): string {
  const sessions = robots.filter((r) => r.parent === undefined).length;
  return STRINGS.scene.people(sessions, robots.length - sessions);
}

/**
 * Creates the 3D office: a WebGL renderer, the building, the robots and the
 * camera. Throws when WebGL is unavailable or the character fails to load; the
 * page then falls back to the list view (W11).
 *
 * @param options - Where to draw and how.
 * @returns The scene, rendering until disposed.
 */
export async function createOfficeScene(options: OfficeSceneOptions): Promise<OfficeScene> {
  const renderer = new THREE.WebGLRenderer({ antialias: !options.lowPower, alpha: true });
  try {
    const template = await loadCharacter(options.character ?? ROBOT_EXPRESSIVE, options.baseUrl);
    return new OfficeScene(options, renderer, template);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}

/**
 * The 3D office (W1–W4, W8–W10). Framework-agnostic: the page feeds it the
 * office view and config, and it renders until disposed, pausing while the tab
 * is hidden.
 */
export class OfficeScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 600);
  private readonly labelRenderer: CSS2DRenderer;
  private readonly controls: OrbitControls;
  private readonly building: Building;
  private readonly key = new THREE.DirectionalLight(0xffe0bd, 2.3);
  private readonly deskLights: THREE.PointLight[] = [];
  private readonly coffeeLight = new THREE.PointLight(0xffc98a, 6, 7, 2);
  private readonly actors = new Map<string, RobotActor>();
  private readonly timer = new THREE.Timer();
  private readonly observer: ResizeObserver;
  private readonly cleanups: (() => void)[] = [];
  private plan: Plan | undefined;
  private rooms: readonly Room[] = [];
  private ease:
    | {
        from: THREE.Vector3;
        to: THREE.Vector3;
        fromDistance: number;
        toDistance: number;
        t: number;
      }
    | undefined;
  private reducedMotion: boolean;
  private frameHandle = 0;
  private screenClock = 0;
  private seconds = 0;
  private flashes = NO_FLASHES;
  private hovered: string | undefined;
  private hoverPoint: { x: number; y: number } | undefined;
  private firstUpdate = true;
  private disposed = false;

  /**
   * Use `createOfficeScene`, which creates the renderer and loads the character.
   *
   * @param options - Where to draw and how.
   * @param renderer - The WebGL renderer.
   * @param template - The loaded character.
   */
  constructor(
    private readonly options: OfficeSceneOptions,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly template: CharacterTemplate,
  ) {
    this.reducedMotion = options.reducedMotion;
    const shadows = !options.lowPower;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.lowPower ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', STRINGS.scene.label);
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    options.stage.append(canvas);

    this.labelRenderer = new CSS2DRenderer({ element: options.labels });
    this.scene.fog = new THREE.Fog(0x12142a, 42, 80);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    // Right-drag, shift-drag or two fingers slide along the floor.
    this.controls.screenSpacePanning = false;
    this.controls.minPolarAngle = POLAR_LIMITS.min;
    this.controls.maxPolarAngle = POLAR_LIMITS.max;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.autoRotate = !this.reducedMotion;
    this.controls.addEventListener('start', this.stopAutoRotate);

    this.scene.add(new THREE.HemisphereLight(0x9fb2ff, 0x2a1f30, 1.1));
    this.key.castShadow = shadows;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.key, this.key.target);
    const rim = new THREE.DirectionalLight(0x7f8cff, 0.7);
    rim.position.set(-14, 10, -12);
    this.scene.add(rim);
    this.scene.add(this.coffeeLight);
    if (!options.lowPower) {
      for (let i = 0; i < DESK_LIGHTS; i++) {
        const light = new THREE.PointLight(0xffffff, 0, 2.6, 2);
        this.deskLights.push(light);
        this.scene.add(light);
      }
    }

    this.building = new Building(shadows, () => !this.reducedMotion);
    this.scene.add(this.building.group);

    this.observer = new ResizeObserver(() => {
      this.resize();
    });
    this.observer.observe(options.stage);
    this.resize();
    this.listen(canvas, 'keydown', this.onKey);
    this.listen(canvas, 'pointerdown', this.onPointerDown);
    this.listen(canvas, 'pointerup', this.onPointerUp);
    this.listen(canvas, 'pointermove', this.onPointerMove);
    this.listen(canvas, 'pointerleave', this.onPointerLeave);
    this.listen(document, 'visibilitychange', this.onVisibility);
    this.timer.connect(document);
    this.start();
  }

  /**
   * Shows the office as it is now. Call on every change; only what changed is
   * rebuilt, and robots walk to their new places.
   *
   * @param view - The office view from the store.
   * @param config - The public office config.
   */
  update(view: OfficeView, config: OfficeConfig): void {
    if (this.disposed) return;
    const limits = config.layout;
    const rooms = config.privateRoom.visible
      ? view.rooms
      : view.rooms.filter((room) => room.id !== PRIVATE_ROOM_ID);
    const roomIds = new Set(rooms.map((room) => room.id));
    const robots = view.robots.filter((robot) => roomIds.has(robot.room));
    const placed = layout(
      rooms.map((room) => ({
        id: room.id,
        slot: room.slot,
        rows: room.rows,
        ...(room.group === undefined ? {} : { group: room.group }),
      })),
      robots.flatMap(toLayoutRobot),
      limits,
    );
    const plan = buildPlan(placed, limits);
    const previous = this.plan;
    const reshaped =
      previous?.floors !== plan.floors ||
      previous.bays !== plan.bays ||
      previous.backDepth !== plan.backDepth ||
      previous.frontDepth !== plan.frontDepth;
    this.plan = plan;
    this.rooms = view.rooms;

    const looks = new Map<string, RoomLook>();
    for (const room of placed.rooms) {
      const hidden = room.hiddenRobots > 0 ? STRINGS.scene.more(room.hiddenRobots) : undefined;
      if (room.id === OTHER_ROOM_ID) {
        const folded = rooms.filter((r) => room.folded.includes(r.id));
        looks.set(room.id, {
          name: STRINGS.scene.otherProjects,
          color: OTHER_COLOR,
          lit: folded.some((r) => r.lit),
          detail: people(robots.filter((r) => room.folded.includes(r.room))),
          ...(hidden === undefined ? {} : { more: hidden }),
        });
        continue;
      }
      const source = rooms.find((r) => r.id === room.id);
      if (source === undefined) continue;
      looks.set(room.id, {
        name: source.name,
        color: source.color,
        lit: source.lit,
        detail: people(robots.filter((r) => r.room === room.id)),
        ...(hidden === undefined ? {} : { more: hidden }),
      });
    }
    const roomFloor = new Map(plan.rooms.map((room) => [room.id, room.floor]));
    const placedRoom = new Map<string, string>(placed.robots.map((r) => [r.key, r.room]));
    const onBreak = plan.coffee.map(
      (_, floor) =>
        robots.filter(
          (r) => r.status === 'idle' && roomFloor.get(placedRoom.get(r.key) ?? '') === floor,
        ).length,
    );
    this.building.sync(plan, looks, onBreak.map(STRINGS.scene.onBreakCount));

    const targets = targetsFor(robots, placed.robots, plan);
    const byKey = new Map<string, Robot>(robots.map((robot) => [robot.key, robot]));
    const colors = new Map(placed.rooms.map((room) => [room.id, looks.get(room.id)?.color]));
    const instant = this.firstUpdate || this.reducedMotion;
    for (const [key, target] of targets) {
      const robot = byKey.get(key);
      if (robot === undefined) continue;
      let actor = this.actors.get(key);
      if (actor === undefined) {
        actor = new RobotActor(
          this.template,
          robot,
          colors.get(placedRoom.get(key) ?? '') ?? OTHER_COLOR,
          laneFor(key),
          !this.options.lowPower,
          plan.exit,
          !instant,
        );
        this.actors.set(key, actor);
        this.scene.add(actor.object, actor.tag);
      }
      actor.setRobot(robot);
      actor.retarget(target, plan, instant);
    }
    for (const [key, actor] of this.actors) {
      if (targets.has(key)) continue;
      if (byKey.has(key)) {
        // Beyond the render cap now: it becomes part of a "+N" sign (E8).
        actor.dispose();
        this.actors.delete(key);
      } else {
        actor.leave(plan, this.reducedMotion);
      }
    }

    if (reshaped) this.reframe(plan);
    this.firstUpdate = false;
  }

  /**
   * Follows a change of `prefers-reduced-motion` (W10).
   *
   * @param reduced - Whether motion should be reduced.
   */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) this.controls.autoRotate = false;
  }

  /** Stops rendering and frees everything the scene created. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    this.observer.disconnect();
    for (const cleanup of this.cleanups) cleanup();
    this.controls.removeEventListener('start', this.stopAutoRotate);
    this.controls.dispose();
    for (const actor of this.actors.values()) actor.dispose();
    this.actors.clear();
    this.building.dispose();
    this.template.dispose();
    this.key.shadow.dispose();
    this.timer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.options.labels.replaceChildren();
  }

  private listen(target: EventTarget, type: string, listener: (event: Event) => void): void {
    target.addEventListener(type, listener);
    this.cleanups.push(() => {
      target.removeEventListener(type, listener);
    });
  }

  private readonly stopAutoRotate = (): void => {
    this.controls.autoRotate = false;
    this.ease = undefined;
  };

  private narrow(): boolean {
    return this.options.stage.clientWidth < NARROW_WIDTH;
  }

  private reframe(plan: Plan): void {
    const framing = frame(plan, this.narrow(), this.camera.aspect);
    this.controls.minDistance = framing.minDistance;
    this.controls.maxDistance = framing.maxDistance;
    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.near = framing.distance * 1.4;
      fog.far = framing.distance * 3;
    }
    const target = new THREE.Vector3(framing.target.x, framing.target.y, framing.target.z);
    const span = Math.max(plan.length, plan.backDepth + plan.frontDepth) / 2 + 3;
    const shadow = this.key.shadow.camera;
    shadow.left = -span;
    shadow.right = span;
    shadow.top = span;
    shadow.bottom = -span;
    shadow.near = 1;
    shadow.far = span * 4 + plan.floors * DIMENSIONS.floorHeight;
    shadow.updateProjectionMatrix();
    this.key.target.position.copy(target);
    this.key.position.copy(target).add(new THREE.Vector3(9, 20, 12).multiplyScalar(span / 14));
    this.coffeeLight.position.set(plan.roomWidth / 2, 2.1, -(DIMENSIONS.corridorWidth / 2 + 2.6));

    const distance = this.camera.position.distanceTo(this.controls.target);
    if (this.ease === undefined && distance === 0) {
      // First framing: place the camera.
      const offset = defaultOffset(framing.distance, this.narrow());
      this.controls.target.copy(target);
      this.camera.position.copy(target).add(new THREE.Vector3(offset.x, offset.y, offset.z));
      this.controls.update();
      return;
    }
    // Ease out to show the whole building when it grows (E4); never zoom in on the visitor.
    const toDistance = Math.max(distance, framing.distance);
    if (this.reducedMotion) {
      this.applyFraming(target, toDistance);
      return;
    }
    this.ease = {
      from: this.controls.target.clone(),
      to: target,
      fromDistance: distance,
      toDistance,
      t: 0,
    };
  }

  private keepCameraOverBuilding(): void {
    if (this.plan === undefined) return;
    const target = this.controls.target;
    const limit = clampToBuilding(target, this.plan);
    const shift = new THREE.Vector3(limit.x - target.x, 0, limit.z - target.z);
    if (shift.lengthSq() === 0) return;
    target.add(shift);
    this.camera.position.add(shift);
  }

  private applyFraming(target: THREE.Vector3, distance: number): void {
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(direction.multiplyScalar(distance));
  }

  private resize(): void {
    const width = Math.max(1, this.options.stage.clientWidth);
    const height = Math.max(1, this.options.stage.clientHeight);
    this.renderer.setSize(width, height);
    // On phones a vertical swipe scrolls the page, so the office can't trap it.
    this.renderer.domElement.style.touchAction = this.narrow() ? 'pan-y' : 'none';
    this.labelRenderer.setSize(width, height);
    const aspect = width / height;
    const changed = Math.abs(aspect - this.camera.aspect) > 0.01;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    if (changed && this.plan !== undefined) this.reframe(this.plan);
  }

  private start(): void {
    cancelAnimationFrame(this.frameHandle);
    if (document.hidden || this.disposed) return;
    this.timer.reset();
    const loop = (time: number): void => {
      this.frameHandle = requestAnimationFrame(loop);
      this.timer.update(time);
      this.render(Math.min(MAX_FRAME_SECONDS, this.timer.getDelta()));
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  private readonly onVisibility = (): void => {
    // Pause rendering while the tab is hidden (W10).
    if (document.hidden) cancelAnimationFrame(this.frameHandle);
    else this.start();
  };

  private render(dt: number): void {
    const plan = this.plan;
    this.seconds += dt;
    this.updateHover();
    if (this.ease !== undefined) {
      this.ease.t = Math.min(1, this.ease.t + dt / EASE_SECONDS);
      const t = 1 - (1 - this.ease.t) ** 3;
      const target = this.ease.from.clone().lerp(this.ease.to, t);
      this.applyFraming(
        target,
        this.ease.fromDistance + (this.ease.toDistance - this.ease.fromDistance) * t,
      );
      if (this.ease.t >= 1) this.ease = undefined;
    }
    this.keepCameraOverBuilding();
    this.controls.update(dt);
    this.building.tick(dt);
    if (plan !== undefined) {
      for (const [key, actor] of this.actors) {
        const stride = animationStride(this.camera.position.distanceTo(actor.object.position));
        if (actor.step(dt, stride, plan, this.rooms, this.reducedMotion)) {
          actor.dispose();
          this.actors.delete(key);
          continue;
        }
        if (actor.takeChanged()) {
          this.flashes = requestFlash(this.flashes, actor.zone, key, this.seconds);
        }
        actor.setOpen(
          isFlashing(this.flashes, actor.zone, key, this.seconds),
          this.hovered === key,
        );
      }
    }
    this.screenClock += dt;
    if (this.screenClock >= SCREEN_REFRESH_SECONDS) {
      this.screenClock = 0;
      this.refreshDesks();
    }
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  /** Lights monitors and desk lamps for robots at their desks. */
  private refreshDesks(): void {
    this.building.clearScreens();
    const working = [...this.actors.values()]
      .filter((actor) => actor.workingAtDesk !== undefined)
      .sort((a, b) => (a.key < b.key ? -1 : 1));
    for (const actor of this.actors.values()) {
      const standing = actor.standingAtDesk;
      if (standing !== undefined) this.building.setScreen(standing.room, standing.index, 'dim');
    }
    for (const actor of working) {
      const desk = actor.workingAtDesk;
      if (desk !== undefined) this.building.setScreen(desk.room, desk.index, 'on');
    }
    this.deskLights.forEach((light, i) => {
      const actor = working[i];
      if (actor === undefined) {
        light.intensity = 0;
        return;
      }
      const p = actor.where;
      light.position.set(p.x + DIMENSIONS.deskOffset + 0.5, p.y + 1.05, p.z);
      light.intensity = 2.2;
    });
  }

  private readonly onKey = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    const step = keyOrbit(event.key);
    if (step === undefined) return;
    event.preventDefault();
    this.stopAutoRotate();
    const t = this.controls.target;
    const offset = this.camera.position.clone().sub(t);
    const next = orbit({ x: offset.x, y: offset.y, z: offset.z }, step.azimuth, step.polar);
    this.camera.position.set(t.x + next.x, t.y + next.y, t.z + next.z);
  };

  private pickTargets(rect: DOMRect): PickTarget[] {
    const toScreen = (v: THREE.Vector3): { x: number; y: number } => {
      const ndc = v.clone().project(this.camera);
      return { x: ((ndc.x + 1) / 2) * rect.width, y: ((1 - ndc.y) / 2) * rect.height };
    };
    return [...this.actors.values()]
      .filter((actor) => actor.visible)
      .map((actor) => ({
        key: actor.key,
        from: toScreen(actor.object.position),
        to: toScreen(actor.tagPosition),
      }));
  }

  /** Finds the robot under the mouse, once per frame, as robots and the camera move. */
  private updateHover(): void {
    const point = this.hoverPoint;
    const canvas = this.renderer.domElement;
    if (point === undefined || this.pointer !== undefined) {
      if (this.hovered !== undefined) canvas.style.cursor = '';
      this.hovered = undefined;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    this.hovered = pick(this.pickTargets(rect), { x: point.x - rect.left, y: point.y - rect.top });
    canvas.style.cursor = this.hovered === undefined ? '' : 'pointer';
  }

  private readonly onPointerMove = (event: Event): void => {
    // Touch has no hover: a tap opens the robot's card.
    if (!(event instanceof PointerEvent) || event.pointerType !== 'mouse') return;
    this.hoverPoint = { x: event.clientX, y: event.clientY };
  };

  private readonly onPointerLeave = (): void => {
    this.hoverPoint = undefined;
  };

  private pointer: { x: number; y: number } | undefined;

  private readonly onPointerDown = (event: Event): void => {
    if (!(event instanceof PointerEvent)) return;
    this.pointer = { x: event.clientX, y: event.clientY };
  };

  private readonly onPointerUp = (event: Event): void => {
    if (!(event instanceof PointerEvent)) return;
    const down = this.pointer;
    this.pointer = undefined;
    if (down === undefined || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6)
      return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const targets = this.pickTargets(rect);
    this.options.onPick(
      pick(targets, { x: event.clientX - rect.left, y: event.clientY - rect.top }),
    );
  };
}
