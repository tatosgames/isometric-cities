"""Controllo delle altezze comunali con una nube di punti PNOA-LiDAR (LAZ/LAS).

Uso:  python scripts/lidar-check.py [--export] [cartella_o_file ...]   (default: .cache/lidar)
--export aggiorna content/lidar-heights.json, letto da data.py per gli edifici senza altezza comunale.
Legge public/data/city.json.gz, misura per ogni edificio coperto dai tile
l'altezza del tetto (classe 6) sul terreno (classe 2 in un anello attorno) e
confronta con l'altezza comunale. Scrive solo in .cache/lidar-control/.
Dipendenza solo locale: laspy[lazrs] in .cache/pylib (non in requirements.txt).
"""
import csv, json, sys
from collections import Counter
from math import floor
from pathlib import Path
sys.path.insert(0, '.cache/pylib')
import numpy as np
import laspy
import shapely
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree
from geo import origin
from city_layers import read_layers

OUT = Path('.cache/lidar-control')
GROUND, BUILDING = 2, 6
ORIGIN = origin()

def load_points(paths):
    files = []
    for p in map(Path, paths or ['.cache/lidar']):
        files += sorted(p.glob('*.la[sz]')) if p.is_dir() else [p]
    if not files:
        sys.exit('Nessun file LAZ/LAS trovato: mettilo in .cache/lidar/')
    xs, ys, zs, cs, meta = [], [], [], [], []
    for f in files:
        las = laspy.read(f)
        keep = np.isin(las.classification, (GROUND, BUILDING))
        xs.append(las.x[keep]); ys.append(las.y[keep]); zs.append(las.z[keep]); cs.append(np.asarray(las.classification)[keep])
        n = len(las.points)
        b = las.header
        area = (b.maxs[0]-b.mins[0])*(b.maxs[1]-b.mins[1])
        meta.append(dict(file=f.name, points=int(n), density_per_m2=round(n/area, 2), classes={int(c): int((np.asarray(las.classification) == c).sum()) for c in np.unique(las.classification)},
                         bbox=[round(float(v), 1) for v in (b.mins[0], b.mins[1], b.maxs[0], b.maxs[1])]))
    return np.concatenate(xs), np.concatenate(ys), np.concatenate(zs), np.concatenate(cs), meta

def part_key(building):
    """Names one part of a municipal footprint: the same OBJECTID can be cut into several polygons."""
    ring = building['rings'][0]
    return f"{building['id']}:{floor(min(p[0] for p in ring))}:{floor(min(p[1] for p in ring))}"


