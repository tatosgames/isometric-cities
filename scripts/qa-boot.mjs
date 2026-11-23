import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {preview} from 'vite';

const server = process.env.MAP_URL ? null : await preview({preview:{host:'127.0.0.1',port:0}});
const origin = process.env.MAP_URL ?? server.resolvedUrls.local[0];
const browser = await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});

async function delayFirst(page, pattern) {
  const requested = page.waitForRequest(pattern);
  const released = Promise.withResolvers();
  let held = false;
  await page.route(pattern, async route => {
    if (!held) {
      held = true;
      await released.promise;
    }
    await route.continue();
  });
  return {requested, release:released.resolve};
}

function ready(page) {
  return page.waitForSelector('#map[data-boot="ready"] #scene[data-view]', {timeout:25000});
}

async function swipe(page,x,fromY,toY) {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:fromY}]});
  for(let step=1;step<=6;step++){
    const y = fromY+(toY-fromY)*step/6;
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await session.detach();
}

async function timings(page) {
  return page.evaluate(() => Object.fromEntries(
    performance.getEntriesByType('mark').filter(entry => entry.name.startsWith('atlas:'))
      .map(entry => [entry.name.replace('atlas:startup-', ''), Math.round(entry.startTime)])
  ));
}

try {
  for (const mobile of [false,true]) {
    const page = await browser.newPage({
      viewport:mobile ? {width:390,height:844} : {width:1440,height:900},
      isMobile:mobile,hasTouch:mobile
    });
    const dataRequests = [];
    page.on('request',request => {
      if (/\/city-(core\.json|terrain\.bin)$/.test(request.url())) dataRequests.push(request.url());
    });
    const entry = await delayFirst(page,'**/assets/index-*.js');
    const core = await delayFirst(page,'**/data/city-core.json');
    const terrain = page.waitForRequest('**/data/city-terrain.bin');
    const zone = await delayFirst(page,'**/data/city-zones/*.json');
    const detail = await delayFirst(page,'**/data/city-sectors/*.json');
    await page.goto(origin,{waitUntil:'commit'});
    await entry.requested;
    await core.requested;
    await terrain;
    await page.waitForSelector('#boot-progress:not([aria-valuenow])');
    entry.release();
    await page.waitForLoadState('domcontentloaded');
    assert.equal(await page.getByRole('progressbar').isVisible(),true);
    assert.equal(await page.locator('footer').isVisible(),true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('footer a').first().evaluate(link => link === document.activeElement),true);
    await page.waitForFunction(() => Number(document.querySelector('#boot-progress').getAttribute('aria-valuenow')) > 12);
    core.release();
    await zone.requested;
    assert.equal(await page.locator('#map').getAttribute('data-boot'),'loading');
    zone.release();
    await detail.requested;
    assert.equal(await page.locator('#map').getAttribute('data-boot'),'loading');
    await page.waitForFunction(() => document.querySelector('#boot-progress').getAttribute('aria-valuenow') === '92');
    detail.release();
    await ready(page);
    assert.equal(await page.getByRole('progressbar').isVisible(),false);
    assert.equal(await page.locator('#boot-progress').getAttribute('aria-valuenow'),'100');
    assert.equal(await page.locator('#map-content').evaluate(content => content.inert),false);
    const credits = await page.locator('footer').boundingBox();
    const playButton = await page.getByRole('button',{name:'Play',exact:true}).boundingBox();
    assert.ok(credits && playButton && credits.x + credits.width < playButton.x);
    assert.equal(await page.locator('footer a').first().evaluate(link => link === document.activeElement),true);
    assert.equal(dataRequests.length,2,'Core and terrain must use the preloaded responses');
    const startup = await timings(page);
    assert.ok(startup.interactive > startup['ready-frame']);
    assert.ok(startup['stream-ready'] <= startup['ready-frame']);
    if(!mobile){
      await page.locator('#scene').press('ArrowRight');
      assert.equal(await page.locator('footer').isVisible(),false);
    }
    await page.getByRole('button',{name:'Play',exact:true}).click();
    await page.waitForSelector('#scene[data-drive^="ready"]');
    assert.equal(await page.locator('footer').isVisible(),false);
    const play = await page.evaluate(() => performance.getEntriesByName('atlas:play-first-frame').at(-1)?.duration);
    assert.ok(play > 0);
    if(mobile){
      assert.ok(await page.locator('#hud-time').evaluate(node =>
        getComputedStyle(node).userSelect === 'none' &&
        ['contextmenu','selectstart','dragstart'].every(type =>
          !node.dispatchEvent(new Event(type,{bubbles:true,cancelable:true}))
        )
      ));
      await swipe(page,250,120,360);
      await page.waitForSelector('#scene[data-drive^="playing"]');
      assert.equal(await page.evaluate(() => window.scrollY),0);
    }
    await page.locator('#drive-exit').click();
    assert.equal(await page.locator('#map > footer').count(),0);
    if(mobile)await page.setViewportSize({width:390,height:360});
    await page.locator('#index-toggle').click();
    assert.equal(await page.locator('footer').isVisible(),false);
    if(mobile){
      await swipe(page,55,240,100);
      await page.waitForFunction(() => document.querySelector('nav').scrollTop > 0);
      assert.equal(await page.evaluate(() => window.scrollY),0);
    }
    await page.getByText('Licencias de datos',{exact:true}).click();
    assert.equal(await page.getByRole('link',{name:'OpenStreetMap contributors'}).isVisible(),true);
    await page.locator('#index-toggle').click();
    await page.locator('#index-toggle').click();
    assert.equal(await page.locator('footer').isVisible(),false);
    console.log(mobile?'Mobile boot':'Desktop boot', startup, 'Play',Math.round(play),'ms');
    await page.close();
  }

  const slow = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const zone = await delayFirst(slow,'**/data/city-zones/*.json');
  await slow.goto(origin,{waitUntil:'domcontentloaded'});
  await zone.requested;
  await ready(slow);
  const fallback = await timings(slow);
  assert.ok(fallback['stream-fallback'] <= fallback['ready-frame']);
  assert.ok(fallback['ready-frame'] - fallback['base-frame'] >= 4000);
  await slow.getByRole('button',{name:'Play',exact:true}).tap();
  await slow.waitForSelector('#drive[aria-busy="true"]');
  assert.equal(await slow.locator('#hud').isHidden(),true);
  zone.release();
  await slow.waitForSelector('#scene[data-drive^="ready"]');
  assert.equal(await slow.locator('#drive').getAttribute('aria-busy'),null);
  await slow.close();
  console.log('Optional zone fallback and queued Play passed');

  const failed = await browser.newPage();
  let failedOnce = false;
  await failed.route('**/assets/index-*.js',async route => {
    if (failedOnce) await route.continue();
    else {
      failedOnce = true;
      await route.abort('failed');
    }
  });
  await failed.goto(origin,{waitUntil:'domcontentloaded'});
  const retry = failed.getByRole('button',{name:'Reintentar'});
  await retry.waitFor();
  assert.equal(await retry.evaluate(button => button === document.activeElement),true);
  assert.equal(await failed.locator('#map-content').evaluate(content => content.inert),true);
  await retry.click();
  await ready(failed);
  await failed.close();
  console.log('Module failure and retry passed');

  for (const persistent of [false,true]) {
    const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    let attempts = 0;
    await page.route('**/data/city-terrain.bin',route => {
      attempts++;
      return persistent || attempts === 1 ? route.fulfill({status:503}) : route.continue();
    });
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    if (persistent) {
      await page.getByRole('button',{name:'Reintentar'}).waitFor();
      assert.equal(await page.locator('#scene canvas').count(),0);
    } else {
      await ready(page);
      assert.equal(await page.getByRole('button',{name:'Reintentar'}).isVisible(),false);
    }
    assert.equal(attempts,2);
    await page.close();
  }
  console.log('Transient and persistent data failures passed');

  const background = await browser.newPage();
  await background.addInitScript(() => {
    window.bootHidden = true;
    window.bootWatchdogs = [];
    Object.defineProperty(document,'hidden',{get:() => window.bootHidden});
    const schedule = window.setTimeout;
    window.setTimeout = function (callback,delay,...args) {
      if (delay >= 24000 && delay <= 25000) window.bootWatchdogs.push(delay);
      return schedule(callback,delay,...args);
    };
  });
  const heldCore = await delayFirst(background,'**/data/city-core.json');
  await background.goto(origin,{waitUntil:'domcontentloaded'});
  await heldCore.requested;
  assert.deepEqual(await background.evaluate(() => window.bootWatchdogs),[]);
  await background.evaluate(() => {
    window.bootHidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await background.evaluate(() => window.bootWatchdogs.length),1);
  heldCore.release();
  await ready(background);
  await background.close();
  console.log('Startup watchdog pauses in background tabs');

  const unsupported = await browser.newPage();
  await unsupported.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type,...args) {
      return type === 'webgl2' ? null : getContext.call(this,type,...args);
    };
  });
  await unsupported.goto(origin,{waitUntil:'domcontentloaded'});
  await unsupported.getByRole('button',{name:'Reintentar'}).waitFor();
  assert.equal(await unsupported.locator('#scene').getAttribute('data-view'),null);
  await unsupported.close();
  console.log('WebGL unavailable passed');

  const interrupted = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await interrupted.addInitScript(() => {
    const render = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      if (!window.startupContext) {
        window.startupContext = this.getExtension('WEBGL_lose_context');
        window.startupContext.loseContext();
      }
      return render.apply(this,args);
    };
  });
  await interrupted.goto(origin,{waitUntil:'domcontentloaded'});
  await interrupted.waitForFunction(() => window.startupContext);
  await interrupted.waitForSelector('#boot-progress:not([aria-valuenow])');
  assert.equal(await interrupted.locator('#map').getAttribute('data-boot'),'loading');
  assert.equal(await interrupted.locator('#scene').getAttribute('data-view'),null);
  await interrupted.evaluate(() => window.startupContext.restoreContext());
  await ready(interrupted);
  await interrupted.close();
  console.log('WebGL loss before the first frame and restoration passed');

  const reveal = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await reveal.addInitScript(() => {
    new MutationObserver(() => {
      if (window.revealContext || document.querySelector('#map')?.dataset.boot !== 'revealing') return;
      window.revealContext = document.querySelector('#scene canvas').getContext('webgl2').getExtension('WEBGL_lose_context');
      window.revealContext.loseContext();
    }).observe(document,{subtree:true,attributes:true,attributeFilter:['data-boot']});
  });
  await reveal.goto(origin,{waitUntil:'domcontentloaded'});
  await reveal.waitForSelector('#map[data-boot="loading"] #boot-progress:not([aria-valuenow])');
  assert.equal(await reveal.locator('#boot').evaluate(boot => getComputedStyle(boot).opacity),'1');
  assert.equal(await reveal.locator('#map-content').evaluate(content => content.inert),true);
  await reveal.evaluate(() => window.revealContext.restoreContext());
  await ready(reveal);
  assert.equal(await reveal.locator('#boot-progress').getAttribute('aria-valuenow'),'100');
  await reveal.close();
  console.log('WebGL loss during the reveal restores the preloader');
} finally {
  await browser.close();
  await server?.httpServer.close();
}
