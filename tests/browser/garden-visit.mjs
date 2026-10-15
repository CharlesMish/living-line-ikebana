/** Assisted Visit regression, using ordinary UI to create and inspect saved work.
 * No botanical or Garden fixture is injected. Storage faults are isolated and
 * explicitly labelled diagnostics. Run only through the hosted evidence job. */
import assert from "node:assert/strict";
import path from "node:path";
import { writeFile } from "node:fs/promises";

const WORKING = "ikebana-web-alpha:studio-v2";
const GARDEN = "ikebana-web-alpha:garden-v2";
const DISPLAY = `${GARDEN}:display-v1`;
const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const state = page => page.evaluate(() => ({
  state: window.__IKEBANA_TEST__.getState(),
  canonical: window.__IKEBANA_TEST__.getCanonicalSnapshot(),
  audit: window.__IKEBANA_TEST__.getAutosaveAudit(),
}));
const disk = page => page.evaluate(({ working, garden, display }) => ({
  working: localStorage.getItem(working), garden: localStorage.getItem(garden), display: localStorage.getItem(display),
}), { working: WORKING, garden: GARDEN, display: DISPLAY });
const slotIds = page => page.evaluate(() => [0, 1, 2].map(i => document.querySelector(`#visit-position-${i}`).dataset.entryId || null));
async function renderedSlots(page, ids) {
  await page.waitForFunction(expected => {
    const raw = document.querySelector("#garden-visit-canvas")?.dataset.gardenVisitStats;
    if (!raw) return false;
    const stats = JSON.parse(raw);
    return !stats.disposed && !stats.graphicsLost && stats.calls > 0 && stats.slots.length === 3
      && (!expected || stats.slots.every((slot, index) => slot.entryId === expected[index]))
      && stats.slots.every(slot => !slot.entryId || slot.printLoaded);
  }, ids ?? null);
  return page.locator("#garden-visit-canvas").evaluate(el => JSON.parse(el.dataset.gardenVisitStats));
}
async function overlayLayout(page, panelId, closeId, config) {
  await painted(page);
  const layout = await page.evaluate(({ panelId, closeId }) => {
    const rect = element => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; };
    const panel = document.getElementById(panelId), close = document.getElementById(closeId);
    const closeBox = close.getBoundingClientRect();
    const top = document.elementFromPoint(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
    const result = { dialog: rect(document.getElementById("garden-visit")), panel: rect(panel), close: rect(close), closeAtFront: top === close || close.contains(top) };
    if (panelId === "visit-print-panel") {
      const image = document.getElementById("visit-print-image"), css = getComputedStyle(image), box = image.getBoundingClientRect();
      const px = value => parseFloat(value) || 0;
      const width = box.width - px(css.paddingLeft) - px(css.paddingRight) - px(css.borderLeftWidth) - px(css.borderRightWidth);
      const height = box.height - px(css.paddingTop) - px(css.paddingBottom) - px(css.borderTopWidth) - px(css.borderBottomWidth);
      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      result.image = { naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, objectFit: css.objectFit,
        element: rect(image), fittedWidth: image.naturalWidth * scale, fittedHeight: image.naturalHeight * scale };
    }
    return result;
  }, { panelId, closeId });
  assert.ok(layout.panel.width >= layout.dialog.width * .8 && layout.panel.height >= layout.dialog.height * .8,
    `${panelId} uses most of the dialog, rather than only the smaller scene strip: ${JSON.stringify(layout)}`);
  for (const [label, box] of [[panelId, layout.panel], [closeId, layout.close]]) {
    assert.ok(box.width > 0 && box.height > 0 && box.x >= -1 && box.y >= -1
      && box.x + box.width <= config.width + 1 && box.y + box.height <= config.height + 1,
    `${label} remains inside the viewport: ${JSON.stringify(box)}`);
  }
  assert.equal(layout.closeAtFront, true, `${closeId} is visibly reachable above the overlay`);
  if (layout.image) {
    assert.equal(layout.image.objectFit, "contain", "The saved photograph is shown whole, without cropping");
    if (config.width === 844 && config.height === 390) {
      assert.ok(layout.image.fittedHeight >= 140,
        `Landscape saved print has at least 140px of actual fitted picture height: ${JSON.stringify(layout.image)}`);
    }
  }
  return layout;
}
async function visibleMessage(page, selector, config) {
  const message = await page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return { text: element.textContent, x: box.x, y: box.y, width: box.width, height: box.height,
      atFront: top === element || element.contains(top) };
  });
  assert.ok(message.width > 0 && message.height > 0 && message.x >= -1 && message.y >= -1
    && message.x + message.width <= config.width + 1 && message.y + message.height <= config.height + 1,
  `${selector} error is on screen: ${JSON.stringify(message)}`);
  assert.equal(message.atFront, true, `${selector} error is not hidden beneath an overlay`);
  return message;
}
function unchanged(after, before) {
  assert.deepEqual(after.canonical, before.canonical, "Visit never changes the working graph or insertion ordinal");
  assert.equal(after.state.cameraHash, before.state.cameraHash, "Visit camera never replaces the working camera");
  assert.deepEqual(after.audit, before.audit, "Looking and display choices create no botanical autosave");
}
async function fault(page, key) {
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    window.__LL_RESTORE_VISIT_STORAGE__ = () => { Storage.prototype.setItem = original; delete window.__LL_RESTORE_VISIT_STORAGE__; };
    Storage.prototype.setItem = function(name, value) {
      if (this === localStorage && name === key) throw new DOMException("Isolated Visit quota diagnostic", "QuotaExceededError");
      return original.call(this, name, value);
    };
  }, key);
}
const restoreStorage = page => page.evaluate(() => window.__LL_RESTORE_VISIT_STORAGE__?.());

