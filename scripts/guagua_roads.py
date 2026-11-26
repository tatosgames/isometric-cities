"""Match GTFS to directed OSM road edges and check the full vehicle against the game map."""
from collections import defaultdict
from functools import lru_cache
from heapq import heappop, heappush
import math
from shapely import STRtree, intersects, make_valid, prepare, union_all
from shapely.geometry import LineString, Point, Polygon, box
from osm_extract import acquire
from geo import origin, to_crs

ROAD_CLASSES={'motorway','trunk','primary','secondary','tertiary','residential','unclassified',
              'service','living_street','road','busway','bus_guideway'}
ROAD_CLASSES |= {name+'_link' for name in ['motorway','trunk','primary','secondary','tertiary']}
DENIED={'no','private','agricultural','forestry','customers','delivery','destination'}
def tags(element):
    return {tag.get('k'):tag.get('v') for tag in element.findall('tag')}

class BusRoads:
    def __init__(self,spec,ids):
        osm=acquire(spec,offline=True)
        self.edges=[];self.nodes=[]
        self.out=defaultdict(list)
        self.restrictions=defaultdict(list)
        self.via_ways=set()
        self.coords={}
        raw={n.get('id'):(float(n.get('lon')),float(n.get('lat'))) for n in osm.findall('node')}
        ox,oy=origin()
        project=to_crs()
        for way in osm.findall('way'):
            wid=way.get('id')
            if wid not in ids: continue
            t=tags(way)
            kind=t.get('highway')
            access=next((t[k] for k in ('bus','psv','motor_vehicle','vehicle','access') if k in t),'yes')
            if access in DENIED or kind not in ROAD_CLASSES and access not in ('designated','permissive'): continue
            if t.get('tunnel','no')!='no' or t.get('area')=='yes': continue
            oneway=next((t[k] for k in ('oneway:bus','oneway:psv','oneway') if k in t),
                        'yes' if t.get('junction')=='roundabout' or kind=='motorway' else 'no')
            if t.get('busway','').startswith('opposite'): oneway='no'
            forward=oneway!='-1' and t.get('bus:forward')!='no'
            reverse=oneway in ('no','0','false','-1') and t.get('bus:backward')!='no'
            refs=[n.get('ref') for n in way.findall('nd')]
            for n in refs:
                if n not in self.coords and n in raw:
                    x,y=project.transform(*raw[n]); self.coords[n]=(x-ox,y-oy)
            for a,b in zip(refs,refs[1:]):
                if a not in self.coords or b not in self.coords: continue
                if forward:self.add(a,b,wid)
                if reverse:self.add(b,a,wid)
        for rel in osm.findall('relation'):
            t=tags(rel)
            if t.get('type')!='restriction' or set(t.get('except','').split(';')) & {'bus','psv'}:continue
            rule=t.get('restriction:bus',t.get('restriction:psv',t.get('restriction','')))
            members=rel.findall('member')
            via=[m for m in members if m.get('role')=='via']
            for m in via:
                if m.get('type')=='way':self.via_ways.add(m.get('ref'))
            if len(via)!=1 or via[0].get('type')!='node':continue
            for a in members:
                if a.get('role')!='from':continue
                for b in members:
                    if b.get('role')=='to':
                        self.restrictions[(via[0].get('ref'),a.get('ref'))].append((rule,b.get('ref')))
        self.tree=STRtree(self.edges)
        self.xy=[list(e.coords) for e in self.edges]
        self.length=[e.length for e in self.edges]

    def add(self,a,b,wid):
        p,q=self.coords[a],self.coords[b]
        if math.dist(p,q)<.05:return
        i=len(self.edges)
        self.nodes.append((a,b,wid));self.edges.append(LineString([p,q]));self.out[a].append(i)

    def turn(self,a,b):
        start,via,way=self.nodes[a]
        node,end,next_way=self.nodes[b]
        if via!=node or start==end:return False
        if way!=next_way and (way in self.via_ways or next_way in self.via_ways):return False
        for rule,target in self.restrictions.get((via,way),()):
            if rule.startswith('only_') and target!=next_way:return False
            if rule.startswith('no_') and target==next_way:return False
        return True

    def snap(self,p,dx,dy):
        best=None
        for idx in self.tree.query(box(p[0]-15,p[1]-15,p[0]+15,p[1]+15)):
            i=int(idx); a,b=self.xy[i];length=self.length[i]
            ux=(b[0]-a[0])/length;uy=(b[1]-a[1])/length
            dot=dx*ux+dy*uy
            if dot<.4:continue
            s=max(0,min(length,(p[0]-a[0])*ux+(p[1]-a[1])*uy))
            err=math.hypot(a[0]+ux*s-p[0],a[1]+uy*s-p[1])
            if err>14:continue
            rank=(err+7*(1-dot),i,s)
            if best is None or rank<best:best=rank
        return best[1:] if best else None

    def connect(self,first,last,source_length):
        i,s=first;j,t=last
        if i==j:return [(i,s,t)] if t>=s-.05 else None
        cap=source_length*1.8+8
        queue=[(self.length[i]-s,i,())]
        seen=set()
        while queue:
            d,edge,via=heappop(queue)
            if edge in seen or d+t>cap:continue
            seen.add(edge)
            for nxt in self.out[self.nodes[edge][1]]:
                if not self.turn(edge,nxt):continue
                if nxt==j:return [(i,s,self.length[i])]+[(k,0,self.length[k]) for k in via]+[(j,0,t)]
                if nxt not in seen:heappush(queue,(d+self.length[nxt],nxt,via+(nxt,)))
        return None

    def position(self,edge,s):
        a,b=self.xy[edge];u=s/self.length[edge]
        return (a[0]+u*(b[0]-a[0]),a[1]+u*(b[1]-a[1]))

    def match(self,coords):
        """Order-preserving road points labelled with source distance and way ID. Gaps break the run."""
        chains=[];chain=[];prev=None;last_m=0;total=0
        def anchor(p,m,dx,dy):
            nonlocal prev,last_m,chain
            cur=self.snap(p,dx,dy)
            parts=self.connect(prev,cur,m-last_m) if prev and cur else None
            if parts:
                real=sum(max(0,b-a) for _,a,b in parts)
                walked=0
                for edge,a,b in parts:
                    if b-a<.001:continue
                    wid=self.nodes[edge][2]
                    if not chain:chain=[(self.position(edge,a),last_m,wid)]
                    walked+=b-a
                    chain.append((self.position(edge,b),last_m+(m-last_m)*walked/real,wid))
            elif chain:
                chains.append(chain);chain=[]
            prev=cur;last_m=m
        for i,(p,q) in enumerate(zip(coords,coords[1:])):
            length=math.dist(p,q)
            if length<.01:continue
            dx=(q[0]-p[0])/length;dy=(q[1]-p[1])/length
            count=max(1,math.ceil(length/16))
            for k in range(count):
                u=k/count
                anchor((p[0]+u*(q[0]-p[0]),p[1]+u*(q[1]-p[1])),total+length*u,dx,dy)
            total+=length
            if i==len(coords)-2:anchor(q,total,dx,dy)
        if chain:chains.append(chain)
        return chains


