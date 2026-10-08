/** Camera A/B study: fresh contexts, synthetic graphs, UI gestures and actual files. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const url=process.env.IKEBANA_URL??'http://127.0.0.1:4192/';
const out=process.env.IKEBANA_EVIDENCE_DIR??'artifacts/camera-views';await mkdir(out,{recursive:true});
const fixture=JSON.parse(await readFile('tests/fixtures/polish-baseline-arrangements.plants.json','utf8')).arrangements[0];
const camera={position:{x:0,y:3.7,z:15},target:{x:0,y:2.55,z:0},up:{x:0,y:1,z:0}};
const scene={sceneVersion:1,layoutId:'original',colorId:'sand',finishId:'glaze',backdropId:'paper',perchId:'ground',photoFormat:'landscape',stemFibers:false};
const saved={storageVersion:2,savedAt:'2026-10-05T00:00:00Z',nextSuccessfulOrdinal:fixture.successfulPlantOrdinal+1,plants:fixture.plants,camera,scene};
const studyKey='ikebana-camera-views-study:studio-v2';
const browser=await chromium.launch({headless:true});
const result={url,checks:[],mobile:[],errors:[],physicalPhoneTested:false};
const ready=p=>p.locator('[data-ready=true]').waitFor();
const state=p=>p.evaluate(()=>window.__IKEBANA_TEST__.getState());
const graph=p=>p.evaluate(()=>window.__IKEBANA_TEST__.getCanonicalSnapshot());
const writes=p=>p.evaluate(()=>window.__IKEBANA_TEST__.getAutosaveAudit().writes.length);
const pose=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)).camera,studyKey);
const activate=async(p,locator)=>await p.evaluate(()=>navigator.maxTouchPoints>0)?locator.tap():locator.click();
async function angles(p){if(await p.getByTestId('view-toggle').getAttribute('aria-expanded')!=='true')await activate(p,p.getByTestId('view-toggle'));}
async function closeAngles(p){if(await p.getByTestId('view-toggle').getAttribute('aria-expanded')==='true')await activate(p,p.getByTestId('view-toggle'));}
async function cameraAction(p,action,slot){await angles(p);await activate(p,p.locator(`#camera-${action}-${slot}`));assert.equal(await p.getByTestId('view-toggle').getAttribute('aria-expanded'),'false');}
async function more(p,id){await activate(p,p.getByTestId('more-toggle'));await activate(p,p.locator('#'+id));}
async function shot(p,name){await p.mouse.move(10,800);await p.waitForTimeout(250);await p.screenshot({path:out+'/'+name+'.png'});}
async function capture(p,name){const next=p.waitForEvent('download');await activate(p,p.locator('#photo-export'));await(await next).saveAs(out+'/'+name+'.png');await p.waitForFunction(()=>!document.querySelector('#photo-export').disabled);}
async function drag(p,x,y,dx,dy){await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx,y+dy,{steps:12});await p.mouse.up();}
function observe(p){p.on('pageerror',e=>result.errors.push(String(e)));}
try{
 const c=await browser.newContext({viewport:{width:1100,height:850},acceptDownloads:true});
 await c.addInitScript(f=>{if(!sessionStorage.getItem('camera-study-seeded')){
   localStorage.setItem('ikebana-camera-views-study:studio-v2',JSON.stringify(f));
   localStorage.setItem('ikebana-integration-preview:studio-v2',JSON.stringify(f));
   localStorage.setItem('ikebana-web-alpha:studio-v1','synthetic old studio sentinel');
   localStorage.setItem('ikebana-web-alpha:garden-v1','synthetic old garden sentinel');
   localStorage.setItem('ikebana-web-alpha:studio-v2','synthetic normal studio sentinel');
   localStorage.setItem('ikebana-web-alpha:garden-v2','synthetic normal garden sentinel');
   sessionStorage.setItem('camera-study-seeded','1');
 }},saved);
 const baseline=await c.newPage();observe(baseline);await baseline.goto(url+'?combinedPreview=1&test=1');await ready(baseline);
 assert.equal(await baseline.locator('#camera-views').count(),0);const baselineGraph=await graph(baseline);await shot(baseline,'baseline-full');await angles(baseline);await shot(baseline,'baseline-menu');await closeAngles(baseline);
 const p=await c.newPage();observe(p);await p.goto(url+'?cameraViews=1&test=1');await ready(p);assert.deepEqual(await graph(p),baselineGraph);await shot(p,'candidate-full');
 await angles(p);assert.match(await p.getByTestId('view-toggle').getAttribute('aria-label'),/camera A\/B/);assert.deepEqual(await p.locator('#view-options .studio-menu-heading').allTextContents(),['Preset angles','Camera A / B','Stem checks']);assert.ok(await p.locator('#camera-recall-A').isDisabled());assert.ok(await p.locator('#camera-recall-B').isDisabled());await shot(p,'candidate-unset-menu');
 await closeAngles(p);const startWrites=await writes(p);await cameraAction(p,'store','A');assert.equal(await writes(p),startWrites);const a=(await state(p)).cameraHash;
 await p.getByTestId('posture-step-back').click();await drag(p,450,420,65,-24);await p.mouse.wheel(0,-730);await p.locator('[data-camera-mode="move"]').click();await drag(p,450,430,-18,85);
 const b=(await state(p)).cameraHash;assert.notEqual(b,a);result.poses={A:camera,B:await pose(p)};await cameraAction(p,'store','B');await p.getByTestId('posture-arrange').click();await shot(p,'detail-B');
 assert.deepEqual(await graph(p),baselineGraph);await angles(p);assert.equal(await p.locator('#camera-store-A').innerText(),'Replace A');assert.equal(await p.locator('#camera-store-B').innerText(),'Replace B');assert.equal(await p.locator('#camera-recall-B').getAttribute('aria-pressed'),'true');await shot(p,'candidate-set-menu');await closeAngles(p);
 for(let i=0;i<3;i++)for(const [slot,hash] of [['A',a],['B',b]]){await cameraAction(p,'recall',slot);assert.equal((await state(p)).cameraHash,hash);assert.equal((await state(p)).posture,'arrange');assert.deepEqual(await graph(p),baselineGraph);}
 await cameraAction(p,'recall','A');await shot(p,'returned-A');
 result.checks.push('off-route baseline unchanged; empty/store/replace labels; real orbit, wheel zoom and pan; repeated A/B exact camera hashes with exact graphs and Arrange retained');console.log('PASS framing and repeated recall');
 // Photograph consumes the current camera, and remembers its own kept frame.
 await more(p,'photo-open');assert.equal(await p.locator('#photo-view').inputValue(),'current');await capture(p,'photo-A');await p.locator('#photo-name').fill('Synthetic composition A');await p.locator('#photo-keep').click();assert.match(await p.locator('#photo-message').innerText(),/kept/);await p.locator('#photo-close').click();
 await cameraAction(p,'recall','B');await more(p,'photo-open');await capture(p,'photo-B');await p.locator('#photo-close').click();
 assert.notEqual(createHash('sha256').update(await readFile(out+'/photo-A.png')).digest('hex'),createHash('sha256').update(await readFile(out+'/photo-B.png')).digest('hex'));
 await more(p,'garden-open');await p.locator('.garden-card-view').first().click();await angles(p);for(const s of ['A','B'])for(const act of ['store','recall'])assert.ok(await p.locator(`#camera-${act}-${s}`).isDisabled());await shot(p,'garden-slots-unavailable');await closeAngles(p);
 await more(p,'photo-open');await capture(p,'photo-A-from-garden');await p.locator('#photo-close').click();assert.equal(createHash('sha256').update(await readFile(out+'/photo-A.png')).digest('hex'),createHash('sha256').update(await readFile(out+'/photo-A-from-garden.png')).digest('hex'));
 await p.locator('#garden-return').click();assert.equal((await state(p)).cameraHash,b);await cameraAction(p,'recall','A');assert.equal((await state(p)).cameraHash,a);
 await more(p,'vessel-appearance-open');await p.locator('#vessel-layout').selectOption('pinbed-small');await p.locator('#vessel-appearance-close').click();await cameraAction(p,'recall','B');assert.equal((await state(p)).cameraHash,b);assert.deepEqual(await graph(p),baselineGraph);await shot(p,'small-bed-B');
 result.checks.push('A/B photographs differ in framing only; Garden A export byte-identical; working slots disabled while viewing, retained on Return; vessel change retains both poses and graphs');console.log('PASS photo, Garden and vessel');
 // A meaningful plant edit remains undoable across camera recall; tools stay selected.
 const target=await p.evaluate(()=>window.__IKEBANA_TEST__.getScreenTargets().find(t=>t.plantId==='plant-2'&&t.branchId==='plant-2:stalk-1-1'));assert.ok(target);
 await p.mouse.click(target.x,target.y);assert.equal((await state(p)).selectedPlantId,'plant-2');await shot(p,'detail-B-editing');
 const beforeEdit=await graph(p);await p.mouse.move(target.x,target.y);await p.mouse.down();assert.equal((await state(p)).transaction.operation,'aim');await p.mouse.move(target.x+35,target.y+10,{steps:8});await p.mouse.up();const edited=await graph(p);assert.notDeepEqual(edited,beforeEdit);
 await p.getByTestId('tool-prune').click();await cameraAction(p,'recall','A');assert.equal((await state(p)).tool,'prune');assert.deepEqual(await graph(p),edited);await p.getByTestId('edit-toggle').click();await p.getByTestId('undo-edit').click();assert.deepEqual(await graph(p),beforeEdit);
 await p.getByTestId('tool-shape').click();await p.getByTestId('posture-step-back').click();const n=await writes(p);await p.mouse.move(430,460);await p.mouse.down();await p.mouse.move(480,475,{steps:6});assert.equal((await state(p)).transaction.operation,'camera');
 await p.getByTestId('view-toggle').evaluate(el=>el.click());assert.equal((await state(p)).transaction,null);await p.locator('#camera-store-B').evaluate(el=>el.click());await p.mouse.up();assert.equal(await writes(p),n);assert.equal((await state(p)).cameraHash,a);await cameraAction(p,'recall','B');assert.equal((await state(p)).cameraHash,a);assert.equal((await state(p)).posture,'step-back');
 result.checks.push('real Aim then Prune tool, A recall and Undo retain exact pre-edit graphs; held camera interrupted before Replace stores committed A; late release inert; Step Back/Pan retained');console.log('PASS edit, Undo and interrupted overwrite');
 // Save shape stays exactly v2: only active camera persists, slots are deliberately transient.
 const stored=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),studyKey);assert.deepEqual(Object.keys(stored).sort(),['camera','nextSuccessfulOrdinal','plants','savedAt','scene','storageVersion'].sort());
 await p.reload();await ready(p);assert.equal((await state(p)).cameraHash,a);await angles(p);assert.ok(await p.locator('#camera-recall-A').isDisabled());assert.ok(await p.locator('#camera-recall-B').isDisabled());await closeAngles(p);
 // A working copy starts its own empty slots; an ordinary Garden visit preserves them.
 await cameraAction(p,'store','A');await more(p,'garden-open');await p.locator('.garden-card-view').first().click();await p.locator('#garden-copy').click();await p.locator('#garden-replace').click();await angles(p);assert.ok(await p.locator('#camera-recall-A').isDisabled());await closeAngles(p);
 const sentinels=await p.evaluate(()=>['studio-v1','garden-v1','studio-v2','garden-v2'].map(k=>localStorage.getItem('ikebana-web-alpha:'+k)));assert.deepEqual(sentinels,['synthetic old studio sentinel','synthetic old garden sentinel','synthetic normal studio sentinel','synthetic normal garden sentinel']);
 result.checks.push('reload restores active camera but clears slots; explicit working copy clears slots; unchanged v2 envelope and four ordinary/legacy sentinels');await c.close();console.log('PASS reload and storage isolation');
 const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const q=await phone.newPage();observe(q);
 for(const [width,height,scale] of [[320,568,1],[390,844,1],[568,320,1],[390,844,2]]){
  await q.setViewportSize({width,height});await q.goto(url+'?cameraViews=1&test=1');await ready(q);if(scale===2)await q.evaluate(()=>document.documentElement.style.fontSize='32px');
  await angles(q);assert.ok(await q.locator('#camera-recall-A').isDisabled());await q.locator('#camera-store-A').scrollIntoViewIfNeeded();await q.locator('#camera-store-A').tap();assert.equal(await q.evaluate(()=>document.activeElement.id),'view-toggle');await angles(q);await q.locator('#camera-recall-A').scrollIntoViewIfNeeded();await q.locator('#camera-recall-A').tap();
  await angles(q);for(const id of ['camera-recall-A','camera-store-A','camera-store-B','stem-overlaps-toggle','stem-prevention-toggle']){const e=q.locator('#'+id);await e.scrollIntoViewIfNeeded();const box=await e.boundingBox();assert.ok(box.height>=44&&box.x>=0&&box.x+box.width<=width+.5&&box.y>=0&&box.y+box.height<=height+.5);}
  assert.equal(await q.locator('#view-options').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await q.locator('#camera-views').scrollIntoViewIfNeeded();await q.screenshot({path:out+`/mobile-${width}x${height}-text${scale}.png`});await q.keyboard.press('Escape');assert.equal(await q.getByTestId('view-toggle').getAttribute('aria-expanded'),'false');
  result.mobile.push({width,height,textScale:scale,realTaps:true,controlsReachable:true});
 }
 await phone.close();assert.deepEqual(result.errors,[]);console.log('PASS mobile layouts and keyboard dismissal');
}finally{await browser.close();await writeFile(out+'/checks.json',JSON.stringify(result,null,2));}
