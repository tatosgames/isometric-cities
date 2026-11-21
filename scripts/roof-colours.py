"""Build a subdued local roof-colour atlas from an IGN PNOA orthophoto."""
from pathlib import Path
from urllib.parse import urlencode
import json
import subprocess
import sys
sys.path.insert(0, str(Path('.cache/pylib').resolve()))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pyproj import Transformer

# One metre per pixel, east/north relative to the common scene origin.
west, south, width, height = -410, -850, 800, 1500
ox, oy = Transformer.from_crs(4326, 4083, always_xy=True).transform(-15.415, 28.105)
params = dict(SERVICE='WMS', VERSION='1.3.0', REQUEST='GetMap', LAYERS='OI.OrthoimageCoverage',
              STYLES='', CRS='EPSG:4083', FORMAT='image/jpeg', WIDTH=width, HEIGHT=height,
              BBOX=','.join(map(str, [ox+west, oy+south, ox+west+width, oy+south+height])))
source = Path('.cache/pnoa-roofs.jpg')
if not source.exists():
    subprocess.run(['curl','-fsSL','--max-time','60','https://www.ign.es/wms-inspire/pnoa-ma?'+urlencode(params),'-o',str(source)],check=True)
with Image.open(source) as im:
    assert im.size == (width,height)
    # Suppress narrow aerial shadows and tiny roof furniture before applying live lighting.
    smooth = im.convert('RGB').filter(ImageFilter.MedianFilter(5))
    rgb = np.asarray(smooth,dtype=float)
    shade = np.maximum(0, 105-rgb.mean(axis=2,keepdims=True))
    rgb = np.clip(rgb + shade*.67,0,255)
    Image.fromarray(rgb.astype('uint8')).save('public/data/roof-colours.webp',quality=86)
# Robust midtone from the inside of each footprint; holes and dark occlusions do not set its hue.
colours = {}
for stage in ['pilot','city']:
    scene = json.loads(Path('public/data/'+stage+'.json').read_text(encoding='utf8'))
    for b in scene['buildings']:
        rings = [[(x-west,height-1-(y-south)) for x,y in ring] for ring in b['rings']]
        xs,ys=zip(*rings[0])
        x0,y0,x1,y1=int(min(xs)),int(min(ys)),int(max(xs))+1,int(max(ys))+1
        mask=Image.new('L',(x1-x0,y1-y0))
        draw=ImageDraw.Draw(mask)
        for i,ring in enumerate(rings):
            draw.polygon([(x-x0,y-y0) for x,y in ring],fill=0 if i else 255)
        pixels=rgb[y0:y1,x0:x1][np.asarray(mask)>0]
        key=str(b['id'])+('-nave' if b['cathedral'] else '')
        if len(pixels)<4: continue
        brightness=pixels.mean(axis=1)
        lo,hi=np.percentile(brightness,[35,85])
        sample=np.median(pixels[(brightness>=lo)&(brightness<=hi)],axis=0)
        if np.isfinite(sample).all(): colours[key]='#'+''.join(f'{int(c):02x}' for c in sample)
    points=scene['boundary']
    assert all(west<=x<=west+width and south<=y<=south+height for x,y in points)
Path('public/data/roof-tones.json').write_text(json.dumps(colours,separators=(',',':')))
print('Roof colour extent (west, south, width, height)', west,south,width,height)

