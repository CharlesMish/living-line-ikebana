/** Optional Playwright check. Uses a new browser/profile, never a player bowl.
 * IKEBANA_URL=http://127.0.0.1:4173 node tests/browser/phone-chrome.mjs
 * Physical iPhone/Safari feel is separate from these automated checks. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.IKEBANA_EVIDENCE_DIR;
if(output) await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try {
 for(const [width,height,textScale] of (process.env.IKEBANA_TEXT_ONLY ? [[390,844,2]] : [[320,568,1],[390,844,1],[430,932,1],[844,390,1],[568,320,1],[1280,900,1],[390,844,2]])) {
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const url=new URL(process.env.IKEBANA_URL??'http://127.0.0.1:4173');url.searchParams.set('test','1');
  await page.goto(url.href);await page.locator('[data-ready="true"]').waitFor();
  if(textScale!==1) {
   // Assert the actual computed size, not merely a requested text scale.
   await page.evaluate(()=>{document.documentElement.style.setProperty('font-size','32px','important');});
   await page.waitForFunction(()=>getComputedStyle(document.documentElement).fontSize==='32px');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize),'32px');
  }
  const before=await page.evaluate(()=>({state:window.__IKEBANA_TEST__.getState(),audit:window.__IKEBANA_TEST__.getAutosaveAudit(),storage:Object.entries(localStorage)}));
  const boxes=await page.evaluate(()=>Array.from(document.querySelectorAll('.posture-control button,.top-actions > div > button,.tool-control button,#selected-cutting,#materials-toggle')).map(b=>{
   const r=b.getBoundingClientRect();return{label:b.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height};
  }));
  for(const b of boxes) {
   assert.ok(b.x>=0 && b.x+b.w<=width+.5 && b.y+b.h<=height,`${width} ${b.label} stays in viewport`);
   assert.ok(b.h>=44,`${b.label} has a 44px target`);
  }
  if(width<=640) {
   assert.equal(boxes[0].y,boxes[1].y,'mode pair aligns');
   assert.equal(boxes[2].y,boxes[3].y,'actions align');assert.equal(boxes[3].y,boxes[4].y);
   assert.ok(boxes[2].y>=boxes[0].y+boxes[0].h,'action row follows mode row');
   assert.ok(Math.abs(boxes[2].w-boxes[4].w)<1,'action columns are equal');
  }
  if(output) await page.screenshot({path:`${output}/after-${width}x${height}-text${textScale}.png`});
  for(let i=0;i<3;i++) {
   await page.getByTestId('more-toggle').click();
   await page.locator('#more-options:not([hidden])').waitFor();
   assert.equal(await page.getByTestId('more-toggle').getAttribute('aria-expanded'),'true');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#more-options').isVisible(),false);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'more-toggle');
   await page.getByTestId('more-toggle').click();await page.getByTestId('view-toggle').click();
   assert.equal(await page.locator('#more-options').isVisible(),false);
   await page.keyboard.press('Escape');
   await page.getByTestId('more-toggle').click();await page.getByTestId('posture-arrange').click();
   assert.equal(await page.locator('#more-options').isVisible(),false);
  }
  await page.getByTestId('more-toggle').focus();await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'garden-open');
  await page.keyboard.press('Enter');await page.locator('#garden-dialog[open]').waitFor();
  assert.equal(await page.locator('#more-options').isVisible(),false);
  await page.locator('#garden-close').click();
  await page.waitForFunction(()=>document.activeElement.id==='more-toggle');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'more-toggle');
  await page.keyboard.press('Enter');await page.keyboard.press('Tab');await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'experiment-toggle');
  await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'experiment-close');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'more-toggle');
  await page.keyboard.press('Enter');await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.keyboard.press('Tab');
  assert.equal(await page.locator('#more-options').isVisible(),false,'tabbing outside dismisses More');
  await page.getByTestId('view-toggle').click();
  await page.getByTestId('stem-prevention-toggle').click();
  await page.getByTestId('view-toggle').click();
  assert.equal(await page.getByTestId('stem-prevention-toggle').getAttribute('aria-pressed'),'true');
  assert.equal(await page.getByTestId('stem-overlaps-toggle').getAttribute('aria-pressed'),'false');
  await page.getByTestId('stem-overlaps-toggle').click();await page.getByTestId('view-toggle').click();
  assert.equal(await page.getByTestId('stem-overlaps-toggle').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#stem-overlaps-note').textContent(),/indicators, not drag handles/);
  await page.getByTestId('stem-prevention-toggle').click();await page.getByTestId('view-toggle').click();
  assert.equal(await page.getByTestId('stem-overlaps-toggle').getAttribute('aria-pressed'),'true');
  await page.getByTestId('stem-overlaps-toggle').click();
  const after=await page.evaluate(()=>({state:window.__IKEBANA_TEST__.getState(),audit:window.__IKEBANA_TEST__.getAutosaveAudit(),storage:Object.entries(localStorage)}));
  assert.equal(after.state.canonicalHash,before.state.canonicalHash);assert.equal(after.state.cameraHash,before.state.cameraHash);
  assert.equal(after.audit.writes.length,before.audit.writes.length);assert.deepEqual(after.storage,before.storage);
  assert.deepEqual(errors,[]);
  results.push({width,height,textScale,boxes,menuCycles:3,status:'PASS'});
  console.log(`PASS phone chrome ${width}x${height} text ${textScale}`);
  await context.close();
 }
} finally {
 await browser.close();if(output) await writeFile(`${output}/phone-chrome-results.json`,JSON.stringify(results,null,2));
}
