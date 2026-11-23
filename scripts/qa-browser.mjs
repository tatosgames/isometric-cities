// Shared start-up for the browser checks: one place to choose the browser and to serve the build.
import {chromium} from 'playwright';
import {preview} from 'vite';

/**
 * Chrome with software WebGL, as every check has always used. Set CHROME_PATH to run another
 * Chromium build instead (for example the one Playwright installs on Linux).
 */
export function launchBrowser(extraArgs=[]){
  const args=['--enable-unsafe-swiftshader',...extraArgs];
  const executablePath=process.env.CHROME_PATH;
  return chromium.launch(executablePath?{executablePath,args}:{channel:'chrome',args});
}

/**
 * Serve the production build on a free local port, unless `env` names a running map to use instead.
 * `server` is null in that case; `origin` keeps the server's trailing slash.
 */
export async function serveMap({env='MAP_URL',outDir}={}){
  const external=env && process.env[env];
  const server=external?null:await preview({...(outDir?{build:{outDir}}:{}),preview:{host:'127.0.0.1',port:0,open:false}});
  return {server,origin:external||server.resolvedUrls.local[0]};
}
