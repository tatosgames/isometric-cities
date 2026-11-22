import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const server=await createServer({server:{host:'127.0.0.1',port:0}});
await server.listen();
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
const root=server.resolvedUrls.local[0];
const dir='.cache/qa-visual-lab';
await mkdir(dir,{recursive:true});
try{
  for(const mobile of [false,true]){
    const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1040,height:720},isMobile:mobile,hasTouch:mobile});
    const faults=[];
    page.on('pageerror',e=>faults.push(e.message));
    page.on('console',m=>{if(m.type()==='error' && !m.text().includes('404'))faults.push(m.text());});
    await page.goto(root+'lab.html');
    const ready=zone=>page.waitForFunction(zone=>document.querySelector('#view')?.dataset.zone===zone&&document.querySelector('#view').dataset.ready==='true',zone);
    await ready('mercado');
    const select=(i,text)=>page.locator('select').nth(i).selectOption({label:text});
    const mode=id=>page.locator('[data-mode="'+id+'"]').click();
    const pixels=async id=>{
      await mode(id);
      return page.locator('#view').screenshot({style:'#tools,#credit,#divider{visibility:hidden}'});
    };
    const compare=async equal=>{
      const a=await pixels('A'),b=await pixels('B');assert.equal(a.equals(b),equal,'A and B comparison');
    };
    await compare(true);
    await select(2,'Suolo');await compare(false);
    await select(2,'Combinato');await compare(false);await mode('split');
    const download=async(label,path)=>{
      const pending=page.waitForEvent('download');
      await page.getByRole('button',{name:label,exact:true}).click();
      const file=await pending;await file.saveAs(path);
    };
    if(!mobile){
      for(const preset of ['Facciate','Tetti','Verde']){
        await select(2,preset);await compare(false);
      }
      await select(2,'Suolo + facciate');await mode('split');
      await download('Esporta ricetta',dir+'/mercado.json');
      await download('Scarica confronto PNG',dir+'/mercado.png');
      await page.getByRole('button',{name:'Usa B come riferimento'}).click();await compare(true);
      for(const [zone,id] of [['Plaza de Santa Ana','santa-ana'],['Calle Mayor de Triana','triana'],['Parque Doramas','doramas'],['Isolato in pendenza','pendio']]){
        await select(0,zone);await ready(id);
      }
      await page.getByRole('button',{name:'Ripristina originale'}).click();await select(2,'Pendio');await compare(false);
      await select(1,'Guida');await mode('split');
      await download('Esporta ricetta',dir+'/pendio.json');
      await download('Scarica confronto PNG',dir+'/pendio.png');
      await page.locator('#file').setInputFiles(dir+'/mercado.json');await ready('mercado');
      const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('las-palmas:visual-lab:v1')));
      const exported=JSON.parse(await readFile(dir+'/mercado.json','utf8'));
      assert.deepEqual(stored.b,exported.b);
      assert.ok(Math.abs(stored.camera.span-exported.camera.span)<1e-6);
      for(const key of ['target','position'])assert.ok(stored.camera[key].every((v,i)=>Math.abs(v-exported.camera[key][i])<1e-6));
      await page.getByRole('button',{name:'Misura A/B'}).click();
      await page.waitForFunction(()=>document.querySelector('#metrics')?.textContent.includes('Δ'),null,{timeout:120000});
      console.log(await page.locator('#metrics').innerText());
      // Independent reference: render the same bounded data through the unchanged four-argument entry point.
      assert.ok(await page.evaluate(async()=>{
        const [{makeCity},{buildStudy,defaults,foundation,subset}]=await Promise.all([import('/src/render/scene.ts'),import('/src/lab/variants.ts')]);
        const [city,s,tones]=await Promise.all(['data/city.json','src/lab/samples/mercado.json','data/roof-tones.json'].map(url=>fetch(url).then(r=>r.json())));
        const data=subset(city,s),base=makeCity(data,false,tones.tones,true),lab=buildStudy(data,s,new Image(),tones.tones,true,{...defaults});
        const meshes=base.group.children,others=lab.group.children;
        const same=meshes.length===others.length&&meshes.every((m,i)=>Object.entries(m.geometry.attributes).every(([key,attr])=>{
          const ref=others[i].geometry.attributes[key].array;
          return attr.array.length===ref.length&&attr.array.every((v,j)=>v===ref[j]);
        }));
        const ring=[[0,0],[9,0],[9,10],[0,10],[0,0]], rotated=[...ring.slice(1),ring[1]];
        const b={id:1,height:8,rings:[ring]},alt=(x,y)=>x*.4+y*.25;
        return same&&foundation(b,alt).base===foundation({...b,rings:[rotated]},alt).base;
      }));
    }
    if(!mobile)await checkVisualRules(page);
    await select(2,'Originale');await page.getByRole('button',{name:'Ripristina originale'}).click();
    const rect=await page.locator('#view').boundingBox();await page.mouse.move(rect.x+rect.width*.43,rect.y+rect.height*.5);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.55,rect.y+rect.height*.6,{steps:5});await page.mouse.up();
    await page.setViewportSize(mobile?{width:844,height:390}:{width:900,height:650});await compare(true);
    assert.deepEqual(faults,[]);await page.close();console.log(mobile?'Mobile passed':'Desktop passed');
  }
}finally{await browser.close();await server.close();}

