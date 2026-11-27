import './flood-panel.css';
import { drawChart, type Series } from './flood-chart.ts';
import type { Flood } from './flood-controller.ts';
import type { FacilityKind } from './flood-facilities.ts';
import type { BuildingState } from './flood-impact.ts';
import { STATE_TONES } from './flood-markers.ts';

/**
 * The event report of a flood, as a hydrologist would want it: clock, key figures, the hydrograph (design curve
 * against what overflows and what reaches the sea), the gauges, the watched buildings by severity, and the method
 * with its sources. Optional: the module runs without it. Redrawn at most four times a second.
 */
export interface PanelSetup {
  title: string;
  subtitle: string;
  /** The design hydrograph at simulated time t (s), dashed on the chart, and how long the event lasts (s). */
  design?: ((t: number) => number) | null;
  until: number;
  /** Rows of the method table, and the sources. */
  method: readonly (readonly [string, string])[];
  sources: readonly string[];
}

const GAUGE_TONES = ['#1d5c8e', '#c2571a', '#6a3d9a', '#2f7d3b'];
const KIND_NAMES: Record<FacilityKind, string> = {hospital: 'Hospital', health: 'Health', school: 'School', emergency: 'Emergency', care: 'Care home'};
const STATE_NAMES: Record<BuildingState, string> = {dry: 'dry', wet: 'water at the walls', flooded: 'over 1 m', damaged: 'damaged', collapsed: 'down'};
const SEVERITY: BuildingState[] = ['collapsed', 'damaged', 'flooded', 'wet', 'dry'];

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return Math.floor(t / 3600) + ':' + String(Math.floor(t / 60) % 60).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};

