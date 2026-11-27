/**
 * The flood module's public face. Callers import from here only; everything else in `src/flood/` is internal.
 *
 *   const flood = createFlood({terrain, buildings, sea, box, source, scenario, facilities});
 *   scene.add(flood.group);
 *   every frame: flood.control({playing, speed, view}); flood.tick(seconds);
 *
 * It needs from the project only the data types and the terrain helpers of `src/geometry.ts`. See docs/FLOOD.md for
 * how to reuse it elsewhere or take it out.
 */
export { createFlood, type Flood, type FloodSetup, type FloodSample } from './flood-controller.ts';
export { makeFloodPanel, type PanelSetup } from './flood-panel.ts';
export { isFacilities, type Facility, type FacilityKind } from './flood-facilities.ts';
export { GUINIGUADA, HISTORIC, rationalFlood, designRain, peakTime, riseTo, hydrograph, HYDROGRAPH_SHAPE,
  type Basin, type DesignFlood } from './flood-hydrology.ts';
export { buildingState, damageShare, hazardRating, hazardClass, COLLAPSE, PARTIAL_DAMAGE, type BuildingState } from './flood-impact.ts';
export type { FloodScenario, FloodStats, FloodView } from './flood-sim.ts';
export type { FloodOptions } from './flood-solver.ts';
export type { Box } from './flood-grid.ts';
