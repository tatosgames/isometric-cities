/**
 * The query string shared by the map, the drive and the labs: nine names, all English.
 * - `lab`  which lab: `quality`, `drive`, `roads`, `demolition`, `flood`
 * - `case` the scenario inside it, its parts separated by dots: `guiniguada.1954`, `widths.ordinaria`
 * - `mode` the one exclusive choice of a lab: a view, a tool, a variant, a quality profile
 * - `area` the dataset: `city` (default), `pilot`, `stress`
 * - `at`   where the camera looks: `x,y[,zoom[,turn[,place]]]` in map metres, or a place id
 * - `on`, `off` lists of switches: `on=stats,diagnostics`, `off=police,buses`
 * - `look` the look, then its values: `sole`, `preset:clay,tilt:1`
 * - `tune` numbers as `key:value`, the same syntax in every lab: `seed:7,speed:1200,player.baseSpeed:30`
 * Lists are comma separated and defaults are not written. Old links are rewritten once at start (`upgradeUrl`).
 */
export type Switch = 'on' | 'off';

export const query = () => new URLSearchParams(location.search);

export const items = (q: URLSearchParams, name: string) => (q.get(name) ?? '').split(',').filter(Boolean);

function writeItems(q: URLSearchParams, name: string, list: string[]) {
  if (list.length) q.set(name, list.join(',')); else q.delete(name);
}

/** Whether a switch is listed: `has(q, 'off', 'police')`. */
export const has = (q: URLSearchParams, name: Switch, item: string) => items(q, name).includes(item);

export function setSwitch(q: URLSearchParams, name: Switch, item: string, listed: boolean) {
  const rest = items(q, name).filter(i => i !== item);
  writeItems(q, name, listed ? [...rest, item] : rest);
}

/** The `key:value` items of `tune` or `look`; a bare item maps to ''. */
export function pairs(q: URLSearchParams, name: 'tune' | 'look') {
  return new Map(items(q, name).map(item => {
    const colon = item.indexOf(':');
    return colon < 0 ? [item, ''] as const : [item.slice(0, colon), item.slice(colon + 1)] as const;
  }));
}

export function setPairs(q: URLSearchParams, name: 'tune' | 'look', entries: Iterable<readonly [string, string]>) {
  writeItems(q, name, [...entries].map(([k, v]) => v === '' ? k : k + ':' + v));
}

/** A number from `tune`, or the fallback when it is missing or not a number. */
export function tuned(q: URLSearchParams, key: string, fallback: number) {
  const raw = pairs(q, 'tune').get(key);
  return raw && Number.isFinite(Number(raw)) ? Number(raw) : fallback;
}

export function setTune(q: URLSearchParams, key: string, value: number | string | null) {
  const tune = pairs(q, 'tune');
  if (value === null) tune.delete(key); else tune.set(key, String(value));
  setPairs(q, 'tune', tune);
}

/** The parts of `case`: `guiniguada.1954` → ['guiniguada', '1954']; [] without it. */
export const caseParts = (q: URLSearchParams) => (q.get('case') ?? '').split('.').filter(Boolean);

export interface At {point?: [number, number]; zoom?: number; turn?: number; place?: string}

export function readAt(q: URLSearchParams): At {
  const parts = items(q, 'at');
  const [x, y, zoom, turn] = parts.map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return parts.length ? {place: parts[0]} : {};
  return {point: [x, y], ...zoom > 0 ? {zoom} : {}, ...Number.isFinite(turn) ? {turn} : {}, ...parts[4] ? {place: parts[4]} : {}};
}

export function setAt(q: URLSearchParams, x: number, y: number, zoom?: number, turn?: number, place?: string | number | null) {
  const parts = [x.toFixed(1), y.toFixed(1)];
  if (zoom !== undefined) parts.push(zoom.toFixed(2));
  if (turn !== undefined) parts.push(String(+turn.toFixed(3)));
  if (place != null) parts.push(String(place));
  q.set('at', parts.join(','));
}

/** The query string with its lists readable: `:` and `,` stay unescaped. */
export const search = (q: URLSearchParams) => q.toString().replaceAll('%3A', ':').replaceAll('%2C', ',');

