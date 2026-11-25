import { bootEvent, bootPhase, bootProgress } from '../boot.ts';
import { isCity, isPlaces, isRoofPalette, isSea, isSectorIndex, loadCore, loadData } from '../data/load.ts';
import { validateSectorIndex } from '../data/sector-index.ts';
import { required } from '../required.ts';
import { element } from './dom.ts';

interface StartupOptions {
  pilot: boolean;
  editorPreview: boolean;
  neutral: boolean;
  stage: 'city' | 'stress';
  signal: AbortSignal;
}

export async function loadStartupData({pilot,editorPreview,neutral,stage,signal}: StartupOptions){
  const withSea=!pilot && !neutral && stage==='city';
  const tasks=(pilot?2:3)+Number(!neutral)+Number(withSea);
  let completed=0;
  const waiting=new Set<string>();
  const downloading=()=>bootPhase(waiting.size?'Descargando: '+[...waiting].join(', '):'Datos recibidos');
  function track<T>(job: Promise<T>,label: string){
    waiting.add(label);downloading();
    return job.then(result=>{
      waiting.delete(label);downloading();
      bootProgress(12+Math.round(34*++completed/tasks));
      return result;
    });
  }
  function load<T>(file: string,valid: (value: unknown)=>value is T){
    return track(loadData(file,valid,signal,true),file.replace(/\.\w+$/,''));
  }
  const preview=pilot && editorPreview
    ? track(import('../editor/pilot-preview.ts').then(({loadEditedPilot})=>loadEditedPilot(element('status'),signal,
      waiting=>bootEvent(waiting?'picker':'resume'))),'editor') : null;
  const [core,single,poi,{tones},index,sea,edited]=await Promise.all([
    pilot?null:track(loadCore(stage,signal),'ciudad y terreno'),pilot&&!preview?load('pilot.json',isCity):null,load('poi.geojson',isPlaces),
    neutral?{tones:null}:load('roof-tones.json',isRoofPalette),pilot?null:load(stage+'-index.json',isSectorIndex),
    withSea?load('sea.json',isSea):null,preview
  ]);
  signal.throwIfAborted();
  const data=required(core??single??edited?.data,'map data');
  if(index)validateSectorIndex(index);
  return {data,core,poi,tones,index,sea,edited};
}
