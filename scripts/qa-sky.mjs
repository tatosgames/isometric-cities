import assert from 'node:assert/strict';
import {launchBrowser,serveMap} from './qa-browser.mjs';

// Repeat the quality toggle before exercising the same path in the browser.
const {makeSkyEffects}=await import('../src/render/sky-effects.ts');
const {Scene,OrthographicCamera,Vector3}=await import('three');
const scene=new Scene(),effects=makeSkyEffects(scene,[{x:0,y:35,z:0}]);
const camera=new OrthographicCamera(-200,200,150,-150),target=new Vector3();
effects.setEnabled(false);effects.update(camera,target,false);
assert.equal(scene.children.length,0);
effects.setEnabled(true);const group=scene.children[0],children=[...group.children];
effects.setEnabled(true);assert.deepEqual(group.children,children);
effects.setEnabled(false);assert.equal(scene.children.length,0);
effects.setEnabled(true);assert.equal(scene.children[0],group);
assert.deepEqual(group.children,children);effects.dispose();assert.equal(scene.children.length,0);

const {server,origin}=await serveMap();
const browser=await launchBrowser();
try{
  for(const mobile of [false,true]){
    const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.addInitScript(()=>{
      const gl=WebGL2RenderingContext.prototype, use=gl.useProgram,programs=new WeakMap();
      window.skyDraws={birds:0,clouds:0};
      let kind;
      gl.useProgram=function(p){
        if(p && !programs.has(p)){
          const shaders=this.getAttachedShaders(p).map(s=>this.getShaderSource(s)).join(' ');
          programs.set(p,shaders.includes('uniform float skyTime')?'birds':shaders.includes('windTime,opacity')?'clouds':'');
        }
        kind=p && programs.get(p);return use.call(this,p);
      };
      for(const name of ['drawArraysInstanced','drawElements']){
        const draw=gl[name];gl[name]=function(...args){if(kind)window.skyDraws[kind]++;return draw.apply(this,args);};
      }
    });
    const open=async query=>{
      await page.goto(new URL('index.html?at=parque-doramas&'+query,origin).href);
      await page.waitForSelector('#scene[data-view]',{timeout:120000});
    };
    const quality=enabled=>page.evaluate(value=>window.dispatchEvent(new CustomEvent('atlas:sky-quality',{detail:value})),enabled);
    const draws=()=>page.evaluate(()=>({...window.skyDraws}));
    await open('off=sky');await quality(true);await page.waitForTimeout(700);
    assert.deepEqual(await draws(),{birds:0,clouds:0});
    const view=await page.locator('#scene').getAttribute('data-view');
    await open('');
    assert.equal(await page.locator('#scene').getAttribute('data-view'),view);
    await page.waitForFunction(()=>skyDraws.birds>2 && skyDraws.clouds>2);
    await page.waitForTimeout(20000);
    if(!mobile)await page.screenshot({path:'docs/screenshots/sky-doramas.png'});
    for(let i=0;i<2;i++){
      await quality(false);const before=await draws();await page.waitForTimeout(700);
      assert.deepEqual(await draws(),before);
      await quality(true);await page.waitForFunction(n=>skyDraws.birds>n, before.birds);
    }
    const ext=await page.evaluateHandle(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context'));
    await ext.evaluate(e=>e.loseContext());await page.waitForSelector('#status:visible');
    const before=await draws();await ext.evaluate(e=>e.restoreContext());
    await page.waitForFunction(n=>skyDraws.birds>n,before.birds,{timeout:90000});
    await page.mouse.move(160,300);await page.mouse.down();await page.mouse.move(180,315,{steps:5});await page.mouse.up();
    await page.mouse.wheel(0,-120);await page.waitForTimeout(500);
    await page.goto(new URL('index.html?lab=drive&off=police,buses&at=-1340,1762',origin).href);
    await page.waitForSelector('#scene[data-lab-ready=true][data-drive]',{timeout:120000});
    await page.locator('#scene').focus();await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(()=>document.querySelector('#scene').dataset.drive.startsWith('playing'));
    assert.deepEqual(errors,[]);
    await page.close();console.log('Sky effects: map, toggle, restore and drive passed on '+(mobile?'mobile':'desktop'));
  }
}finally{await browser.close();await server?.close();}
