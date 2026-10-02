/** Optional browser QA. Run against Vite; PLAYWRIGHT_MODULE may point to a local installation. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const baseURL = process.env.IKEBANA_URL ?? 'http://127.0.0.1:4193/';
const output = process.env.IKEBANA_EVIDENCE ?? 'docs/development/reports/vessel-study/browser';
await mkdir(output, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 850 }, deviceScaleFactor: 1 });
const errors = [], results = [];
page.on('pageerror', e => errors.push(String(e)));
const bridge = fn => page.evaluate(fn);
const state = () => bridge(() => window.__IKEBANA_TEST__.getState());
const snapshot = () => bridge(() => window.__IKEBANA_TEST__.getCanonicalSnapshot());
const writes = () => bridge(() => window.__IKEBANA_TEST__.getAutosaveAudit().writes.length);
async function ready() { await page.waitForSelector('[data-ready="true"]'); }
async function view(name) { await page.getByTestId('view-toggle').click(); await page.getByTestId(`view-${name}`).click(); }
async function project(point) {
  return page.evaluate(async point => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { canonicalCameraPose } = await import('/src/app/camera.ts');
    const s = window.__IKEBANA_TEST__.getState(), lens = window.__IKEBANA_TEST__.getStageLens();
    const pose = canonicalCameraPose(s.view), rect = document.querySelector('canvas.scene-canvas').getBoundingClientRect();
    const camera = new THREE.PerspectiveCamera(lens.verticalFov, rect.width / lens.virtualHeight, .1, 80);
    if (lens.shift > 0) camera.setViewOffset(rect.width, lens.virtualHeight, 0, 0, rect.width, rect.height);
    camera.position.set(pose.position.x, pose.position.y, pose.position.z); camera.up.set(pose.up.x, pose.up.y, pose.up.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z); camera.updateMatrixWorld(true);
    const p = new THREE.Vector3(point.x, point.y, point.z).project(camera);
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  }, point);
}
async function material(id) { await page.getByTestId('materials-toggle').click(); await page.getByTestId(`material-choice-${id}`).click(); }
async function dragSeat(point, cancel = false) {
  const box = await page.getByTestId('material-source').boundingBox(), p = await project(point);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(p.x, p.y, { steps: 8 });
  const pending = await state(); assert.equal(pending.transaction.operation, 'insert');
  if (cancel) await bridge(() => window.__IKEBANA_TEST__.interruptForTest('pointercancel'));
  await page.mouse.up();
}
async function garden() { await page.getByTestId('more-toggle').click(); await page.locator('#garden-open').click(); }

try {
  await page.goto(baseURL + '?test=1'); await ready();
  await material('reed'); await page.getByTestId('material-source').focus(); await page.keyboard.press('Enter');
  const oldSave = await bridge(() => localStorage.getItem('ikebana-web-alpha:studio-v1'));
  const oldGraph = await snapshot();
  for (const id of ['original', 'compact', 'petite', 'offset', 'islands', 'long-bed', 'vessel-pair']) {
    await page.goto(baseURL + `?test=1&vesselStudy=${id}`); await ready();
    assert.equal((await state()).successfulSeatOrdinal, 0, 'ordinary bowl must not leak into studies');
    await view('above');
    const box = await page.getByTestId('material-source').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.screenshot({ path: `${output}/${id}-footprint.png` });
    await bridge(() => window.__IKEBANA_TEST__.interruptForTest('pointercancel')); await page.mouse.up();
    await material('reed');
    const area = await page.evaluate(async id => (await import('/src/study/vesselProfiles.ts')).VESSEL_PROFILES.find(p => p.id === id).areas[0], id);
    const center = { x: area.x, y: .55, z: area.z };
    const invalid = { x: ['islands','vessel-pair'].includes(id) ? 0 : 4, y: .55, z: 0 };
    await dragSeat(invalid); assert.equal((await state()).successfulSeatOrdinal, 0); assert.equal(await writes(), 0);
    await dragSeat(center, true); assert.equal((await state()).successfulSeatOrdinal, 0); assert.equal(await writes(), 0);
    await dragSeat(center); assert.equal((await state()).successfulSeatOrdinal, 1);
    // Real selected bead and cut-surface acquisition, with the existing protection on.
    await view('front');
    await page.getByTestId('view-toggle').click(); await page.getByTestId('stem-prevention-toggle').click(); await page.getByTestId('view-toggle').click();
    const beforeShape = await snapshot();
    const station = await page.evaluate(async () => {
      const { fromCanonicalPlantGraph, sampleBranch } = await import('/src/core/index.ts');
      const graph = fromCanonicalPlantGraph(window.__IKEBANA_TEST__.getCanonicalSnapshot().plants[0]);
      const branch = graph.branches.get(graph.rootBranchId);
      return sampleBranch(branch, branch.activeLength * .54).position;
    });
    const bead = await project(station);
    await page.mouse.move(bead.x, bead.y); await page.mouse.down();
    assert.equal((await state()).transaction.operation, 'bend');
    await page.mouse.move(bead.x + 25, bead.y + 4, {steps:8}); await page.mouse.up();
    assert.notDeepEqual(await snapshot(), beforeShape);
    await page.getByTestId('edit-toggle').click(); await page.getByTestId('undo-edit').click();
    assert.deepEqual(await snapshot(), beforeShape);
    const baseScreen = await project(center), movedBase = await project({ ...center, x: center.x + .15 });
    await page.mouse.move(baseScreen.x, baseScreen.y); await page.mouse.down();
    assert.equal((await state()).transaction.operation, 'base');
    await page.mouse.move(movedBase.x, movedBase.y, {steps:8}); await page.mouse.up();
    assert.notDeepEqual(await snapshot(), beforeShape);
    await page.getByTestId('edit-toggle').click(); await page.getByTestId('undo-edit').click(); assert.deepEqual(await snapshot(), beforeShape);
    const aimPoint = await page.evaluate(async () => {
      const { fromCanonicalPlantGraph, sampleBranch } = await import('/src/core/index.ts');
      const graph=fromCanonicalPlantGraph(window.__IKEBANA_TEST__.getCanonicalSnapshot().plants[0]);
      const branch=graph.branches.get(graph.rootBranchId); return sampleBranch(branch,branch.activeLength * .84).position;
    });
    const aim = await project(aimPoint);
    await page.mouse.move(aim.x,aim.y); await page.mouse.down(); assert.equal((await state()).transaction.operation,'aim');
    await page.mouse.move(aim.x+18,aim.y+5,{steps:8}); await page.mouse.up(); assert.notDeepEqual(await snapshot(),beforeShape);
    await page.getByTestId('edit-toggle').click(); await page.getByTestId('undo-edit').click(); assert.deepEqual(await snapshot(), beforeShape);
    await page.getByTestId('tool-prune').click();
    const cutPoint = await page.evaluate(async () => {
      const { fromCanonicalPlantGraph, sampleBranch } = await import('/src/core/index.ts');
      const graph = fromCanonicalPlantGraph(window.__IKEBANA_TEST__.getCanonicalSnapshot().plants[0]);
      const branch = graph.branches.get(graph.rootBranchId);
      return sampleBranch(branch, branch.activeLength * .72).position;
    });
    const cut = await project(cutPoint);
    await page.mouse.move(cut.x, cut.y); await page.mouse.down(); assert.equal((await state()).transaction.operation, 'prune'); await page.mouse.up();
    assert.notDeepEqual(await snapshot(), beforeShape);
    await page.getByTestId('edit-toggle').click(); await page.getByTestId('undo-edit').click(); assert.deepEqual(await snapshot(), beforeShape);
    await page.getByTestId('tool-shape').click();
    await page.getByTestId('view-toggle').click(); await page.getByTestId('stem-prevention-toggle').click(); await page.getByTestId('view-toggle').click();
    await material('single-flower'); await page.getByTestId('material-source').focus(); await page.keyboard.press('Enter');
    await material('fern-frond'); await page.getByTestId('material-source').focus(); await page.keyboard.press('Enter');
    assert.equal((await state()).successfulSeatOrdinal, 3);
    const canonical = await snapshot();
    const beforeAppearanceState=await state(), beforeAppearanceWrites=await writes();
    await page.getByTestId('more-toggle').click(); await page.getByTestId('vessel-appearance-open').click();
    await page.getByTestId('vessel-color').selectOption('celadon'); await page.getByTestId('vessel-finish').selectOption('stoneware');
    assert.deepEqual(await snapshot(),canonical); assert.equal(await writes(),beforeAppearanceWrites);
    assert.equal((await state()).cameraHash,beforeAppearanceState.cameraHash);
    await page.locator('#vessel-appearance-close').click();
    await page.reload(); await ready(); assert.deepEqual(await snapshot(),canonical);
    assert.deepEqual((await bridge(()=>window.__IKEBANA_TEST__.getVesselPresentation())).vessels[0].appearance,{colorId:'celadon',finishId:'stoneware'});
    await page.getByTestId('more-toggle').click(); await page.getByTestId('vessel-appearance-open').click();
    await page.getByTestId('vessel-color').selectOption('sand'); await page.getByTestId('vessel-finish').selectOption('glaze');
    await page.locator('#vessel-appearance-close').click();
    await page.getByTestId('posture-step-back').click();
    for (const name of ['front', 'three-quarter', 'above']) {
      await view(name); await page.screenshot({ path: `${output}/${id}-${name}.png` });
    }
    await page.reload(); await ready(); assert.deepEqual(await snapshot(), canonical, 'reload retains graph bytes');
    await garden(); await page.locator('#garden-name').fill(`${id} reference`); await page.locator('#garden-keep').click();
    await page.locator('.garden-card-view').first().click();
    assert.equal((await state()).posture, 'step-back'); assert.deepEqual(await snapshot(), canonical);
    await page.locator('#garden-return').click(); assert.deepEqual(await snapshot(), canonical);
    await garden(); await page.locator('#garden-name').fill(`${id} second`); await page.locator('#garden-keep').click();
    await page.locator('.garden-compare-toggle').nth(0).click();
    await page.locator('.garden-compare-toggle').nth(1).click();
    await page.locator('#garden-compare-go').click();
    await page.locator('[data-compare-view="above"]').click();
    await page.screenshot({ path: `${output}/${id}-garden-compare.png` });
    await page.locator('#garden-compare-leave').click(); await page.locator('#garden-close').click();
    assert.deepEqual(await snapshot(), canonical);
    assert.equal(await bridge(() => localStorage.getItem('ikebana-web-alpha:studio-v1')), oldSave);
    await writeFile(`${output}/${id}-arrangement.json`, JSON.stringify(canonical, null, 2));
    results.push({ id, pointerInsertion: 'pass', protectedAimBaseBendPruneUndo: 'pass', appearanceNoGraphOrSaveChange: 'pass', appearanceURLReload: 'pass', invalidSeat: 'pass', cancelNoSave: 'pass', keyboardInsertion: 'pass', reload: 'pass', gardenViewReturnCompare: 'pass', oldBowlUntouched: 'pass' });
    await writeFile(`${output}/checks.json`, JSON.stringify({ results, errors, physicalPhoneTested:false }, null, 2));
    console.log('PASS', id);
  }
  await page.goto(baseURL + '?test=1'); await ready(); assert.deepEqual(await snapshot(), oldGraph);
  for (const id of ['petite','long-bed','vessel-pair']) {
    await page.setViewportSize({width:320,height:640});
    await page.goto(baseURL + `?test=1&vesselStudy=${id}`); await ready();
    await page.getByTestId('view-toggle').click();
    await page.getByTestId('stem-overlaps-toggle').click();
    if (await page.getByTestId('view-toggle').getAttribute('aria-expanded') !== 'true') await page.getByTestId('view-toggle').click();
    await page.getByTestId('stem-prevention-toggle').click();
    if (await page.getByTestId('view-toggle').getAttribute('aria-expanded') !== 'true') await page.getByTestId('view-toggle').click();
    assert.equal(await page.getByTestId('stem-overlaps-toggle').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByTestId('stem-prevention-toggle').getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: `${output}/${id}-phone-controls.png` });
    await page.getByTestId('view-toggle').click();
    await page.getByTestId('posture-step-back').click();
    await page.screenshot({ path: `${output}/${id}-phone.png` });
    await page.getByTestId('more-toggle').click(); await page.getByTestId('vessel-appearance-open').click();
    await page.getByTestId('vessel-color').selectOption('charcoal'); await page.getByTestId('vessel-finish').selectOption('stoneware');
    await page.screenshot({path:`${output}/${id}-phone-appearance.png`});
    await page.locator('#vessel-appearance-close').click();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/checks.json`, JSON.stringify({ viewport:[1100,850], phoneViewport:[320,640], results, errors, physicalPhoneTested:false }, null, 2));
} finally { await browser.close(); }
