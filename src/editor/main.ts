import * as T from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { applyPilotEdits, inPilot, isFixedBuilding, loadPilotBase, propKinds, readPilotFile } from '../data/pilot-edits.ts';
import type { MapProp, PilotEdits, PropKind } from '../data/pilot-edits.ts';
import { isRoofPalette, loadData } from '../data/load.ts';
import { ringCenter } from '../data/sector-index.ts';
import type { Point } from '../data/types.ts';
import { required } from '../required.ts';
import { GROUND_SURFACE } from '../render/ground-surface.ts';
import { CAMERA_DISTANCE, GroundControls, fitPixels, makeMapCamera } from '../render/map-camera.ts';
import { makeCityView } from './city-view.ts';
import { draftEdit, roundCoordinate as round, vertexList } from './edit-draft.ts';
import { makeEditHistory } from './edit-history.ts';
import { bindPointerEditing, type Selection } from './pointer-editing.ts';
import { disposeMeshes, poseProp } from './props.ts';

type Mode = 'select' | 'move' | 'vertices' | 'rotate';
const ui = <E extends HTMLElement>(id: string) => required(document.querySelector<E>('#'+id),id);
const button = (id: string) => ui<HTMLButtonElement>(id);
const message = ui('message');
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Could not complete the action.';