def main():
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    x, y, z, c, meta = load_points([a for a in sys.argv[1:] if not a.startswith('--')])
    bx0, by0, bx1, by1 = x.min(), y.min(), x.max(), y.max()
    # Sorted by easting, a footprint only reads the strip of points it spans.
    order = np.argsort(x, kind='stable')
    x, y, z, c = x[order], y[order], z[order], c[order]
    del order
    city = read_layers('city')
    poi = json.loads(Path('public/data/poi.geojson').read_text(encoding='utf8'))['features']
    poi_xy = {f['properties']['id']: Point(f['properties']['xy'][0]+ORIGIN[0], f['properties']['xy'][1]+ORIGIN[1]) for f in poi}
    polys = []
    for b in city['buildings']:
        rings = [[(px+ORIGIN[0], py+ORIGIN[1]) for px, py in r] for r in b['rings']]
        g = Polygon(rings[0], rings[1:]).buffer(0)
        if g.is_empty or not (bx0 < g.centroid.x < bx1 and by0 < g.centroid.y < by1):
            continue
        polys.append((b, g))
    # Ground is sampled around a footprint but outside every building: only the neighbours matter.
    padded = [g.buffer(1.0) for _, g in polys]
    tree = STRtree(padded)
    rows = []
    for b, g in polys:
        x0, y0, x1, y1 = g.buffer(8).bounds
        i0, i1 = np.searchsorted(x, [x0, x1])
        strip = slice(i0, i1)
        m = (y[strip] >= y0) & (y[strip] <= y1)
        px, py, pz, pc = x[strip][m], y[strip][m], z[strip][m], c[strip][m]
        roof = pz[(pc == BUILDING) & shapely.contains_xy(g, px, py)]
        halo = g.buffer(8)
        ring = halo.difference(unary_union([padded[i] for i in tree.query(halo)]))
        gr = pz[(pc == GROUND) & shapely.contains_xy(ring, px, py)]
        if len(roof) < 5 or len(gr) < 5:
            rows.append(dict(id=b['id'], key=part_key(b), area_m2=round(g.area, 1), municipal_m=b['height'], source=b.get('source', ''), roof_pts=len(roof), ground_pts=len(gr), status='insufficient'))
            continue
        ground = float(np.median(gr))
        h50, h95, h99 = (float(np.percentile(roof, q))-ground for q in (50, 95, 99))
        rows.append(dict(id=b['id'], key=part_key(b), area_m2=round(g.area, 1), municipal_m=b['height'], source=b.get('source', ''), roof_pts=len(roof), ground_pts=len(gr),
                         ground_z=round(ground, 2), lidar_p50=round(h50, 2), lidar_p95=round(h95, 2), lidar_p99=round(h99, 2),
                         delta_p95=round(h95-b['height'], 2), status='ok'))
    ok = [r for r in rows if r['status'] == 'ok' and r['area_m2'] >= 30]
    d = np.array([r['delta_p95'] for r in ok]) if ok else np.array([0.0])
    report = dict(tiles=meta, buildings_in_tiles=len(polys), measured=len(ok), insufficient=sum(r['status'] != 'ok' for r in rows),
                  delta_p95_m=dict(median=round(float(np.median(d)), 2), mean=round(float(d.mean()), 2), mae=round(float(np.abs(d).mean()), 2),
                                   within_2m=round(float((np.abs(d) <= 2).mean()), 3), within_5m=round(float((np.abs(d) <= 5).mean()), 3)),
                  by_source={s: dict(n=len(v), median_delta=round(float(np.median([r['delta_p95'] for r in v])), 2)) for s in sorted({r['source'] for r in ok}) for v in [[r for r in ok if r['source'] == s]]},
                  poi={k: [dict(id=r['id'], municipal_m=r['municipal_m'], lidar_p95=r.get('lidar_p95'), lidar_p99=r.get('lidar_p99'), delta_p95=r.get('delta_p95'), area_m2=r['area_m2'])
                           for (b, g), r in zip(polys, rows) if g.contains(p) or g.distance(p) < 3] for k, p in poi_xy.items()} )
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/'report.json').write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding='utf8')
    with (OUT/'buildings.csv').open('w', newline='', encoding='utf8') as f:
        w = csv.DictWriter(f, fieldnames=sorted({k for r in rows for k in r}))
        w.writeheader(); w.writerows(rows)
    if '--export' in flags:
        # Solo edifici senza altezza comunale valida; per ID con piu parti vale la parte maggiore.
        target = Path('content/lidar-heights.json')
        old = json.loads(target.read_text(encoding='utf8')) if target.exists() else {}
        heights = old.get('heights', {})
        best = {}
        for r in rows:
            # Under 2.5 m the points called building are not a roof: keep the estimate instead.
            if r['status'] == 'ok' and r['source'] == 'estimate' and r['area_m2'] >= 30 and r['roof_pts'] >= 50 and r['lidar_p95'] >= 2.5:
                if r['id'] not in best or r['area_m2'] > best[r['id']]['area_m2']:
                    best[r['id']] = r
        heights.update({str(i): round(r['lidar_p95'], 1) for i, r in best.items()})
        # A complex carries its tallest height on every part. Where the municipal value towers over the
        # measured roof of one part by more than 10 m, that part takes the measured height.
        count = Counter(b['id'] for b in city['buildings'])
        low = {r['key']: round(r['lidar_p95'], 1) for r in rows if r['status'] == 'ok' and r['source'] == 'municipal-provisional'
               and count[r['id']] > 1 and r['area_m2'] >= 30 and r['roof_pts'] >= 50 and r['delta_p95'] < -10 and r['lidar_p95'] >= 2}
        # The opposite case: a roof measured more than 10 m above the municipal value. The 95th percentile alone
        # can be a tree or a neighbour's overhang, so the median of the roof must rise too and sit close to it.
        tall = {r['key']: round(r['lidar_p95'], 1) for r in rows if r['status'] == 'ok' and r['source'] == 'municipal-provisional'
                and r['area_m2'] >= 30 and r['roof_pts'] >= 50 and r['delta_p95'] > 10
                and r['lidar_p50'] - r['municipal_m'] > 5 and r['lidar_p50'] >= .75 * r['lidar_p95']}
        part_heights = {**old.get('parts', {}), **low, **tall}
        tiles = sorted(set(old.get('tiles', [])) | {m['file'] for m in meta})
        target.write_text(json.dumps(dict(
            source='PNOA-LiDAR 3a cobertura, NPC02 (Canarias 2023-2024), (c) Instituto Geografico Nacional, licencia compatible con CC BY 4.0',
            method='p95 della quota dei punti classe 6 nell\'impronta meno la mediana dei punti classe 2 in un anello di 8 m; solo OBJECTID senza altezza comunale valida',
            parts_method="parti di un OBJECTID con piu poligoni dove l'altezza comunale supera di oltre 10 m il p95 misurato; oppure dove il p95 misurato supera di oltre 10 m l'altezza comunale e la mediana del tetto lo conferma (oltre 5 m sopra il comunale e almeno il 75 % del p95); chiave OBJECTID:floor(x minimo):floor(y minimo) in metri locali",
            tiles=tiles, heights=dict(sorted(heights.items(), key=lambda kv: int(kv[0]))), parts=dict(sorted(part_heights.items()))), indent=1, ensure_ascii=False), encoding='utf8')
        print('Esportate', len(best), 'altezze,', len(low), 'parti basse e', len(tall), 'parti alte in', target)
    print(json.dumps({k: v for k, v in report.items() if k != 'poi'}, indent=1))
    print('POI:', json.dumps(report['poi'], ensure_ascii=False))

main()