export async function checkGardenVisit({ browser, baseURL, output, cases }) {
  const report = {
    status: "RUNNING", input: "Production UI, assisted keyboard seating, click or emulated tap, and mouse orbit. No graph or Garden injection.",
    limitations: ["Chromium/SwiftShader, not physical phone or Safari.", "Keyboard seating does not test placement acquisition.", "Screenshots require independent visual review; no phone frame-time claim."],
    cases: [],
  };
  for (const config of cases) {
    const name = `visit-${config.width}x${config.height}-text${config.text}`;
    const result = { name, status: "RUNNING", errors: [], checks: [], images: [] };
    report.cases.push(result);
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height },
      screen: { width: config.width, height: config.height }, deviceScaleFactor: 1,
      isMobile: config.mobile, hasTouch: config.mobile, reducedMotion: "reduce", locale: "en-US" });
    const page = await context.newPage(); page.setDefaultTimeout(20_000);
    page.on("pageerror", error => result.errors.push({ kind: "pageerror", message: String(error) }));
    page.on("console", message => { if (message.type() === "error") result.errors.push({ kind: "console", message: message.text() }); });
    const activate = locator => config.mobile ? locator.tap() : locator.click();
    const studio = async id => { await activate(page.getByTestId("more-toggle")); await activate(page.locator(`#${id}`)); };
    const capture = async suffix => {
      await painted(page); const file = `${name}-${suffix}.png`;
      await page.screenshot({ path: path.join(output, file) }); result.images.push(file);
    };
    const ready = async () => {
      await page.locator('[data-testid="app-root"][data-ready="true"]').waitFor();
      await page.waitForFunction(() => Boolean(window.__IKEBANA_TEST__));
      if (config.text !== 1) {
        const baseFont = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
        const requestedFontSize = Number((baseFont * config.text).toFixed(6));
        await page.evaluate(size => document.documentElement.style.setProperty("font-size", `${size}px`, "important"), requestedFontSize);
        // Match the settled text probe in rendered-evidence.mjs. Chromium can
        // expose the prior computed value immediately after the style write;
        // require the actual enlarged value before testing or capturing layout.
        await page.waitForFunction(size => Math.abs(parseFloat(getComputedStyle(document.documentElement).fontSize) - size) < .001, requestedFontSize);
        await painted(page);
        const textProbe = await page.evaluate(({ baseline, requested }) => ({
          baselinePx: baseline, requestedPx: requested,
          computedPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
          inlineValue: document.documentElement.style.getPropertyValue("font-size"),
          inlinePriority: document.documentElement.style.getPropertyPriority("font-size"),
        }), { baseline: baseFont, requested: requestedFontSize });
        assert.ok(Math.abs(textProbe.computedPx - requestedFontSize) < .001, "Actual Visit root text matches the requested 150% scale");
        assert.equal(textProbe.inlinePriority, "important");
        (result.textProbes ??= []).push(textProbe);
      }
    };
    const openVisit = async () => {
      await studio("garden-open"); await activate(page.locator("#garden-visit-open"));
      await page.locator("#garden-visit[open]").waitFor(); await painted(page);
      assert.equal(await page.locator("#visit-scene-error").isHidden(), true, "Garden renderer starts without a caught graphics error");
      await renderedSlots(page);
    };
    const closeVisit = async () => {
      await activate(page.locator("#visit-close"));
      await page.waitForFunction(() => JSON.parse(document.querySelector("#garden-visit-canvas").dataset.gardenVisitStats).disposed);
      await page.locator("#garden-dialog[open]").waitFor();
      await activate(page.locator("#garden-close"));
    };
    try {
      const url = new URL(baseURL); url.searchParams.set("test", "1");
      assert.ok((await page.goto(url.href, { waitUntil: "networkidle" }))?.ok()); await ready();
      // An empty collection should still be an honest, non-destructive place.
      const emptyDisk = await disk(page), emptyState = await state(page);
      await openVisit(); assert.deepEqual(await slotIds(page), [null, null, null]);
      await capture("empty"); await closeVisit();
      assert.deepEqual(await disk(page), emptyDisk); unchanged(await state(page), emptyState);
      result.checks.push("Empty Visit opens and closes without creating any saved bowl, Garden or display preference");

      // Three actual kept moments with distinct botanical inventories, ceramic
      // colors and photograph settings. These use the ordinary accessibility
      // insertion path; they are not blind placement sessions.
      const recipes = [
        { material: "flowering-branch", color: "sand", backdrop: "sage", format: "landscape", title: "Branch in Sage" },
        { material: "starry-pincushion", color: "celadon", backdrop: "hills", format: "portrait", title: "Stars over the hills" },
        { material: "silver-seed", color: "iron", backdrop: "dusk", format: "square", title: "Silver at dusk" },
      ];
      const fixtureStates = [];
      for (const [index, recipe] of recipes.entries()) {
        await activate(page.getByTestId("posture-arrange"));
        if (index) {
          await activate(page.getByTestId("materials-toggle"));
          await activate(page.getByTestId(`material-choice-${recipe.material}`));
        }
        await page.getByTestId("material-source").focus(); await page.keyboard.press("Enter");
        await page.waitForFunction(count => window.__IKEBANA_TEST__.getCanonicalSnapshot().plants.length === count, index + 1);
        await studio("vessel-appearance-open"); await page.locator("#vessel-color").selectOption(recipe.color);
        await activate(page.locator("#vessel-appearance-close"));
        await studio("working-backdrop-open"); await activate(page.locator(`#working-backdrop-choice-${recipe.backdrop}`));
        await activate(page.locator("#working-backdrop-close"));
        fixtureStates.push(await state(page));
        await studio("photo-open"); await activate(page.locator("#photo-tab-scene"));
        // A previously customized photo draft is intentionally retained until
        // explicitly changed. Select the requested recipe through its tile.
        await activate(page.locator(`#photo-backdrop-choice-${recipe.backdrop}`));
        await activate(page.locator("#photo-tab-frame")); await page.locator("#photo-format").selectOption(recipe.format);
        await activate(page.locator("#photo-tab-save")); await page.locator("#photo-name").fill(recipe.title);
        await activate(page.locator("#photo-keep"));
        await page.waitForFunction(({ key, count }) => JSON.parse(localStorage.getItem(key)).entries.length === count, { key: GARDEN, count: index + 1 });
        await activate(page.locator("#photo-close"));
      }
      const before = await state(page), beforeDisk = await disk(page);
      const entries = JSON.parse(beforeDisk.garden).entries;
      assert.equal(entries.length, 3); assert.deepEqual(entries.map(e => e.arrangement.plants.length), [3, 2, 1]);
      assert.deepEqual(entries.map(e => e.arrangement.scene.colorId), ["iron", "celadon", "sand"]);
      assert.ok(entries.every(e => e.thumbnail?.startsWith("data:image/jpeg;base64,")));
      result.entries = entries.map(e => ({ id: e.id, title: e.title, plants: e.arrangement.plants.length, color: e.arrangement.scene.colorId }));
      result.checks.push("Three kept photos made through UI with distinct botanical inventories, vessel colors and photo formats");

      if (!config.mobile) {
        await studio("working-backdrop-open"); await fault(page, WORKING);
        try {
          await activate(page.locator("#working-backdrop-choice-clay"));
          assert.match(await page.locator("#working-backdrop-message").textContent(), /could not save|unchanged/i);
          assert.equal(await page.locator("#working-backdrop-choice-dusk").getAttribute("aria-pressed"), "true");
          assert.deepEqual(await disk(page), beforeDisk); unchanged(await state(page), before);
          await capture("backdrop-save-failure");
        } finally { await restoreStorage(page); }
        await activate(page.locator("#working-backdrop-close"));
        result.checks.push("Injected working-save quota failure preserves the previous backdrop, working graph and all saved bytes");
      }

      await openVisit(); assert.deepEqual(await slotIds(page), entries.map(e => e.id));
      const initialStats = await renderedSlots(page, entries.map(e => e.id));
      assert.deepEqual(initialStats.slots.map(slot => slot.plantGroups), [3, 2, 1], "The scene contains all six actual saved botanical groups");
      assert.ok(initialStats.slots.every(slot => slot.vesselMeshes > 0 && slot.printLoaded), "Each occupied position has a vessel and decoded photograph");
      assert.equal(initialStats.rendererContexts, 1); result.initialRenderer = initialStats;
      assert.equal((await disk(page)).display, null, "Automatic recent-three display is never written implicitly");
      const canvas = page.locator("#garden-visit-canvas");
      assert.equal(await canvas.evaluate(el => Boolean(el.getContext("webgl2"))), true, "Visit owns a rendered WebGL scene");
      const box = await canvas.boundingBox();
      assert.ok(box && box.width >= 120 && box.height >= 80, "Visit retains a visible scene");
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= config.width + 1 && box.y + box.height <= config.height + 1);
      assert.equal(await page.locator("#garden-visit").evaluate(el => el.scrollWidth > el.clientWidth + 1), false, "Visit has no horizontal overflow");
      result.stage = box;
      await capture("overview");
      for (let i = 0; i < 3; i++) {
        await activate(page.locator(`#visit-position-${i}`));
        await activate(page.locator("#visit-zoom-in")); await activate(page.locator("#visit-zoom-out"));
        await capture(`position-${i}`);
      }
      // Camera-only orbit on the known canvas, with no guessed plant target.
      const orbit = await canvas.boundingBox();
      const beforeOrbit = await renderedSlots(page);
      await page.mouse.move(orbit.x + orbit.width * .5, orbit.y + orbit.height * .5);
      await page.mouse.down(); await page.mouse.move(orbit.x + orbit.width * .62, orbit.y + orbit.height * .47, { steps: 5 }); await page.mouse.up();
      await painted(page);
      assert.notDeepEqual((await renderedSlots(page)).camera.position, beforeOrbit.camera.position, "Ordinary drag changes only the visitor camera");
      await capture("orbit");
      await activate(page.locator("#visit-print"));
      await page.waitForFunction(() => { const image = document.querySelector("#visit-print-image"); return image?.complete && image.naturalWidth > 0; });
      assert.equal(await page.locator("#visit-print-image").getAttribute("src"), entries[2].thumbnail,
        "Print detail displays the exact stored JPEG pixels of the selected vessel");
      result.printLayout = await overlayLayout(page, "visit-print-panel", "visit-print-close", config);
      await capture("print"); await activate(page.locator("#visit-print-close"));
      await activate(page.locator("#visit-overview"));
      unchanged(await state(page), before); assert.deepEqual(await disk(page), beforeDisk);
      result.checks.push("Overview, all three approaches, zoom, orbit and exact saved print leave working graph, camera, audit and all storage unchanged");

      for (let i = 0; i < 2; i++) { await closeVisit(); await openVisit(); }
      unchanged(await state(page), before); assert.deepEqual(await disk(page), beforeDisk);
      result.reopenedRenderer = await renderedSlots(page, entries.map(e => e.id));
      assert.equal(result.reopenedRenderer.rendererContexts, 1);
      result.checks.push("Repeated close/reopen preserves the working bowl and does not implicitly pin recent entries");

      await activate(page.locator("#visit-position-0")); await activate(page.locator("#visit-change"));
      await page.locator("#visit-picker:not([hidden])").waitFor();
      result.pickerLayout = await overlayLayout(page, "visit-picker", "visit-picker-close", config);
      await capture("picker");
      await activate(page.locator(`#visit-choice-${entries[2].id}`));
      const swapped = [entries[2].id, entries[1].id, entries[0].id];
      assert.equal(await page.locator("#visit-scene-error").isHidden(), true, "Slot replacement rebuilds a usable scene");
      assert.deepEqual((await renderedSlots(page, swapped)).slots.map(slot => slot.plantGroups), [1, 2, 3]);
      assert.deepEqual(await slotIds(page), swapped, "Choosing an already displayed moment swaps positions");
      const preferenceRaw = (await disk(page)).display;
      assert.deepEqual(JSON.parse(preferenceRaw), { displayVersion: 1, slots: swapped });
      assert.equal((await disk(page)).garden, beforeDisk.garden); assert.equal((await disk(page)).working, beforeDisk.working);
      await closeVisit(); await openVisit(); assert.deepEqual(await slotIds(page), swapped);

      if (!config.mobile || config.width === 844) {
        // Storage fault injection is explicitly diagnostic, not play evidence.
        await activate(page.locator("#visit-position-0")); await activate(page.locator("#visit-change"));
        await fault(page, DISPLAY);
        try {
          await activate(page.locator("#visit-empty"));
          assert.equal((await disk(page)).display, preferenceRaw); assert.deepEqual(await slotIds(page), swapped);
          assert.match(await page.locator("#visit-message").textContent(), /save|storage|unchanged/i);
          result.failurePickerLayout = await overlayLayout(page, "visit-picker", "visit-picker-close", config);
          result.visibleSaveError = await visibleMessage(page, "#visit-picker-message", config);
          assert.match(result.visibleSaveError.text, /save|storage|unchanged/i);
          await capture("save-failure");
        } finally { await restoreStorage(page); }
        if (await page.locator("#visit-picker").isVisible()) await activate(page.locator("#visit-picker-close"));
        result.checks.push("Injected display-preference quota failure preserves prior slots and all saved arrangements with visible feedback");
      }
      await activate(page.locator("#visit-position-1")); await activate(page.locator("#visit-change"));
      await activate(page.locator("#visit-empty"));
      const expectedSlots = [entries[2].id, null, entries[0].id];
      assert.deepEqual(await slotIds(page), expectedSlots);
      assert.deepEqual((await renderedSlots(page, expectedSlots)).slots.map(slot => slot.plantGroups), [1, 0, 3]);
      assert.equal((await disk(page)).garden, beforeDisk.garden, "Clearing a display position never removes its saved arrangement");
      await capture("one-empty-position");
      await closeVisit(); unchanged(await state(page), before);
      // The last insertion checkpoint survives visiting, scene changes, and
      // explicit display choices. Exercise Undo rather than infer it from UI.
      await activate(page.getByTestId("edit-toggle")); await activate(page.getByTestId("undo-edit"));
      assert.deepEqual((await state(page)).canonical.plants, fixtureStates[1].canonical.plants);
      assert.equal((await state(page)).canonical.successfulPlantOrdinal, before.canonical.successfulPlantOrdinal);
      const afterUndo = await state(page);
      result.checks.push("Visit and display changes retain the existing insertion Undo checkpoint");

      await page.reload({ waitUntil: "networkidle" }); await ready();
      assert.deepEqual((await state(page)).canonical, afterUndo.canonical);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).scene.backdropId, WORKING), "dusk");
      await openVisit(); assert.deepEqual(await slotIds(page), expectedSlots);
      await capture("reloaded-display");
      result.checks.push("Reload restores explicit display references, empty positions and the saved working backdrop without modifying Garden");

      // Reusing a moment remains an explicit protected document replacement.
      await activate(page.locator("#visit-position-0")); await activate(page.locator("#visit-copy"));
      await page.locator("#garden-choice:not([hidden])").waitFor();
      assert.deepEqual((await state(page)).canonical, afterUndo.canonical);
      await activate(page.locator("#garden-cancel-choice"));
      assert.deepEqual((await state(page)).canonical, afterUndo.canonical);
      await activate(page.locator("#garden-visit-open")); await activate(page.locator("#visit-position-0"));
      await activate(page.locator("#visit-copy")); await activate(page.locator("#garden-replace"));
      assert.deepEqual((await state(page)).canonical.plants, entries[2].arrangement.plants);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).scene.colorId, WORKING), "sand");
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).scene.backdropId, WORKING), "sage");
      assert.equal((await disk(page)).garden, beforeDisk.garden);
      assert.equal((await disk(page)).display, JSON.stringify({ displayVersion: 1, slots: expectedSlots }));
      result.checks.push("Make a working copy offers the existing Keep/Replace/Cancel choice; Cancel preserves work, explicit Replace preserves the saved original");
      assert.deepEqual(result.errors, []); result.status = "PASS";
      console.log(`PASS ${name}`);
    } catch (error) {
      result.status = "FAIL"; result.failure = error.stack ?? String(error); report.status = "FAIL";
      try { await capture("failure"); } catch { /* Keep original failure. */ }
      console.error(`FAIL ${name}: ${result.failure}`);
    } finally {
      await restoreStorage(page).catch(() => {}); await context.close();
      await writeFile(path.join(output, "garden-visit.json"), JSON.stringify(report, null, 2));
    }
  }
  report.status = report.cases.every(result => result.status === "PASS") ? "PASS" : "FAIL";
  await writeFile(path.join(output, "garden-visit.json"), JSON.stringify(report, null, 2));
  assert.equal(report.status, "PASS", "Garden Visit browser checks: see garden-visit.json");
  return report;
}
