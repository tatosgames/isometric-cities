import {readFile} from 'node:fs/promises';
import {isCity, isLayers, isPlaces, isRoofPalette, isSectorIndex} from '../src/data/load.ts';
import {validateSectorIndex} from '../src/data/sector-index.ts';

async function load(file, valid) {
  const data = JSON.parse(await readFile(new URL('../public/data/' + file, import.meta.url), 'utf8'));
  if (!valid(data)) throw new Error('Invalid map data: ' + file);
  return data;
}

const [city, index] = await Promise.all([
  load('city.json', isCity),
  load('city-index.json', isSectorIndex),
  load('pilot.json', isCity),
  load('poi.geojson', isPlaces),
  load('roof-tones.json', isRoofPalette)
]);
validateSectorIndex(city, index);
for (const {file} of index.sectors) await load('city-sectors/' + file, isLayers);
console.log('Map data validated: city, pilot, places, roof palette and ' + index.sectors.length + ' sectors');
