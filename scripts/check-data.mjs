import {readFile} from 'node:fs/promises';
import {coreWithTerrain, isBarrios, isCity, isCoreFile, isLayers, isPlaces, isRoofPalette, isSea, isSectorIndex, isZone} from '../src/data/load.ts';
import {validateSectorIndex, validateZone} from '../src/data/sector-index.ts';

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
  load('barrios.json', isBarrios)
]);
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
console.log('Map data validated: core, pilot, places, roof palette, sea, barrios, ' + index.zones.length + ' zones and ' + index.sectors.length + ' sectors');
