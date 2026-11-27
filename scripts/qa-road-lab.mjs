import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {preview} from 'vite';
import {launchBrowser} from './qa-browser.mjs';

const server=process.env.LAB_URL?null:await preview({preview:{port:0,host:'127.0.0.1'}});
const url=process.env.LAB_URL||new URL('lab.html?lab=roads',server.resolvedUrls.local[0]).href;
const browser=await launchBrowser();
try{
  await mkdir('.cache/road-lab',{recursive:true});
  for(const mobile of [false,true]){
    const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1024,height:720},hasTouch:mobile,isMobile:mobile});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const catalog=new URL(url);catalog.search='';
    await page.goto(catalog.href);
    await page.getByRole('link',{name:'Map, LOD & roads'}).click();
    await page.waitForSelector('#view[data-ready=true]');
    assert.equal(await page.getByLabel('Scenario',{exact:true}).inputValue(),'mercado');
    const variant=page.locator('#gui select'),view=page.locator('#view');
    const captured=[];
    for(let i=0;i<2;i++){
      await variant.selectOption({index:i});
      assert.equal(await view.getAttribute('data-road-mode'),String(i));
      captured.push(await view.screenshot({path:'.cache/road-lab/'+(mobile?'mobile':'desktop')+'-'+i+'.png'}));
    }
    assert.ok(!captured[0].equals(captured[1]));
    await page.locator('#compare').check();
    await page.locator('#split').fill('50');
    const split=await view.screenshot({style:'#tools,#divider,#credit{visibility:hidden}'});
    await page.locator('#split').fill('25');
    const moved=await view.screenshot({style:'#tools,#divider,#credit{visibility:hidden}'});
    assert.ok(!split.equals(moved),'Changing the divider should reveal different road pixels');
    await page.locator('#compare').uncheck();
    await page.getByRole('button',{name:'Start route'}).click();
    await page.waitForFunction(()=>Number(document.querySelector('.lil-gui input').value)>1);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    const progress=await page.locator('.lil-gui input').inputValue();
    await variant.selectOption({index:1});assert.equal(await page.locator('.lil-gui input').inputValue(),progress);
    await page.getByRole('button',{name:'Restart from Calle Pelota'}).click();
    assert.equal(Number(await page.locator('.lil-gui input').inputValue()),0);
    if(mobile){
      await page.getByRole('button',{name:'Measure the two renderings'}).click();
      await page.waitForFunction(()=>document.querySelector('#metrics').textContent.includes('Painted roads'),null,{timeout:120000});
      console.log(await page.locator('#metrics').textContent());
      assert.equal(await view.getAttribute('data-road-mode'),'1');
    }
    if(!mobile){
      await page.context().grantPermissions(['clipboard-read','clipboard-write']);
      await page.getByRole('button',{name:'Copy link'}).click();
      await page.getByRole('button',{name:'Link copied'}).waitFor();
      const share=await page.evaluate(()=>navigator.clipboard.readText());
      await page.goto(share);
      await page.waitForSelector('#view[data-ready=true][data-road-mode="1"]');
      await page.getByLabel('Scenario',{exact:true}).selectOption('lod');
      await page.waitForSelector('#view[data-ready=true][data-lod-changes]');
      assert.equal(new URL(page.url()).searchParams.get('case'),'lod');
    }
    assert.deepEqual(errors,[]);await page.close();
  }
}finally{await browser.close();await server?.close();}
