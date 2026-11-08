import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  DIMENSIONS as D,
  floorY,
  roomDepth,
  spotPlan,
  tableOf,
  type CoffeePlan,
  type Plan,
  type RoomPlan,
} from '../plan';
import { STRINGS } from '../../core/strings';
import { renderRoomLabel } from './tags';

/** How a room looks: its name, colour, lights and who is in it. */
export interface RoomLook {
  readonly name: string;
  readonly color: string;
  readonly lit: boolean;
  readonly detail: string;
  readonly more?: string;
}

/** A desk monitor's state: off, dim while thinking, or on while working. */
export type ScreenState = 'off' | 'dim' | 'on';

const DARK = new THREE.Color(0x30354e);
const SCREEN_OFF = new THREE.Color(0x0b0d16);
const GROW_SECONDS = 0.6;

const material = (color: THREE.ColorRepresentation, roughness = 0.8): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

/** Materials every part of the building shares. */
function sharedMaterials() {
  return {
    base: material(0x1f2338, 0.9),
    edge: material(0x2b3050),
    slab: material(0x262a42, 0.9),
    corridor: material(0x3a3f5c, 0.95),
    runner: material(0x4b4565, 1),
    free: material(0x2a2e46, 0.95),
    lobby: material(0x3a3a52, 0.95),
    coffeeFloor: material(new THREE.Color(0xd9b48a).lerp(DARK, 0.72), 0.95),
    wall: material(0x444b6c, 0.85),
    wallTall: material(0x3a4062, 0.85),
    cap: material(0x5a6288),
    wood: material(0xa98463, 0.6),
    woodDark: material(0x6e533f, 0.7),
    metal: new THREE.MeshStandardMaterial({ color: 0x23263a, roughness: 0.4, metalness: 0.5 }),
    chair: material(0x2c3150, 0.7),
    bezel: material(0x101320, 0.4),
    pot: material(0xd2c0a3),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4fa37f, roughness: 0.75, flatShading: true }),
    screen: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    window: new THREE.MeshStandardMaterial({
      color: 0x141a36,
      emissive: 0x2c3f8a,
      emissiveIntensity: 0.32,
      roughness: 0.2,
    }),
    lamp: new THREE.MeshStandardMaterial({
      color: 0xfff1d6,
      emissive: 0xffd9a0,
      emissiveIntensity: 1.6,
    }),
    exit: new THREE.MeshStandardMaterial({
      color: 0x0f2a1f,
      emissive: 0x5cc8a1,
      emissiveIntensity: 1.4,
    }),
  };
}

type Materials = ReturnType<typeof sharedMaterials>;

interface RoomEntry {
  readonly shape: string;
  readonly group: THREE.Group;
  readonly floorMat: THREE.MeshStandardMaterial;
  readonly rugMat: THREE.MeshStandardMaterial;
  readonly label: CSS2DObject;
  look?: RoomLook;
}

/** One kind of instanced part: a box placed at each desk or seat (E9). */
interface Part {
  readonly material: THREE.Material;
  readonly size: readonly [number, number, number];
  readonly offset: readonly [number, number, number];
}

/** The parts of a desk and chair, relative to the chair, facing +x. */
const DESK_PARTS = (m: Materials): Part[] => [
  { material: m.wood, size: [0.75, 0.05, 1.5], offset: [D.deskOffset, 0.66, 0] },
  { material: m.woodDark, size: [0.7, 0.62, 0.05], offset: [D.deskOffset, 0.32, -0.68] },
  { material: m.woodDark, size: [0.7, 0.62, 0.05], offset: [D.deskOffset, 0.32, 0.68] },
  { material: m.bezel, size: [0.05, 0.42, 0.72], offset: [D.deskOffset + 0.22, 1, 0] },
  { material: m.metal, size: [0.05, 0.22, 0.05], offset: [D.deskOffset + 0.24, 0.78, 0] },
  { material: m.metal, size: [0.16, 0.02, 0.42], offset: [D.deskOffset - 0.12, 0.695, 0] },
  { material: m.chair, size: [0.5, 0.08, 0.5], offset: [0, 0.44, 0] },
  { material: m.chair, size: [0.08, 0.55, 0.48], offset: [-0.26, 0.74, 0] },
  { material: m.metal, size: [0.06, 0.4, 0.06], offset: [0, 0.2, 0] },
];

