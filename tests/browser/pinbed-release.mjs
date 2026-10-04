/** Release regression: fresh browser contexts and synthetic graphs only. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import * as THREE from 'three';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const compiled=await build({entryPoints:['src/core/index.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {createReed,createFloweringBranch,toCanonicalPlantGraph}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const url=process.env.IKEBANA_URL??'http://127.0.0.1:4186/';
const out=process.env.IKEBANA_EVIDENCE_DIR??'artifacts/pinbed-release';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const results={url,recovery:[],menus:[],photos:[],errors:[],physicalPhoneTested:false};
const camera={position:{x:0,y:15.4,z:.03},target:{x:0,y:1.85,z:0},up:{x:0,y:0,z:-1}};
const scene={sceneVersion:1,layoutId:'vessel-pair',colorId:'sand',finishId:'glaze',backdropId:'paper',perchId:'ground',photoFormat:'landscape',stemFibers:false};
const point=(x,z=0)=>({x,y:.55,z});
const snapshot=p=>p.evaluate(()=>window.__IKEBANA_TEST__.getCanonicalSnapshot());
const state=p=>p.evaluate(()=>window.__IKEBANA_TEST__.getState());
const writes=p=>p.evaluate(()=>window.__IKEBANA_TEST__.getAutosaveAudit().writes.length);
const root=(s,id='plant-2')=>{const g=s.plants.find(p=>p.id===id);return g.branches.find(b=>b.id===g.rootBranchId).points[0];};
async function more(p,id){await p.getByTestId('more-toggle').click();await p.locator('#'+id).click();}
async function toggleProtection(p){await p.getByTestId('view-toggle').click();await p.getByTestId('stem-prevention-toggle').click();if(await p.getByTestId('view-toggle').getAttribute('aria-expanded')==='true')await p.getByTestId('view-toggle').click();}
async function project(p,point){const d=await p.evaluate(()=>({lens:window.__IKEBANA_TEST__.getStageLens(),rect:document.querySelector('canvas.scene-canvas').getBoundingClientRect().toJSON()}));const c=new THREE.PerspectiveCamera(d.lens.verticalFov,d.rect.width/d.lens.virtualHeight,.1,80);if(d.lens.shift>0)c.setViewOffset(d.rect.width,d.lens.virtualHeight,0,0,d.rect.width,d.rect.height);c.position.set(0,15.4,.03);c.up.set(0,0,-1);c.lookAt(0,1.85,0);c.updateMatrixWorld(true);const v=new THREE.Vector3(point.x,point.y,point.z).project(c);return{x:d.rect.left+(v.x+1)*d.rect.width/2,y:d.rect.top+(1-v.y)*d.rect.height/2};}
async function context(material='reed'){
 const c=await browser.newContext({viewport:{width:1100,height:850},acceptDownloads:true});
 const generate=material==='reed'?createReed:createFloweringBranch;
 const fixture={storageVersion:2,savedAt:'2026-10-04T00:00:00Z',nextSuccessfulOrdinal:3,plants:[generate('plant-1',8278,point(-1.65)),generate('plant-2',9255,point(1.65))].map(toCanonicalPlantGraph),camera,scene};
 await c.addInitScript(f=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('ikebana-integration-preview:studio-v2',JSON.stringify(f));sessionStorage.setItem('seeded','1');}},fixture);
 const p=await c.newPage();p.on('pageerror',e=>results.errors.push(String(e)));await p.goto(url+'?combinedPreview=1&test=1');await p.locator('[data-ready=true]').waitFor();return{c,p};
}
async function layout(p,id){await more(p,'vessel-appearance-open');await p.locator('#vessel-layout').selectOption(id);await p.locator('#vessel-appearance-close').click();await p.getByTestId('view-toggle').click();await p.getByTestId('view-above').click();}
async function select(p,id){const t=await p.evaluate(id=>window.__IKEBANA_TEST__.getScreenTargets().find(t=>t.role==='branch'&&t.plantId===id),id);await p.mouse.click(t.x,t.y);assert.equal((await state(p)).selectedPlantId,id);}
async function begin(p,id='plant-2'){const start=root(await snapshot(p),id),source=await project(p,start);await p.mouse.move(source.x,source.y);await p.mouse.down();assert.equal((await state(p)).transaction.operation,'base');return start;}
async function move(p,target){const end=await project(p,target);await p.mouse.move(end.x,end.y,{steps:16});}
async function capture(p,name){const next=p.waitForEvent('download');await p.locator('#photo-export').click();await(await next).saveAs(out+'/'+name+'.png');await p.waitForFunction(()=>!document.querySelector('#photo-export').disabled);}
try{
 for(const id of ['petite','pinbed-small','pinbed-single','pinbed-medium-oval'])for(const protectedOn of [false,true]){
  const {c,p}=await context();const initial=await snapshot(p);await layout(p,id);assert.deepEqual(await snapshot(p),initial);if(protectedOn)await toggleProtection(p);await select(p,'plant-2');
  const before=await snapshot(p);await begin(p);await p.mouse.up();assert.deepEqual(await snapshot(p),before,'no-motion release preserves remote base');
  const target=point(id==='pinbed-medium-oval'?-.1:0),beforeWrites=await writes(p);
  await begin(p);await move(p,target);await p.evaluate(()=>window.__IKEBANA_TEST__.interruptForTest('pointercancel'));await p.mouse.up();assert.deepEqual(await snapshot(p),before);assert.equal(await writes(p),beforeWrites);
  await begin(p);await move(p,target);await p.mouse.up();const recovered=await snapshot(p);assert.ok(Math.hypot(root(recovered).x-target.x,root(recovered).z-target.z)<1e-5);assert.deepEqual(recovered.plants[0],before.plants[0]);assert.equal(recovered.successfulPlantOrdinal,before.successfulPlantOrdinal);
  // A following no-motion release must retain this meaningful Undo checkpoint.
  await begin(p);await p.mouse.up();await p.getByTestId('edit-toggle').click();await p.getByTestId('undo-edit').click();assert.deepEqual(await snapshot(p),before);
  await p.reload();await p.locator('[data-ready=true]').waitFor();assert.deepEqual(await snapshot(p),before);await more(p,'vessel-appearance-open');assert.equal(await p.locator('#vessel-layout').inputValue(),id,'menu grouping preserves the saved selection');assert.equal(await p.locator('#vessel-layout option').count(),10);await p.locator('#vessel-appearance-close').click();
  if(protectedOn&&id.startsWith('pinbed-')){
   await p.getByTestId('posture-step-back').click();await more(p,'photo-open');await p.locator('#photo-backdrop').selectOption('sage');await p.locator('#photo-perch').selectOption('stone');await p.locator('#photo-format').selectOption('square');await p.locator('#photo-view').selectOption('three-quarter');await capture(p,id+'-square');
   await p.locator('#photo-name').fill('Synthetic '+id);await p.locator('#photo-keep').click();assert.match(await p.locator('#photo-message').innerText(),/kept/);await p.locator('#photo-close').click();
   await more(p,'garden-open');await p.locator('.garden-card-view').first().click();assert.deepEqual(await snapshot(p),before);await more(p,'photo-open');assert.equal(await p.locator('#photo-format').inputValue(),'square');await capture(p,id+'-restored');await p.locator('#photo-backdrop').selectOption('transparent');await p.locator('#photo-format').selectOption('portrait');await capture(p,id+'-transparent');await p.locator('#photo-close').click();await p.locator('#garden-return').click();assert.deepEqual(await snapshot(p),before);
   results.photos.push({id,keptFrameRestored:true,transparentPortrait:true});
  }
  results.recovery.push({id,protectedOn,noMotionUnchanged:true,cancelNoSave:true,deliberateRecovery:true,undoAndReload:true});console.log('PASS recovery',id,protectedOn);await c.close();
 }
 const {c,p}=await context('flower');await layout(p,'petite');await toggleProtection(p);await select(p,'plant-1');await begin(p,'plant-1');await move(p,point(-.28));await p.mouse.up();await select(p,'plant-2');const before=await snapshot(p);
 await begin(p);await p.mouse.up();assert.deepEqual(await snapshot(p),before);await begin(p);await move(p,point(.28));assert.match(await p.locator('body').innerText(),/Prevent overlaps stopped this move/);await p.mouse.up();assert.ok(root(await snapshot(p)).x>.67);assert.match(await p.getByTestId('status').innerText(),/Prevent overlaps stopped this move.*Angles/);
 await toggleProtection(p);await begin(p);await move(p,point(.28));await p.mouse.up();assert.ok(root(await snapshot(p)).x<.67);results.protection='actual contact explained during drag and after release; disabling permits deliberate recovery';console.log('PASS protection explanation and recovery');await c.close();
 const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const q=await phone.newPage();q.on('pageerror',e=>results.errors.push(String(e)));
 for(const [width,height,textScale] of [[320,568,1],[390,844,1],[568,320,1],[390,844,2]]){
  await q.setViewportSize({width,height});await q.goto(url+'?combinedPreview=1&test=1');await q.locator('[data-ready=true]').waitFor();if(textScale===2)await q.evaluate(()=>document.documentElement.style.fontSize='32px');
  assert.match(await q.getByTestId('more-toggle').innerText(),/Studio/);assert.equal(await q.locator('#view-toggle span').innerText(),'Angles');
  const buttons=await q.locator('.top-actions > div > button').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().toJSON()));assert.equal(buttons.length,3);assert.ok(buttons.every(b=>Math.abs(b.y-buttons[0].y)<1&&b.height>=44&&b.x>=0&&b.right<=width+.5));
  await q.getByTestId('more-toggle').focus();await q.keyboard.press('Enter');await q.keyboard.press('Tab');assert.equal(await q.evaluate(()=>document.activeElement.id),'vessel-appearance-open');await q.keyboard.press('Enter');await q.locator('#vessel-layout').selectOption('pinbed-small');await q.locator('#vessel-appearance-close').tap();
  await q.getByTestId('more-toggle').tap();await q.locator('#photo-open').tap();await q.locator('#photo-keep').scrollIntoViewIfNeeded();assert.equal(await q.locator('#photo-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await q.locator('#photo-close').tap();
  await q.getByTestId('more-toggle').tap();for(const id of ['garden-open','experiment-toggle']){await q.locator('#'+id).scrollIntoViewIfNeeded();assert.ok(await q.locator('#'+id).isVisible());}assert.equal(await q.locator('#more-options').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await q.keyboard.press('Escape');
  await q.getByTestId('view-toggle').tap();for(const id of ['stem-overlaps-toggle','stem-prevention-toggle']){await q.getByTestId(id).scrollIntoViewIfNeeded();assert.ok(await q.getByTestId(id).isVisible());}await q.keyboard.press('Escape');await q.screenshot({path:out+`/menu-${width}x${height}-text${textScale}.png`});results.menus.push({width,height,textScale,pass:true});console.log('PASS menu',width,height,textScale);
 }
 await phone.close();assert.deepEqual(results.errors,[]);
}finally{await browser.close();await writeFile(out+'/checks.json',JSON.stringify(results,null,2));}
