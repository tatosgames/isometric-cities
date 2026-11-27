import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const out='.cache/qa-carriageways/larghezze';
await mkdir(out,{recursive:true});
const {server}=await serveMap({env:null});
const browser=await launchBrowser();
try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const host=page.locator('#view');
  const settle=()=>page.waitForFunction(()=>{
    const h=document.querySelector('#view'),s=JSON.parse(h.dataset.sectors||'{}');
    return s.visible===1&&!s.pending&&h.dataset.position==='50';
  });
  await page.goto(server.resolvedUrls.local[0]+'lab.html?lab=roads&case=widths');
  for(const [section,wide,old] of [['ordinaria','5','4.5'],['principale','9','8'],['vincolata','4.75','4.5']]){
    await page.locator('.lil-gui select').selectOption({label:section});
    await settle();
    const before=page.getByText('Previous width',{exact:true}).locator('..').locator('input');
    for(const [previous,width] of [[true,old],[false,wide]]){
      await before.setChecked(previous);
      await page.waitForURL(url=>(url.searchParams.get('on')??'').split(',').includes('before')===previous);
      await settle();
      assert.ok((await page.locator('#status').textContent()).includes(' '+width+' m'));
      await host.screenshot({path:out+'/'+section+(previous?'-prima':'-dopo')+'.png'});
    }
    const [oldImage,newImage]=await Promise.all(['prima','dopo'].map(v=>readFile(out+'/'+section+'-'+v+'.png')));
    assert.ok(!oldImage.equals(newImage),'Le due larghezze devono produrre immagini diverse');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await server.close();}
