import assert from 'node:assert/strict';
import {launchBrowser, serveMap} from './qa-browser.mjs';

/** Browser smoke checks for lazy, nearby-only guagua traffic. */
const browser = await launchBrowser();
const {server, origin} = await serveMap();
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  const requests = [];
  page.on('request', request => {
    if (request.url().includes('/data/guaguas')) requests.push(request.url());
  });
  await page.goto(new URL('/?area=pilot', origin).href);
  await page.waitForSelector('#scene[data-view]', {timeout: 60000});
  assert.equal(requests.length, 0, 'Map mode must not load guagua data');
  await page.goto(new URL('/?lab=guida&area=pilot&start=-60,-818', origin).href);
  await page.waitForFunction(() => document.querySelector('#scene')?.dataset.labReady === 'true', null, {timeout: 60000});
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(() => {
    const value = document.querySelector('#scene')?.dataset.guaguas;
    if (!value) return false;
    const state = JSON.parse(value);
    return Array.isArray(state.active) && state.active.length <= 6;
  }, null, {timeout: 60000});
  const state = JSON.parse(await page.locator('#scene').getAttribute('data-guaguas'));
  assert.ok(state.active.every(bus => typeof bus.id === 'string' && typeof bus.line === 'string' && Number.isFinite(bus.x) && Number.isFinite(bus.y)));
  assert.equal(state.errors.length, 0, state.errors.join('; '));
  await page.keyboard.up('ArrowDown');
  const before = requests.length;
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#scene')?.dataset.guaguas, null, {timeout: 60000});
  assert.equal(requests.length, before, 'Reload should reuse the local indexed data without unbounded requests');
  await page.goto(new URL('/?lab=guida&area=pilot&start=-60,-818&nobuses', origin).href);
  await page.waitForFunction(() => document.querySelector('#scene')?.dataset.labReady === 'true', null, {timeout: 60000});
  const disabled = await page.locator('#scene').getAttribute('data-guaguas');
  assert.ok(!disabled || JSON.parse(disabled).active.length === 0, 'nobuses must disable nearby traffic');
  console.log('Guagua fleet browser QA passed (map lazy-load, nearby cap, reload, nobuses)');
} finally {
  await browser.close();
  await server?.close();
}
