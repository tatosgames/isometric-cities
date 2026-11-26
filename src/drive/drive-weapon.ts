import * as T from 'three';
import type { Building } from '../data/types.ts';
import type { Blast } from '../demolition/debris.ts';
import { surfaceStencil } from '../render/building-stencil.ts';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * The car's gun: a slug flying level along the car, every `cooldown` seconds. On its way it can meet a patrol or a
 * guagua, else it ends at the first wall in reach, which comes down, or at its reach. The geometry is checked in
 * Node (`scripts/qa-drive-fire.mjs`); `drive.ts` owns what each hit does.
 */
export interface Shot {
  /** Plan position (east, north) and height of the slug, its heading, and the metres left to the wall or the reach. */
  x: number; y: number; z: number;
  dx: number; dy: number;
  left: number;
  /** The building it ends in, if any. */
  building: Building | null;
}

/** A slug from (x, y, z) along `heading`; `t` metres ahead stands `building`. Beyond `range` it falls short. */
export function aimShot(x: number, y: number, z: number, heading: number, t: number, building: Building | null, range: number): Shot {
  return {x, y, z, dx: Math.cos(heading), dy: Math.sin(heading), left: Math.min(t, range), building: t <= range ? building : null};
}

/** The blast of a slug at the end of its flight, in world axes: the drive and the demolition lab break walls alike. */
export function shotBlast(shot: Shot, {blast, blastReach, push}: {blast: number; blastReach: number; push: number}): Blast {
  return {point: new T.Vector3(shot.x, shot.z, -shot.y), push: new T.Vector3(shot.dx * push, 0, -shot.dy * push),
    strength: blast, reach: blastReach};
}

/** Where along the plan segment a→b (0 to 1) it first comes within `r` of (cx, cy); Infinity if never. */
export function segmentCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number) {
  const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy;
  const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  if (!a) return Infinity;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : Infinity;
}

/** Where along a→b (0 to 1) it enters a box of half sizes `half`×`side` turned by `h` round (cx, cy); Infinity if never. */
export function segmentBox(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, h: number, half: number, side: number) {
  const c = Math.cos(h), s = Math.sin(h);
  const local = (x: number, y: number) => [(x - cx) * c + (y - cy) * s, (y - cy) * c - (x - cx) * s];
  const [px, py] = local(ax, ay), [qx, qy] = local(bx, by), vx = qx - px, vy = qy - py;
  let t0 = 0, t1 = 1;
  for (const [p, v, e] of [[px, vx, half], [py, vy, side]]) {
    if (Math.abs(v) < 1e-9) { if (Math.abs(p) > e) return Infinity; continue; }
    let ta = (-e - p) / v, tb = (e - p) / v;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

/** A body thrown by a shot: height above the road, vertical speed, and a roll that turns it over. */
export interface Thrown { lift: number; lv: number; tumble: number; tumbleRate: number; vx: number; vy: number }

export function launch(b: Thrown, dx: number, dy: number, speed: number, up: number) {
  b.vx = dx * speed; b.vy = dy * speed; b.lv = up; b.lift = Math.max(b.lift, .01);
  b.tumbleRate = (Math.random() < .5 ? -1 : 1) * (5 + Math.random() * 3);
}

/**
 * One step of a thrown body: a parabola, one bounce, then it lies on its wheels or its roof. True while it moves.
 * `x`/`y` are moved by the caller with `vx`/`vy`, which this slows on each landing.
 */
export function fly(b: Thrown, dt: number, gravity: number) {
  if (b.lift <= 0 && !b.lv) return false;
  b.lv -= gravity * dt; b.lift += b.lv * dt; b.tumble += b.tumbleRate * dt;
  if (b.lift > 0) return true;
  b.lift = 0;
  if (b.lv < -4) {
    b.lv = -b.lv * .35; b.vx *= .45; b.vy *= .45; b.tumbleRate *= .5;
    return true;
  }
  b.lv = b.vx = b.vy = b.tumbleRate = 0;
  b.tumble = Math.round(b.tumble / Math.PI) * Math.PI;
  return false;
}

/** The slug: a fat warm shell along its flight, unlit so it reads against any facade. */
export function makeSlug(group: T.Object3D) {
  const body = new T.CylinderGeometry(.42, .5, 2.4, 10).rotateZ(Math.PI / 2);
  const tip = new T.ConeGeometry(.42, .9, 10).rotateZ(-Math.PI / 2).translate(1.65, 0, 0);
  const mesh = new T.Mesh(mergeGeometries([body.toNonIndexed(), tip.toNonIndexed()])!,
    new T.MeshBasicMaterial({...surfaceStencil(), color: '#ffc93c'}));
  mesh.visible = false;
  group.add(mesh);
  return {
    show(shot: Shot | null) {
      mesh.visible = !!shot;
      if (!shot) return;
      mesh.position.set(shot.x, shot.z, -shot.y);
      mesh.rotation.y = Math.atan2(shot.dy, shot.dx);
    }
  };
}
