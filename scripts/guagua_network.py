"""Generate verified Conducir network pieces, local-sector indexes and a coverage ledger."""
from collections import defaultdict
from bisect import bisect_left,bisect_right
import hashlib
import json
import math
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile

from guaguas import ROOT, SOURCE, extract, rows
from guagua_roads import BusRoads, RoadClearance
from guagua_index import index_piece
from geo import origin, to_crs
from shapely import STRtree, make_valid
from shapely.geometry import LineString, Point, Polygon

def encode(obj):
    return (json.dumps(obj,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n').encode()

def read_feed(feed):
    transform=to_crs()
    ox,oy=origin()
    def xy(row,prefix):
        x,y=transform.transform(float(row[prefix+'_lon']),float(row[prefix+'_lat']))
        return x-ox,y-oy
    with ZipFile(feed) as z:
        routes={r['route_id']:r['route_short_name'] for r in rows(z,'routes')}
        stops={r['stop_id']:(r['stop_name'],xy(r,'stop')) for r in rows(z,'stops')}
        shapes=defaultdict(list)
        for r in rows(z,'shapes'):
            shapes[r['shape_id']].append((int(r['shape_pt_sequence']),xy(r,'shape_pt')))
        shapes={k:[p for _,p in sorted(v)] for k,v in shapes.items()}
        orders=defaultdict(list)
        for r in rows(z,'stop_times'):orders[r['trip_id']].append((int(r['stop_sequence']),r['stop_id']))
        patterns={}
        for r in rows(z,'trips'):
            key=(routes[r['route_id']],r['direction_id'],r['trip_headsign'],r['shape_id'],
                 tuple(s for _,s in sorted(orders[r['trip_id']])))
            patterns.setdefault(key,r['trip_id'])
    return shapes,patterns,stops

def intervals_within(shape,boundary):
    intervals=[];current=0
    for a,b in zip(shape.coords,list(shape.coords)[1:]):
        line=LineString([a,b]);length=line.length
        inside=line.intersection(boundary)
        parts=inside.geoms if hasattr(inside,'geoms') else [inside]
        spans=[]
        for part in parts:
            if part.geom_type=='LineString' and part.length>.0001:
                s,e=sorted([line.project(Point(part.coords[0])),line.project(Point(part.coords[-1]))])
                spans.append((current+s,current+e))
        for s,e in sorted(spans):
            if intervals and s<=intervals[-1][1]+.001:intervals[-1]=(intervals[-1][0],e)
            else:intervals.append((s,e))
        current+=length
    return intervals

def stop_locations(shape,order,stops):
    """Advance along source measures, including repeated stops on loops."""
    start=0;result=[]
    for sid in order:
        name,p=stops[sid];point=Point(p)
        # On a looping route pick the first occurrence close to the official stop.
        options=[];cursor=0
        for a,b in zip(shape.coords,list(shape.coords)[1:]):
            length=math.dist(a,b)
            if length and cursor+length>=start:
                u=max(0,min(1,((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/length**2))
                m=cursor+u*length
                err=math.hypot(p[0]-a[0]-u*(b[0]-a[0]),p[1]-a[1]-u*(b[1]-a[1]))
                if m>=start and err<=25:options.append((m,err))
            cursor+=length
        if options:
            earliest=options[0][0]
            m,_=min((o for o in options if o[0]<earliest+75),key=lambda o:o[1])
            start=m+1
            result.append((m,sid,name,point))
    return result

def clipped_verified(chains,clearance,reviewed):
    result=[];matched=[]
    for chain in chains:
        matched.append((chain[0][1],chain[-1][1]))
        for run in clearance.verified(chain):
            # Reserve the original pilot demo for its reviewed alignment and stops.
            groups=[run]
            if reviewed:
                s,e,_=reviewed
                groups=[[r for r in run if r[1]<s],[r for r in run if r[1]>e]]
            for group in groups:
                if len(group)<2 or group[-1][1]-group[0][1]<7.2:continue
                line=LineString([r[0] for r in group])
                if line.length<7.2:continue
                result.append((group[0][1],group[-1][1],line,sorted({r[2] for r in group}),False,[r[1] for r in group]))
    if reviewed:
        s,e,p=reviewed
        path=[tuple(v) for v in p['path']]
        if (not all(clearance.straight(a,b) for a,b in zip(path,path[1:])) or
                not all(clearance.corner(a,b,c) for a,b,c in zip(path,path[1:],path[2:]))):
            raise ValueError('Reviewed Vegueta bus body no longer fits the pilot')
        result.append((s,e,LineString(p['path']),p['source']['osmWays'],True,[]))
    return sorted(result,key=lambda v:v[0]),matched

def ledger(inside,accepted,matched,shape):
    """Intervals use GTFS metres, so a detour or a shared geometry never inflates coverage."""
    cuts=sorted({v for pair in [*inside,*accepted,*matched] for v in pair})
    missing=[];served=0
    for a,b in zip(cuts,cuts[1:]):
        m=(a+b)/2
        if not any(s<=m<=e for s,e in inside):continue
        if any(s<=m<=e for s,e in accepted):served+=b-a;continue
        reason='vehicle clearance or short fragment' if any(s<=m<=e for s,e in matched) else 'no connected directed street near GTFS'
        if missing and missing[-1][2]==reason and abs(missing[-1][1]-a)<.02:missing[-1][1]=b
        else:missing.append([a,b,reason])
    return round(served,1),[{'from':round(a,1),'to':round(b,1),'at':[round(v,1) for v in shape.interpolate((a+b)/2).coords[0]],'reason':r} for a,b,r in missing if b-a>.05]

def coverage_report(source,patterns):
    polygons=[];names=[]
    for barrio in json.loads((ROOT/'public/data/barrios.json').read_bytes()):
        for outer,*holes in barrio['polygons']:
            polygons.append(make_valid(Polygon(outer,holes)));names.append(barrio['name'])
    tree=STRtree(polygons)
    by_area=defaultdict(lambda:{'gaps':0,'metres':0})
    by_line={}
    for pattern in patterns:
        key=(pattern['line'],pattern['directionId'],pattern['direction'])
        summary=by_line.setdefault(key,dict(line=key[0],directionId=key[1],direction=key[2],
                                             gtfsMetresInMap=0,verifiedGtfsMetres=0,servedStops=set()))
        for field in ('gtfsMetresInMap','verifiedGtfsMetres'):summary[field]+=pattern[field]
        summary['servedStops'].update(pattern['servedStops'])
        for gap in pattern['gaps']:
            matches=tree.query(Point(gap['at']),predicate='intersects')
            gap['barrio']=min((names[i] for i in matches),default=None)
            bucket=by_area[gap['barrio'] or 'Sin barrio catalogado']
            bucket['gaps']+=1;bucket['metres']+=gap['to']-gap['from']
    for summary in by_line.values():
        summary['servedStops']=len(summary['servedStops'])
        for field in ('gtfsMetresInMap','verifiedGtfsMetres'):summary[field]=round(summary[field],1)
    for bucket in by_area.values():bucket['metres']=round(bucket['metres'],1)
    return {'source':source,'lines':list(by_line.values()),'gapsByMidpointBarrio':dict(sorted(by_area.items())),
            'patterns':patterns}

def generate(feed,out):
    public=ROOT/'public/data'
    datasets={area:json.loads((public/(area+'.json')).read_bytes()) for area in ('city','pilot')}
    style=json.loads((ROOT/'src/data/road-style.json').read_bytes())
    catalog=json.loads((ROOT/'content/las-palmas.json').read_bytes())
    shapes,patterns,stops=read_feed(feed)
    reviewed=extract(feed);source={'url':SOURCE,'sha256':hashlib.sha256(feed.read_bytes()).hexdigest()}
    ids={r['id'] for d in datasets.values() for r in d['roads']}
    print('Loading directed street network',flush=True)
    roads=BusRoads(catalog['coverage'],ids)
    print('Matching',len(shapes),'shapes to',len(roads.edges),'directed edges',flush=True)
    matches={k:roads.match(coords) for k,coords in shapes.items()}
    groups=defaultdict(list)
    for pattern in sorted(patterns):groups[pattern[:2]].append(pattern)
    for area,dataset in datasets.items():
        print('Checking vehicle envelopes in',area,flush=True)
        clearance=RoadClearance(dataset,style)
        folder=out/area;folder.mkdir(parents=True)
        index={'version':1,'size':240,'source':source,'cells':{},'pieces':{}}
        stats=[];geometry={}
        bundles={};path_slots=defaultdict(dict);run_slots=defaultdict(dict)
        for shape_id,coords in shapes.items():
            shape=LineString(coords)
            reserve=None
            if shape_id==reviewed['source']['shape'] and area=='pilot':
                s,e=[shape.project(Point(reviewed['path'][i])) for i in (0,-1)]
                reserve=(s,e,reviewed)
            inside=intervals_within(shape,clearance.boundary)
            runs,matched=clipped_verified(matches[shape_id],clearance,reserve) if inside else ([],[])
            served,gaps=ledger(inside,[(s,e) for s,e,*_ in runs],matched,shape)
            geometry[shape_id]=(shape,runs,round(sum(e-s for s,e in inside),1),served,gaps)
        for (line,dir_id),variants in sorted(groups.items()):
            for variant,key in enumerate(variants):
                _,_,direction,shape_id,order=key
                shape,runs,inside,served,gaps=geometry[shape_id]
                positions=stop_locations(shape,order,stops) if runs else []
                all_stops=set();period=90*len(variants)
                group_phase=int.from_bytes(hashlib.sha256((line+'|'+dir_id).encode()).digest()[:3],'big')%90
                pieces=[]
                for n,(s,e,road,ways,is_reviewed,measures) in enumerate(runs):
                    pid=f'{shape_id}-{variant}-{n}-{dir_id}-{line}'
                    if pid in index['pieces']:raise ValueError('Duplicate pattern ID '+pid)
                    local=[]
                    for m,sid,name,p in positions:
                        if not s<=m<=e or road.distance(p)>15:continue
                        d=round(road.project(p),2)
                        if local and d<=local[-1]['distance'] and measures:
                            # A circular service may pass a stop for a second time.
                            # Project only onto the remaining path in travel order.
                            lo=max(0,bisect_left(measures,m-16)-1)
                            hi=min(len(measures),bisect_right(measures,m+16)+1)
                            pts=list(road.coords)
                            if hi-lo<2:continue
                            nearby=LineString(pts[lo:hi])
                            if nearby.distance(p)>15:continue
                            start=LineString(pts[:lo+1]).length if lo else 0
                            d=round(start+nearby.project(p),2)
                        if local and d<=local[-1]['distance']:continue
                        local.append(dict(id=sid,name=name,position=[round(v,2) for v in p.coords[0]],distance=d))
                    if is_reviewed:local=reviewed['stops']
                    path=list(road.coords)
                    # Geometry and stop sequence define the payload, independently of trip identity.
                    tile=f'{math.floor(path[0][0]/960)}_{math.floor(path[0][1]/960)}'
                    file=f'roads/{tile}.json'
                    bundle=bundles.setdefault(file,{'paths':[],'runs':[]})
                    path_key=tuple(path)
                    paths=path_slots[file]
                    if path_key not in paths:
                        paths[path_key]=len(bundle['paths']);bundle['paths'].append(path)
                    run_key=(paths[path_key],encode(local))
                    if run_key not in run_slots[file]:
                        run_slots[file][run_key]=len(bundle['runs'])
                        bundle['runs'].append({'path':paths[path_key],'stops':local})
                    phase=0 if is_reviewed else round((group_phase+90*variant+s/8+3*sum(m<s for m,*_ in positions))%period,3)
                    index_piece(index,pid,file,line,direction,phase,period,path,local)
                    index['pieces'][pid]['slot']=run_slots[file][run_key]
                    all_stops.update(item['id'] for item in local)
                    pieces.append({'id':pid,'from':round(s,1),'to':round(e,1),'osmWays':ways})
                stats.append(dict(line=line,direction=direction,directionId=dir_id,shape=shape_id,trip=patterns[key],
                                  gtfsMetresInMap=inside,verifiedGtfsMetres=served,servedStops=sorted(all_stops),
                                  pieces=pieces,gaps=gaps))
        zones={}
        for cell,intervals in index['cells'].items():
            x,y=map(int,cell.split('_'));zone=f'{x//4}_{y//4}'
            sub=zones.setdefault(zone,{'version':1,'size':240,'pieces':{},'cells':{}})
            sub['cells'][cell]=intervals
            for pid,*_ in intervals:sub['pieces'][pid]=index['pieces'][pid]
        (folder/'roads').mkdir();(folder/'zones').mkdir()
        for file,bundle in bundles.items():(folder/file).write_bytes(encode(bundle))
        directory={'version':1,'size':240,'zoneSize':960,'source':source,'zones':{}}
        for zone,sub in zones.items():
            file='zones/'+zone+'.json'
            (folder/file).write_bytes(encode(sub));directory['zones'][zone]=file
        (folder/'index.json').write_bytes(encode(directory))
        (folder/'coverage.json').write_bytes(encode(coverage_report(source,stats)))
        version_packs(folder)
        print(area,len(index['pieces']),'pieces,',len(index['cells']),'cells,',len(stats),'patterns',flush=True)
        if not index['pieces'] or not index['cells']:raise ValueError('Empty network for '+area)
    if len({k[0] for k in patterns})<1:raise ValueError('No routes')

def version_packs(folder):
    """Write immutable pack names before publishing either area's entry point."""
    directory=json.loads((folder/'index.json').read_bytes())
    def name(file,data):
        prefix=file.removesuffix('.json')
        return prefix+'.'+hashlib.sha256(data).hexdigest()[:12]+'.json'
    files={}
    for file in sorted((folder/'roads').glob('*.json')):
        old=file.relative_to(folder).as_posix()
        new=name(old,file.read_bytes());file.rename(folder/new);files[old]=new
    for key,old in directory['zones'].items():
        file=folder/old
        zone=json.loads(file.read_bytes())
        for ref in zone['pieces'].values():ref['file']=files[ref['file']]
        data=encode(zone);new=name(old,data)
        (folder/new).write_bytes(data);file.unlink();directory['zones'][key]=new
    (folder/'index.json').write_bytes(encode(directory))


def previous_files(target):
    """Only files registered by the previous generated manifests may be retired."""
    owned=set()
    for area in ('city','pilot'):
        folder=target/area
        if not (folder/'index.json').exists():continue
        directory=json.loads((folder/'index.json').read_bytes())
        if not directory.get('zones') or directory.get('version')!=1:
            raise ValueError('Unrecognised network output: '+str(folder))
        for file in directory['zones'].values():
            if Path(file).parent.as_posix()!='zones':raise ValueError('Invalid zone filename')
            sub=json.loads((folder/file).read_bytes())
            owned.add(Path(area)/file)
            for ref in sub['pieces'].values():
                if Path(ref['file']).parent.as_posix()!='roads':raise ValueError('Invalid road filename')
                owned.add(Path(area)/ref['file'])
    return owned


def install(staging,target):
    """Install immutable bundles first, then switch the small public manifests."""
    target=target.resolve()
    lock=target.with_name('.'+target.name+'.publish.lock')
    with lock.open('x'):pass
    try:
        old=previous_files(target)
        installed=[];changed=[]
        headers=[Path(a)/f for f in ('coverage.json','index.json') for a in ('city','pilot')]
        bundles={p.relative_to(staging) for p in staging.rglob('*.json')}-set(headers)
        try:
            for path in sorted(bundles):
                dst=target/path
                if dst.exists():
                    if dst.read_bytes()!=(staging/path).read_bytes():raise ValueError('Content-address collision '+str(path))
                    continue
                dst.parent.mkdir(parents=True,exist_ok=True)
                os.replace(staging/path,dst);installed.append(dst)
            for path in headers:
                dst=target/path;backup=staging/(path.as_posix()+'.previous')
                if dst.exists():backup.write_bytes(dst.read_bytes())
                os.replace(staging/path,dst);changed.append((dst,backup))
        except BaseException:
            for dst,backup in reversed(changed):
                if backup.exists():os.replace(backup,dst)
                else:dst.unlink()
            for dst in installed:dst.unlink()
            raise
        for path in old-bundles:(target/path).unlink(missing_ok=True)
    finally:lock.unlink()


def publish(feed,target):
    target=Path(target).resolve()
    target.parent.mkdir(parents=True,exist_ok=True)
    with TemporaryDirectory(prefix='.guagua-build-',dir=target.parent) as tmp:
        staging=Path(tmp)/'candidate'
        generate(feed,staging)
        install(staging,target)
