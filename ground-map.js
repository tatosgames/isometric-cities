import * as T from 'three';

// Ground features share the terrain triangles. Paint their plan-view coverage once.
export function makeGroundMap(data) {
  const extent = new T.Box2();
  for (const [x, y] of data.boundary) extent.expandByPoint(new T.Vector2(x, y));
  if(data.textureBounds){
    extent.min.fromArray(data.textureBounds);extent.max.fromArray(data.textureBounds,2);
  }
  const size = extent.getSize(new T.Vector2());
  const scale = Math.min(data.textureBounds ? 2 : 3, 2048 / Math.max(size.x, size.y));
  const canvas = typeof document==='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(size.x * scale));
  canvas.height = Math.max(1, Math.ceil(size.y * scale));
  const ctx = /** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d', { alpha: false }));
  const sx = canvas.width / size.x, sy = canvas.height / size.y;
  ctx.fillStyle = '#c7bcb2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(sx, 0, 0, -sy, -extent.min.x * sx, extent.max.y * sy);

  function trace(points) {
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  }
  for (const s of data.surfaces) {
    ctx.beginPath();
    for (const ring of s.rings) {
      trace(ring);
      ctx.closePath();
    }
    ctx.fillStyle = s.kind === 'park' && !s.paved ? '#728157' :
      s.id === '30801430' ? '#96948f' : '#c0b9af';
    ctx.fill('evenodd');
  }

  const footways = new Set(['steps', 'footway', 'path', 'pedestrian', 'cycleway']);
  const mainRoads = new Set(['primary', 'secondary', 'trunk']);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const pedestrian of [false, true]) {
    for (const road of data.roads) {
      if (footways.has(road.kind) !== pedestrian || road.line.length < 2) continue;
      ctx.lineWidth = pedestrian ? 2.2 : mainRoads.has(road.kind) ? 8 : 4.5;
      ctx.strokeStyle = pedestrian ? '#c6bdb6' : '#626575';
      ctx.beginPath();
      trace(road.line);
      ctx.stroke();
    }
  }

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return { texture, bounds: new T.Vector4(extent.min.x, extent.min.y, size.x, size.y) };
}
