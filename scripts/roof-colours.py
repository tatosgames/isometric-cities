"""Build a subdued local roof-colour atlas from an IGN PNOA orthophoto."""
from pathlib import Path
from urllib.parse import urlencode
import json
import sys
sys.path.insert(0, str(Path('.cache/pylib').resolve()))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pyproj import Transformer

# Keep the 1 m grid fixed to the original scene origin. Adjacent requests share edges.
from source_cache import fetch
from math import floor, ceil
stages = [json.loads(Path(f'public/data/{s}.json').read_bytes()) for s in ('pilot','city')]
xs,ys = zip(*(p for stage in stages for p in stage['boundary']))
west,south=floor(min(xs))-8,floor(min(ys))-8
width,height=ceil(max(xs))-west+8,ceil(max(ys))-south+8
ox, oy = Transformer.from_crs(4326, 4083, always_xy=True).transform(-15.415, 28.105)
def mosaic():
    image=Image.new('RGB',(width,height))
    for x in range(0,width,1024):
        for y in range(0,height,1024):
            w,h=min(1024,width-x),min(1024,height-y)
            bounds=[ox+west+x,oy+south+y,ox+west+x+w,oy+south+y+h]
            params=dict(SERVICE='WMS',VERSION='1.3.0',REQUEST='GetMap',LAYERS='OI.OrthoimageCoverage',
                STYLES='',CRS='EPSG:4083',FORMAT='image/jpeg',WIDTH=w,HEIGHT=h,BBOX=','.join(f'{v:.3f}' for v in bounds))
            url='https://www.ign.es/wms-inspire/pnoa-ma?'+urlencode(params)
            with Image.open(fetch('roof.jpg',url)) as tile:
                assert tile.size==(w,h)
                image.paste(tile,(x,height-y-h))
    return image
with mosaic() as im:
    # Suppress narrow aerial shadows and tiny roof furniture before applying live lighting.
    smooth = im.convert('RGB').filter(ImageFilter.MedianFilter(5))
    rgb = np.asarray(smooth,dtype=np.float32)
    shade = np.maximum(0, 105-rgb.mean(axis=2,keepdims=True))
    rgb = np.clip(rgb + shade*.67,0,255)
    atlas=Image.fromarray(rgb.astype('uint8'))
    atlas.save('.cache/roof-atlas.png')
    atlas.resize((max(1,width//2),max(1,height//2)),Image.Resampling.LANCZOS).save('public/data/roof-colours.webp',quality=86)
# Robust midtone from the inside of each footprint; holes and dark occlusions do not set its hue.
colours = {}
for scene in stages:
    for b in scene['buildings']:
        rings = [[(x-west,height-1-(y-south)) for x,y in ring] for ring in b['rings']]
        xs,ys=zip(*rings[0])
        x0,y0,x1,y1=int(min(xs)),int(min(ys)),int(max(xs))+1,int(max(ys))+1
        mask=Image.new('L',(x1-x0,y1-y0))
        draw=ImageDraw.Draw(mask)
        for i,ring in enumerate(rings):
            draw.polygon([(x-x0,y-y0) for x,y in ring],fill=0 if i else 255)
        pixels=rgb[y0:y1,x0:x1][np.asarray(mask)>0]
        key=str(b['id'])+b.get('toneSuffix','')
        if len(pixels)<4: continue
        brightness=pixels.mean(axis=1)
        lo,hi=np.percentile(brightness,[35,85])
        sample=np.median(pixels[(brightness>=lo)&(brightness<=hi)],axis=0)
        if np.isfinite(sample).all(): colours[key]='#'+''.join(f'{int(c):02x}' for c in sample)
    points=scene['boundary']
    assert all(west<=x<=west+width and south<=y<=south+height for x,y in points)
Path('public/data/roof-tones.json').write_text(json.dumps(dict(tones=colours,bounds=[west,south,width,height]),separators=(',',':')))
print('Roof colour extent (west, south, width, height)', west,south,width,height)

