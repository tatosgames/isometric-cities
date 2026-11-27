/**
 * What the water does, with published measures rather than invented ones.
 *
 * Damage: the residential depth-damage function for Europe of the JRC, Huizinga, de Moel & Szewczyk (2017), "Global
 * flood depth-damage functions", EUR 28552 EN: the share of a building's value lost at a given water depth.
 *
 * Danger to people: the flood hazard rating of Defra / Environment Agency R&D FD2320 (2005, revised 2008),
 * HR = d (v + 0.5) + DF, with the debris factor DF of urban streets. Thresholds 0.75, 1.25 and 2 split it into
 * «danger for some», «for most» and «for all» (children, the elderly, then the emergency services too).
 */

const JRC_EUROPE_RESIDENTIAL: readonly (readonly [number, number])[] = [
  [0, 0], [.5, .25], [1, .4], [1.5, .5], [2, .6], [3, .75], [4, .85], [5, .95], [6, 1]
];

/** Share (0–1) of a building's value lost with `depth` metres of water around it. */
export function damageShare(depth: number) {
  if (depth <= 0) return 0;
  const curve = JRC_EUROPE_RESIDENTIAL;
  for (let k = 1; k < curve.length; k++) {
    const [d1, s1] = curve[k];
    if (depth <= d1) {
      const [d0, s0] = curve[k - 1];
      return s0 + (s1 - s0) * (depth - d0) / (d1 - d0);
    }
  }
  return 1;
}

/** Debris factor of FD2320 for urban areas: nothing in shallow water, then 0.5, then 1 above 0.75 m. */
export const debrisFactor = (depth: number) => depth <= .25 ? 0 : depth <= .75 ? .5 : 1;

/** Flood hazard rating of FD2320 at `depth` m and `speed` m/s. */
export const hazardRating = (depth: number, speed: number) => depth > 0 ? depth * (speed + .5) + debrisFactor(depth) : 0;

/** 0 none, 1 low, 2 danger for some, 3 for most, 4 for all. */
export function hazardClass(rating: number) {
  return rating <= 0 ? 0 : rating < .75 ? 1 : rating < 1.25 ? 2 : rating < 2 ? 3 : 4;
}
