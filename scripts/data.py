"""Build local metric scene layers. Run from the project root."""
import json, math, sys, subprocess, time
started=time.perf_counter()
from pathlib import Path
from urllib.parse import urlencode
import xml.etree.ElementTree as ET
sys.path.insert(0, str(Path('.cache/pylib').resolve()))
from shapely.geometry import Polygon, LineString, Point, shape, mapping, box, MultiPoint
from shapely.ops import transform
from shapely import make_valid
from pyproj import Transformer
import rasterio

cache = Path('.cache')
out = Path('public/data')
cache.mkdir(exist_ok=True)
out.mkdir(exist_ok=True, parents=True)
def fetch(name, url):
    path = cache / name
    if not path.exists():
        tmp = path.with_suffix('.part')
        subprocess.run(['curl','-fsSL','--max-time','90',url,'-o',str(tmp)],check=True)
        tmp.replace(path)
    return path
def save(name, data):
    (out/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')

bbox = '-15.4195,28.0974,-15.4113,28.1116'
osm = ET.parse(fetch('osm-full.xml','https://api.openstreetmap.org/api/0.6/map?bbox='+bbox))
utm = Transformer.from_crs(4326,32628,always_xy=True)
geo = Transformer.from_crs(32628,4326,always_xy=True)
ox,oy = utm.transform(-15.415,28.105)
def project(lon,lat):
    x,y=utm.transform(lon,lat)
    return x-ox,y-oy
def inverse(x,y):
    return geo.transform(x+ox,y+oy)
def tags(e):
    return {t.get('k'):t.get('v') for t in e.findall('tag')}
nodes={e.get('id'):project(float(e.get('lon')),float(e.get('lat'))) for e in osm.findall('node')}
ways={e.get('id'):(tags(e),[nodes[n.get('ref')] for n in e.findall('nd')]) for e in osm.findall('way')}
catalog=json.loads(Path('content/las-palmas.json').read_text(encoding='utf8'))
def place_polygon(reference):
    kind, ref = reference.split('/')
    if kind == 'way':
        return Polygon(ways[ref][1])
    if kind != 'relation':
        raise ValueError(f'Expected polygon way or relation: {reference}')
    members=osm.find(f"relation[@id='{ref}']").findall('member')
    outer, = [ways[m.get('ref')][1] for m in members if m.get('role')=='outer']
    holes=[ways[m.get('ref')][1] for m in members if m.get('role')=='inner']
    return Polygon(outer,holes)

def feature(g,p):
    return dict(type='Feature',geometry=mapping(transform(inverse,g)),properties=p)
places=catalog['places']
polygons={p['id']:place_polygon(p['osm']) for p in places}
assert len(polygons)==len(places), 'Duplicate POI ID'
features=[]
for p in places:
    point=polygons[p['id']].representative_point()
    features.append(feature(point,dict(p,xy=[point.x,point.y])))
save('poi.geojson',dict(type='FeatureCollection',features=features))
aoi=MultiPoint([v for p in places if 'city' in p['areas'] for v in polygons[p['id']].exterior.coords]).convex_hull.buffer(95,quad_segs=2)
stage=sys.argv[1] if len(sys.argv)>1 else 'city'
a=polygons[catalog['pilotFocus']].representative_point()
pilot=box(a.x-325,a.y-325,a.x+325,a.y+325)
area=pilot if stage=='pilot' else aoi
save(stage+'-aoi.geojson',feature(area,{'stage':stage}))
extent=transform(inverse,area).bounds
query='https://services-eu1.arcgis.com/eV9RayDSwR2BokOl/ArcGIS/rest/services/Building/FeatureServer/0/query?'
params=dict(where='1=1',geometry=','.join(map(str,extent)),geometryType='esriGeometryEnvelope',inSR=4326,spatialRel='esriSpatialRelIntersects',outSR=4326)
def arc(name,**opts):
    return json.loads(fetch(stage+name,query+urlencode(params|opts)).read_bytes())
count=arc('-count.json',returnCountOnly='true',f='json')['count']
features=[]
for offset in range(0,count,1000):
    features+=arc(f'-{offset}.json',outFields='OBJECTID,MAX_BLDGHEIGHT_1',orderByFields='OBJECTID',resultOffset=offset,resultRecordCount=1000,f='geojson')['features']
assert len({f['properties']['OBJECTID'] for f in features})==len(features)==count
def parts(g,kind):
    if g.is_empty: return []
    if g.geom_type==kind: return [g]
    return [p for child in getattr(g,'geoms',[]) for p in parts(child,kind)]
def coords(seq):
    return [[round(x,1),round(y,1)] for x,y in seq]
def rings(p):
    return [coords(r.coords) for r in [p.exterior,*p.interiors]]
buildings=[]; roads=[]; surfaces=[]; trees=[]
for f in features:
    g=make_valid(transform(project,shape(f['geometry'])))
    h=f['properties']['MAX_BLDGHEIGHT_1']
    clipped=g.intersection(area)
    style=catalog['buildings'].get(str(f['properties']['OBJECTID']),{}).copy()
    split=style.pop('split',None)
    sections=[(clipped,style)]
    if split:
        mask=Polygon(ways[split['osmWay']][1])
        sections=[(clipped.intersection(mask),split['inside']),(clipped.difference(mask),style)]
    for section,style in sections:
      for p in parts(section,'Polygon'):
        if p.area<2: continue
        buildings.append(dict(id=f['properties']['OBJECTID'],**style,rings=rings(p),height=round(h,1) if h and 2<h<100 else 9,source='municipal-provisional' if h and 2<h<100 else 'estimate'))
for i,(t,vs) in ways.items():
    if len(vs)<2: continue
    road=t.get('highway')
    green=t.get('leisure') in ('garden','park') or t.get('landuse') in ('grass','village_green')
    if vs[0]==vs[-1] and len(vs)>3 and (green or t.get('area')=='yes' and road):
        for p in parts(make_valid(Polygon(vs)).intersection(area),'Polygon'):
            surfaces.append(dict(id=i,kind='park' if green else 'plaza',paved=i in catalog['pavedParks'],rings=rings(p)))
    elif road and road not in ('construction','proposed','elevator') and not t.get('tunnel'):
        for l in parts(LineString(vs).intersection(area),'LineString'):
            roads.append(dict(id=i,name=t.get('name'),kind=road,line=coords(l.coords)))
for e in osm.findall('node'):
    if tags(e).get('natural')=='tree' and area.contains(Point(nodes[e.get('id')])):
        trees+=coords([nodes[e.get('id')]])
x0,y0,x1,y1=area.bounds
# Sample a bounded REGCAN95 / UTM 28N bare-earth coverage.
west,south,east,north=math.floor(x0+ox-30),math.floor(y0+oy-30),math.ceil(x1+ox+30),math.ceil(y1+oy+30)
url='https://servicios.idee.es/wcs-inspire/mdt?'+urlencode([('service','WCS'),('version','2.0.1'),('request','GetCoverage'),('coverageId','Elevacion4083_5'),('subset',f'X({west},{east})'),('subset',f'Y({south},{north})'),('format','image/tiff')])
with rasterio.open(fetch(stage+'-dem.tif',url)) as dem:
    assert dem.crs.to_epsg()==4083
    grid=dem.read(1,masked=True)
    assert grid.count()
    elev=dict(origin=[dem.transform.c+dem.transform.a/2-ox,dem.transform.f+dem.transform.e/2-oy],stepY=-dem.transform.e,step=dem.transform.a,w=dem.width,h=dem.height,values=grid.filled(0).round(1).flatten().tolist())
ground=[coords(p.exterior.coords) for x in range(math.floor(x0),math.ceil(x1),15) for y in range(math.floor(y0),math.ceil(y1),15) for p in parts(area.intersection(box(x,y,x+15,y+15)),'Polygon') if p.area>0.01]
save(stage+'.json',dict(ground=ground,boundary=rings(area)[0],buildings=buildings,roads=roads,surfaces=surfaces,trees=trees,terrain=elev,focus=catalog['pilotFocus'] if stage=='pilot' else None))
print(stage,count,len(buildings),len(roads),len(trees),elev['step'],round(time.perf_counter()-started,2),'s')



