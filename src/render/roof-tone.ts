import type { Building, RoofTones } from '../data/types.ts';

const fallback=['#dbd4be','#b37559','#e8dfc9','#d4c8b6','#c28869'];

export function roofTone(building: Building,tones: RoofTones | null | undefined){
  return tones?.[String(building.id)+(building.toneSuffix??'')] ?? fallback[Math.abs(building.id)%fallback.length];
}
