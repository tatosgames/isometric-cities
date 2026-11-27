/**
 * A small line chart on a 2D canvas, for hydrographs and gauges: no library, redrawn only when asked.
 * Time on x (hours), one or more series on y, an optional dashed series (the design hydrograph) and a time cursor.
 */
export interface Series { points: readonly (readonly [number, number])[]; colour: string; label: string; dashed?: boolean }

export function drawChart(canvas: HTMLCanvasElement, {series, unit, until, cursor}: {
  series: readonly Series[]; unit: string; until: number; cursor?: number;
}) {
  const ratio = devicePixelRatio || 1, width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  }
  const g = canvas.getContext('2d');
  if (!g) return;
  const style = getComputedStyle(canvas), ink = style.color || '#333', line = style.getPropertyValue('--chart-grid') || 'rgba(0,0,0,.12)';
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  g.clearRect(0, 0, width, height);
  const left = 34, right = 8, top = 8, bottom = 18, pw = width - left - right, ph = height - top - bottom;
  let most = 0;
  for (const s of series) for (const [, v] of s.points) most = Math.max(most, v);
  const scale = niceCeiling(most || 1), end = Math.max(until, 1e-6);
  const px = (t: number) => left + pw * t / end, py = (v: number) => top + ph * (1 - v / scale);
  g.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  g.lineWidth = 1;
  g.strokeStyle = line; g.fillStyle = ink;
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let k = 0; k <= 4; k++) {
    const v = scale * k / 4, y = py(v);
    g.beginPath(); g.moveTo(left, y); g.lineTo(left + pw, y); g.stroke();
    g.fillText(format(v), left - 4, y);
  }
  g.textAlign = 'center'; g.textBaseline = 'top';
  const hours = end / 3600, tick = hours > 12 ? 4 : hours > 6 ? 2 : hours > 2 ? 1 : .5;
  for (let t = 0; t <= hours + 1e-9; t += tick) g.fillText(t + ' h', px(t * 3600), top + ph + 4);
  g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillText(unit, left + 4, top);
  for (const s of series) {
    if (s.points.length < 2) continue;
    g.strokeStyle = s.colour; g.lineWidth = s.dashed ? 1.2 : 1.8;
    g.setLineDash(s.dashed ? [4, 3] : []);
    g.beginPath();
    s.points.forEach(([t, v], i) => i ? g.lineTo(px(t), py(v)) : g.moveTo(px(t), py(v)));
    g.stroke();
  }
  g.setLineDash([]);
  if (cursor !== undefined) {
    g.strokeStyle = ink; g.globalAlpha = .45;
    g.beginPath(); g.moveTo(px(cursor), top); g.lineTo(px(cursor), top + ph); g.stroke();
    g.globalAlpha = 1;
  }
}

function niceCeiling(v: number) {
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  for (const k of [1, 2, 2.5, 5, 10]) if (v <= k * step) return k * step;
  return 10 * step;
}
const format = (v: number) => v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2);
