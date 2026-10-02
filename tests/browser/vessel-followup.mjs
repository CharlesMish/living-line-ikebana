/** Bounded follow-up QA: actual backup import, interruption, material plate and an authored fan. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const baseURL = process.env.IKEBANA_URL ?? 'http://127.0.0.1:4193/';
const output = process.env.IKEBANA_EVIDENCE ?? 'docs/development/reports/vessel-study/browser';
await mkdir(output, {recursive:true});
const page = await browser.newPage({viewport:{width:1100,height:850}}), errors=[];
page.on('pageerror',e=>errors.push(String(e)));
const ready=()=>page.waitForSelector('[data-ready="true"]');
const snapshot=()=>page.evaluate(()=>window.__IKEBANA_TEST__.getCanonicalSnapshot());
const writes=()=>page.evaluate(()=>window.__IKEBANA_TEST__.getAutosaveAudit().writes.length);
async function view(name){await page.getByTestId('view-toggle').click();await page.getByTestId(`view-${name}`).click();}
async function garden(){await page.getByTestId('more-toggle').click();await page.locator('#garden-open').click();}
async function project(point){return page.evaluate(async point=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {canonicalCameraPose}=await import('/src/app/camera.ts');
  const s=window.__IKEBANA_TEST__.getState(),lens=window.__IKEBANA_TEST__.getStageLens();
  const pose=canonicalCameraPose(s.view),rect=document.querySelector('canvas.scene-canvas').getBoundingClientRect();
  const camera=new THREE.PerspectiveCamera(lens.verticalFov,rect.width/lens.virtualHeight,.1,80);
  if(lens.shift>0)camera.setViewOffset(rect.width,lens.virtualHeight,0,0,rect.width,rect.height);
  camera.position.set(pose.position.x,pose.position.y,pose.position.z);camera.up.set(pose.up.x,pose.up.y,pose.up.z);
  camera.lookAt(pose.target.x,pose.target.y,pose.target.z);camera.updateMatrixWorld(true);
  const p=new THREE.Vector3(point.x,point.y,point.z).project(camera);
  return{x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
},point);}
try{
  await page.goto(baseURL+'?test=1&vesselStudy=vessel-pair&vesselColor=celadon&vesselFinish=stoneware');await ready();
  await page.getByTestId('materials-toggle').click();await page.getByTestId('material-choice-reed').click();
  for(let i=0;i<2;i++){await page.getByTestId('material-source').focus();await page.keyboard.press('Enter');}
  const kept=await snapshot(),beforeWrites=await writes(),keptCamera=await page.evaluate(()=>window.__IKEBANA_TEST__.getState().cameraHash);
  // Opening appearance through its real handler must roll back the owned live preview.
  const box=await page.getByTestId('material-source').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(550,400,{steps:5});
  assert.equal(await page.evaluate(()=>window.__IKEBANA_TEST__.getState().transaction.operation),'insert');
  await page.locator('#vessel-appearance-open').dispatchEvent('click');
  await page.getByTestId('vessel-color').selectOption('charcoal');await page.mouse.up();
  assert.deepEqual(await snapshot(),kept);assert.equal(await writes(),beforeWrites);
  await page.getByTestId('vessel-color').selectOption('celadon');await page.locator('#vessel-appearance-close').click();
  await garden();await page.locator('#garden-name').fill('Pair / Celadon / Stoneware');await page.locator('#garden-keep').click();
  const downloaded=page.waitForEvent('download');await page.locator('#garden-export').click();
  const download=await downloaded,backupPath=`${output}/pair-celadon-stoneware-garden.json`;await download.saveAs(backupPath);
  const backup=JSON.parse(await readFile(backupPath,'utf8'));
  assert.equal(backup.entries.length,1);assert.equal('vesselProfileId' in backup.entries[0].arrangement,false);
  const thumbnail=backup.entries[0].thumbnail;
  // Separate browser contexts model genuine imports without pre-existing source storage.
  for(const [layout,color,finish] of [['vessel-pair','celadon','stoneware'],['compact','sand','glaze']]){
    const context=await browser.newContext({viewport:{width:1100,height:850}}),restored=await context.newPage();
    restored.on('pageerror',e=>errors.push(String(e)));
    await restored.goto(baseURL+`?test=1&vesselStudy=${layout}&vesselColor=${color}&vesselFinish=${finish}`);
    await restored.waitForSelector('[data-ready="true"]');await restored.getByTestId('more-toggle').click();await restored.locator('#garden-open').click();
    await restored.locator('#garden-file').setInputFiles(backupPath);await restored.locator('.garden-card-view').waitFor();
    assert.equal(await restored.locator('.garden-card-view img').getAttribute('src'),thumbnail);
    await restored.locator('.garden-card-view').click();
    assert.deepEqual(await restored.evaluate(()=>window.__IKEBANA_TEST__.getCanonicalSnapshot()),kept);
    assert.equal(await restored.evaluate(()=>window.__IKEBANA_TEST__.getState().cameraHash),keptCamera);
    const presentation=await restored.evaluate(()=>window.__IKEBANA_TEST__.getVesselPresentation());
    assert.equal(presentation.layoutId,layout);assert.deepEqual(presentation.vessels[0].appearance,{colorId:color,finishId:finish});
    await restored.screenshot({path:`${output}/restore-${layout}.png`});
    await restored.locator('#garden-copy').click();
    assert.deepEqual(await restored.evaluate(()=>window.__IKEBANA_TEST__.getCanonicalSnapshot()),kept);
    await restored.reload();await restored.waitForSelector('[data-ready="true"]');
    assert.deepEqual(await restored.evaluate(()=>window.__IKEBANA_TEST__.getCanonicalSnapshot()),kept);
    await context.close();
  }
  console.log('PASS appearance interruption and actual Garden export/import; wrong-layout limitation reproduced');
  // A deliberate fan example: real pointer seats and ordinary Aim, no plant resizing.
  await page.goto(baseURL+'?test=1&vesselStudy=long-bed');await ready();
  await page.getByTestId('materials-toggle').click();await page.getByTestId('material-choice-reed').click();
  const fanRoots=[-1.4,-.85,-.3,.25,.8],aimPixels=[-85,-42,0,42,85];
  for(let i=0;i<fanRoots.length;i++){
    await view('above');const seat=await project({x:fanRoots[i],y:.55,z:-.22}),source=await page.getByTestId('material-source').boundingBox();
    await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(seat.x,seat.y,{steps:8});await page.mouse.up();
    if(aimPixels[i]){
      await view('front');
      const station=await page.evaluate(async index=>{
        const {fromCanonicalPlantGraph,sampleBranch}=await import('/src/core/index.ts');
        const g=fromCanonicalPlantGraph(window.__IKEBANA_TEST__.getCanonicalSnapshot().plants[index]);
        const b=g.branches.get(g.rootBranchId);return sampleBranch(b,b.activeLength*.84).position;
      },i),handle=await project(station);
      await page.mouse.move(handle.x,handle.y);await page.mouse.down();
      assert.equal(await page.evaluate(()=>window.__IKEBANA_TEST__.getState().transaction.operation),'aim');
      await page.mouse.move(handle.x+aimPixels[i],handle.y+8,{steps:10});await page.mouse.up();
    }
  }
  await page.getByTestId('posture-step-back').click();
  for(const name of ['front','three-quarter','above']){await view(name);await page.screenshot({path:`${output}/long-bed-fan-${name}.png`});}
  await writeFile(`${output}/long-bed-fan-arrangement.json`,JSON.stringify(await snapshot(),null,2));
  await garden();await page.locator('#garden-name').fill('Long offset bed - full-stock fan - Sand Glaze');await page.locator('#garden-keep').click();
  const fanDownload=page.waitForEvent('download');await page.locator('#garden-export').click();await (await fanDownload).saveAs(`${output}/long-bed-fan-garden.json`);
  console.log('PASS authored five-reed fan using pointer seats and Aim');
  // Production renderer, one fixed close camera for every finish; no scene-light overrides.
  await page.goto(baseURL+'vessel-study.html');
  await page.evaluate(async()=>{
    const {ThreeStudio}=await import('/src/presentation/ThreeStudio.ts'),{VESSEL_PROFILES}=await import('/src/study/vesselProfiles.ts');
    document.body.replaceChildren();document.body.style='margin:0;background:#eee9dd';
    const canvas=document.createElement('canvas');canvas.style='display:block;width:1000px;height:600px';document.body.append(canvas);
    window.materialStudio=new ThreeStudio(canvas,{vesselProfile:VESSEL_PROFILES.find(p=>p.id==='compact'),maxPixelRatio:2});
    window.materialStudio.setCameraPose({position:{x:6,y:4.2,z:7.5},target:{x:0,y:.25,z:0},up:{x:0,y:1,z:0}});
  });
  for(const colorId of ['sand','celadon','charcoal'])for(const finishId of ['glaze','stoneware']){
    await page.evaluate(async choice=>{window.materialStudio.setVesselAppearance(choice);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},{colorId,finishId});
    await page.locator('canvas').screenshot({path:`${output}/material-${colorId}-${finishId}.png`});
  }
  await page.evaluate(()=>window.materialStudio.dispose());assert.deepEqual(errors,[]);
  await writeFile(`${output}/followup-checks.json`,JSON.stringify({appearanceInterruptionNoSave:'pass',backupMatchingLayoutExact:'pass',wrongLayoutPreservesPlantsButChangesVessel:'confirmed limitation',sameThumbnailDoesNotProveSceneRestore:true,workingCopyReloadExact:'pass',authoredFan:'five full-stock reeds; explicit seats and Aim only',materialPlate:{profile:'compact',camera:{position:[6,4.2,7.5],target:[0,.25,0]},lighting:'unchanged production studio',colors:['sand','celadon','charcoal'],finishes:['glaze','stoneware']},errors},null,2));
  console.log('PASS six constant-light, constant-camera finish renders');
}finally{await browser.close();}