/** The screen, which is coloured per desk. */
const SCREEN_PART: Part['size'] = [0.012, 0.36, 0.66];
const SCREEN_OFFSET: Part['offset'] = [D.deskOffset + 0.19, 1, 0];

/**
 * The office building drawn from a plan (W1): floors, corridor, lobby with the
 * coffee corner and stairs, one group per room, and instanced desks, chairs,
 * monitors and stools (E9). It rebuilds only what changed.
 */
export class Building {
  /** Everything the building draws. */
  readonly group = new THREE.Group();
  private readonly m = sharedMaterials();
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly cylinder = new THREE.CylinderGeometry(1, 1, 1, 20);
  private readonly cone = new THREE.ConeGeometry(1, 1, 16, 1, true);
  private readonly ico = new THREE.IcosahedronGeometry(1, 0);
  private readonly plane = new THREE.PlaneGeometry(1, 1);
  private shell = new THREE.Group();
  private shellShape = '';
  private readonly rooms = new Map<string, RoomEntry>();
  private furniture: THREE.InstancedMesh[] = [];
  private furnitureShape = '';
  private screens: THREE.InstancedMesh | undefined;
  private readonly screenIndex = new Map<string, { index: number; color: THREE.Color }>();
  private readonly growing: { group: THREE.Group; t: number }[] = [];
  private coffeeLabels: CSS2DObject[] = [];

  /**
   * @param shadows - Whether meshes cast and receive shadows.
   * @param animate - Whether new rooms grow into place (off with reduced motion).
   */
  constructor(
    private readonly shadows: boolean,
    private readonly animate: () => boolean,
  ) {
    this.group.add(this.shell);
  }

  /**
   * Brings the building in line with a plan.
   *
   * @param plan - The building plan.
   * @param looks - Each room's look, by room id.
   * @param coffeeDetail - The coffee corner label's detail, per floor.
   */
  sync(plan: Plan, looks: ReadonlyMap<string, RoomLook>, coffeeDetail: readonly string[]): void {
    const shellShape = `${String(plan.floors)}:${String(plan.bays)}:${String(plan.backDepth)}:${String(plan.frontDepth)}:${plan.rooms.map((r) => `${String(r.floor)}.${String(r.bay)}.${r.side}`).join(',')}`;
    if (shellShape !== this.shellShape) {
      this.shellShape = shellShape;
      this.buildShell(plan);
    }
    this.coffeeLabels.forEach((label, floor) => {
      const element = label.element;
      const detail = element.querySelector('.hf-room-detail');
      if (detail !== null) detail.textContent = coffeeDetail[floor] ?? '';
    });

    const seen = new Set<string>();
    for (const room of plan.rooms) {
      seen.add(room.id);
      const look = looks.get(room.id) ?? {
        name: room.id,
        color: '#8d94ab',
        lit: false,
        detail: '',
      };
      const shape = `${String(room.slot)}:${String(room.floor)}:${String(room.bay)}:${room.side}:${String(room.rows)}:${String(room.depthRows)}:${look.color}:${String(this.eastWall(plan, room))}`;
      let entry = this.rooms.get(room.id);
      if (entry?.shape !== shape) {
        const isNew = entry === undefined;
        if (entry !== undefined) this.removeRoom(entry);
        entry = this.buildRoom(plan, room, look.color, shape);
        this.rooms.set(room.id, entry);
        if (isNew && this.animate()) {
          entry.group.scale.y = 0.02;
          this.growing.push({ group: entry.group, t: 0 });
        }
      }
      this.paintRoom(entry, look);
    }
    for (const [id, entry] of this.rooms) {
      if (!seen.has(id)) {
        this.removeRoom(entry);
        this.rooms.delete(id);
      }
    }

    const furnitureShape = plan.rooms
      .map((r) => `${r.id}:${String(r.slot)}:${String(r.rows)}`)
      .sort()
      .join(',');
    if (furnitureShape !== this.furnitureShape) {
      this.furnitureShape = furnitureShape;
      this.buildFurniture(plan, looks);
    }
  }

