// Optional local QA. Uses a fresh browser/context; never attaches to a user's tabs.
// Supply PLAYWRIGHT_MODULE only when reusing an existing external installation.
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? require(process.env.PLAYWRIGHT_MODULE) : await import("playwright");
const output = process.env.STUDY_OUTPUT ?? "artifacts/candidate-sol61";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto((process.env.STUDY_ORIGIN ?? "http://127.0.0.1:5193") + "/candidate-study.html");
await page.waitForFunction(() => !!window.__CANDIDATE_STUDY__);
const report = { viewport: [1400, 1000], browser: browser.version(), seeds: [], interactions: [], errors };
const getGraphs = () => page.evaluate(() => window.__CANDIDATE_STUDY__.getGraphs());
const storage = () => page.evaluate(() => Object.keys(localStorage));
assert.deepEqual(await storage(), []);
async function shot(name) {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${output}/${name}.png` });
}
for (const seed of [8278, 9255, 10232]) {
  await page.locator("#seed").fill(String(seed)); await page.locator("#pair").click();
  report.seeds.push({ seed, graphs: await getGraphs() });
  for (const view of ["front", "angle", "back"]) {
    await page.locator(`[data-view=${view}]`).click(); await shot(`pair-${seed}-${view}`);
  }
}
await page.locator("#seed").fill("8278"); await page.locator("#mixed").click();
for (const view of ["front", "angle", "back"]) {
  await page.locator(`[data-view=${view}]`).click(); await shot(`mixed-${view}`);
}
// Comparators use the same seed, world units and camera (no per-material fitting).
for (const value of ["sparse-cane", "paired-leaf", "reed", "leafy-shoot", "flowering-branch"]) {
  await page.locator("#clear").click(); await page.locator("#material").selectOption(value);
  await page.locator("#insert").click(); await page.locator("#look").click();
  await page.locator("[data-view=front]").click(); await shot(`single-${value}`);
}
await page.locator("#pair").click(); await page.locator("[data-view=front]").click();
await page.locator("#bend").click();
async function dragRoot(dx, dy, cancel = false) {
  const root = (await getGraphs())[0].rootBranchId;
  const p = await page.evaluate(root => window.__CANDIDATE_STUDY__.project(0, root), root);
  await page.mouse.move(p.clientX, p.clientY); await page.mouse.down();
  await page.mouse.move(p.clientX + dx, p.clientY + dy, { steps: 12 });
  const state = await page.evaluate(() => window.__CANDIDATE_STUDY__.state());
  assert.equal(state.transaction, true); assert.equal(state.preview, true);
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
}
const beforeBend = await getGraphs();
await dragRoot(90, -25, true);
assert.deepEqual(await getGraphs(), beforeBend); report.interactions.push("Escape cancels bend preview");
await dragRoot(100, -30);
assert.notDeepEqual(await getGraphs(), beforeBend); report.interactions.push("Owner release commits bend");
await page.locator("#look").click(); await shot("bent-pair-front");
await page.locator("[data-view=back]").click(); await shot("bent-pair-back");
await page.locator("#undo").click(); assert.deepEqual(await getGraphs(), beforeBend);
report.interactions.push("Undo restores exact pre-bend graph");
await page.locator("[data-view=front]").click(); await page.locator("#aim").click();
await dragRoot(-75, 20);
assert.notDeepEqual(await getGraphs(), beforeBend); report.interactions.push("Aim release changes cutting");
await page.locator("#undo").click(); assert.deepEqual(await getGraphs(), beforeBend);
await page.locator("#prune").click();
await page.locator("#branch").selectOption("candidate-1:twig-1");
await page.locator("#cut").fill("10"); await page.locator("#cut").dispatchEvent("input");
assert.deepEqual(await getGraphs(), beforeBend);
await shot("prune-preview"); await page.locator("#cancel").click();
assert.deepEqual(await getGraphs(), beforeBend); report.interactions.push("Prune slider preview and cancel do not mutate");
await page.locator("#apply-cut").click();
const afterCut = await getGraphs();
assert.equal(afterCut[0].organs.filter(o => o.active).length, 2);
assert.deepEqual(afterCut[1], beforeBend[1]); report.interactions.push("Cane branchlet cut removes three leaves; neighboring cutting stays identical");
await page.locator("#look").click(); await shot("opened-pair-front");
await page.locator("[data-view=back]").click(); await shot("opened-pair-back");
await page.locator("#undo").click(); assert.deepEqual(await getGraphs(), beforeBend);
// Pointer prune uses immutable original geometry; a pointer cancellation rolls back.
await page.locator("[data-view=front]").click(); await page.locator("#prune").click();
const root = beforeBend[0].rootBranchId;
const p = await page.evaluate(root => window.__CANDIDATE_STUDY__.project(0, root, 0.65), root);
await page.mouse.move(p.clientX, p.clientY); await page.mouse.down();
await page.mouse.move(p.clientX + 4, p.clientY + 20, { steps: 4 });
assert.equal((await page.evaluate(() => window.__CANDIDATE_STUDY__.state())).transaction, true);
await page.keyboard.press("Escape"); await page.mouse.up();
assert.deepEqual(await getGraphs(), beforeBend); report.interactions.push("Pointer prune cancellation retains the exact bowl");
assert.deepEqual(await storage(), []); assert.deepEqual(errors, []);
const inventory = await page.evaluate(() => window.__CANDIDATE_STUDY__.inventory());
for (const graph of await getGraphs()) {
  const rendered = inventory.find(item => item.plantId === graph.id);
  assert.deepEqual(rendered.branchIds, graph.branches.filter(b => b.active).map(b => b.id).sort());
  assert.deepEqual(rendered.organIds, graph.organs.filter(o => o.active).map(o => o.id).sort());
}
report.interactions.push("All active branches/organs rendered; zero localStorage writes; zero page errors");
await writeFile(`${output}/browser-qa.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify({ screenshots: output, seeds: report.seeds.map(s => s.seed), interactions: report.interactions, errors }));