export function makeFloodPanel(container: HTMLElement, flood: Flood, setup: PanelSetup) {
  const root = document.createElement('section');
  root.className = 'flood-panel';
  root.setAttribute('aria-label', 'Flood event report');
  root.innerHTML = `<span class="fp-clock" aria-label="Simulated time"></span><h2></h2><p class="fp-sub"></p>
    <div class="fp-kpis"></div>
    <h3>Hydrograph</h3><canvas class="fp-hydro" aria-label="Hydrograph"></canvas>
    <p class="fp-legend"><span><i style="background:#242e28;opacity:.5"></i>design</span><span><i style="background:#1d5c8e"></i>overflow</span><span><i style="background:#2b9a8c"></i>to sea</span></p>
    <h3>Gauges</h3><canvas class="fp-gauges" aria-label="Gauges"></canvas>
    <p class="fp-legend fp-gauge-legend"></p>
    <h3>Critical buildings</h3><ol class="fp-facilities"></ol>
    <details><summary>Method</summary><table class="fp-method"></table><ol class="fp-sources"></ol></details>`;
  const q = <E extends Element>(s: string) => root.querySelector(s) as E;
  q<HTMLElement>('h2').textContent = setup.title;
  q<HTMLElement>('.fp-sub').textContent = setup.subtitle;
  const kpis = q<HTMLElement>('.fp-kpis'), hydro = q<HTMLCanvasElement>('.fp-hydro'), gaugeChart = q<HTMLCanvasElement>('.fp-gauges');
  const facilities = q<HTMLOListElement>('.fp-facilities'), legend = q<HTMLElement>('.fp-gauge-legend');
  for (const [label, value] of setup.method) {
    const row = document.createElement('tr'), a = document.createElement('td'), b = document.createElement('td');
    a.textContent = label; b.textContent = value; row.append(a, b); q<HTMLTableElement>('.fp-method').append(row);
  }
  for (const source of setup.sources) {
    const li = document.createElement('li'); li.textContent = source; q<HTMLOListElement>('.fp-sources').append(li);
  }
  container.prepend(root);
  // The design curve is drawn once per resize from its formula, in 120 points.
  const design: Series | null = setup.design ? {label: 'design', colour: 'rgba(36,46,40,.5)', dashed: true,
    points: Array.from({length: 121}, (_, k) => [setup.until * k / 120, setup.design!(setup.until * k / 120)] as const)} : null;

  let next = 0, shownKpis = '', shownList = '', shownLegend = '';
  function update(now = performance.now()) {
    const s = flood.stats;
    if (!s || now < next) return;
    next = now + 250;
    q<HTMLElement>('.fp-clock').textContent = clock(s.time);
    // Four figures: how much is under water, how much kills, what is hit, what it costs. The rest is in the charts.
    const figures: [string, string][] = [
      [(s.wet / 1e4).toFixed(1) + ' ha', 'flooded'],
      [(s.hazard[3] / 1e4).toFixed(1) + ' ha', 'danger to all'],
      [s.wetBuildings + ' / ' + s.collapsedBuildings, 'buildings wet / down'],
      [(s.damage * 100).toFixed(1) + '%', 'value lost']];
    const key = figures.map(f => f[0]).join('|');
    if (key !== shownKpis) {
      shownKpis = key;
      kpis.replaceChildren(...figures.map(([value, label]) => {
        const d = document.createElement('div'), b = document.createElement('b'), span = document.createElement('span');
        d.className = 'fp-kpi'; b.textContent = value; span.textContent = label; d.append(b, span); return d;
      }));
    }
    const h = flood.history, until = Math.max(setup.until, s.time);
    drawChart(hydro, {unit: 'm³/s', until, cursor: s.time, series: [
      ...(design ? [design] : []),
      {label: 'overflowing', colour: '#1d5c8e', points: h.map(p => [p.time, p.inflow] as const)},
      {label: 'to the sea', colour: '#2b9a8c', points: h.map(p => [p.time, p.outflow] as const)}]});
    drawChart(gaugeChart, {unit: 'depth m', until, cursor: s.time,
      series: flood.gauges.map((_gauge, g) => ({label: 'gauge ' + (g + 1), colour: GAUGE_TONES[g],
        points: h.filter(p => p.gauges.length > g).map(p => [p.time, p.gauges[g]] as const)}))});
    const legendKey = flood.gauges.map((_gauge, k) => k + ':' + (s.gauges[k]?.depth ?? 0).toFixed(2)).join('|');
    if (legendKey !== shownLegend) {
      shownLegend = legendKey;
      legend.replaceChildren(...flood.gauges.map((_, k) => {
        const span = document.createElement('span'), i = document.createElement('i'), reading = s.gauges[k];
        i.style.background = GAUGE_TONES[k];
        span.append(i, `${reading ? reading.depth.toFixed(2) + ' m · ' + reading.speed.toFixed(1) + ' m/s' : ''}`);
        return span;
      }));
    }
    // Watched buildings: the worst first, then how many stay dry.
    const rows = s.watched.map((w, k) => ({...w, facility: flood.watched[k].facility}))
      .filter(w => w.state !== 'dry').sort((a, b) => SEVERITY.indexOf(a.state) - SEVERITY.indexOf(b.state) || b.depth - a.depth);
    const dry = s.watched.length - rows.length;
    const listKey = rows.slice(0, 8).map(r => r.facility.id + r.state + r.depth.toFixed(1)).join('|') + dry;
    if (listKey !== shownList) {
      shownList = listKey;
      facilities.replaceChildren(...rows.slice(0, 8).map(r => {
        const li = document.createElement('li'), dot = document.createElement('i'), name = document.createElement('span'), small = document.createElement('small');
        dot.className = 'fp-dot'; dot.style.background = STATE_TONES[r.state];
        name.textContent = r.facility.name || KIND_NAMES[r.facility.kind];
        name.title = KIND_NAMES[r.facility.kind] + ' · ' + STATE_NAMES[r.state];
        small.textContent = r.state === 'collapsed' || r.state === 'damaged' ? STATE_NAMES[r.state] : r.depth.toFixed(1) + ' m';
        li.append(dot, name, small); return li;
      }), (() => {
        const li = document.createElement('li'), dot = document.createElement('i'), name = document.createElement('span'), small = document.createElement('small');
        dot.className = 'fp-dot'; dot.style.background = STATE_TONES.dry;
        name.textContent = rows.length > 8 ? `+${rows.length - 8} more · ${dry} dry` : `${dry} of ${s.watched.length} dry`;
        li.append(dot, name, small); return li;
      })());
    }
  }
  return {root, update, dispose() { root.remove(); }};
}