  /**
   * Lights or darkens a desk's monitor.
   *
   * @param room - The room id.
   * @param desk - The desk number.
   * @param state - The screen state.
   */
  setScreen(room: string, desk: number, state: ScreenState): void {
    const entry = this.screenIndex.get(`${room}:${String(desk)}`);
    if (entry === undefined || this.screens === undefined) return;
    const color =
      state === 'off'
        ? SCREEN_OFF
        : state === 'dim'
          ? SCREEN_OFF.clone().lerp(entry.color, 0.35)
          : entry.color;
    this.screens.setColorAt(entry.index, color);
    if (this.screens.instanceColor !== null) this.screens.instanceColor.needsUpdate = true;
  }

  /** Turns every monitor off, before the scene lights the ones in use. */
  clearScreens(): void {
    for (const [key] of this.screenIndex) {
      const [room = '', desk = '0'] = key.split(':');
      this.setScreen(room, Number(desk), 'off');
    }
  }

  /**
   * Advances the rooms that are growing into place (E9).
   *
   * @param dt - Seconds since the last frame.
   */
  tick(dt: number): void {
    for (let i = this.growing.length - 1; i >= 0; i--) {
      const item = this.growing[i];
      if (item === undefined) continue;
      item.t = Math.min(1, item.t + dt / GROW_SECONDS);
      item.group.scale.y = 0.02 + 0.98 * (1 - (1 - item.t) ** 3);
      if (item.t >= 1) this.growing.splice(i, 1);
    }
  }

  /** Frees every geometry, material and label the building created. */
  dispose(): void {
    for (const entry of this.rooms.values()) this.removeRoom(entry);
    this.rooms.clear();
    this.clearFurniture();
    this.clearShell();
    for (const value of Object.values(this.m)) value.dispose();
    this.box.dispose();
    this.cylinder.dispose();
    this.cone.dispose();
    this.ico.dispose();
    this.plane.dispose();
    this.group.removeFromParent();
  }

  private mesh(
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    size: readonly [number, number, number],
    position: readonly [number, number, number],
    cast = true,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = this.shadows && cast;
    mesh.receiveShadow = this.shadows;
    return mesh;
  }

  private boxAt(
    parent: THREE.Object3D,
    mat: THREE.Material,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    cast = true,
  ): void {
    parent.add(this.mesh(this.box, mat, [w, h, d], [x, y, z], cast));
  }

  private wall(
    parent: THREE.Object3D,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    height: number,
    mat: THREE.Material = this.m.wall,
  ): void {
    const length = Math.hypot(x1 - x0, z1 - z0);
    if (length < 0.05) return;
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const t = 0.16;
    const [w, d] = along ? [length, t] : [t, length];
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    this.boxAt(parent, mat, w, height, d, cx, y + height / 2, cz);
    this.boxAt(parent, this.m.cap, w + 0.02, 0.05, d + 0.02, cx, y + height + 0.025, cz, false);
  }

  private label(parent: THREE.Object3D, x: number, y: number, z: number): CSS2DObject {
    const element = document.createElement('div');
    element.className = 'hf-room-label';
    const label = new CSS2DObject(element);
    label.position.set(x, y, z);
    parent.add(label);
    return label;
  }

  private plant(parent: THREE.Object3D, x: number, y: number, z: number, s = 1): void {
    parent.add(
      this.mesh(this.cylinder, this.m.pot, [0.2 * s, 0.38 * s, 0.2 * s], [x, y + 0.19 * s, z]),
    );
    parent.add(
      this.mesh(this.ico, this.m.leaf, [0.42 * s, 0.42 * s, 0.42 * s], [x, y + 0.72 * s, z]),
    );
    parent.add(
      this.mesh(
        this.ico,
        this.m.leaf,
        [0.3 * s, 0.3 * s, 0.3 * s],
        [x + 0.18 * s, y + s, z + 0.08 * s],
      ),
    );
  }

  private eastWall(plan: Plan, room: RoomPlan): boolean {
    return !plan.rooms.some(
      (r) => r.floor === room.floor && r.side === room.side && r.bay === room.bay + 1,
    );
  }

  private clearShell(): void {
    for (const label of this.coffeeLabels) label.removeFromParent();
    this.coffeeLabels = [];
    this.shell.removeFromParent();
    this.shell.clear();
  }

