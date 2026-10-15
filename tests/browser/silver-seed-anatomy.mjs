/** Matched, explicitly assisted Silver seed appearance evidence.
 * Fresh ordinary keyboard seating supplies the same stock on both builds.
 * Read-only graph coordinates centre one disc through native Frame sliders;
 * there is no graph injection, automatic taste verdict or phone claim. */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const BASELINE = "7a9a12dab892e48e758de845b5e091ec25431a47";
const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function captureBuild({ browser, baseURL, output, prefix }) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 850 }, acceptDownloads: true, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  const result = { prefix, status: "RUNNING", images: [], frames: [], errors: [] };
  page.on("pageerror", error => result.errors.push(String(error)));
  page.on("console", message => { if (message.type() === "error") result.errors.push(message.text()); });
  const state = () => page.evaluate(() => ({ canonical: window.__IKEBANA_TEST__.getCanonicalSnapshot(), audit: window.__IKEBANA_TEST__.getAutosaveAudit() }));
  const studio = async id => { await page.getByTestId("more-toggle").click(); await page.locator(`#${id}`).click(); };
  const capture = async suffix => {
    await painted(page);
    const file = `${prefix}-${suffix}.png`;
    await page.screenshot({ path: path.join(output, file) }); result.images.push(file);
  };
  const range = async (id, value) => {
    const slider = page.locator(`#photo-${id}`);
    const current = Number(await slider.inputValue()), step = Number(await slider.getAttribute("step"));
    await slider.focus();
    for (let i = 0; i < Math.round(Math.abs(value - current) / step); i++) await page.keyboard.press(value > current ? "ArrowRight" : "ArrowLeft");
    assert.ok(Math.abs(Number(await slider.inputValue()) - value) < .001, `${id} reaches the requested frame through ordinary keys`);
  };
  try {
    const url = new URL(baseURL); url.searchParams.set("test", "1");
    await page.goto(url.href, { waitUntil: "networkidle" });
    await page.locator('[data-testid="app-root"][data-ready="true"]').waitFor();
    await page.getByTestId("materials-toggle").click(); await page.getByTestId("material-choice-silver-seed").click();
    await page.getByTestId("material-source").focus(); await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__IKEBANA_TEST__.getCanonicalSnapshot().plants.length === 1);
    result.fixture = (await state()).canonical.plants;
    for (const backdrop of ["paper", "ink"]) {
      await studio("working-backdrop-open"); await page.locator(`#working-backdrop-choice-${backdrop}`).click(); await page.locator("#working-backdrop-close").click();
      for (const angle of ["front", "three-quarter"]) {
        await page.getByTestId("view-toggle").click(); await page.getByTestId(`view-${angle}`).click();
        await capture(`bowl-${backdrop}-${angle}`);
      }
    }
    await page.getByTestId("view-toggle").click(); await page.getByTestId("view-front").click();
    for (const face of ["front", "reverse"]) {
      if (face === "reverse") {
        // This is an intentional whole-stock turn, not a hit-acquisition test.
        await page.getByTestId("edit-toggle").click();
        for (let i = 0; i < 12; i++) await page.locator("#turn-cutting-right").click();
        await page.keyboard.press("Escape");
      }
      const beforePhoto = await state(), graph = beforePhoto.canonical.plants[0];
      const stalk = graph.branches.find(branch => branch.id.endsWith(":disc-stalk-2-2"));
      const disc = graph.organs.find(organ => organ.branchId === stalk?.id);
      assert.ok(stalk && disc, "Frozen middle-arm disc exists");
      const end = stalk.points.at(-1), previous = stalk.points.at(-2);
      const delta = { x: end.x - previous.x, y: end.y - previous.y, z: end.z - previous.z };
      const length = Math.hypot(delta.x, delta.y, delta.z);
      const centre = Object.fromEntries(["x", "y", "z"].map(axis => [axis, end[axis] + delta[axis] / length * .32 * disc.scale]));
      // Front's target is (0,2.55,0); screen-up is perpendicular to its
      // (0,1.15,15) camera offset. Quantize to the real sliders' .02 steps.
      const round = value => Math.round(value / .02) * .02;
      const horizontal = round(-centre.x), vertical = round(-((centre.y - 2.55) * 15 - centre.z * 1.15) / Math.hypot(15, 1.15));
      await studio("photo-open"); await page.locator("#photo-tab-frame").click();
      await page.locator("#photo-view").selectOption("front"); await page.locator("#photo-reset").click();
      await page.locator("#photo-zoom").focus(); await page.keyboard.press("End");
      await range("horizontal", horizontal); await range("vertical", vertical);
      assert.equal(await page.locator("#photo-zoom").inputValue(), "4.8");
      result.frames.push({ face, disc: disc.id, centre, zoom: 4.8, horizontal, vertical, graph });
      for (const backdrop of ["paper", "ink"]) {
        await page.locator("#photo-tab-scene").click(); await page.locator(`#photo-backdrop-choice-${backdrop}`).click();
        await page.locator("#photo-tab-save").click();
        const old = await page.locator("#photo-result-image").getAttribute("src");
        await page.locator("#photo-export").click();
        await page.waitForFunction(previous => {
          const image = document.querySelector("#photo-result-image");
          return image.getAttribute("src") !== previous && image.complete && image.naturalWidth === 1600 && !document.querySelector("#photo-export").disabled;
        }, old);
        const file = `${prefix}-detail-${backdrop}-${face}.png`;
        const pending = page.waitForEvent("download"); await page.locator("#photo-download").click();
        await (await pending).saveAs(path.join(output, file)); result.images.push(file);
      }
      await page.locator("#photo-return").click();
      assert.deepEqual(await state(), beforePhoto, "Photographic framing/export changes neither the botanical document nor autosaves");
    }
    assert.deepEqual(result.errors, []); result.status = "PASS";
    return result;
  } catch (error) {
    result.status = "FAIL"; result.failure = error.stack ?? String(error);
    try { await capture("failure"); } catch { /* Retain original error. */ }
    throw error;
  } finally {
    await writeFile(path.join(output, `${prefix}.json`), JSON.stringify(result, null, 2));
    await context.close();
  }
}

