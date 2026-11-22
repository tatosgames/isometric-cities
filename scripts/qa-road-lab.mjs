import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {preview} from 'vite';
import {chromium} from 'playwright';

const server=process.env.LAB_URL?null:await preview({preview:{port:0,host:'127.0.0.1'}});
const url=process.env.LAB_URL||new URL('lab.html?test=strade',server.resolvedUrls.local[0]).href;
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
try{
  await mkdir('.cache/road-lab',{recursive:true});
  for(const mobile of [false,true]){
    const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1024,height:720},hasTouch:mobile,isMobile:mobile});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(url);
    await page.waitForSelector('#view[data-ready=true]');
    const variant=page.locator('select'),view=page.locator('#view');
    const captured=[];
    for(let i=0;i<3;i++){
      await variant.selectOption({index:i});
      assert.equal(await view.getAttribute('data-road-mode'),String(i));
      captured.push(await view.screenshot({path:'.cache/road-lab/'+(mobile?'mobile':'desktop')+'-'+i+'.png'}));
    }
    assert.ok(!captured[0].equals(captured[1])&&!captured[1].equals(captured[2]));
    await page.getByRole('button',{name:'Avvia percorso'}).click();
    await page.waitForFunction(()=>Number(document.querySelector('.lil-gui input').value)>1);
    await page.getByRole('button',{name:'Pausa',exact:true}).click();
    const progress=await page.locator('.lil-gui input').inputValue();
    await variant.selectOption({index:1});assert.equal(await page.locator('.lil-gui input').inputValue(),progress);
    await page.getByRole('button',{name:'Riparti da Calle Pelota'}).click();
    assert.equal(Number(await page.locator('.lil-gui input').inputValue()),0);
    if(mobile){
      await page.getByRole('button',{name:'Misura le tre rese'}).click();
      await page.waitForFunction(()=>document.querySelector('#metrics').textContent.includes('Carreggiata geometrica'),null,{timeout:120000});
      console.log(await page.locator('#metrics').textContent());
      assert.equal(await view.getAttribute('data-road-mode'),'1');
    }
    assert.deepEqual(errors,[]);await page.close();
  }
}finally{await browser.close();await server?.close();}