class RoadClearance:
    """Prepared local pavement minus obstacles. Cache repeats where different lines share a street."""
    def __init__(self,data,style):
        self.boundary=make_valid(Polygon(data['boundary']));prepare(self.boundary)
        self.pavement=[LineString(r['line']).buffer(style['width']['main' if r['kind'] in style['main'] else 'street']/2)
                       for r in data['roads'] if r['kind'] not in style['pedestrian']]
        self.obstacles=[make_valid(Polygon(b['rings'][0],b['rings'][1:])) for b in data['buildings']]
        self.obstacles.extend(Point(x,y).buffer(.3) for x,y in data['trees'])
        self.obstacles.extend(make_valid(Polygon(s['rings'][0],s['rings'][1:])) for s in data['surfaces'] if s['kind']=='water')
        self.road_tree=STRtree(self.pavement); self.obstacle_tree=STRtree(self.obstacles)

    @lru_cache(maxsize=5000)
    def tile(self,x,y):
        region=box(x*120-35,y*120-35,(x+1)*120+35,(y+1)*120+35)
        roads=union_all([self.pavement[i] for i in self.road_tree.query(region)])
        pavement=roads.intersection(self.boundary)
        prepare(pavement)
        candidates=[self.obstacles[i] for i in self.obstacle_tree.query(region)]
        # The indexed halo contains many obstacles outside actual roadway.
        obstacles=union_all([o for o,hit in zip(candidates,intersects(pavement,candidates)) if hit])
        free=pavement.difference(obstacles)
        prepare(free)
        return free

    def fits(self,shape):
        x,y,_,_=shape.bounds
        return self.tile(math.floor(x/120),math.floor(y/120)).covers(shape)

    @staticmethod
    def body(p,dx,dy):
        return Polygon([(p[0]+f*dx-s*dy,p[1]+f*dy+s*dx)
                        for f,s in [(-3.6,-1.1),(3.6,-1.1),(3.6,1.1),(-3.6,1.1)]])

    @lru_cache(maxsize=200000)
    def straight(self,a,b):
        length=math.dist(a,b);dx=(b[0]-a[0])/length;dy=(b[1]-a[1])/length
        return self.fits(self.body(a,dx,dy).union(self.body(b,dx,dy)).convex_hull)

    @lru_cache(maxsize=200000)
    def corner(self,a,b,c):
        h=math.atan2(b[1]-a[1],b[0]-a[0]);g=math.atan2(c[1]-b[1],c[0]-b[0])
        angle=math.remainder(g-h,2*math.pi)
        if abs(angle)<1e-7:return True
        # A rotating corner follows an arc. Buffer the hull of each pair of poses
        # by the maximum arc sagitta, enclosing every intermediate orientation.
        n=max(1,math.ceil(abs(angle)/.22))
        pad=math.hypot(3.6,1.1)*(1-math.cos(angle/(2*n)))
        bodies=[self.body(b,math.cos(h+angle*k/n),math.sin(h+angle*k/n)) for k in range(n+1)]
        return all(self.fits(x.union(y).convex_hull.buffer(pad+.0001)) for x,y in zip(bodies,bodies[1:]))

    def verified(self,chain):
        # Offset to the right; limit the miter at acute turns. All checks run on
        # the rounded coordinates that the browser will actually receive.
        normals=[]
        cleaned=[chain[0]]
        for row in chain[1:]:
            x,y=cleaned[-1][0];u,v=row[0];d=math.hypot(u-x,v-y)
            if d<.03:continue
            normals.append(((v-y)/d,(x-u)/d));cleaned.append(row)
        if not normals:return
        vertices=[]
        for i,((x,y),m,wid) in enumerate(cleaned):
            ax,ay=normals[max(0,i-1)]; bx,by=normals[min(i,len(normals)-1)]
            scale=.95/max(.6,1+ax*bx+ay*by)
            point=(round(x+(ax+bx)*scale,2),round(y+(ay+by)*scale,2))
            if not vertices or point!=vertices[-1][0]:vertices.append((point,m,wid))
        run=[]
        for a,b in zip(vertices,vertices[1:]):
            if not self.straight(a[0],b[0]):
                if run:yield run
                run=[];continue
            if run and not self.corner(run[-2][0],a[0],b[0]):
                yield run;run=[]
            if not run:run=[a]
            run.append(b)
        if run:yield run
