"""Build local metric scene layers. Run from the project root."""
import argparse, json, math, sys, time
started=time.perf_counter()
from itertools import chain
from pathlib import Path
from urllib.parse import urlencode
sys.path.insert(0, str(Path('.cache/pylib').resolve()))
from shapely.geometry import Polygon, LineString, Point, shape, mapping, box, MultiPoint
from shapely.ops import transform, unary_union, polygonize, nearest_points
import shapely
from shapely import make_valid, maximum_inscribed_circle
from shapely.strtree import STRtree
from geo import clip_to_area, from_crs, origin, to_crs
import numpy as np
import rasterio
from source_cache import fetch
from osm_extract import acquire_projected, tags
from osm_buildings import osm_buildings
from city_layers import write_layers

cache = Path('.cache')
out = Path('public/data')
cache.mkdir(exist_ok=True)
out.mkdir(exist_ok=True, parents=True)
def save(name, data):
    (out/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')

catalog=json.loads(Path('content/las-palmas.json').read_text(encoding='utf8'))
coverage=catalog['coverage']
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('stage', nargs='?', choices=('city','pilot','barrios','sea'), default='city')
parser.add_argument('--gzip-level', type=int, choices=(6,9))
args=parser.parse_args()
stage=args.stage
if args.gzip_level is not None and stage!='city':
    parser.error('--gzip-level applies only to city')
nodes,node_tags,ways_refs,osm=acquire_projected(coverage)
utm = to_crs()
geo = from_crs()
ox,oy = origin()
def project(lon,lat):
    x,y=utm.transform(lon,lat)
    return x-ox,y-oy
def inverse(x,y):
    return geo.transform(x+ox,y+oy)
ways={ident:(tag,[nodes[ref] for ref in refs]) for ident,(tag,refs) in ways_refs.items()}
del ways_refs
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

def parts(g,kind):
    if g.is_empty: return []
    if g.geom_type==kind: return [g]
    return [p for child in getattr(g,'geoms',[]) for p in parts(child,kind)]
def coords(seq):
    return [[round(x,1),round(y,1)] for x,y in seq]
def rings(p):
    return [coords(r.coords) for r in [p.exterior,*p.interiors]]

places=catalog['places']
polygons={p['id']:place_polygon(p['osm']) for p in places}
assert len(polygons)==len(places), 'Duplicate POI ID'
features=[]
for p in places:
    point=polygons[p['id']].representative_point()
    features.append(feature(point,dict(p,xy=[point.x,point.y])))
# Keep the exact OSM boundary for labels. The coverage can add a margin.
def mapped_area(relation):
    return unary_union(list(polygonize(unary_union([LineString(ways[m.get('ref')][1]) for m in relation.findall('member') if m.get('type')=='way']))))

# Barrios that OpenStreetMap does not map as boundaries come from the municipal layer, by its NUCL_CO_ID
# inside an entity: the city proper (ENTS_CO_ID 24) unless the zone names another with `entity`.
MUNICIPAL='https://services-eu1.arcgis.com/eV9RayDSwR2BokOl/ArcGIS/rest/services/Barrios/FeatureServer/0/query?'+urlencode(dict(where='1=1',outFields='ENTS_CO_ID,NUCL_CO_ID,NUCL_DS_NO',outSR=4326,f='geojson'))
municipal={}
def municipal_area(zone):
    code=(zone.get('entity',24),zone['municipal'])
    if not municipal:
        for f in json.loads(fetch('barrios-municipal.geojson',MUNICIPAL).read_bytes())['features']:
            municipal[(f['properties']['ENTS_CO_ID'],f['properties']['NUCL_CO_ID'])]=make_valid(transform(project,shape(f['geometry'])))
    return unary_union([g for g in getattr(municipal[code],'geoms',[municipal[code]]) if g.geom_type in ('Polygon','MultiPolygon')])

def save_barrios():
    barrios=[]
    for zone in coverage['zones']:
        if 'municipal' in zone:
            # A scattered remainder between barrios has no name of its own: it is covered, not labelled.
            if 'name' not in zone: continue
            area=municipal_area(zone).simplify(.25, preserve_topology=True)
            barrios.append(dict(name=zone['name'],polygons=[
                [[[round(x,1),round(y,1)] for x,y in ring.coords] for ring in [p.exterior,*p.interiors]]
                for p in getattr(area,'geoms',[area])]))
            continue
        if 'osm' not in zone: continue
        relation=osm.find(f"relation[@id='{zone['osm'].split('/')[1]}']")
        area=mapped_area(relation).simplify(.25, preserve_topology=True)
        assert area.area>0, 'Open boundary: '+zone['id']
        polygons=[area] if area.geom_type=='Polygon' else list(area.geoms)
        name=tags(relation)['name']
        if zone['id']=='san-cristobal': name='San Cristóbal'
        barrios.append(dict(name=name,polygons=[
            [[[round(x,1),round(y,1)] for x,y in ring.coords] for ring in [p.exterior,*p.interiors]]
            for p in polygons]))
    save('barrios.json',barrios)

if stage in ('city','barrios'): save_barrios()
if stage=='barrios': sys.exit()
if stage!='sea': save('poi.geojson',dict(type='FeatureCollection',features=features))
# Each zone is an envelope of places, a buffered corridor, a mapped OSM boundary or an explicit lon/lat polygon.
def zone_shape(z):
    if 'places' in z: return MultiPoint([v for key in z['places'] for v in polygons[key].exterior.coords]).convex_hull.buffer(z['margin'],quad_segs=2)
    if 'axis' in z: return LineString([project(*p) for p in z['axis']]).buffer(z['radius'])
    if 'osm' in z:
        # A mapped boundary relation, such as a barrio: its member ways close into the area. One metre joins neighbours.
        area=mapped_area(osm.find(f"relation[@id='{z['osm'].split('/')[1]}']"))
        assert area.area>0, 'Open boundary: '+z['id']
        return area.buffer(1)
    # The municipal outlines do not share vertices with the OSM ones: ten metres close the seam between them.
    if 'municipal' in z: return municipal_area(z).buffer(10)
    return Polygon([project(*p) for p in z['polygon']])
zones=[zone_shape(z) for z in coverage['zones']]
assert len({z['id'] for z in coverage['zones']})==len(zones), 'Duplicate zone ID'
covered=unary_union(zones)
# Slivers left between two sources of boundaries are not courtyards: close the holes smaller than a block.
covered=unary_union([Polygon(p.exterior,[r for r in p.interiors if Polygon(r).area>5000]) for p in getattr(covered,'geoms',[covered])])
# Classify the coast partitions inside the acquisition window using the known inland plaza.
window=transform(project,box(*coverage['bounds']))
# Cross the window edge with the whole coastline: clipped ends can miss the edge by a rounding error.
shorelines=[LineString(v) for t,v in ways.values() if t.get('natural')=='coastline' and len(v)>1]
partitions=[p for p in polygonize(unary_union([window.boundary,*shorelines])) if window.buffer(1).contains(p)]
focus_point=polygons[catalog['pilotFocus']].representative_point()
land=next(p for p in partitions if p.contains(focus_point))
assert len(partitions)>1 and land.area<window.area*.99, 'Coastline failed to split the acquisition window'
aoi=covered.intersection(land)
assert aoi.geom_type=='Polygon' and aoi.area>=coverage['minimumLandM2'], aoi.area
assert all(aoi.covers(poly.representative_point()) for poly in polygons.values())
print('Land area',round(aoi.area),'m2',flush=True)
pilot=box(focus_point.x-325,focus_point.y-325,focus_point.x+325,focus_point.y+325)
area=pilot if stage=='pilot' else aoi
if stage in ('city','sea'):
    # The full coastal ways in the supplementary cell close the wider window to the west.
    sea_coast=shorelines.copy()
    if 'seaCoastBounds' in coverage:
        extra_nodes,_,extra_ways,_=acquire_projected(dict(bounds=coverage['seaCoastBounds'],lattice=coverage['lattice']))
        extra_nodes.update(nodes)
        for ident,(tag,refs) in extra_ways.items():
            if ident not in ways and tag.get('natural')=='coastline':
                sea_coast.append(LineString([extra_nodes[ref] for ref in refs]))
    # Allow for a square viewport at maximum zoom-out, including during rotation.
    west,south,east,north=aoi.bounds
    # To the south the coast runs on past the model: the sea stops where the acquired coastline does.
    sea_window=box(west-2800,max(south-2800,window.bounds[1]),east+2800,north+2800)
    sea_partitions=list(polygonize(unary_union([sea_window.boundary,*sea_coast])))
    sea_land=next(p for p in sea_partitions if p.contains(focus_point))
    _,_,east,north=sea_window.bounds
    ocean=next(p for p in sea_partitions if p.contains(Point(east-1,north-1)))
    assert ocean is not sea_land and sea_window.covers(ocean), 'Coastline must split the extended sea window'
    assert ocean.intersection(land).area<1, 'Extended sea overlaps mapped land'
    # Keep the other coastline partitions previously drawn beside the model, such as enclosed basins.
    near=aoi.buffer(260,quad_segs=4)
    near=unary_union([Polygon(p.exterior) for p in parts(near,'Polygon')])
    water=[ocean]+[p for part in sea_partitions if part is not ocean and part is not sea_land
                   for p in parts(part.intersection(near),'Polygon') if p.area>400]
    shore=parts(unary_union(sea_coast).intersection(sea_window),'LineString')
    save('sea.json',dict(water=[rings(p) for p in water],shore=[coords(l.coords) for l in shore]))
    print('Sea',round(ocean.area),'m2, shore',round(sum(l.length for l in shore)),'m',flush=True)
    if stage=='sea': sys.exit()
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
# Some municipal records carry no geometry: nothing to draw.
empty=[f['properties']['OBJECTID'] for f in features if not f['geometry']]
if empty: print('Municipal records without geometry:',empty,flush=True)
features=[f for f in features if f['geometry']]
buildings=[]; roads=[]; surfaces=[]; trees=[]
# Altezze misurate dal LiDAR PNOA solo per gli edifici senza altezza comunale valida (vedi scripts/lidar-check.py --export).
lidar_file=Path('content/lidar-heights.json')
lidar=json.loads(lidar_file.read_text(encoding='utf8')) if lidar_file.exists() else {}
lidar_heights,lidar_parts=lidar.get('heights',{}),lidar.get('parts',{})
# Storage tanks and silos mapped in OpenStreetMap are municipal footprints too: plain pale shells, no windows.
tanks=[Point(nodes[ident]) for ident,tag in node_tags.items() if tag.get('man_made') in ('storage_tank','silo')]
tanks+=[LineString(v).centroid for t,v in ways.values() if t.get('man_made') in ('storage_tank','silo') and len(v)>1]
tank_index=STRtree(tanks) if tanks else None
tank_style=dict(windows=False,roofFurniture=False,wallColor='#e3e3dc')
# What a building is, when its plan or its OpenStreetMap tags say it is not housing. `hall`: sheds, markets,
# shopping centres, sports halls. `block`: hospitals, schools, offices and public buildings.
HALL={'industrial','warehouse','retail','supermarket','commercial','hangar','garage','garages','parking','sports_centre','sports_hall','service'}
BLOCK={'hospital','school','university','college','office','public','civic','government','government_office','fire_station'}
def osm_kind(t):
    b=t.get('building')
    return ('hall' if b in HALL or t.get('shop') in ('mall','supermarket','department_store')
        else 'block' if b in BLOCK or t.get('amenity') in ('hospital','school','university','college','courthouse','police','townhall','library') else None)
mapped=[(make_valid(Polygon(v)),osm_kind(t)) for t,v in ways.values() if t.get('building') not in (None,'roof','carport') and len(v)>3 and v[0]==v[-1]]
mapped_index=STRtree([p for p,_ in mapped])
def kind_of(p,height):
    best,kind=0,None
    for i in mapped_index.query(p):
        candidate,archetype=mapped[i]
        if not archetype: continue
        a=candidate.intersection(p).area
        if a>.5*p.area and a>best: best,kind=a,archetype
    # A plan deeper than any dwelling under a low roof is a hall, whatever the map says.
    if not kind and p.area>=1200 and height<=16 and maximum_inscribed_circle(p).length>=15: kind='hall'
    return kind
shapely.prepare(area)
for f in features:
    g=make_valid(transform(project,shape(f['geometry'])))
    h=f['properties']['MAX_BLDGHEIGHT_1']
    clipped=clip_to_area(g, area)
    style=catalog['buildings'].get(str(f['properties']['OBJECTID']),{}).copy()
    split=style.pop('split',None)
    if style.pop('footprint',None)=='osm':
        # The municipal record is a whole plot: keep only what OpenStreetMap maps as buildings inside it.
        clipped=clipped.intersection(unary_union([mapped[i][0] for i in mapped_index.query(g) if mapped[i][0].intersection(g).area>.5*mapped[i][0].area]))
    sections=[(clipped,style)]
    if split:
        # The dividing outline is an OSM way, or a ring in local metres traced on the 20 cm orthophoto.
        mask=Polygon(ways[split['osmWay']][1] if 'osmWay' in split else split['polygon'])
        sections=[(clipped.intersection(mask),split['inside']),(clipped.difference(mask),style)]
    for section,style in sections:
      for p in parts(section,'Polygon'):
        if p.area<2: continue
        valid=bool(h and 2<h<100)
        measured=lidar_heights.get(str(f['properties']['OBJECTID']))
        height,origin=(round(h,1),'municipal-provisional') if valid else (measured,'lidar-pnoa') if measured else (9,'estimate')
        outline=rings(p)
        # Low bodies of a complex and roofs measured far above the municipal value: see scripts/lidar-check.py --export.
        key=f"{f['properties']['OBJECTID']}:{math.floor(min(v[0] for v in outline[0]))}:{math.floor(min(v[1] for v in outline[0]))}"
        part=lidar_parts.get(key)
        if part and valid: height,origin=part,'lidar-pnoa'
        # One municipal record can hold several separate bodies: the catalogue may style a single one by the same key.
        look={**style,**catalog['buildings'].get(key,{})}
        if tank_index is not None and 'wallColor' not in look and any(p.contains(tanks[i]) for i in tank_index.query(p)): look={**tank_style,**look}
        # An archetype only where the catalogue says nothing: a curated building keeps its look.
        if not look:
            kind=kind_of(p,height)
            if kind: look={'kind':kind}
        elif look.get('kind')=='housing': look={k:v for k,v in look.items() if k!='kind'}
        buildings.append(dict(id=f['properties']['OBJECTID'],**look,rings=outline,height=height,source=origin))
# Monuments the municipal layer leaves out: OSM footprint, catalogue height (see scripts/osm_buildings.py).
buildings+=osm_buildings(catalog,place_polygon,area,parts,rings)
def underground(t):
    """A way below the street: a tunnel, or a level wholly below ground (the bays of the Santa Catalina bus station)."""
    levels=[v.strip() for v in t.get('level','').split(';') if v.strip()]
    try: below=bool(levels) and all(float(v)<0 for v in levels)
    except ValueError: below=False
    return bool(t.get('tunnel')) or below
# Where a street goes under ground it ends square, as a portal, instead of on a round cap.
portals={tuple(v) for t,vs in ways.values() if t.get('highway') and underground(t) for v in (vs[0],vs[-1]) if vs}
def cover(t):
    """What an area is made of, from its OSM `surface` tag; None keeps the colour of its kind."""
    v=t.get('surface')
    return ('asphalt' if v=='asphalt' else 'earth' if v in ('sand','dirt','ground','earth','fine_gravel','gravel','compacted','unpaved')
        else 'grass' if v in ('grass','artificial_turf') else 'rubber' if v in ('rubber','tartan','acrylic') else None)
for i,(t,vs) in ways.items():
    if len(vs)<2: continue
    road=t.get('highway')
    green=t.get('leisure') in ('garden','park') or t.get('landuse') in ('grass','village_green')
    # A sand beach mapped as an area is ground of its own: the viewer paints it as sand.
    beach=t.get('natural')=='beach' and t.get('surface','sand')=='sand'
    # Swimming pools and ponds are painted on the ground as water; the sea comes from the coast instead.
    water=t.get('leisure')=='swimming_pool' or t.get('natural')=='water'
    # Playgrounds and sports pitches at street level are ground of their own; those on a roof are not.
    play=t.get('leisure') in ('playground','pitch') and t.get('layer','0') in ('0','-1')
    if vs[0]==vs[-1] and len(vs)>3 and (beach or water):
        for p in parts(clip_to_area(make_valid(Polygon(vs)), area),'Polygon'):
            if p.area>50 if beach else 4<p.area<20000: surfaces.append(dict(id=i,kind='beach' if beach else 'water',rings=rings(p)))
    elif vs[0]==vs[-1] and len(vs)>3 and (green or t.get('area')=='yes' and road or play or t.get('place')=='square'):
        # The ground of the area: the catalogue first, then the `surface` tag, then what a playground or a pitch is made of.
        made=catalog.get('grounds',{}).get(i) or cover(t) or ('rubber' if t.get('leisure')=='playground' else 'pitch' if play else None)
        for p in parts(clip_to_area(make_valid(Polygon(vs)), area),'Polygon'):
            surfaces.append(dict(id=i,kind='park' if green else 'plaza',paved=i in catalog['pavedParks'],rings=rings(p),**({'ground':made} if made and not (green and made=='grass') else {})))
    elif road and road not in ('construction','proposed','elevator') and not underground(t):
        for l in parts(clip_to_area(LineString(vs), area),'LineString'):
            grade={key:t[key] for key in ('bridge','layer') if key in t}
            if any(tuple(l.coords[k]) in portals for k in (0,-1)): grade['portal']=True
            roads.append(dict(id=i,name=t.get('name'),kind=road,line=coords(l.coords),**grade))
# Painted from the largest to the smallest, so a flower bed shows on the paved park around it; water last.
surfaces.sort(key=lambda s:(s['kind']=='water',-Polygon(s['rings'][0]).area))
for ident,tag in node_tags.items():
    if tag.get('natural')=='tree' and area.contains(Point(nodes[ident])):
        trees+=coords([nodes[ident]])
# Port objects exactly where OpenStreetMap maps them: quay cranes and chimneys. A crane heads for the nearest
# quay edge; its mapped place is approximate. Tanks and silos are municipal buildings already.
props=[]
if stage=='city':
    quays=unary_union(shorelines).intersection(window)
    point_props=((tag,Point(nodes[ident])) for ident,tag in node_tags.items() if tag.get('man_made') in ('crane','chimney'))
    way_props=((tag,LineString(points).centroid) for tag,points in ways.values() if tag.get('man_made') in ('crane','chimney'))
    for t,p in chain(point_props,way_props):
        if not area.contains(p): continue
        if t['man_made']=='chimney':
            props.append(['chimney',round(p.x,1),round(p.y,1),0,float(t.get('height',25))])
            continue
        edge=nearest_points(quays,p)[0]
        heading=math.atan2(edge.y-p.y,edge.x-p.x) if edge.distance(p)>.5 else 0
        props.append(['crane',round(p.x,1),round(p.y,1),round(heading,3),{'gantry_crane':1,'travel_lift':.3}.get(t.get('crane:type'),.6)])
    print('Port objects',len(props),flush=True)
x0,y0,x1,y1=area.bounds
# Sample a bounded REGCAN95 / UTM 28N bare-earth coverage.
west,south,east,north=math.floor(x0+ox-30),math.floor(y0+oy-30),math.ceil(x1+ox+30),math.ceil(y1+oy+30)
url='https://servicios.idee.es/wcs-inspire/mdt?'+urlencode([('service','WCS'),('version','2.0.1'),('request','GetCoverage'),('coverageId','Elevacion4083_5'),('subset',f'X({west},{east})'),('subset',f'Y({south},{north})'),('format','image/tiff')])
with rasterio.open(fetch(stage+'-dem.tif',url)) as dem:
    assert dem.crs.to_epsg()==4083
    grid=dem.read(1,masked=True)
    # Beyond its coverage the service answers -32768 without declaring it as missing: read it as sea level.
    grid=np.ma.masked_less(grid,-1000)
    assert grid.count()
    elev=dict(origin=[dem.transform.c+dem.transform.a/2-ox,dem.transform.f+dem.transform.e/2-oy],stepY=-dem.transform.e,step=dem.transform.a,w=dem.width,h=dem.height,values=grid.filled(0).round(1).flatten().tolist())
def ground_cells():
    """The land in 15 m squares. Only the squares on the edge are clipped: one wholly inside is the square itself, with
    the vertices in the order GEOS gives them, and a million clips against the whole outline took twenty minutes."""
    ys=list(range(15*math.floor(y0/15),math.ceil(y1),15))
    for x in range(15*math.floor(x0/15),math.ceil(x1),15):
        squares=shapely.box(x,ys,x+15,[y+15 for y in ys])
        for y,square,inside,touch in zip(ys,squares,shapely.contains(area,squares),shapely.intersects(area,squares)):
            if inside: yield coords((float(a),float(b)) for a,b in ((x,y),(x,y+15),(x+15,y+15),(x+15,y),(x,y)))
            elif touch: yield from (coords(p.exterior.coords) for p in parts(area.intersection(square),'Polygon') if p.area>0.01)
ground=list(ground_cells())
write_layers(stage,dict(ground=ground,boundary=rings(area)[0],buildings=buildings,roads=roads,surfaces=surfaces,trees=trees,props=props,terrain=elev,focus=catalog['pilotFocus'] if stage=='pilot' else None),
             compresslevel=args.gzip_level or 9)
print(stage,count,len(buildings),len(roads),len(trees),elev['step'],round(time.perf_counter()-started,2),'s')



