import * as T from 'three';
import { surfaceStencil } from '../render/building-stencil.ts';
import type { Body } from './drive-physics.ts';

export interface GuaguaStop { id: string; name: string; position: [number, number]; distance: number }
export interface GuaguaData { line: string; direction: string; path: [number, number][]; stops: GuaguaStop[] }
export interface GuaguaState { x: number; y: number; h: number; distance: number; speed: number; stopped: number }

export function validGuagua(value: unknown): value is GuaguaData {
  if (!value || typeof value !== 'object') return false;
  const d = value as Partial<GuaguaData>;
  return typeof d.line === 'string' && typeof d.direction === 'string' && Array.isArray(d.path) && d.path.length > 1
    && d.path.every(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    && Array.isArray(d.stops) && d.stops.every(s => !!s && typeof s.id === 'string' && typeof s.name === 'string'
      && Array.isArray(s.position) && Number.isFinite(s.position[0]) && Number.isFinite(s.position[1]) && Number.isFinite(s.distance));
}

export async function loadGuagua(base = import.meta.env.BASE_URL): Promise<GuaguaData | null> {
  try {
    const response = await fetch(`${base}data/guaguas.json`, { cache: 'no-cache' });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return validGuagua(value) ? value : null;
  } catch { return null; }
}

function length(path: readonly [number, number][]) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return total;
}

export function guaguaState(data: GuaguaData, previous: GuaguaState | null, dt: number): GuaguaState {
  const total = length(data.path);
  const cruise = 8;
  if (previous?.stopped && previous.stopped > 0) {
    const stopped = Math.max(0, previous.stopped - dt);
    return { ...previous, stopped };
  }
  const start = previous?.distance ?? 0;
  let distance = start + cruise * dt;
  if (distance > total) distance = 0;
  const stop = data.stops.find(s => Math.abs(s.distance - distance) < cruise * dt + .25
    && s.distance !== previous?.distance);
  if (stop) distance = stop.distance;
  let walked = 0;
  for (let i = 1; i < data.path.length; i++) {
    const a = data.path[i - 1], b = data.path[i], segment = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (distance <= walked + segment) {
      const t = segment ? (distance - walked) / segment : 0;
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, h: Math.atan2(b[1] - a[1], b[0] - a[0]), distance, speed: stop ? 0 : cruise, stopped: stop ? 3 : 0 };
    }
    walked += segment;
  }
  const a = data.path[data.path.length - 2], b = data.path[data.path.length - 1];
  return { x: b[0], y: b[1], h: Math.atan2(b[1] - a[1], b[0] - a[0]), distance, speed: cruise, stopped: 0 };
}

/** Circular footprint used by the arcade cars and the bus. Returns closing speed. */
export function guaguaHit(bus: GuaguaState, car: Pick<Body, 'x' | 'y' | 'vx' | 'vy'>, radius = 3.2) {
  const dx = car.x - bus.x, dy = car.y - bus.y, d = Math.hypot(dx, dy), reach = radius + 2.7;
  if (d >= reach || d < 1e-5) return 0;
  const nx = dx / d, ny = dy / d;
  const closing = car.vx * nx + car.vy * ny - bus.speed;
  return closing > 0 ? closing : 0;
}

export function guaguaMesh() {
  const group = new T.Group();
  const yellow = new T.MeshStandardMaterial({ ...surfaceStencil(), color: '#f0c928', roughness: .75, flatShading: true });
  const dark = new T.MeshStandardMaterial({ ...surfaceStencil(), color: '#24323a', roughness: .8, flatShading: true });
  const body = new T.Mesh(new T.BoxGeometry(2.2, 1.8, 6.2).translate(0, 1.25, 0), yellow);
  const windows = new T.Mesh(new T.BoxGeometry(2.24, .7, 5.1).translate(0, 1.95, 0), dark);
  group.add(body, windows);
  group.rotation.order = 'YXZ';
  return group;
}
