import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { applyPilotEdits, inPilot, isFixedBuilding, loadPilotBase, propKinds, readPilotEdits, readPilotFile } from '../data/pilot-edits.ts';
import type { MapProp, PilotEdits, PropKind } from '../data/pilot-edits.ts';
import { isRoofPalette, loadData } from '../data/load.ts';
import { ringCenter } from '../data/sector-index.ts';
import type { Point, Ring } from '../data/types.ts';
import { required } from '../required.ts';
import { GROUND_SURFACE } from '../render/ground-surface.ts';
import { makeCity } from '../render/scene.ts';
import { disposeMeshes, makeProp, poseProp } from './props.ts';

type Selection = { part: number } | { prop: string };
type Mode = 'move' | 'vertices' | 'rotate';
const ui = <E extends HTMLElement>(id: string) => required(document.querySelector<E>('#'+id),id);
const button = (id: string) => ui<HTMLButtonElement>(id);
const message = ui('message');
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Could not complete the action.';
const round = (value: number) => Math.round(value*1000)/1000;

async function start() {
  const [base,{tones}] = await Promise.all([loadPilotBase(),loadData('roof-tones.json',isRoofPalette)]);
  let edits: PilotEdits = { version: 1, base: base.hash, footprints: [], props: [] };
  let data = base.data;
  const undo: PilotEdits[] = [], redo: PilotEdits[] = [];
  let selected: Selection | null = null, mode: Mode = 'move', vertex = 0, placing = false, importing = false;
  let handles: T.Mesh[] = [], outlines: T.Line[] = [];
  const host = ui('viewport'), catalog = ui<HTMLSelectElement>('catalog'), vertexSelect = ui<HTMLSelectElement>('vertex');
  const file = ui<HTMLInputElement>('file');
  const east = ui<HTMLInputElement>('east'), north = ui<HTMLInputElement>('north'), yaw = ui<HTMLInputElement>('yaw');
  const renderer = new T.WebGLRenderer({ antialias: true, stencil: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  host.append(renderer.domElement);
  const canvas = renderer.domElement;
  const scene = new T.Scene(), camera = new T.OrthographicCamera(-1,1,1,-1,1,3000);
  scene.background = new T.Color('#e5e3d2');
  const sun = new T.DirectionalLight(0xfff6ea,2.12);
  sun.position.set(-550,690,-370);
  scene.add(sun,new T.HemisphereLight(0xf1f4ff,0x9b9dac,1.38));
  const controls = new OrbitControls(camera,canvas);
  controls.maxPolarAngle = Math.PI/2.6;
  controls.minZoom = .25;
  controls.maxZoom = 80;
  const [centerEast,centerNorth] = ringCenter(data.boundary);
  controls.target.set(centerEast,0,-centerNorth);
  camera.position.copy(controls.target).add(new T.Vector3(-490,690,410));
  controls.update();

  const gizmo = new TransformControls(camera,canvas), anchor = new T.Object3D();
  gizmo.enabled = false;
  const helpers = new T.Group(), props = new T.Group(), pickables = new T.Group();
  const propModels = new Map<string,T.Object3D>();
  const pointer = new T.Vector2(), ray = new T.Raycaster();
  scene.add(gizmo.getHelper(),anchor,helpers,props);
  let city: ReturnType<typeof makeCity>;
  let sceneData: typeof data | undefined;
  let frame = 0, fitted = false;
  function draw() {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      for (const handle of handles) handle.scale.setScalar(4/camera.zoom);
      renderer.render(scene,camera);
    });
  }
  controls.addEventListener('change',draw);
  gizmo.addEventListener('change',draw);
  new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    if (!fitted) { camera.zoom = Math.min(w/980,h/790); fitted = true; }
    camera.left = -w/2; camera.right = w/2; camera.top = h/2; camera.bottom = -h/2;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h);
    draw();
  }).observe(host);

  function rebuild() {
    const previous = sceneData;
    if (previous?.buildings.some((b,i) => b.rings !== data.buildings[i].rings) || !previous) {
      if (previous) {
        disposeMeshes(city.group);
        city.groundMap?.texture.dispose();
        disposeMeshes(pickables);
        pickables.clear();
      }
      city = makeCity(data,false,tones);
      scene.add(city.group);
      const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
      data.buildings.forEach((building,part) => {
        const rings = building.rings.map(ring => ring.map(([x,y]) => new T.Vector2(x,y)));
        const shape = new T.Shape(rings[0]);
        shape.holes = rings.slice(1).map(ring => new T.Path(ring));
        const z = city.altitude(...building.rings[0][0]);
        const geometry = new T.ExtrudeGeometry(shape,{ depth: building.heightOverride ?? building.height, bevelEnabled: false });
        geometry.translate(0,0,z).rotateX(-Math.PI/2);
        const mesh = new T.Mesh(geometry,material);
        mesh.userData.part = part;
        pickables.add(mesh);
      });
    }
    sceneData = data;
    disposeMeshes(props);
    props.clear();
    propModels.clear();
    for (const prop of edits.props) {
      const model = makeProp(prop,city.groundAt);
      model.userData.prop = prop.id;
      propModels.set(prop.id,model);
      props.add(model);
    }
    scene.add(props);
  }

  const propSelected = () => {
    const id = selected && 'prop' in selected ? selected.prop : undefined;
    return edits.props.find(prop => prop.id === id);
  };
  const buildingSelected = () => selected && 'part' in selected ? data.buildings[selected.part] : undefined;
  const vertexList = (rings: Ring[]) => rings.flatMap((ring,r) => ring.slice(0,-1).map((point,i) => ({ r,i,point })));
  const world = ([x,y]: Point,z: number) => new T.Vector3(x,z,-y);
  const azimuth = T.MathUtils.radToDeg;
  const angle = T.MathUtils.degToRad;

  function refreshSelection() {
    gizmo.enabled = false;
    gizmo.detach();
    disposeMeshes(helpers);
    helpers.clear();
    scene.add(helpers);
    handles = []; outlines = [];
    const building = buildingSelected(), prop = propSelected();
    if (!building && !prop) selected = null;
    const fixed = !!(selected && 'part' in selected && isFixedBuilding(data,selected.part));
    ui('selection').hidden = !selected;
    if (building || prop) {
      ui('object-name').textContent = prop ? propKinds[prop.kind] : `Building ${building!.id}${fixed ? ' · Read-only' : ''}`;
      button('move').disabled = fixed;
      button('vertices').hidden = !building;
      button('vertices').disabled = fixed;
      button('rotate').hidden = !prop;
      button('remove').hidden = !prop;
      for (const tool of ['move','vertices','rotate']) button(tool).setAttribute('aria-pressed',String(mode === tool));
      const editingVertices = mode === 'vertices' && !!building && !fixed;
      ui('vertex-field').hidden = !editingVertices;
      ui('coordinates').hidden = fixed;
      east.disabled = north.disabled = mode === 'rotate';
      yaw.disabled = mode !== 'rotate';
      ui('east-field').hidden = ui('north-field').hidden = east.disabled;
      ui('yaw-field').hidden = yaw.disabled;
      if (building) {
        const z = city.altitude(...building.rings[0][0]) + (building.heightOverride ?? building.height) + .18;
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
        poseProp(anchor,prop,city.groundAt);
        anchor.position.y += .45;
      }
      if (!fixed && !placing) {
        gizmo.setMode(mode === 'rotate' ? 'rotate' : 'translate');
        gizmo.showX = gizmo.showZ = mode !== 'rotate';
        gizmo.showY = mode === 'rotate';
        gizmo.showXYZE = gizmo.showE = false;
        gizmo.attach(anchor);
        gizmo.enabled = true;
      }
      syncFields();
    }
    button('undo').disabled = !undo.length;
    button('redo').disabled = !redo.length;
    button('place').setAttribute('aria-pressed',String(placing));
    canvas.style.cursor = placing ? 'crosshair' : 'grab';
    draw();
  }

  function syncFields() {
    east.value = String(round(anchor.position.x));
    north.value = String(round(-anchor.position.z));
    yaw.value = String(round(azimuth(anchor.rotation.y)));
  }

  function show(next: PilotEdits) {
    edits = next;
    data = applyPilotEdits(base.data,next);
    rebuild();
    refreshSelection();
  }

  function commit(next: PilotEdits) {
    try {
      const valid = readPilotEdits(base,next);
      if (JSON.stringify(valid) !== JSON.stringify(edits)) {
        undo.push(edits);
        redo.length = 0;
        show(valid);
      } else refreshSelection();
      message.textContent = '';
    } catch (error) {
      rebuild();
      refreshSelection();
      message.textContent = errorMessage(error);
    }
  }

  function draft(position: Point, yawValue: number): PilotEdits {
    const prop = propSelected(), building = buildingSelected();
    if (prop) return { ...edits, props: edits.props.map(entry => entry.id === prop.id ? {
      ...entry, position: mode === 'rotate' ? entry.position : position, yaw: mode === 'rotate' ? yawValue : entry.yaw
    } : entry) };
    if (!building || !selected || !('part' in selected)) return edits;
    const part = selected.part;
    let rings: Ring[];
    if (mode === 'vertices') {
      const { r,i } = vertexList(building.rings)[vertex];
      rings = building.rings.map((ring,index) => index === r ? ring.map((p,j) =>
        j === i || (i === 0 && j === ring.length-1) ? position : p) : ring);
    } else {
      const [x,y] = ringCenter(building.rings[0]);
      const dx = position[0]-x, dy = position[1]-y;
      rings = building.rings.map(ring => ring.map(([east,north]) => [round(east+dx),round(north+dy)]));
    }
    const footprints = edits.footprints.filter(edit => edit.part !== part);
    if (JSON.stringify(rings) !== JSON.stringify(base.data.buildings[part].rings)) footprints.push({ part,id: building.id,rings });
    footprints.sort((a,b) => a.part-b.part);
    return { ...edits, footprints };
  }

  const position = (): Point => [round(anchor.position.x),round(-anchor.position.z)];
  gizmo.addEventListener('dragging-changed',event => { controls.enabled = !event.value; });
  gizmo.addEventListener('objectChange',() => {
    const part = selected && 'part' in selected ? selected.part : null;
    const next = draft(position(),anchor.rotation.y);
    const prop = propSelected();
    if (prop) {
      const moved = next.props.find(entry => entry.id === prop.id);
      if (moved) poseProp(required(propModels.get(prop.id),'prop'),moved,city.groundAt);
    } else if (part !== null) {
      const rings = next.footprints.find(edit => edit.part === part)?.rings ?? base.data.buildings[part].rings;
      for (const [i,line] of outlines.entries()) {
        const z = line.geometry.attributes.position.getY(0);
        line.geometry.setFromPoints(rings[i].map(p => world(p,z)));
        line.geometry.computeBoundingSphere();
      }
      for (const [i,{point}] of vertexList(rings).entries()) handles[i]?.position.copy(world(point,anchor.position.y));
    }
    syncFields();
  });
  gizmo.addEventListener('mouseUp',() => commit(draft(position(),anchor.rotation.y)));

  let clickStart: {x:number;y:number;id:number;gizmo:boolean} | null = null;
  canvas.addEventListener('pointerdown',event => {
    if (!event.isPrimary || event.button !== 0) return;
    clickStart = { x:event.clientX,y:event.clientY,id:event.pointerId,gizmo:gizmo.dragging };
  });
  canvas.addEventListener('pointercancel',() => {
    clickStart = null;
    if (gizmo.dragging) {
      gizmo.dragging = false;
      gizmo.axis = null;
      rebuild(); refreshSelection();
    }
  });
  canvas.addEventListener('pointerup',event => {
    const start = clickStart;
    clickStart = null;
    if (!start || start.id !== event.pointerId || start.gizmo
      || Math.hypot(event.clientX-start.x,event.clientY-start.y) > 5) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height);
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); pickables.updateMatrixWorld(true);
    ray.setFromCamera(pointer,camera);
    if (placing) {
      const hit = ray.intersectObject(city.group,true).find(({object,face}) =>
        object instanceof T.Mesh && face && object.geometry.getAttribute('surface')?.getX(face.a) === GROUND_SURFACE);
      const position: Point | null = hit ? [round(hit.point.x),round(-hit.point.z)] : null;
      if (!position || !inPilot(data,position)) { message.textContent = 'Choose a point inside the map.'; return; }
      const prop: MapProp = { id: crypto.randomUUID(), kind: catalog.value as PropKind, position, yaw: 0 };
      selected = { prop: prop.id }; placing = false; mode = 'move';
      commit({ ...edits, props: [...edits.props,prop] });
      return;
    }
    const handle = ray.intersectObjects(handles,false)[0];
    if (handle) { vertex = handles.indexOf(handle.object as T.Mesh); refreshSelection(); return; }
    const hit = ray.intersectObjects([...props.children,...pickables.children],true)[0];
    const mesh = hit?.object;
    const part: unknown = mesh?.userData.part;
    const prop: unknown = mesh?.parent?.userData.prop;
    selected = typeof prop === 'string' ? { prop } : typeof part === 'number' ? { part } : null;
    mode = 'move'; vertex = 0;
    message.textContent = '';
    refreshSelection();
  });

  for (const [kind,label] of Object.entries(propKinds)) catalog.add(new Option(label,kind));
  for (const name of ['open','save','place']) button(name).disabled = false;
  catalog.disabled = false;
  for (const tool of ['move','vertices','rotate'] as const) button(tool).onclick = () => { mode = tool; refreshSelection(); };
  vertexSelect.onchange = () => { vertex = Number(vertexSelect.value); refreshSelection(); };
  button('place').onclick = () => { placing = !placing; refreshSelection(); };
  button('remove').onclick = () => { const prop = propSelected(); if (prop) commit({ ...edits, props: edits.props.filter(p => p.id !== prop.id) }); };
  ui<HTMLFormElement>('coordinates').onsubmit = event => {
    event.preventDefault();
    commit(draft(mode === 'rotate' ? position() : [east.valueAsNumber,north.valueAsNumber],angle(yaw.valueAsNumber)));
  };
  function step(from: PilotEdits[], to: PilotEdits[]) {
    const next = from.pop();
    if (!next) return;
    to.push(edits);
    show(next);
    message.textContent = '';
  }
  button('undo').onclick = () => step(undo,redo);
  button('redo').onclick = () => step(redo,undo);
  window.addEventListener('keydown',event => {
    if (event.defaultPrevented || gizmo.dragging || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === 'Escape' && placing) { placing = false; refreshSelection(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) step(redo,undo); else step(undo,redo);
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
    const href = URL.createObjectURL(new Blob([JSON.stringify(edits,null,2)+'\n'],{ type:'application/json' }));
    const link = document.createElement('a');
    link.download = 'las-palmas-pilot-edits.json'; link.href = href; link.click();
    setTimeout(() => URL.revokeObjectURL(href),1000);
  };
  show(edits);
  message.textContent = '';
}

start().catch(error => { console.error(error); message.textContent = errorMessage(error); });