async function start() {
  const [base,{tones}] = await Promise.all([loadPilotBase(),loadData('roof-tones.json',isRoofPalette)]);
  const history = makeEditHistory(base);
  let data = base.data;
  let selected: Selection | null = null, mode: Mode = 'move', vertex = 0, placing = false, importing = false;
  let handles: T.Mesh[] = [], outlines: T.Line[] = [];
  const host = ui('viewport'), catalog = ui<HTMLSelectElement>('catalog'), vertexSelect = ui<HTMLSelectElement>('vertex');
  const file = ui<HTMLInputElement>('file');
  const east = ui<HTMLInputElement>('east'), north = ui<HTMLInputElement>('north'), yaw = ui<HTMLInputElement>('yaw');
  const renderer = new T.WebGLRenderer({ antialias: true, stencil: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  host.append(renderer.domElement);
  const canvas = renderer.domElement;
  const scene = new T.Scene(), camera = makeMapCamera();
  scene.background = new T.Color('#e5e3d2');
  const sun = new T.DirectionalLight(0xfff6ea,2.12);
  sun.position.set(-550,690,-370);
  scene.add(sun,new T.HemisphereLight(0xf1f4ff,0x9b9dac,1.38));
  // The map's controls: left and middle drag pan with the ground under the pointer, right drag orbits,
  // the wheel zooms towards the pointer.
  const controls = new GroundControls(camera,canvas);
  controls.maxPolarAngle = Math.PI/2.6;
  controls.mouseButtons.MIDDLE = T.MOUSE.PAN;
  controls.touches.TWO = T.TOUCH.DOLLY_PAN;
  controls.zoomToCursor = true;
  controls.minZoom = .25;
  controls.maxZoom = 80;
  const [centerEast,centerNorth] = ringCenter(data.boundary);
  const overviewTarget = new T.Vector3(centerEast,0,-centerNorth);
  const overviewOffset = new T.Vector3(-490,690,410).setLength(CAMERA_DISTANCE);
  controls.target.copy(overviewTarget);
  camera.position.copy(overviewTarget).add(overviewOffset);
  controls.update();

  const gizmo = new TransformControls(camera,canvas), anchor = new T.Object3D();
  gizmo.enabled = false;
  const helpers = new T.Group(), view = makeCityView(scene,tones);
  let propOutline: T.BoxHelper | undefined;
  scene.add(gizmo.getHelper(),anchor,helpers);
  let frame = 0, fitted = false;
  function draw() {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      // Zooming to the cursor slides the camera across its plane: an orthographic view looks the same from any
      // distance, so it goes back to the standard one.
      camera.position.sub(controls.target).setLength(CAMERA_DISTANCE).add(controls.target);
      camera.updateMatrixWorld();
      for (const handle of handles) handle.scale.setScalar(4/camera.zoom);
      renderer.render(scene,camera);
    });
  }
  controls.addEventListener('change',draw);
  gizmo.addEventListener('change',draw);
  new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    if (!fitted) { camera.zoom = overviewZoom(); fitted = true; }
    fitPixels(camera,w,h);
    renderer.setSize(w,h);
    draw();
  }).observe(host);

  const overviewZoom = () => Math.min(host.clientWidth/980,host.clientHeight/790);

  const propSelected = () => {
    const id = selected && 'prop' in selected ? selected.prop : undefined;
    return history.current.props.find(prop => prop.id === id);
  };
  const buildingSelected = () => selected && 'part' in selected ? data.buildings[selected.part] : undefined;
  const world = ([x,y]: Point,z: number) => new T.Vector3(x,z,-y);
  const azimuth = T.MathUtils.radToDeg;
  const angle = T.MathUtils.degToRad;

  function toolAllowed(tool: Mode) {
    const building = buildingSelected();
    if (tool === 'vertices') return !!(building && selected && 'part' in selected && !isFixedBuilding(data,selected.part));
    if (tool === 'rotate') return !!propSelected();
    return true;
  }

  const keyboard = matchMedia('(pointer:fine)').matches;
  function refreshSelection() {
    gizmo.enabled = false;
    gizmo.detach();
    disposeMeshes(helpers);
    helpers.clear();
    scene.add(helpers);
    handles = []; outlines = []; propOutline = undefined;
    const building = buildingSelected(), prop = propSelected();
    if (!building && !prop) selected = null;
    if (!toolAllowed(mode)) mode = 'move';
    const fixed = !!(selected && 'part' in selected && isFixedBuilding(data,selected.part));
    ui('selection').hidden = !selected;
    ui('selection-empty').hidden = !!selected;
    button('frame').disabled = !selected;
    for (const tool of ['select','move','vertices','rotate'] as const) {
      button(tool).disabled = !toolAllowed(tool);
      button(tool).setAttribute('aria-pressed',String(!placing && mode === tool));
    }
    ui('viewport-hint').textContent = placing ? 'Choose where to place the prop.'
      : mode === 'vertices' ? 'Drag a vertex to reshape the footprint.'
      : mode === 'rotate' ? 'Drag the ring to rotate the prop.'
      : keyboard ? (mode === 'move' ? 'Drag an object to move it. Right-drag to orbit.' : 'Click an object to select it. Right-drag to orbit.')
      : (mode === 'move' ? 'Drag an object to move it. Pinch to zoom.' : 'Tap an object to select it. Pinch to zoom.');
    if (building || prop) {
      ui('object-name').textContent = prop ? propKinds[prop.kind] : `Building ${building!.id}${fixed ? ' · Read-only' : ''}`;
      button('remove').hidden = !prop;
      const editingVertices = mode === 'vertices' && !!building && !fixed;
      ui('vertex-field').hidden = !editingVertices;
      ui('coordinates').hidden = fixed || mode === 'select';
      east.disabled = north.disabled = mode === 'rotate';
      yaw.disabled = mode !== 'rotate';
      ui('east-field').hidden = ui('north-field').hidden = east.disabled;
      ui('yaw-field').hidden = yaw.disabled;
      if (building) {
        const z = view.city.altitude(...building.rings[0][0]) + (building.heightOverride ?? building.height) + .18;
        for (const ring of building.rings) {
          const line = new T.Line(new T.BufferGeometry().setFromPoints(ring.map(p => world(p,z))),
            new T.LineBasicMaterial({ color: 0xd66438, depthTest: false }));
          line.renderOrder = 2;
          outlines.push(line); helpers.add(line);
        }
        if (editingVertices) {
          const entries = vertexList(building.rings);
          vertex = Math.min(vertex,entries.length-1);
          vertexSelect.replaceChildren(...entries.map(({r,i},index) => new Option(r ? `Courtyard ${r} · ${i+1}` : `Outer edge · ${i+1}`,String(index))));
          vertexSelect.value = String(vertex);
          const sphere = new T.SphereGeometry(1,12,8);
          const active = new T.MeshBasicMaterial({ color: 0xa64227, depthTest: false });
          const inactive = new T.MeshBasicMaterial({ color: 0xffc690, depthTest: false });
          handles = entries.map(({point},i) => {
            const handle = new T.Mesh(sphere,i === vertex ? active : inactive);
            handle.position.copy(world(point,z));
            handle.renderOrder = 3;
            helpers.add(handle);
            return handle;
          });
          anchor.position.copy(handles[vertex].position);
        } else anchor.position.copy(world(ringCenter(building.rings[0]),z));
        anchor.rotation.set(0,0,0);
      } else if (prop) {
        const model = required(view.propModel(prop.id),'prop');
        propOutline = new T.BoxHelper(model,0xd66438);
        propOutline.material.depthTest = false;
        propOutline.renderOrder = 3;
        helpers.add(propOutline);
        poseProp(anchor,prop,view.city.groundAt);
        anchor.position.y += .45;
      }
      if (!fixed && !placing && (mode === 'move' || mode === 'rotate')) {
        gizmo.setMode(mode === 'rotate' ? 'rotate' : 'translate');
        gizmo.showX = gizmo.showZ = mode !== 'rotate';
        gizmo.showY = mode === 'rotate';
        gizmo.showXYZE = gizmo.showE = false;
        gizmo.attach(anchor);
        gizmo.enabled = true;
      }
      syncFields();
    }
    button('undo').disabled = !history.canUndo;
    button('redo').disabled = !history.canRedo;
    button('place').setAttribute('aria-pressed',String(placing));
    canvas.style.cursor = placing ? 'crosshair' : mode === 'move' ? 'grab' : 'default';
    draw();
  }

  function syncFields() {
    east.value = String(round(anchor.position.x));
    north.value = String(round(-anchor.position.z));
    yaw.value = String(round(azimuth(anchor.rotation.y)));
  }

  function show() {
    data = applyPilotEdits(base.data,history.current);
    view.rebuild(data,history.current.props);
    refreshSelection();
  }

  function commit(next: PilotEdits) {
    view.clearPreview();
    try {
      if (history.commit(next)) show();
      else refreshSelection();
      message.textContent = '';
    } catch (error) {
      view.rebuild(data,history.current.props);
      refreshSelection();
      message.textContent = errorMessage(error);
    }
  }

  function draft(position: Point, yawValue: number): PilotEdits {
    const edits = history.current;
    const prop = propSelected(), part = selected && 'part' in selected ? selected.part : undefined;
    if (prop) return draftEdit(edits,mode === 'rotate'
      ? { kind:'rotate-prop',id:prop.id,yaw:yawValue }
      : { kind:'move-prop',id:prop.id,position },data.buildings,base.data.buildings);
    if (part === undefined || !data.buildings[part]) return edits;
    return draftEdit(edits,mode === 'vertices'
      ? { kind:'move-vertex',part,vertex,position }
      : { kind:'move-building',part,position },data.buildings,base.data.buildings);
  }

  const position = (): Point => [round(anchor.position.x),round(-anchor.position.z)];
  function updatePreview() {
    const part = selected && 'part' in selected ? selected.part : null;
    const next = draft(position(),anchor.rotation.y);
    const prop = propSelected();
    if (prop) {
      const moved = next.props.find(entry => entry.id === prop.id);
      if (moved) {
        view.poseProp(moved);
        propOutline?.update();
      }
    } else if (part !== null) {
      const building = data.buildings[part];
      const rings = next.footprints.find(edit => edit.part === part)?.rings ?? base.data.buildings[part].rings;
      const top = view.previewFootprint(building,rings,mode === 'move');
      for (const [i,line] of outlines.entries()) {
        line.geometry.setFromPoints(rings[i].map(p => world(p,top)));
        line.geometry.computeBoundingSphere();
      }
      for (const [i,{point}] of vertexList(rings).entries()) handles[i]?.position.copy(world(point,top));
    }
    syncFields();
    draw();
  }

  function pick(ray: T.Raycaster) {
    const vertexHit = ray.intersectObjects(handles,false)[0];
    if (vertexHit) return {selection:selected,vertex:handles.indexOf(vertexHit.object as T.Mesh),point:vertexHit.point};
    const hit = view.pick(ray);
    if (!hit) return null;
    const part: unknown = hit.object.userData.part;
    const prop: unknown = hit.object.parent?.userData.prop;
    const selection = typeof prop === 'string' ? {prop} : typeof part === 'number' ? {part} : null;
    return {selection,vertex:null,point:hit.point};
  }

  function selectPicked(selection: Selection, pickedVertex: number | null){
    if (pickedVertex !== null) vertex = pickedVertex;
    else {
      const previous = selected;
      selected = selection;
      const samePart = previous && 'part' in previous && 'part' in selected && previous.part === selected.part;
      if (mode === 'vertices' && !samePart) mode = 'move';
      if (!samePart) vertex = 0;
    }
    message.textContent = '';
    refreshSelection();
    const fixed = selected && 'part' in selected && isFixedBuilding(data,selected.part);
    return !fixed && (mode === 'move' || pickedVertex !== null);
  }

  function clickScene(ray: T.Raycaster){
    if (placing) {
      const hit = ray.intersectObject(view.city.group,true).find(({object,face}) =>
        object instanceof T.Mesh && face && object.geometry.getAttribute('surface')?.getX(face.a) === GROUND_SURFACE);
      const position: Point | null = hit ? [round(hit.point.x),round(-hit.point.z)] : null;
      if (!position || !inPilot(data,position)) { message.textContent = 'Choose a point inside the map.'; return; }
      const prop: MapProp = {id:crypto.randomUUID(),kind:catalog.value as PropKind,position,yaw:0};
      selected = {prop:prop.id}; placing = false; mode = 'move';
      commit({...history.current,props:[...history.current.props,prop]});
    } else if (!pick(ray)) {
      selected = null;
      message.textContent = '';
      refreshSelection();
    }
  }

  const pointerEditing = bindPointerEditing({
    host,canvas,scene,camera,controls,gizmo,anchor,pick,
    isPlacing: () => placing,
    idleCursor: () => mode === 'move' ? 'grab' : 'default',
    select: selectPicked,
    click: clickScene,
    preview: updatePreview,
    commit: () => commit(draft(position(),anchor.rotation.y)),
    restore(){
      view.clearPreview();
      const prop = propSelected();
      if (prop) view.poseProp(prop);
      refreshSelection();
    }
  });

  function setTool(tool: Mode) {
    if (!toolAllowed(tool)) return;
    mode = tool; placing = false;
    refreshSelection();
  }

  function showView(target: T.Vector3,offset: T.Vector3,zoom: number) {
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(offset.clone().normalize(),CAMERA_DISTANCE);
    camera.zoom = T.MathUtils.clamp(zoom,controls.minZoom,controls.maxZoom);
    camera.updateProjectionMatrix();
    controls.update();
    draw();
  }

  function frameSelection() {
    if (!selected) return;
    const target = 'part' in selected ? view.buildingMesh(selected.part) : view.propModel(selected.prop);
    if (!target) return;
    const box = new T.Box3().setFromObject(target), size = box.getSize(new T.Vector3());
    showView(box.getCenter(new T.Vector3()),camera.position.clone().sub(controls.target),
      Math.min(host.clientWidth,host.clientHeight)*.52/Math.max(size.x,size.y,size.z,5));
  }
  for (const [kind,label] of Object.entries(propKinds)) catalog.add(new Option(label,kind));
  for (const name of ['open','save','place','overview']) button(name).disabled = false;
  catalog.disabled = false;
  for (const tool of ['select','move','vertices','rotate'] as const) button(tool).onclick = () => setTool(tool);
  button('frame').onclick = frameSelection;
  button('overview').onclick = () => showView(overviewTarget,overviewOffset,overviewZoom());
  vertexSelect.onchange = () => { vertex = Number(vertexSelect.value); refreshSelection(); };
  button('place').onclick = () => { placing = !placing; refreshSelection(); };
  button('remove').onclick = () => {
    const prop = propSelected(), edits = history.current;
    if (prop) commit({ ...edits, props: edits.props.filter(p => p.id !== prop.id) });
  };
  ui<HTMLFormElement>('coordinates').onsubmit = event => {
    event.preventDefault();
    commit(draft(mode === 'rotate' ? position() : [east.valueAsNumber,north.valueAsNumber],angle(yaw.valueAsNumber)));
  };
  function step(direction: 'undo' | 'redo') {
    if (!history[direction]()) return;
    show();
    message.textContent = '';
  }
  button('undo').onclick = () => step('undo');
  button('redo').onclick = () => step('redo');
  window.addEventListener('keydown',event => {
    if (event.defaultPrevented || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === 'Escape') {
      if (pointerEditing.active) { pointerEditing.cancel(); return; }
      if (placing) placing = false;
      else selected = null;
      refreshSelection();
      return;
    }
    if (pointerEditing.active) return;
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      const tools = {q:'select',w:'move',v:'vertices',e:'rotate'} as const;
      const key = event.key.toLowerCase();
      if (Object.hasOwn(tools,key)) setTool(tools[key as keyof typeof tools]);
      if (key === 'f') frameSelection();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      step(event.shiftKey ? 'redo' : 'undo');
    }
  });
  button('open').onclick = () => file.click();
  file.onchange = async () => {
    const chosen = file.files?.[0];
    if (!chosen || importing) return;
    importing = true;
    button('open').disabled = true;
    try {
      const next = await readPilotFile(base,chosen);
      selected = null; placing = false;
      commit(next);
      message.textContent = 'Edits loaded.';
    } catch (error) { message.textContent = errorMessage(error); }
    finally { file.value = ''; importing = false; button('open').disabled = false; }
  };
  button('save').onclick = () => {
    const href = URL.createObjectURL(new Blob([JSON.stringify(history.current,null,2)+'\n'],{ type:'application/json' }));
    const link = document.createElement('a');
    link.download = 'las-palmas-pilot-edits.json'; link.href = href; link.click();
    setTimeout(() => URL.revokeObjectURL(href),1000);
  };
  show();
  message.textContent = '';
}

start().catch(error => { console.error(error); message.textContent = errorMessage(error); });
