/** Optional Playwright study. Uses only a disposable profile and repository synthetic fixtures.
 * IKEBANA_URL / IKEBANA_BASELINE_URL / IKEBANA_EVIDENCE_DIR select local servers and output. */
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const dir=process.env.IKEBANA_EVIDENCE_DIR ?? 'artifacts/photo-study';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const results={checks:[],errors:[]};
try {
 const context=await browser.newContext({viewport:{width:1280,height:1000},acceptDownloads:true});
 const page=await context.newPage();page.on('pageerror',e=>results.errors.push(String(e)));
 const studyURL=new URL(process.env.IKEBANA_URL??'http://127.0.0.1:4177');for(const key of ['workbench','test','photo'])studyURL.searchParams.set(key,'1');await page.goto(studyURL.href);await page.locator('[data-ready=true]').waitFor();
 await page.evaluate(async()=>{
  const fixture=await(await fetch('/tests/fixtures/polish-baseline-arrangements.plants.json')).json();
  const arrangement=fixture.arrangements[0];
  const {canonicalCameraPose}=await import('/src/app/camera.ts');
  localStorage.setItem('ikebana-web-alpha:workbench-garden-v1',JSON.stringify({gardenVersion:1,entries:[{id:'legacy-synthetic',title:'Earlier synthetic moment',keptAt:'2026-09-01T12:00:00Z',thumbnail:null,arrangement:{plants:arrangement.plants,successfulPlantOrdinal:arrangement.successfulPlantOrdinal,camera:canonicalCameraPose('front')}}]}));
  localStorage.setItem('ikebana-web-alpha:workbench-studio-v1',JSON.stringify({storageVersion:1,savedAt:new Date().toISOString(),nextSuccessfulOrdinal:arrangement.successfulPlantOrdinal+1,plants:arrangement.plants}));
 });
 await page.reload();await page.locator('[data-ready=true]').waitFor();
 await page.getByTestId('posture-step-back').click();
 const initial=await page.evaluate(()=>({state:window.__IKEBANA_TEST__.getState(),audit:window.__IKEBANA_TEST__.getAutosaveAudit(),snapshot:window.__IKEBANA_TEST__.getCanonicalSnapshot(),storage:localStorage.getItem('ikebana-web-alpha:workbench-studio-v1')}));
 await writeFile(`${dir}/synthetic-arrangement.json`,JSON.stringify(initial.snapshot,null,2));
 await page.screenshot({path:`${dir}/candidate-clean-studio.png`});
 const baseline=await context.newPage();const baselineURL=new URL(process.env.IKEBANA_BASELINE_URL??'http://127.0.0.1:4178');for(const key of ['workbench','test'])baselineURL.searchParams.set(key,'1');await baseline.goto(baselineURL.href);await baseline.locator('[data-ready=true]').waitFor();
 await baseline.evaluate(raw=>localStorage.setItem('ikebana-web-alpha:workbench-studio-v1',raw),initial.storage);await baseline.reload();await baseline.locator('[data-ready=true]').waitFor();await baseline.getByTestId('posture-step-back').click();
 await baseline.screenshot({path:`${dir}/baseline-clean-studio.png`});
 assert.equal(await baseline.evaluate(()=>window.__IKEBANA_TEST__.getState().canonicalHash),initial.state.canonicalHash);
 await baseline.close();
 await page.getByTestId('more-toggle').click();await page.locator('#photo-open').click();await page.locator('#photo-dialog[open]').waitFor();
 const set=async(id,value)=>{await page.locator(`#photo-${id}`).fill(value);await page.locator(`#photo-${id}`).dispatchEvent('input');};
 await set('zoom','1.3');
 const capture=async(name)=>{
  const downloadPromise=page.waitForEvent('download');await page.locator('#photo-export').click();const download=await downloadPromise;await download.saveAs(`${dir}/${name}.png`);
  await page.waitForFunction(()=>!document.querySelector('#photo-export').disabled);
 };
 await capture('paper-ground-clean');await page.screenshot({path:`${dir}/photo-controls-desktop.png`});
 await page.locator('#photo-perch').selectOption('stone');await capture('paper-stone');
 await page.locator('#photo-backdrop').selectOption('sage');await capture('sage-stone');
 await page.locator('#photo-backdrop').selectOption('dusk');await page.locator('#photo-perch').selectOption('bench');await page.locator('#photo-view').selectOption('three-quarter');await set('zoom','1.25');await capture('dusk-bench');
 await page.locator('#photo-format').selectOption('portrait');await capture('portrait-dusk');
 await page.locator('#photo-backdrop').selectOption('transparent');await capture('portrait-transparent');
 assert.equal(await page.locator('#photo-perch').isEnabled(),false);
 await page.locator('#photo-format').selectOption('square');await capture('square-transparent');
 await page.locator('#photo-format').selectOption('landscape');await page.locator('#photo-backdrop').selectOption('paper');await page.locator('#photo-perch').selectOption('ground');await page.locator('#photo-view').selectOption('front');await set('zoom','1.8');
 await capture('fiber-baseline');await page.locator('#photo-fibers').check();await capture('fiber-candidate');await page.locator('#photo-fibers').uncheck();await capture('fiber-restored');
 const beforeKeep=await page.evaluate(()=>({state:window.__IKEBANA_TEST__.getState(),audit:window.__IKEBANA_TEST__.getAutosaveAudit(),storage:localStorage.getItem('ikebana-web-alpha:workbench-studio-v1')}));
 assert.equal(beforeKeep.state.canonicalHash,initial.state.canonicalHash);assert.equal(beforeKeep.state.cameraHash,initial.state.cameraHash);assert.deepEqual(beforeKeep.audit,initial.audit);assert.equal(beforeKeep.storage,initial.storage);
 results.checks.push('staging/framing/exports/fiber toggles preserve canonical, main camera, ordinal, autosave');
 // A failed explicit Keep must leave both documents intact.
 const gardenBefore=await page.evaluate(()=>localStorage.getItem('ikebana-web-alpha:workbench-garden-v1'));
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.includes('garden-v1'))throw new Error('synthetic quota');return window.originalSetItem.call(this,key,value);};});
 await page.locator('#photo-keep').click();assert.match(await page.locator('#photo-message').textContent(),/could not be saved/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('ikebana-web-alpha:workbench-garden-v1')),gardenBefore);
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
 results.checks.push('failed photo Keep preserves v1 Garden and working document');
 await page.locator('#photo-name').fill('Synthetic afternoon');await page.locator('#photo-keep').click();
 const kept=await page.evaluate(()=>JSON.parse(localStorage.getItem('ikebana-web-alpha:workbench-garden-v1')));
 assert.equal(kept.gardenVersion,1);assert.equal(kept.entries.length,2);assert.ok(kept.entries[0].thumbnail.length<=80000);assert.equal(kept.entries[0].title,'Synthetic afternoon');
 assert.deepEqual(kept.entries[0].arrangement.plants,initial.snapshot.plants);assert.deepEqual(kept.entries[1],JSON.parse(gardenBefore).entries[0]);
 await writeFile(`${dir}/synthetic-photo-garden.json`,JSON.stringify(kept,null,2));
 await page.locator('#photo-close').click();
 await page.waitForFunction(()=>document.activeElement.id==='more-toggle');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'more-toggle');
 await page.getByTestId('more-toggle').click();await page.locator('#garden-open').click();await page.locator('#garden-dialog[open]').waitFor();await page.waitForFunction(()=>{const image=document.querySelector('.garden-card-view img');return image&&image.complete&&image.naturalWidth===360;});await page.screenshot({path:`${dir}/garden-photo-bookmark.png`});
 await page.locator('.garden-card-view').first().click();assert.equal(await page.evaluate(()=>window.__IKEBANA_TEST__.getState().posture),'step-back');
 await page.locator('#garden-return').click();assert.equal(await page.evaluate(()=>window.__IKEBANA_TEST__.getState().canonicalHash),initial.state.canonicalHash);
 await page.reload();await page.locator('[data-ready=true]').waitFor();
 assert.equal(await page.evaluate(()=>window.__IKEBANA_TEST__.getState().canonicalHash),initial.state.canonicalHash);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ikebana-web-alpha:workbench-garden-v1'))),kept);
 results.checks.push('v1 cover bookmark persists, opens read-only and returns, reload keeps canonical data');
 for(let cycle=0;cycle<3;cycle++){
  await page.getByTestId('more-toggle').click();await page.locator('#photo-open').click();await page.locator('#photo-dialog[open]').waitFor();
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#photo-dialog').open);
 }
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ikebana-web-alpha:workbench-garden-v1'))),kept);
 results.checks.push('three open/Escape cycles preserve Garden');
 for(const [width,height,text] of [[320,568,1],[390,844,1],[844,390,1],[390,844,2]]) {
  await page.setViewportSize({width,height});if(text===2)await page.evaluate(()=>document.documentElement.style.fontSize='32px');
  await page.getByTestId('more-toggle').click();await page.locator('#photo-open').click();await page.locator('#photo-dialog[open]').waitFor();
  const overflow=await page.evaluate(()=>{const d=document.querySelector('#photo-dialog');return {client:d.clientWidth,scroll:d.scrollWidth,viewport:innerWidth};});
  assert.ok(overflow.scroll<=overflow.client+1,JSON.stringify(overflow));
  await page.locator('#photo-keep').scrollIntoViewIfNeeded();assert.ok(await page.locator('#photo-keep').isVisible());
  await page.screenshot({path:`${dir}/photo-${width}x${height}-text${text}.png`});
  await page.locator('#photo-close').click();
 }
 results.checks.push('controls reachable at 320 portrait, 390 portrait, short landscape, 200% root text');
 assert.deepEqual(results.errors,[]);await context.close();
}finally{await browser.close();await writeFile(`${dir}/photo-browser-results.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));