async function checkVisualRules(page){
  const results=await page.evaluate(async()=>{
    const {buildStudy,defaults}=await import('/src/lab/variants.ts');
    const ring=[[0,0],[12,0],[12,12],[0,12],[0,0]],hole=[[5,5],[5,7],[7,7],[7,5],[5,5]];
    const data={boundary:[],textureBounds:[-4,-4,16,16],ground:[],buildings:[{id:7,height:15,rings:[ring,hole]}],trees:[],
      roads:[{id:'45',kind:'footway',line:[[-3,-2],[15,-2]]}],surfaces:[],terrain:{origin:[-20,20],step:50,w:2,h:2,values:[0,0,0,0]}};
    const s={bounds:data.textureBounds,roofBounds:data.textureBounds,faces:{0:[[1,[[0,.5,5]]],null,null,null]},trees:{},surfaces:{}};
    const photo=new Image(20,20);
    function make(options){return buildStudy(data,s,photo,{},true,{...defaults,...options});}
    function paint(options){
      const model=make(options),canvas=model.groundMap.texture.image;
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.join(',');
      model.dispose();return pixels;
    }
    const original=paint({}),missing=paint({osm:true});
    s.surfaces['45']='sett';
    const tagged=paint({osm:true});data.roads[0].kind='steps';
    const stairs=paint({steps:true});
    const model=make({shared:true,roof:.5,area:50});
    function hasCorner(x,y){return model.group.children.some(mesh=>{
      const a=mesh.geometry.attributes.position;
      for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i)-x)<.001&&Math.abs(a.getY(i)-y)<.001&&Math.abs(a.getZ(i)-.07)<.001)return true;
      return false;
    });}
    // The left bay is occluded up to 5 m. The upper floor and the right bay remain exposed.
    const partial=!hasCorner(2.26,3)&&hasCorner(2.26,6.6)&&hasCorner(8.26,3);
    const roofs=model.group.children.filter(m=>m.geometry.attributes.surface.array.every(v=>v===4));
    const areas=roofs.flatMap(m=>{
      const a=m.geometry.attributes.position,out=[];
      for(let i=0;i<a.count;i+=3){
        const cross=(a.getX(i+1)-a.getX(i))*(a.getZ(i+2)-a.getZ(i))-(a.getX(i+2)-a.getX(i))*(a.getZ(i+1)-a.getZ(i));
        out.push(Math.abs(cross)/2);
      }
      return out;
    });
    model.dispose();return {missing:original===missing,material:tagged!==original,steps:stairs!==original,partial,courtyard:areas.reduce((a,b)=>a+b,0)===140};
  });
  assert.deepEqual(results,{missing:true,material:true,steps:true,partial:true,courtyard:true});
}