const NAMES = new Set(['lab', 'case', 'mode', 'area', 'at', 'on', 'off', 'look', 'tune']);
const LABS: Record<string, string> = {qualita: 'quality', guida: 'drive', strade: 'roads', demolizione: 'demolition', inondazione: 'flood'};
const ROADS: Record<string, string> = {strade: 'mercado', larghezze: 'widths', settori: 'sectors'};
const ON: Record<string, string> = {neutral: 'neutral', editorPreview: 'editor', diagnostics: 'diagnostics', stats: 'stats',
  confronto: 'compare', raster: 'raster', inverso: 'reverse', mappa: 'map', ritardo: 'delay', intera: 'whole', prima: 'before'};
const OFF: Record<string, string> = {nopolice: 'police', nobuses: 'buses', noSuolo: 'ground', noRetino: 'hatch'};
const TUNE: Record<string, string> = {seed: 'seed', velocita: 'speed', portata: 'peak', tombino: 'culvert', pioggia: 'rain',
  deflusso: 'runoff', manning: 'manning', theta: 'theta', courant: 'courant', froude: 'froude', quota: 'height',
  distanza: 'standoff', pos: 'pos', divisore: 'split', transizione: 'transition', durata: 'duration', campo: 'span'};
const LOOK: Record<string, string> = {matcap: 'preset', palette: 'palette', gain: 'gain', bounce: 'bounce', shade: 'shade',
  clouds: 'clouds', glow: 'glow', tilt: 'tilt'};
const MODES: Record<string, Record<string, string>> = {
  vista: {profondita: 'depth', pericolo: 'hazard', massimo: 'peak'}, strumento: {palla: 'ball', dinamite: 'dynamite', sparo: 'gun'},
  variante: {0: 'game', 1: 'painted'}, modo: {attuale: 'current', stabile: 'stable', visivo: 'visual'}, preview: {}
};

/** The same link in today's names; links already written with them come back unchanged. */
export function upgrade(old: URLSearchParams) {
  const q = new URLSearchParams(), on: string[] = [], off: string[] = [], tune: string[] = [], look: string[] = [];
  const at: string[] = [], scene: string[] = [];
  for (const [key, value] of old) {
    if (key === 'lab') q.set('lab', LABS[value] ?? value);
    else if (key === 'test') { q.set('lab', 'roads'); scene[0] = ROADS[value] ?? value; }
    else if (key === 'scenario') scene[0] = ROADS[value] ?? (value === 'pioggia' ? 'rain' : value);
    else if (key === 'ritorno' || key === 'caso') scene[1] = value;
    else if (key === 'x' || key === 'y' || key === 'zoom') at[{x: 0, y: 1, zoom: 2}[key]] = value;
    else if (key === 'start' || key === 'focus') q.set('at', value);
    else if (key === 'vista' && value.startsWith('{')) {
      try {
        const {target: [x, , z], zoom, turn, selected} = JSON.parse(value);
        q.set('at', [x, -z, zoom, turn ?? 0, ...selected == null ? [] : [selected]].join(','));
      } catch { /* a broken view is dropped */ }
    } else if (key in MODES) q.set('mode', MODES[key][value] ?? value);
    else if (key === 't') tune.push(...value.split(',').filter(Boolean));
    else if (key in TUNE) tune.push(TUNE[key] + ':' + value);
    else if (key in ON) on.push(ON[key]);
    else if (key in OFF) off.push(OFF[key]);
    else if (key === 'sky' || key === 'pausa') { if (value === (key === 'sky' ? '0' : '1')) off.push(key === 'sky' ? 'sky' : 'play'); }
    else if (key === 'look') look.unshift(value);
    else if (key in LOOK) look.push(LOOK[key] + ':' + (value || '1'));
    else q.append(key, value);
  }
  if (at[0] && at[1]) q.set('at', at.filter(Boolean).join(','));
  if (scene[1] && !scene[0]) scene[0] = q.get('lab') === 'flood' ? 'guiniguada' : 'widths';
  if (scene.length) q.set('case', scene.join('.'));
  for (const [name, list] of [['on', on], ['off', off], ['tune', tune], ['look', look]] as const) {
    if (list.length) q.set(name, [...items(q, name), ...list].join(','));
  }
  return q;
}

/** Rewrites an old link in place, before anything reads the URL. */
export function upgradeUrl() {
  const old = query();
  if ([...old.keys()].every(k => NAMES.has(k)) && !((old.get('lab') ?? '') in LABS)) return;
  history.replaceState(history.state, '', location.pathname + '?' + search(upgrade(old)) + location.hash);
}
