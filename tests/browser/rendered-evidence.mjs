/**
 * Opt-in rendered evidence for GitHub Actions. This is an assisted regression
 * workflow, not a blind player, physical phone trial, or performance benchmark.
 * All edits use ordinary UI input. The test bridge is read-only throughout.
 *
 * The job installs pinned Playwright outside the application, builds dist, then
 * calls this script with IKEBANA_RENDER_EVIDENCE=1 and PLAYWRIGHT_MODULE set.
 * It owns its temporary local preview process and fresh browser contexts.
 */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (process.env.IKEBANA_RENDER_EVIDENCE !== "1") {
  console.log("SKIP rendered evidence (set IKEBANA_RENDER_EVIDENCE=1 to enable)");
  process.exit(0);
}

const output = path.resolve(process.env.IKEBANA_EVIDENCE_DIR ?? "artifacts/rendered-evidence");
await mkdir(output, { recursive: true });
const record = {
  testedCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  proposedHead: process.env.IKEBANA_PR_HEAD ?? null,
  browser: null,
  input: "Assisted UI regression: ordinary keyboard insertion, locator clicks/taps, select options, and arrow-key sliders. No scripted graph mutation or guessed canvas targets.",
  limitations: [
    "Chromium with requested SwiftShader software rendering, not a physical phone or Safari.",
    "Viewport emulation and 150% root text are layout probes, not full browser accessibility-zoom coverage.",
    "Keyboard seating intentionally avoids placement; this cannot establish drag/tap acquisition usability.",
    "Screenshots are inspection artifacts, not automatically approved aesthetics or pixel goldens.",
    "No frame-time or FPS measurements are made.",
  ],
  cases: [],
  fatalError: null,
};
const cases = [
  { width: 320, height: 640, mobile: true, text: 1 },
  { width: 390, height: 844, mobile: true, text: 1, png: true },
  { width: 844, height: 390, mobile: true, text: 1 },
  { width: 1280, height: 800, mobile: false, text: 1, png: true },
  { width: 390, height: 844, mobile: true, text: 1.5 },
];