  private buildShell(plan: Plan): void {
    this.clearShell();
    this.shell = new THREE.Group();
    this.group.add(this.shell);
    const s = this.shell;
    const half = D.corridorWidth / 2;
    const back = -(half + plan.backDepth);
    const front = half + plan.frontDepth;
    const width = plan.roomWidth;
    for (let floor = 0; floor < plan.floors; floor++) {
      const y = floorY(floor);
      const depth = front - back;
      const cz = (front + back) / 2;
      if (floor === 0) {
        this.boxAt(s, this.m.base, plan.length + 1.2, 0.6, depth + 1.2, plan.length / 2, -0.3, cz);
        this.boxAt(
          s,
          this.m.edge,
          plan.length + 1.6,
          0.12,
          depth + 1.6,
          plan.length / 2,
          -0.66,
          cz,
          false,
        );
      } else {
        this.boxAt(
          s,
          this.m.slab,
          plan.length + 0.4,
          0.24,
          depth + 0.4,
          plan.length / 2,
          y - 0.12,
          cz,
        );
      }
      this.boxAt(
        s,
        this.m.corridor,
        plan.length,
        0.04,
        D.corridorWidth,
        plan.length / 2,
        y + 0.02,
        0,
        false,
      );
      this.boxAt(
        s,
        this.m.runner,
        plan.length - 1.5,
        0.02,
        1.4,
        plan.length / 2 + 0.5,
        y + 0.05,
        0,
        false,
      );

      // Lobby: coffee corner at the back, stairs at the front.
      const coffee = plan.coffee[floor];
      if (coffee !== undefined) this.buildCoffee(s, coffee, plan);
      this.boxAt(
        s,
        this.m.lobby,
        width - 0.12,
        0.05,
        plan.frontDepth - 0.12,
        width / 2,
        y + 0.025,
        half + plan.frontDepth / 2,
        false,
      );

      // Empty slots: dark floor until a project opens a room there (E3).
      for (let bay = 0; bay < plan.bays; bay++) {
        for (const side of ['left', 'right'] as const) {
          if (plan.rooms.some((r) => r.floor === floor && r.bay === bay && r.side === side))
            continue;
          const sideDepth = side === 'left' ? plan.backDepth : plan.frontDepth;
          const sign = side === 'left' ? -1 : 1;
          this.boxAt(
            s,
            this.m.free,
            width - 0.12,
            0.05,
            sideDepth - 0.12,
            (bay + 1.5) * width,
            y + 0.025,
            sign * (half + sideDepth / 2),
            false,
          );
        }
      }

      // Outer walls: tall at the back and west, low at the front; windows on the back wall.
      this.wall(s, 0, back, plan.length, back, y, 2.7, this.m.wallTall);
      this.wall(s, 0, front, plan.length, front, y, 0.45);
      this.wall(s, 0, back, 0, -half, y, 2.7, this.m.wallTall);
      this.wall(s, 0, half, 0, front, y, 0.45);
      if (floor > 0) this.wall(s, 0, -half, 0, half, y, 1.1);
      this.wall(s, plan.length, back, plan.length, front, y, 1.1);
      for (let x = 1.6; x <= plan.length - 1.2; x += 3) {
        s.add(
          this.mesh(this.plane, this.m.window, [2.2, 1.3, 1], [x, y + 1.6, back + 0.09], false),
        );
      }
    }

    // Stairs between floors (E4).
    for (const stair of plan.stairs) {
      const steps = 14;
      const run = stair.top.x - stair.bottom.x;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const h = ((i + 1) / steps) * D.floorHeight;
        this.boxAt(
          s,
          this.m.woodDark,
          Math.abs(run) / steps + 0.02,
          h,
          1.2,
          stair.bottom.x + run * t,
          stair.bottom.y + h / 2,
          stair.bottom.z,
        );
      }
    }

    // The exit at the west end of the ground floor.
    this.boxAt(s, this.m.metal, 0.2, 2.3, 0.2, 0, 1.15, -half + 0.1);
    this.boxAt(s, this.m.metal, 0.2, 2.3, 0.2, 0, 1.15, half - 0.1);
    this.boxAt(s, this.m.metal, 0.2, 0.2, D.corridorWidth, 0, 2.3, 0);
    this.boxAt(s, this.m.exit, 0.06, 0.24, 0.8, 0.05, 2.62, 0, false);

