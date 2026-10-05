/** Validate the actual downloadable file with synthetic saves in a fresh context. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const out = process.env.IKEBANA_EVIDENCE_DIR ?? "artifacts/camera-views";
await mkdir(out, { recursive: true });
const file = path.resolve(process.env.IKEBANA_STANDALONE ?? "dist/camera-ab-study.html");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1100, height: 850 }, acceptDownloads: true });
const p = await context.newPage(), errors = [], requests = [];
p.on("pageerror", e => errors.push(String(e)));
p.on("request", r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
const graph = () => p.evaluate(() => window.__IKEBANA_TEST__.getCanonicalSnapshot());
const state = () => p.evaluate(() => window.__IKEBANA_TEST__.getState());
async function action(kind, slot) { await p.locator("#view-toggle").click(); await p.locator(`#camera-${kind}-${slot}`).click(); }
async function capture(name) {
  const download = p.waitForEvent("download"); await p.locator("#photo-export").click();
  await (await download).saveAs(`${out}/${name}.png`);
  await p.waitForFunction(() => !document.querySelector("#photo-export").disabled);
}
try {
  await p.goto(pathToFileURL(file).href + "?test=1");
  await p.locator("[data-ready=true]").waitFor();
  assert.equal(new URL(p.url()).searchParams.get("cameraViews"), "1");
  const before = await graph(); assert.equal(before.plants.length, 4);
  await action("store", "A"); const a = (await state()).cameraHash;
  await p.getByTestId("posture-step-back").click(); await p.mouse.move(450, 400); await p.mouse.wheel(0, -500);
  // Wait for the committed wheel gesture's normal settling boundary.
  await p.waitForFunction(() => window.__IKEBANA_TEST__.getState().transaction === null);
  const b = (await state()).cameraHash; assert.notEqual(a, b);
  await action("store", "B"); await p.getByTestId("posture-arrange").click();
  await action("recall", "A"); assert.equal((await state()).cameraHash, a);
  await action("recall", "B"); assert.equal((await state()).cameraHash, b);
  await p.locator("#more-toggle").click(); await p.locator("#photo-open").click();
  await p.locator("#photo-backdrop").selectOption("transparent"); await p.locator("#photo-format").selectOption("portrait");
  await capture("standalone-transparent-B"); await capture("standalone-transparent-B-repeat");
  const digest = async name => createHash("sha256").update(await readFile(`${out}/${name}.png`)).digest("hex");
  assert.equal(await digest("standalone-transparent-B"), await digest("standalone-transparent-B-repeat"));
  await p.locator("#photo-close").click(); assert.deepEqual(await graph(), before); assert.equal((await state()).cameraHash, b);
  await p.reload(); await p.locator("[data-ready=true]").waitFor();
  assert.deepEqual(await graph(), before); assert.equal((await state()).cameraHash, b);
  await p.locator("#view-toggle").click(); assert.ok(await p.locator("#camera-recall-A").isDisabled()); assert.ok(await p.locator("#camera-recall-B").isDisabled());
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  await writeFile(`${out}/standalone-checks.json`, JSON.stringify({ file, offline: true, syntheticPlants: 4, recalls: true, repeatedTransparentExport: true, closePreservesCameraAndGraph: true, reloadRetainsCurrentViewAndSave: true, reloadClearsSlots: true, errors, externalRequests: requests }, null, 2));
  console.log("PASS offline standalone, actual A/B, repeated transparent export, close and reload");
} finally { await browser.close(); }