let server, serverLog, browser;
const baseURL = process.env.IKEBANA_URL ?? "http://127.0.0.1:4173/";
async function startPreview() {
  if (process.env.IKEBANA_URL) return;
  serverLog = createWriteStream(path.join(output, "preview-server.log"));
  server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], { stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.pipe(serverLog); server.stderr.pipe(serverLog);
  let launchError;
  server.on("error", error => { launchError = error; });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (server.exitCode !== null) throw new Error(`Preview process exited with ${server.exitCode}`);
    try { if ((await fetch(baseURL, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* Bounded readiness polling. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("Built preview did not become ready within 30 seconds");
}

const readState = page => page.evaluate(() => ({
  state: window.__IKEBANA_TEST__.getState(),
  canonical: window.__IKEBANA_TEST__.getCanonicalSnapshot(),
  audit: window.__IKEBANA_TEST__.getAutosaveAudit(),
}));
const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
function inside(box, width, height, label) {
  assert.ok(box && box.width > 0 && box.height > 0, `${label} has a rendered box`);
  assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1,
    `${label} is inside ${width}×${height}: ${JSON.stringify(box)}`);
}
async function finishVisibility(page, config, id) {
  const slider = page.locator(`#photo-${id}`);
  await slider.scrollIntoViewIfNeeded();
  await slider.press("ArrowRight");
  await painted(page);
  const layout = await page.evaluate(controlId => {
    const rect = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const canvas = document.querySelector("#photo-canvas"), controls = document.querySelector("#photo-controls");
    const r = canvas.getBoundingClientRect();
    return { preview: rect("#photo-canvas"), control: rect(`#photo-${controlId}`),
      controls: rect("#photo-controls"), active: document.activeElement?.id,
      horizontalOverflow: controls.scrollWidth > controls.clientWidth + 1,
      previewAtFront: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === canvas,
      dialogHorizontalOverflow: document.querySelector("#photo-dialog").scrollWidth > document.querySelector("#photo-dialog").clientWidth + 1,
      output: document.querySelector(`#photo-${controlId}-value`).textContent,
    };
  }, id);
  inside(layout.preview, config.width, config.height, "Live preview");
  inside(layout.control, config.width, config.height, `${id} slider`);
  assert.ok(layout.preview.width >= 120 && layout.preview.height >= 64, "Live preview retains a usable area");
  const a = layout.preview, b = layout.control;
  assert.ok(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1,
    "Focused Finish control does not cover the preview");
  assert.equal(layout.active, `photo-${id}`);
  assert.equal(layout.previewAtFront, true, "The preview is not hidden behind another panel");
  assert.equal(layout.horizontalOverflow, false);
  assert.equal(layout.dialogHorizontalOverflow, false);
  return layout;
}

async function exercise(config) {
  const name = `${config.width}x${config.height}-text${config.text}`;
  const result = { name, ...config, status: "RUNNING", errors: [], checks: [], images: [], finishLayout: [] };
  record.cases.push(result);
  const context = await browser.newContext({ viewport: { width: config.width, height: config.height },
    screen: { width: config.width, height: config.height }, deviceScaleFactor: 1,
    isMobile: config.mobile, hasTouch: config.mobile, reducedMotion: "reduce", acceptDownloads: true, locale: "en-US" });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", error => result.errors.push({ kind: "pageerror", message: String(error) }));
  page.on("console", message => { if (message.type() === "error") result.errors.push({ kind: "console", message: message.text() }); });
  const activate = locator => config.mobile ? locator.tap() : locator.click();
  const openStudio = async id => { await activate(page.getByTestId("more-toggle")); await activate(page.locator(`#${id}`)); };
  const capture = async suffix => {
    await painted(page);
    const file = `${name}-${suffix}.png`;
    await page.screenshot({ path: path.join(output, file) }); result.images.push(file);
  };
  try {
    const url = new URL(baseURL); url.searchParams.set("test", "1");
    const response = await page.goto(url.href, { waitUntil: "networkidle" });
    assert.ok(response?.ok(), "The built app loads");
    await page.locator('[data-testid="app-root"][data-ready="true"]').waitFor();
    await page.waitForFunction(() => Boolean(window.__IKEBANA_TEST__));
    if (config.text !== 1) await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, config.text);
    result.rootFontSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    if (config.text !== 1) assert.equal(result.rootFontSize, "24px");
    result.graphics = await page.locator('[data-testid="scene-canvas"]').evaluate(canvas => {
      const gl = canvas.getContext("webgl2"); if (!gl) return { available: false };
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return { available: true, version: gl.getParameter(gl.VERSION),
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
    });
    assert.equal(result.graphics.available, true);
    assert.equal((await readState(page)).canonical.plants.length, 0, "A fresh context starts empty");

    // Explicitly assisted seating through the real keyboard accessibility path.
    await page.getByTestId("material-source").focus(); await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__IKEBANA_TEST__.getCanonicalSnapshot().plants.length === 1);
    await activate(page.getByTestId("materials-toggle"));
    await activate(page.getByTestId("material-choice-single-flower"));
    await page.getByTestId("material-source").focus(); await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__IKEBANA_TEST__.getCanonicalSnapshot().plants.length === 2);
    const seated = await readState(page);
    assert.equal(seated.state.successfulSeatOrdinal, 2);
    result.fixture = { materials: seated.canonical.plants.map(plant => ({ id: plant.id, seed: plant.seed, generatorVersion: plant.generatorVersion })), canonicalHash: seated.state.canonicalHash };
    result.checks.push("Two ordinary keyboard insertions; no graph injection or guessed placement coordinates");
    await capture("arrange");

    // Seating auto-selects the actual cutting. Turn and Undo require no canvas guess.
    await activate(page.getByTestId("edit-toggle"));
    assert.match(await page.locator("#turn-cutting-selection").textContent(), /Single flower/i);
    await activate(page.locator("#turn-cutting-right"));
    const turned = await readState(page);
    assert.notEqual(turned.state.canonicalHash, seated.state.canonicalHash);
    assert.equal(turned.state.cameraHash, seated.state.cameraHash);
    assert.equal(turned.state.successfulSeatOrdinal, seated.state.successfulSeatOrdinal);
    await capture("turn-cutting");
    await activate(page.getByTestId("undo-edit"));
    assert.deepEqual((await readState(page)).canonical, seated.canonical);
    result.checks.push("Turn selected cutting changes its canonical pose, preserves camera/ordinal, and Undo restores exact graph");

    await openStudio("botanical-tones-open");
    await page.locator("#botanical-tones-dialog[open]").waitFor();
    assert.equal(await page.locator("#botanical-tones-current .botanical-tone-card").count(), 2);
    await activate(page.locator("#botanical-tone-single-flower-lilac"));
    assert.equal(await page.locator("#botanical-tone-single-flower-lilac").getAttribute("aria-pressed"), "true");
    await capture("botanical-tones");
    await activate(page.locator("#botanical-tones-close"));
    const beforePhoto = await readState(page);
    assert.deepEqual(beforePhoto.canonical, seated.canonical);
    result.checks.push("In-bowl tone cards and a selected visual swatch render without changing botanical geometry");

    await openStudio("photo-open");
    await page.locator("#photo-dialog[open]").waitFor();
    await activate(page.locator("#photo-tab-scene"));
    await page.locator("#photo-backdrop").selectOption("hills");
    await page.locator("#photo-perch").selectOption("stone");
    await page.locator("#photo-lighting").selectOption("evening");
    await activate(page.locator("#photo-tab-frame"));
    await page.locator("#photo-format").selectOption("landscape");
    await page.locator("#photo-view").selectOption("three-quarter");
    await capture("photo-frame");
    await activate(page.locator("#photo-tab-finish"));
    for (const id of ["warmth", "saturation"]) {
      result.finishLayout.push({ id, ...(await finishVisibility(page, config, id)) });
      await capture(`photo-${id}`);
    }
    assert.equal(await page.locator("#photo-tab-finish").getAttribute("aria-selected"), "true");
    result.checks.push("Live preview and focused Finish sliders stay visible together without horizontal overflow");
    const warmth = await page.locator("#photo-warmth").inputValue();

    if (config.png) {
      await activate(page.locator("#photo-tab-save"));
      await activate(page.locator("#photo-export"));
      await page.waitForFunction(() => {
        const image = document.querySelector("#photo-result-image");
        return image?.complete && image.naturalWidth > 0 && !document.querySelector("#photo-export").disabled;
      });
      assert.equal(await page.locator("#photo-tab-save").getAttribute("aria-selected"), "true");
      const nextDownload = page.waitForEvent("download"); await activate(page.locator("#photo-download"));
      const download = await nextDownload, filename = `${name}-export.png`;
      await download.saveAs(path.join(output, filename));
      const png = await readFile(path.join(output, filename));
      assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(png.readUInt32BE(16), 1600); assert.equal(png.readUInt32BE(20), 1200);
      result.export = { filename, bytes: png.length, width: 1600, height: 1200 }; result.images.push(filename);
      await capture("photo-save");
      result.checks.push("Explicit Prepare then Download produces a 1600×1200 PNG");
    }

    await activate(page.locator("#photo-return"));
    await page.waitForFunction(() => !document.querySelector("#photo-dialog").open);
    await openStudio("photo-open");
    assert.equal(await page.locator("#photo-backdrop").inputValue(), "hills");
    assert.equal(await page.locator("#photo-lighting").inputValue(), "evening");
    assert.equal(await page.locator("#photo-warmth").inputValue(), warmth);
    await activate(page.locator("#photo-tab-save"));
    const setupNote = page.locator(".photo-setup-note");
    if ((await setupNote.getAttribute("open")) === null) await activate(setupNote.locator("summary"));
    await activate(page.locator("#photo-reset-setup"));
    assert.equal(await page.locator("#photo-backdrop").inputValue(), "paper");
    assert.equal(await page.locator("#photo-lighting").inputValue(), "studio");
    await activate(page.locator("#photo-close"));
    const afterPhoto = await readState(page);
    assert.deepEqual(afterPhoto.canonical, beforePhoto.canonical);
    assert.equal(afterPhoto.state.cameraHash, beforePhoto.state.cameraHash);
    assert.deepEqual(afterPhoto.audit, beforePhoto.audit);
    result.checks.push("Photo return/resume/reset preserves exact working graph, camera, ordinal and commit autosave audit");
    assert.deepEqual(result.errors, []);
    result.status = "PASS";
    console.log(`PASS rendered evidence ${name}`);
  } catch (error) {
    result.status = "FAIL"; result.failure = error.stack ?? String(error);
    try { await capture("failure"); } catch { /* Preserve the primary failure. */ }
    console.error(`FAIL rendered evidence ${name}: ${result.failure}`);
  } finally {
    await context.close();
    await writeFile(path.join(output, "checks.json"), JSON.stringify(record, null, 2));
  }
}

try {
  await startPreview();
  const module = process.env.PLAYWRIGHT_MODULE;
  const { chromium } = await import(module && path.isAbsolute(module) ? pathToFileURL(module).href : module ?? "playwright");
  browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  record.browser = browser.version();
  for (const config of cases) await exercise(config);
} catch (error) {
  record.fatalError = error.stack ?? String(error); console.error(record.fatalError);
} finally {
  await browser?.close();
  if (server && server.exitCode === null) server.kill("SIGTERM");
  serverLog?.end();
  await writeFile(path.join(output, "checks.json"), JSON.stringify(record, null, 2));
}
if (record.fatalError || record.cases.length !== cases.length || record.cases.some(result => result.status !== "PASS")) process.exitCode = 1;
