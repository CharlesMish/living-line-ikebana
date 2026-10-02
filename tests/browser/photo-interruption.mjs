/** Optional Playwright interruption test; disposable profile, synthetic data only. */
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
await mkdir(process.env.IKEBANA_EVIDENCE_DIR??'.',{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});const url=new URL(process.env.IKEBANA_URL??'http://127.0.0.1:4177');for(const key of ['workbench','photo','test'])url.searchParams.set(key,'1');await page.goto(url.href);await page.locator('[data-ready=true]').waitFor();
 const before=await page.evaluate(()=>({s:window.__IKEBANA_TEST__.getState(),a:window.__IKEBANA_TEST__.getAutosaveAudit()}));
 await page.evaluate(()=>{const tray=document.querySelector('#selected-cutting'),r=tray.getBoundingClientRect();tray.dispatchEvent(new PointerEvent('pointerdown',{pointerId:55,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0,buttons:1,bubbles:true}));});
 assert.equal((await page.evaluate(()=>window.__IKEBANA_TEST__.getState())).transaction.operation,'insert');
 await page.evaluate(()=>document.querySelector('#photo-open').click());await page.locator('#photo-dialog[open]').waitFor();
 assert.equal((await page.evaluate(()=>window.__IKEBANA_TEST__.getState())).transaction,null);
 await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:55,pointerType:'touch',buttons:0,bubbles:true})));
 await page.locator('#photo-close').click();await page.waitForFunction(()=>!document.querySelector('#photo-dialog').open);
 const after=await page.evaluate(()=>({s:window.__IKEBANA_TEST__.getState(),a:window.__IKEBANA_TEST__.getAutosaveAudit()}));
 assert.equal(after.s.canonicalHash,before.s.canonicalHash);assert.equal(after.s.successfulSeatOrdinal,before.s.successfulSeatOrdinal);assert.equal(after.s.posture,'arrange');assert.deepEqual(after.a,before.a);
 results.push('opening Photograph during insertion cancels, later release is inert, no ordinal or autosave write');
 await page.getByTestId('more-toggle').click();await page.locator('#photo-open').click();await page.locator('#photo-dialog[open]').waitFor();
 // Synthetic export failure then retry; native output is untouched.
 await page.evaluate(()=>{window.originalToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb){cb(null);};});
 await page.locator('#photo-export').click();await page.waitForFunction(()=>!document.querySelector('#photo-export').disabled);assert.match(await page.locator('#photo-message').textContent(),/could not create/);
 await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=window.originalToBlob;});
 const download=page.waitForEvent('download');await page.locator('#photo-export').click();await download;await page.waitForFunction(()=>!document.querySelector('#photo-export').disabled);
 results.push('PNG encoding failure releases busy state; retry produces a download');
 // Delayed callback then Close: no stale download and reopened session captures again.
 await page.evaluate(()=>{window.originalToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb,type){window.originalToBlob.call(this,b=>setTimeout(()=>cb(b),300),type);};});
 let downloads=0;page.on('download',()=>downloads++);
 await page.locator('#photo-export').click();await page.locator('#photo-close').click();await page.waitForTimeout(400);assert.equal(downloads,0);
 await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=window.originalToBlob;});
 results.push('Close during pending PNG encoding cancels delivery; session token prevents stale download');
 // Unknown v2 data must survive a failed Keep unchanged.
 await page.evaluate(async()=>{const{createWorkbenchFixture}=await import('/src/app/workbench.ts');const f=createWorkbenchFixture('reed',8278,1);localStorage.setItem('ikebana-web-alpha:workbench-studio-v1',JSON.stringify({storageVersion:1,nextSuccessfulOrdinal:2,plants:f.plants}));localStorage.setItem('ikebana-web-alpha:workbench-garden-v1','{"gardenVersion":99,"precious":"synthetic"}');});
 await page.reload();await page.locator('[data-ready=true]').waitFor();await page.getByTestId('more-toggle').click();await page.locator('#photo-open').click();await page.locator('#photo-keep').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('ikebana-web-alpha:workbench-garden-v1')),'{"gardenVersion":99,"precious":"synthetic"}');
 results.push('unsupported Garden version fails closed and keeps its exact bytes');
}finally{await browser.close();await writeFile((process.env.IKEBANA_EVIDENCE_DIR??'.')+'/photo-interruption-results.json',JSON.stringify(results,null,2));}
console.log(results);
