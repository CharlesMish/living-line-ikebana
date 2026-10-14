/**
 * Assisted GPU regression adapted from Claude's prune_preview_tint.py report.
 * Ordinary UI input seats/cuts/undoes a flowering branch; the bridge is read-only.
 * Pixel comparisons use the same screenshot-derived flower mask, graph and camera.
 * This is neither a blind player nor physical-phone/performance evidence.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const state = page => page.evaluate(() => ({
  graph: window.__IKEBANA_TEST__.getCanonicalSnapshot(),
  camera: window.__IKEBANA_TEST__.getState().cameraHash,
  audit: window.__IKEBANA_TEST__.getAutosaveAudit(),
}));
// Claude's supplied reproduction identifies this upper-right petal crop in
// the fixed 1280×800 Front fixture. Keep it explicit: it isolates the flower
// from brown wood and the red bud without rejecting its warm pink colours.
const FLOWER_BOX = { left: 690, top: 200, right: 725, bottom: 235 };

async function flowerDifference(page, before, after, railBottom) {
  assert.ok(FLOWER_BOX.top > railBottom, "The measured flower is below the toolbar");
  return page.evaluate(async ({ a, b, box }) => {
    async function pixels(base64) {
      const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      bitmap.close();
      return { data, width: canvas.width, height: canvas.height };
    }
    const first = await pixels(a), second = await pixels(b);
    if (first.width !== second.width || first.height !== second.height) throw new Error("Mismatched screenshot size");
    let count = 0, difference = 0, initial = 0, final = 0, changed = 0;
    if (box.right > first.width || box.bottom > first.height) throw new Error("Flower crop exceeds screenshot");
    for (let y = box.top; y < box.bottom; y++) {
      for (let x = box.left; x < box.right; x++) {
        const offset = 4 * (y * first.width + x), r = first.data[offset], g = first.data[offset + 1];
        // Pink petals inside the independently identified flower crop.
        // Natural warm pink has blue BELOW green: a blue>green condition
        // sampled the red bud instead and missed this reproduced regression.
        // Freeze this mask from the original only: a dark/absent flower cannot
        // escape the comparison by failing the threshold in the later image.
        if (!(r > g + 15)) continue;
        count++;
        let delta = 0;
        for (let channel = 0; channel < 3; channel++) {
          initial += first.data[offset + channel]; final += second.data[offset + channel];
          delta += Math.abs(first.data[offset + channel] - second.data[offset + channel]);
        }
        difference += delta;
        if (delta > 15) changed++;
      }
    }
    return { box, flowerPixels: count, meanChannelDifference: count ? difference / (count * 3) : null,
      brightnessChange: initial ? final / initial - 1 : null, changedFraction: count ? changed / count : null };
  }, { a: before.toString("base64"), b: after.toString("base64"), box: FLOWER_BOX });
}

export async function runPrunePreviewTint({ browser, baseURL, output, name = "prune-candidate" }) {
  await mkdir(output, { recursive: true });
  const result = { name, status: "RUNNING", input: "Assisted ordinary keyboard seating and mouse hover/cut/Undo; read-only projected branch target", errors: [], images: [], checks: [] };
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(20_000);
  page.on("pageerror", error => result.errors.push(String(error)));
  page.on("console", message => { if (message.type() === "error") result.errors.push(message.text()); });
  const capture = async suffix => {
    await painted(page);
    const filename = `${name}-${suffix}.png`;
    const image = await page.screenshot({ path: path.join(output, filename) });
    result.images.push(filename); return image;
  };
  try {
    const url = new URL(baseURL); url.searchParams.set("test", "1");
    assert.ok((await page.goto(url.href, { waitUntil: "networkidle" }))?.ok());
    await page.locator('[data-testid="app-root"][data-ready="true"]').waitFor();
    await page.waitForFunction(() => Boolean(window.__IKEBANA_TEST__));
    assert.equal((await state(page)).graph.plants.length, 0);
    await page.getByTestId("material-source").focus(); await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__IKEBANA_TEST__.getCanonicalSnapshot().plants.length === 1);
    await page.mouse.move(1150, 700);
    const initial = await state(page), plant = initial.graph.plants[0];
    assert.equal(plant.generatorVersion, "one-branch-v1");
    result.fixture = { plantId: plant.id, seed: plant.seed, generatorVersion: plant.generatorVersion };
    const target = await page.evaluate(rootId => window.__IKEBANA_TEST__.getScreenTargets().find(item => item.role === "branch" && item.branchId === rootId), plant.rootBranchId);
    assert.ok(target && Number.isFinite(target.x) && Number.isFinite(target.y));
    // The root's middle station is clear of the rail and cuts off the flowers.
    // Read the actual chrome geometry; never silently hover a toolbar instead.
    const railBottom = await page.getByTestId("tool-prune").evaluate(element => element.closest("header")?.getBoundingClientRect().bottom ?? element.getBoundingClientRect().bottom);
    assert.ok(target.y > railBottom + 8 && target.y < 700 && target.x > 0 && target.x < 1280, "Prune target is in the exposed scene");
    result.target = target; result.railBottom = railBottom;
    const before = await capture("before");

    await page.getByTestId("tool-prune").click();
    await page.mouse.move(target.x, target.y, { steps: 5 });
    const preview = await capture("preview");
    result.preview = await flowerDifference(page, before, preview, railBottom);
    assert.ok(result.preview.flowerPixels >= 100, "Original flower crop contains enough petals, not empty background or a stray bud");
    assert.ok(result.preview.meanChannelDifference > 8 && result.preview.changedFraction > .15, "Actual prune hover visibly ghosts the flower");
    assert.deepEqual(await state(page), initial, "Hover preview writes no graph, camera or save");
    result.checks.push("genuine-preview");
    await page.mouse.move(1150, 700, { steps: 5 });
    await page.getByTestId("tool-shape").click(); await page.mouse.move(1150, 700);
    const cancelled = await capture("after-hover");
    assert.deepEqual(await state(page), initial, "Leaving preview restores the exact graph/camera with zero saves");
    result.hoverRecovery = await flowerDifference(page, before, cancelled, railBottom);

    await page.getByTestId("tool-prune").click();
    await page.mouse.move(target.x, target.y, { steps: 5 });
    await painted(page); await page.mouse.down(); await painted(page); await page.mouse.up();
    await page.mouse.move(1150, 700);
    assert.notDeepEqual((await state(page)).graph, initial.graph, "The ordinary cut really committed");
    await page.getByTestId("tool-shape").click();
    await page.getByTestId("edit-toggle").click();
    await page.getByTestId("undo-edit").click();
    // Undo normally closes the menu. Explicitly close only if still open.
    if (await page.locator("#edit-options").isVisible()) await page.keyboard.press("Escape");
    await page.mouse.move(1150, 700);
    const restored = await state(page);
    assert.deepEqual(restored.graph, initial.graph, "Undo restores exact graph, including inactive history");
    assert.equal(restored.camera, initial.camera, "Undo did not reframe the scene");
    const undone = await capture("after-undo");
    result.undoRecovery = await flowerDifference(page, before, undone, railBottom);
    assert.deepEqual(result.errors, []);
    const restoredColour = sample => sample.flowerPixels >= 100 && sample.meanChannelDifference <= 3 && Math.abs(sample.brightnessChange) <= .03;
    result.hoverRestored = restoredColour(result.hoverRecovery);
    result.undoRestored = restoredColour(result.undoRecovery);
    result.checks.push("cut-committed", "undo-exact-graph-and-camera");
    result.status = result.hoverRestored && result.undoRestored ? "PASS" : "FAIL";
    if (result.status === "FAIL") result.failure = "flower-colour-not-restored";
  } catch (error) {
    result.status = "FAIL"; result.failure = "setup-or-interaction-failure"; result.error = error.stack ?? String(error);
    try { await capture("failure"); } catch { /* Retain original failure. */ }
  } finally {
    await context.close();
    await writeFile(path.join(output, `${name}.json`), JSON.stringify(result, null, 2));
  }
  return result;
}