export async function checkSilverSeedAnatomy({ browser, baseURL, output }) {
  const directory = process.env.IKEBANA_SEED_BASELINE_DIR;
  assert.ok(directory, "Build the pinned pre-refinement Silver seed baseline separately");
  const actualBaseline = execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.equal(actualBaseline, BASELINE, "The rendered baseline source is exactly the pinned pre-refinement commit");
  const baselineURL = "http://127.0.0.1:4176/";
  const report = { baselineCommit: actualBaseline, input: "Assisted keyboard seating, native UI backdrop/view/turn/framing/export controls; read-only graph coordinates centre one disc.", status: "RUNNING" };
  const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--outDir", path.resolve(directory, "dist"), "--host", "127.0.0.1", "--port", "4176", "--strictPort"], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "", launchError;
  server.stdout.on("data", data => { log += data; }); server.stderr.on("data", data => { log += data; });
  server.on("error", error => { launchError = error; });
  try {
    const deadline = Date.now() + 30_000; let ready = false;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (server.exitCode !== null) throw new Error(`Silver seed baseline exited ${server.exitCode}: ${log}`);
      try { ready = (await fetch(baselineURL, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Bounded readiness polling. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(ready, "Pinned Silver seed baseline becomes ready");
    report.before = await captureBuild({ browser, baseURL: baselineURL, output, prefix: "silver-anatomy-before" });
    report.after = await captureBuild({ browser, baseURL, output, prefix: "silver-anatomy-after" });
    assert.deepEqual(report.after.fixture, report.before.fixture, "Exact same material, seed, graph and placement before/after");
    assert.deepEqual(report.after.frames, report.before.frames, "Exact same turned graphs and close framing before/after");
    report.status = "PASS";
    return report;
  } catch (error) {
    report.status = "FAIL"; report.failure = error.stack ?? String(error); throw error;
  } finally {
    if (server.exitCode === null) server.kill("SIGTERM");
    await writeFile(path.join(output, "silver-anatomy-server.log"), log);
    await writeFile(path.join(output, "silver-seed-anatomy.json"), JSON.stringify(report, null, 2));
  }
}
