import {readFile} from 'node:fs/promises';
import {coreWithTerrain, isBarrios, isCity, isCoreFile, isLayers, isPlaces, isRoofPalette, isSea, isSectorIndex, isZone} from '../src/data/load.ts';
import {validGuagua} from '../src/drive/guagua.ts';
import {validateSectorIndex, validateZone} from '../src/data/sector-index.ts';

function isGuaguaFleetIndex(value) {
  if (!value || value.version !== 1 || value.size !== 240 || typeof value.cells !== 'object' || typeof value.pieces !== 'object') return false;
  for (const [cell, refs] of Object.entries(value.cells)) {
    if (!/^-?\d+_-?\d+$/.test(cell) || !Array.isArray(refs)) return false;
    for (const ref of refs) {
      if (!Array.isArray(ref) || ref.length !== 3 || typeof ref[0] !== 'string' || !Number.isFinite(ref[1]) || !Number.isFinite(ref[2]) || ref[1] > ref[2]) return false;
      if (!value.pieces[ref[0]]) return false;
    }
  }
  for (const piece of Object.values(value.pieces)) {
    if (!piece || typeof piece.file !== 'string' || typeof piece.line !== 'string' || typeof piece.direction !== 'string'
      || !Number.isFinite(piece.phase) || !Number.isFinite(piece.period) || piece.period <= 0) return false;
  }
  return true;
}

async function loadOptionalFleetIndex(area) {
  const file = new URL('../public/data/guaguas/' + area + '/index.json', import.meta.url);
  try {
    const value = JSON.parse(await readFile(file, 'utf8'));
    if (!isGuaguaFleetIndex(value)) throw new Error('Invalid guagua fleet index: ' + area);
    return value;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function load(file, valid) {
  const data = JSON.parse(await readFile(new URL('../public/data/' + file, import.meta.url), 'utf8'));
  if (!valid(data)) throw new Error('Invalid map data: ' + file);
  return data;
}

const [core, index, , places] = await Promise.all([
  load('city-core.json', isCoreFile),
  load('city-index.json', isSectorIndex),
  load('pilot.json', isCity),
  load('poi.geojson', isPlaces),
  load('roof-tones.json', isRoofPalette),
  load('sea.json', isSea),
  load('barrios.json', isBarrios),
  load('guaguas.json', validGuagua)
]);
const fleetIndexes = await Promise.all(['city', 'pilot'].map(async area => [area, await loadOptionalFleetIndex(area)]));
for (const [area, fleet] of fleetIndexes) {
  if (!fleet) continue;
  for (const piece of Object.values(fleet.pieces)) {
    const data = JSON.parse(await readFile(new URL('../public/data/guaguas/' + area + '/' + piece.file, import.meta.url), 'utf8'));
    if (!data || !Array.isArray(data.path) || data.path.length < 2 || !Array.isArray(data.stops)) throw new Error('Invalid guagua fleet piece: ' + piece.file);
  }
}
validateSectorIndex(index);
// Place cards: a text that fits the sheet on a phone, and a photo that is really there.
for (const {properties: {id, card}} of places.features) {
  if (!card) continue;
  const length = [...card.text].length;
  if (length < 400 || length > 600) throw new Error('Card text of ' + id + ' has ' + length + ' characters: keep it between 400 and 600');
  if (card.photo) await readFile(new URL('../public/photos/' + card.photo.file, import.meta.url));
}
if (core.terrain.file !== 'city-terrain.bin') throw new Error('Core must point to city-terrain.bin');
const heights = await readFile(new URL('../public/data/' + core.terrain.file, import.meta.url));
coreWithTerrain(core, heights.buffer.slice(heights.byteOffset, heights.byteOffset + heights.byteLength));
let buildings = 0;
for (const {id, file} of index.zones) {
  if (!core.far[id]) throw new Error('Zone ' + id + ' has no far level');
  buildings += validateZone(await load('city-zones/' + file, isZone), id, index);
}
if (buildings !== index.buildingCount) throw new Error('Zones hold ' + buildings + ' buildings, the index expects ' + index.buildingCount);
for (const {file} of index.sectors) await load('city-sectors/' + file, isLayers);
console.log('Map data validated: core, pilot, places, roof palette, sea, barrios, guaguas, ' + index.zones.length + ' zones and ' + index.sectors.length + ' sectors');
