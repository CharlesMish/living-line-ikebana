/** Synthetic-only combined release QA. Never reuses a browser profile. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=process.env.IKEBANA_URL??'http://127.0.0.1:4180';
const out=process.env.IKEBANA_EVIDENCE_DIR??'artifacts/combined-scene';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const result={checks:[],errors:[],physicalPhoneTested:false};
const ready=page=>page.locator('[data-ready="true"]').waitFor();
async function more(page,id){await page.getByTestId('more-toggle').click();await page.locator('#'+id).click();}
async function capture(page,name){const next=page.waitForEvent('download');await page.locator('#photo-export').click();await(await next).saveAs(`${out}/${name}.png`);await page.waitForFunction(()=>!document.querySelector('#photo-export').disabled);}
async function canonical(page){return page.evaluate(()=>window.__IKEBANA_TEST__.getCanonicalSnapshot());}
async function scene(page){return page.evaluate(()=>window.__IKEBANA_TEST__.getVesselPresentation());}
const previewURL=id=>`${base}/?test=1&combinedPreview=1&vesselStudy=${id}`;
try {
 for(const id of (process.env.IKEBANA_SKIP_LAYOUTS==='1'?[]:['original','compact','petite','offset','islands','long-bed','vessel-pair'])) {
  const context=await browser.newContext({viewport:{width:1100,height:900},acceptDownloads:true});const page=await context.newPage();page.on('pageerror',e=>result.errors.push(String(e)));
  await page.goto(previewURL(id));await ready(page);
  await page.getByTestId('materials-toggle').click();await page.getByTestId('material-choice-reed').click();
  for(let i=0;i<3;i++){await page.getByTestId('material-source').focus();await page.keyboard.press('Enter');}
  const before=await canonical(page);assert.equal(before.plants.length,3);
  await more(page,'vessel-appearance-open');await page.locator('#vessel-color').selectOption('celadon');await page.locator('#vessel-finish').selectOption('stoneware');
  assert.ok(await page.locator('#vessel-appearance-dialog').isVisible());await page.locator('#vessel-appearance-close').click();
  assert.deepEqual(await canonical(page),before);assert.equal((await scene(page)).vessels[0].appearance.colorId,'celadon');
  await page.getByTestId('posture-step-back').click();await more(page,'photo-open');
  await page.locator('#photo-backdrop').selectOption('sage');await page.locator('#photo-perch').selectOption('stone');
  await capture(page,`${id}-sage-stone`);assert.deepEqual(await canonical(page),before);
  await page.locator('#photo-name').fill(`Synthetic ${id}`);await page.locator('#photo-keep').click();assert.match(await page.locator('#photo-message').textContent(),/kept/);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ikebana-integration-preview:garden-v2')));
  assert.equal(saved.entries[0].arrangement.scene.layoutId,id);assert.equal(saved.entries[0].arrangement.scene.finishId,'stoneware');
  assert.deepEqual(saved.entries[0].arrangement.plants,before.plants);
  await page.locator('#photo-backdrop').selectOption('transparent');await page.locator('#photo-format').selectOption('portrait');await capture(page,`${id}-transparent`);
  await page.locator('#photo-close').click();
  for(let i=0;i<2;i++){await more(page,'photo-open');await page.keyboard.press('Escape');}
  assert.deepEqual(await canonical(page),before);
  await page.setViewportSize({width:320,height:640});await more(page,'photo-open');
  assert.ok(await page.locator('#photo-export').isVisible());await page.locator('#photo-keep').scrollIntoViewIfNeeded();
  const overflow=await page.locator('#photo-dialog').evaluate(d=>d.scrollWidth>d.clientWidth+1);assert.equal(overflow,false);
  if(id==='vessel-pair')await page.screenshot({path:`${out}/phone-photo-controls.png`});await page.locator('#photo-close').click();
  result.checks.push(`${id}: ordinary keyboard planting, materials, capture, repeat close, 320px controls, geometry preserved`);await context.close();
 }
 // Actual v1 read and write-on-edit upgrade in a disposable context with production-shaped synthetic keys.
 const context=await browser.newContext({viewport:{width:1100,height:900},acceptDownloads:true});const page=await context.newPage();page.on('pageerror',e=>result.errors.push(String(e)));
 await page.goto(`${base}/?test=1`);await ready(page);
 const legacy=await page.evaluate(async()=>{
  const {createWorkbenchFixture}=await import('/src/app/workbench.ts');const arrangement=createWorkbenchFixture('bare-branch',8278,2);
  const studio=JSON.stringify({storageVersion:1,savedAt:'2026-09-01T12:00:00Z',nextSuccessfulOrdinal:3,plants:arrangement.plants});
  const garden=JSON.stringify({gardenVersion:1,entries:[{id:'legacy-synthetic',title:'Earlier synthetic',keptAt:'2026-09-01T12:00:00Z',thumbnail:null,arrangement}]});
  localStorage.clear();localStorage.setItem('ikebana-web-alpha:studio-v1',studio);localStorage.setItem('ikebana-web-alpha:garden-v1',garden);localStorage.setItem('personal-sentinel','synthetic-do-not-touch');return{studio,garden};
 });
 await page.reload();await ready(page);
 assert.equal((await scene(page)).layoutId,'original');assert.equal((await canonical(page)).plants.length,2);
 assert.equal(await page.evaluate(()=>localStorage.getItem('ikebana-web-alpha:studio-v2')),null);
 await more(page,'garden-open');assert.equal(await page.locator('.garden-card').count(),1);await page.locator('#garden-close').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('ikebana-web-alpha:garden-v2')),null);
 result.checks.push('legacy read has no eager rewrite, defaults Original/Sand/Glaze');
 await more(page,'vessel-appearance-open');await page.locator('#vessel-layout').selectOption('vessel-pair');await page.locator('#vessel-color').selectOption('charcoal');await page.locator('#vessel-finish').selectOption('stoneware');await page.locator('#vessel-appearance-close').click();
 const workBefore=await canonical(page);const stored=await page.evaluate(()=>localStorage.getItem('ikebana-web-alpha:studio-v2'));assert.deepEqual(JSON.parse(stored).plants,workBefore.plants);
 await page.getByTestId('posture-step-back').click();await more(page,'photo-open');await page.locator('#photo-backdrop').selectOption('dusk');await page.locator('#photo-perch').selectOption('bench');await page.locator('#photo-view').selectOption('three-quarter');await page.locator('#photo-format').selectOption('square');
 await capture(page,'pair-dusk-bench');await page.locator('#photo-name').fill('Portable pair');await page.locator('#photo-keep').click();
 const kept=await page.evaluate(()=>JSON.parse(localStorage.getItem('ikebana-web-alpha:garden-v2')));assert.equal(kept.entries.length,2);
 await page.locator('#photo-close').click();await more(page,'garden-open');
 const next=page.waitForEvent('download');await page.locator('#garden-export').click();const downloaded=await next;const backupPath=`${out}/synthetic-portable-garden.json`;await downloaded.saveAs(backupPath);const backup=JSON.parse(await readFile(backupPath,'utf8'));assert.deepEqual(backup,kept);
 await page.locator('.garden-card-view').first().click();assert.equal((await scene(page)).layoutId,'vessel-pair');
 await page.screenshot({path:`${out}/restored-pair-garden.png`});await more(page,'photo-open');
 assert.equal(await page.locator('#photo-backdrop').inputValue(),'dusk');assert.equal(await page.locator('#photo-perch').inputValue(),'bench');assert.equal(await page.locator('#photo-format').inputValue(),'square');await capture(page,'restored-pair-photo');
 await page.locator('#photo-close').click();await page.locator('#garden-return').click();assert.deepEqual(await canonical(page),workBefore);
 await page.reload();await ready(page);assert.deepEqual(await canonical(page),workBefore);assert.equal((await scene(page)).vessels[0].appearance.colorId,'charcoal');
 const preserved=await page.evaluate(()=>({studio:localStorage.getItem('ikebana-web-alpha:studio-v1'),garden:localStorage.getItem('ikebana-web-alpha:garden-v1'),sentinel:localStorage.getItem('personal-sentinel')}));
 assert.equal(preserved.studio,legacy.studio);assert.equal(preserved.garden,legacy.garden);assert.equal(preserved.sentinel,'synthetic-do-not-touch');
 result.checks.push('production-shaped synthetic keys: old bytes retained, v2 working scene reload, staged photo Garden view/return, exact downloaded backup');
 // Import into a genuinely fresh context initially set to a different vessel; metadata must win.
 const targetContext=await browser.newContext({viewport:{width:1100,height:900},acceptDownloads:true}),target=await targetContext.newPage();target.on('pageerror',e=>result.errors.push(String(e)));
 await target.goto(previewURL('compact'));await ready(target);await more(target,'garden-open');await target.locator('#garden-file').setInputFiles(backupPath);await target.waitForFunction(()=>document.querySelectorAll('.garden-card').length===2);
 await target.locator('.garden-card-view').first().click();assert.deepEqual(await canonical(target),{plants:kept.entries[0].arrangement.plants,successfulPlantOrdinal:kept.entries[0].arrangement.successfulPlantOrdinal});assert.equal((await scene(target)).layoutId,'vessel-pair');
 await more(target,'photo-open');await capture(target,'imported-pair-photo');await target.locator('#photo-close').click();
 await target.locator('#garden-copy').click();assert.equal((await scene(target)).layoutId,'vessel-pair');await target.reload();await ready(target);assert.equal((await scene(target)).layoutId,'vessel-pair');assert.equal((await scene(target)).vessels[0].appearance.finishId,'stoneware');
 await more(target,'garden-open');await target.locator('.garden-card-view').last().click();assert.equal((await scene(target)).layoutId,'original');await target.locator('#garden-return').click();assert.equal((await scene(target)).layoutId,'vessel-pair');
 await more(target,'garden-open');await target.locator('.garden-compare-toggle').nth(0).click();await target.locator('.garden-compare-toggle').nth(1).click();await target.locator('#garden-compare-go').click();await target.screenshot({path:`${out}/different-layout-comparison.png`});await target.locator('#garden-compare-leave').click();
 result.checks.push('cross-layout fresh import restores scene/camera, working copy + reload, legacy view + exact return, heterogeneous comparison');
 await targetContext.close();await context.close();
 assert.deepEqual(result.errors,[]);
}finally {await browser.close();await writeFile(`${out}/checks.json`,JSON.stringify(result,null,2));}
console.log(JSON.stringify(result,null,2));