    this.plant(s, 0.6, 0, front - 0.6, 1.1);
    this.plant(s, plan.length - 0.6, 0, front - 0.6, 1.2);
    this.plant(s, plan.length - 0.6, 0, back + 0.6, 1.2);
  }

  private buildCoffee(parent: THREE.Group, coffee: CoffeePlan, plan: Plan): void {
    const y = coffee.door.y;
    const half = D.corridorWidth / 2;
    const depth = roomDepth(1);
    const back = -(half + plan.backDepth);
    const width = coffee.x1 - coffee.x0;
    const cx = (coffee.x0 + coffee.x1) / 2;
    this.boxAt(
      parent,
      this.m.coffeeFloor,
      width - 0.12,
      0.05,
      plan.backDepth - 0.12,
      cx,
      y + 0.025,
      -(half + plan.backDepth / 2),
      false,
    );
    // Corridor wall with a wide opening.
    this.wall(parent, coffee.x0, -half, coffee.door.x - 1.4, -half, y, 0.9);
    this.wall(parent, coffee.door.x + 1.4, -half, coffee.x1, -half, y, 0.9);
    // Counter, machine and lamps along the back of the corner.
    const counterZ = -(half + depth) + 0.6;
    this.boxAt(parent, this.m.woodDark, width - 2, 0.95, 0.8, cx, y + 0.475, counterZ);
    this.boxAt(parent, this.m.wood, width - 1.9, 0.06, 0.9, cx, y + 0.98, counterZ);
    this.boxAt(parent, this.m.metal, 0.6, 0.6, 0.45, cx - 1.4, y + 1.31, counterZ);
    this.boxAt(parent, this.m.pot, 0.5, 0.35, 0.4, cx + 1.6, y + 1.18, counterZ);
    for (const dx of [-2, 0, 2]) {
      parent.add(
        this.mesh(
          this.cone,
          this.m.lamp,
          [0.22, 0.24, 0.22],
          [cx + dx, y + 2.3, counterZ + 1.2],
          false,
        ),
      );
    }
    if (back < counterZ - 1)
      this.wall(parent, coffee.x0, -(half + depth), coffee.x1, -(half + depth), y, 1.1);
    this.plant(parent, coffee.x1 - 0.5, y, -(half + depth) + 0.5, 0.9);
    const label = this.label(parent, cx, y + 0.15, -half - 0.55);
    renderRoomLabel(label.element, STRINGS.scene.coffee, '#d9b48a', '', undefined, false);
    this.coffeeLabels.push(label);
  }

  private buildRoom(plan: Plan, room: RoomPlan, color: string, shape: string): RoomEntry {
    const group = new THREE.Group();
    group.position.set(0, room.y, 0);
    const s = room.sign;
    const width = room.x1 - room.x0;
    const depth = Math.abs(room.zBack - room.zWall);
    const cx = (room.x0 + room.x1) / 2;
    const cz = (room.zWall + room.zBack) / 2;
    const tint = new THREE.Color(color);
    const floorMat = material(tint.clone().lerp(DARK, 0.76), 0.95);
    const rugMat = material(tint.clone().lerp(DARK, 0.5), 1);

    this.boxAt(group, floorMat, width - 0.12, 0.05, depth - 0.12, cx, 0.025, cz, false);
    const rugDepth = room.rows * D.rowPitch;
    const rugCentre = room.zWall + s * (D.tableZone + rugDepth / 2);
    this.boxAt(
      group,
      rugMat,
      width - D.aisle - 0.4,
      0.02,
      rugDepth - 0.2,
      cx + D.aisle / 2,
      0.06,
      rugCentre,
      false,
    );

    // Walls: the corridor wall with the door, the west partition, the back,
    // and the east partition when no room is next door.
    const doorX = room.door.x;
    const corridorHeight = 0.9;
    const tall = room.side === 'left' ? 1.1 : 0.9;
    this.wall(group, room.x0, room.zWall, doorX - 0.9, room.zWall, 0, corridorHeight);
    this.wall(group, doorX + 0.9, room.zWall, room.x1, room.zWall, 0, corridorHeight);
    this.wall(group, room.x0, room.zWall, room.x0, room.zBack, 0, tall);
    this.wall(group, room.x0, room.zBack, room.x1, room.zBack, 0, tall);
    if (this.eastWall(plan, room))
      this.wall(group, room.x1, room.zWall, room.x1, room.zBack, 0, tall);

    // Team table (E6); stools are instanced with the desks.
    const { centre } = tableOf(room, plan.limits);
    const table = centre;
    group.add(this.mesh(this.cylinder, this.m.wood, [0.55, 0.05, 0.55], [table.x, 0.72, table.z]));
    group.add(this.mesh(this.cylinder, this.m.metal, [0.06, 0.7, 0.06], [table.x, 0.35, table.z]));

    // Back rooms are labelled by the corridor, front rooms by their far wall, so
    // labels on both sides of the corridor don't overlap on screen.
    const labelZ = room.side === 'left' ? room.zWall + s * 0.55 : room.zBack - s * 0.6;
    const label = this.label(group, cx, 0.15, labelZ);
    this.group.add(group);
    return { shape, group, floorMat, rugMat, label };
  }

  private paintRoom(entry: RoomEntry, look: RoomLook): void {
    const previous = entry.look;
    if (
      previous?.lit === look.lit &&
      previous.detail === look.detail &&
      previous.more === look.more &&
      previous.name === look.name
    ) {
      return;
    }
    entry.look = look;
    const tint = new THREE.Color(look.color);
    entry.floorMat.color.copy(tint).lerp(DARK, look.lit ? 0.76 : 0.9);
    entry.rugMat.color.copy(tint).lerp(DARK, look.lit ? 0.5 : 0.82);
    renderRoomLabel(entry.label.element, look.name, look.color, look.detail, look.more, !look.lit);
  }

  private removeRoom(entry: RoomEntry): void {
    entry.label.removeFromParent();
    entry.group.removeFromParent();
    entry.floorMat.dispose();
    entry.rugMat.dispose();
    const index = this.growing.findIndex((g) => g.group === entry.group);
    if (index >= 0) this.growing.splice(index, 1);
  }

  private clearFurniture(): void {
    for (const mesh of this.furniture) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.furniture = [];
    this.screens = undefined;
    this.screenIndex.clear();
  }

  private buildFurniture(plan: Plan, looks: ReadonlyMap<string, RoomLook>): void {
    this.clearFurniture();
    const desks: { room: RoomPlan; desk: number; x: number; y: number; z: number }[] = [];
    const stools: { x: number; y: number; z: number }[] = [];
    for (const room of plan.rooms) {
      for (let desk = 0; desk < room.rows * plan.limits.desksPerRow; desk++) {
        const chair = spotPlan(
          room,
          { kind: 'desk', index: desk, standing: false },
          plan.limits,
        ).chair;
        if (chair !== undefined) desks.push({ room, desk, ...chair });
      }
      for (let seat = 0; seat < plan.limits.tableSeats; seat++) {
        const chair = spotPlan(
          room,
          { kind: 'seat', index: seat, standing: false },
          plan.limits,
        ).chair;
        if (chair !== undefined) stools.push(chair);
      }
    }
    const matrix = new THREE.Matrix4();
    const place = (
      mat: THREE.Material,
      geometry: THREE.BufferGeometry,
      size: readonly [number, number, number],
      offset: readonly [number, number, number],
      points: readonly { x: number; y: number; z: number }[],
    ): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(geometry, mat, Math.max(1, points.length));
      mesh.count = points.length;
      points.forEach((p, i) => {
        matrix.compose(
          new THREE.Vector3(p.x + offset[0], p.y + offset[1], p.z + offset[2]),
          new THREE.Quaternion(),
          new THREE.Vector3(...size),
        );
        mesh.setMatrixAt(i, matrix);
      });
      mesh.castShadow = this.shadows;
      mesh.receiveShadow = this.shadows;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      this.furniture.push(mesh);
      return mesh;
    };
    for (const part of DESK_PARTS(this.m))
      place(part.material, this.box, part.size, part.offset, desks);
    place(this.m.chair, this.cylinder, [0.2, 0.42, 0.2], [0, 0.21, 0], stools);
    const screens = place(this.m.screen, this.box, SCREEN_PART, SCREEN_OFFSET, desks);
    screens.castShadow = false;
    desks.forEach((d, index) => {
      const color = new THREE.Color(looks.get(d.room.id)?.color ?? '#6ea8fe');
      this.screenIndex.set(`${d.room.id}:${String(d.desk)}`, { index, color });
      screens.setColorAt(index, SCREEN_OFF);
    });
    if (screens.instanceColor !== null) screens.instanceColor.needsUpdate = true;
    this.screens = screens;
  }
}
