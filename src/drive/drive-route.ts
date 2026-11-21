import type { Altitude } from '../data/types.ts';
import type { RoadNode, routesFrom } from './road-routing.ts';

type Position = {x: number; y: number};
export type Destination = Position & {name: string; number: string};
type Target = {poi: Destination; node: number};
type Coin = Position & {z: number};
type RouteWorld = {
  nodes: RoadNode[];
  nearestNode(x: number, y: number): number;
  free(x: number, y: number, radius: number): boolean;
};
type RouteTuning = {
  coinStep: number;
  coinReach: number;
  magnet: number;
  maxSpeed: number;
  arriveReach: number;
  arriveBonus: number;
};

export type RouteEvent =
  | {type: 'coin'; coin: Coin; points: 1}
  | {type: 'arrival'; points: number};

export function makeDriveRoute(places: Destination[], altitude: Altitude, tune: RouteTuning, capacity: number) {
  let target: Target | null = null;
  const coins: Coin[] = [];
  let arrived = false;

  return {
    get target() { return target; },
    coins,
    clear() {
      target = null;
      arrived = false;
      coins.length = 0;
    },
    choose(world: RouteWorld, field: ReturnType<typeof routesFrom>, random = Math.random) {
      const {source, prev, dist} = field;
      const reachable = places.filter(poi => poi !== target?.poi)
        .map(poi => ({poi, node:world.nearestNode(poi.x, poi.y)}))
        .filter(({node}) => node >= 0 && node !== source && Number.isFinite(dist[node]));
      target = reachable[Math.floor(random() * reachable.length)] ?? null;
      coins.length = 0;
      arrived = false;
      if (!target) return null;

      const path: RoadNode[] = [];
      for (let node = target.node; node >= 0; node = prev[node]) path.push(world.nodes[node]);
      path.reverse();

      // Start the trail a little ahead of the car and carry the spacing across road segments.
      let carry = 3;
      for (let i = 1; i < path.length && coins.length < capacity; i++) {
        const a = path[i - 1], b = path[i], length = Math.hypot(b.x - a.x, b.y - a.y);
        for (; carry < length && coins.length < capacity; carry += tune.coinStep) {
          const x = a.x + (b.x - a.x) * carry / length;
          const y = a.y + (b.y - a.y) * carry / length;
          if (world.free(x, y, 1.2)) coins.push({x, y, z:altitude(x, y) + 2});
        }
        carry -= length;
      }
      return {target, path};
    },
    advance(player: Position, nodes: RoadNode[], dt: number, emit: (event: RouteEvent) => void) {
      for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i], dx = player.x - coin.x, dy = player.y - coin.y;
        const gap = Math.hypot(dx, dy);
        if (gap < tune.coinReach) {
          coins.splice(i, 1);
          emit({type:'coin', coin, points:1});
        } else if (gap < tune.magnet) {
          const pull = Math.min(gap, (tune.maxSpeed + 10) * dt);
          coin.x += dx / gap * pull;
          coin.y += dy / gap * pull;
        }
      }

      const end = target && nodes[target.node];
      if (!arrived && end && Math.hypot(end.x - player.x, end.y - player.y) < tune.arriveReach) {
        arrived = true;
        emit({type:'arrival', points:tune.arriveBonus});
      }
    }
  };
}