/** The caller builds both refs; this helper never fetches or modifies a checkout. */
export async function runPrunePreviewComparison({ browser, baseURL, output, baselineDirectory = process.env.IKEBANA_PRUNE_BASELINE_DIR }) {
  assert.ok(baselineDirectory, "Set IKEBANA_PRUNE_BASELINE_DIR to the separately built pinned baseline checkout");
  const baselineURL = "http://127.0.0.1:4174/";
  const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--outDir", path.resolve(baselineDirectory, "dist"), "--host", "127.0.0.1", "--port", "4174", "--strictPort"], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "", launchError;
  server.stdout.on("data", data => { log += data; }); server.stderr.on("data", data => { log += data; });
  server.on("error", error => { launchError = error; });
  const result = { status: "RUNNING", baseline: null, candidate: null };
  try {
    const deadline = Date.now() + 30_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (server.exitCode !== null) throw new Error(`Baseline server exited ${server.exitCode}: ${log}`);
      try { ready = (await fetch(baselineURL, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Bounded startup polling. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(ready, "Baseline preview starts within 30 seconds");
    result.baseline = await runPrunePreviewTint({ browser, baseURL: baselineURL, output, name: "prune-baseline" });
    result.candidate = await runPrunePreviewTint({ browser, baseURL, output, name: "prune-candidate" });
    assert.equal(result.baseline.failure, "flower-colour-not-restored", "Old build must fail on colour restoration, not setup or unrelated input");
    assert.equal(result.baseline.hoverRestored, false, "Old build reproduces hover-only colour damage");
    assert.equal(result.candidate.status, "PASS", JSON.stringify(result.candidate));
    assert.deepEqual(result.candidate.fixture, result.baseline.fixture, "Compare the same generated cutting");
    result.status = "PASS";
  } catch (error) {
    result.status = "FAIL"; result.failure = error.stack ?? String(error);
  } finally {
    if (server.exitCode === null) server.kill("SIGTERM");
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "prune-baseline-server.log"), log);
    await writeFile(path.join(output, "prune-comparison.json"), JSON.stringify(result, null, 2));
  }
  return result;
}
