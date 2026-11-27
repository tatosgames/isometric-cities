/**
 * Design floods by return period, by the rational method of the Spanish drainage standard Norma 5.2-IC (Orden
 * FOM/298/2016), which the Plan Hidrológico de Gran Canaria (Decreto 2/2019, art. 46.2) prescribes for barranco
 * flood studies until the Consejo Insular de Aguas issues its own technical standard.
 *
 *   Q_T = I(T, tc) · C · A · Kt / 3.6                         (m³/s; mm/h, km²)
 *   I(T, t) = Id · (I1/Id)^(3.5287 − 2.5287 · t^0.1)         (t in hours)
 *   Id = Pd · KA / 24,  KA = 1 − log10(A) / 15  (A ≥ 1 km²)
 *   tc = 0.3 · Lc^0.76 · Jc^−0.19                             (h; km, m/m)
 *   Kt = 1 + tc^1.25 / (tc^1.25 + 14)
 *
 * The barranco Guiniguada is not an ARPSI of Gran Canaria (EPRI, 3rd cycle, 2025): no official design discharge is
 * published for it, so this is an estimate made with the official method and the sources listed on each value.
 */

export interface Basin {
  name: string;
  /** Catchment area (km²). */
  area: number;
  /** Length of the main channel (km) and the drop along it (m). */
  length: number;
  drop: number;
  /** Runoff coefficient C. */
  runoff: number;
  /** Torrentiality index I1/Id: ratio of the hourly to the mean daily intensity. */
  torrentiality: number;
  /** Maximum daily rainfall Pd (mm) by return period (years). */
  rainfall: Readonly<Record<number, number>>;
  /** Where each value comes from. */
  sources: Readonly<Record<'area' | 'length' | 'runoff' | 'torrentiality' | 'rainfall', string>>;
}

export const GUINIGUADA: Basin = {
  name: 'Barranco Guiniguada',
  area: 65,
  length: 27,
  drop: 1891,
  runoff: .75,
  torrentiality: 8,
  rainfall: {2: 28.7, 5: 59.15, 10: 79.36, 25: 104.89, 50: 123.83, 100: 142.63, 500: 186.08, 1000: 204.76},
  // Short enough for a panel; docs/FLOOD.md has them in full.
  sources: {
    area: 'A: Plan Hidrológico de Gran Canaria, 2.3.4',
    length: 'Lc: estimate from OSM and the map',
    runoff: 'C: Plan Hidrológico de Gran Canaria, art. 39.2',
    torrentiality: 'I1/Id: Cabildo de Gran Canaria (Salto del Negro)',
    rainfall: 'Pd: station 183 Capón, Gumbel (Cabildo de Gran Canaria)'
  }
};

/** Observed rainfalls to replay, with their source. */
export const HISTORIC = {
  1954: {label: '22 Nov 1954', rainfall: 138.5,
    source: 'Pd observed: Máyer Suárez (2001), AEMET'},
  1989: {label: '16 Feb 1989', rainfall: 117.5,
    source: 'Pd observed: Máyer Suárez (2001), AEMET'}
} as const;

/** Every intermediate value of the rational method, to be shown as well as used. */
export interface DesignFlood {
  /** Daily rainfall (mm), areal factor, mean daily intensity (mm/h). */
  rainfall: number;
  areal: number;
  daily: number;
  /** Time of concentration (h), intensity for that duration (mm/h), uniformity coefficient. */
  concentration: number;
  intensity: number;
  uniformity: number;
  /** Peak discharge (m³/s). */
  peak: number;
}

/** Hourly intensity factor of Norma 5.2-IC, Fa = (I1/Id)^(3.5287 − 2.5287 t^0.1), t in hours. */
export const intensityFactor = (torrentiality: number, hours: number) =>
  Math.pow(torrentiality, 3.5287 - 2.5287 * Math.pow(hours, .1));

export const arealFactor = (km2: number) => km2 < 1 ? 1 : 1 - Math.log10(km2) / 15;

/** The design flood of `basin` for a daily rainfall `rainfall` (mm), e.g. `basin.rainfall[100]`. */
export function rationalFlood(basin: Basin, rainfall: number): DesignFlood {
  const areal = arealFactor(basin.area), daily = rainfall * areal / 24;
  const slope = basin.drop / (basin.length * 1000);
  const concentration = .3 * Math.pow(basin.length, .76) * Math.pow(slope, -.19);
  const intensity = daily * intensityFactor(basin.torrentiality, concentration);
  const k = Math.pow(concentration, 1.25), uniformity = 1 + k / (k + 14);
  return {rainfall, areal, daily, concentration, intensity, uniformity,
    peak: intensity * basin.runoff * basin.area * uniformity / 3.6};
}

/** Rain intensity (mm/h) of return period `rainfall` falling for `hours` on `km2`, by the same IDF of Norma 5.2-IC. */
export function designRain(basin: Basin, rainfall: number, hours: number, km2: number) {
  return rainfall * arealFactor(km2) / 24 * intensityFactor(basin.torrentiality, hours);
}

/**
 * Shape of the synthetic hydrograph: the gamma function closest to the SCS dimensionless unit hydrograph (m = 3.7,
 * NEH-4 ch. 16), peaking at tp = D/2 + 0.6 tc with D = 0.133 tc, i.e. 0.667 tc.
 */
export const HYDROGRAPH_SHAPE = 3.7;
export const peakTime = (flood: DesignFlood) => .667 * flood.concentration * 3600;

/** Discharge (m³/s) at `t` (s) of Q = Qp (t/tp)^m e^{m(1 − t/tp)}. */
export function hydrograph(t: number, peak: number, rise: number, m = HYDROGRAPH_SHAPE) {
  if (t <= 0 || peak <= 0 || rise <= 0) return 0;
  const k = t / rise;
  return peak * Math.pow(k, m) * Math.exp(m * (1 - k));
}

/** When (s) the rising limb reaches `share` of the peak: the simulation can start there instead of at a trickle. */
export function riseTo(share: number, rise: number, m = HYDROGRAPH_SHAPE) {
  let lo = 0, hi = 1;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (Math.pow(mid, m) * Math.exp(m * (1 - mid)) < share) lo = mid; else hi = mid;
  }
  return lo * rise;
}
