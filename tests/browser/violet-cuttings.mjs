/** Explicitly assisted visual/roundtrip regression, not a blind playtest.
 * Ordinary keyboard seating and UI commands only. Read-only bridge supplies a
 * projected branch station for the cancel check; no guessed acquisition point.
 * Run only in the opt-in rendered CI harness. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function checkVioletCuttings({ browser, baseURL, output }) {
  const report = { status: "RUNNING", input: "Assisted keyboard seating, UI tone/turn/photo/Garden controls; read-only projected branch station for prune-cancel", cases: [] };
  for (const [material, tone] of [["violet-sprig", "lavender"], ["indigo-spire", "blue"], ["nodding-flower", "violet"]]) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 850 }, acceptDownloads: true, reducedMotion: "reduce" });
    const page = await context.newPage(); page.setDefaultTimeout(10_000);
    const record = { material, tone, status: "RUNNING", images: [], errors: [] };
    report.cases.push(record);
    page.on("pageerror", error => record.errors.push(String(error)));
    page.on("console", message => { if (message.type() === "error") record.errors.push(message.text()); });
    const state = () => page.evaluate(() => ({ canonical: window.__IKEBANA_TEST__.getCanonicalSnapshot(), audit: window.__IKEBANA_TEST__.getAutosaveAudit() }));
    const capture = async suffix => {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const file = `violet-study-${material}-${suffix}.png`;
      await page.screenshot({ path: path.join(output, file) }); record.images.push(file);
    };
    const studio = async id => { await page.getByTestId("more-toggle").click(); await page.locator(`#${id}`).click(); };
    const view = async id => { await page.getByTestId("view-toggle").click(); await page.getByTestId(`view-${id}`).click(); };
    try {
      const url = new URL(baseURL); url.searchParams.set("test", "1");
      await page.goto(url.href, { waitUntil: "networkidle" });
      await page.locator('[data-testid="app-root"][data-ready="true"]').waitFor();
      await page.getByTestId("materials-toggle").click(); await page.getByTestId(`material-choice-${material}`).click();
      await page.getByTestId("material-source").focus(); await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.__IKEBANA_TEST__.getCanonicalSnapshot().plants.length === 1);
      const seated = await state();
      await capture("front-natural");
      await view("three-quarter"); await capture("three-quarter-natural");
      await view("front");
      await page.getByTestId("tool-prune").click();
      const target = await page.evaluate(() => {
        const graph = window.__IKEBANA_TEST__.getCanonicalSnapshot().plants[0];
        return window.__IKEBANA_TEST__.getScreenTargets().find(t => t.branchId === graph.rootBranchId);
      });
      assert.ok(target && Number.isFinite(target.x) && Number.isFinite(target.y));
      const beforePrune = await state();
      await page.mouse.move(target.x, target.y); await page.mouse.down();
      assert.equal(await page.evaluate(() => window.__IKEBANA_TEST__.getState().transaction?.operation), "prune");
      await capture("prune-preview");
      await page.keyboard.press("Escape"); await page.mouse.up();
      await page.mouse.move(20, 400);
      assert.deepEqual(await state(), beforePrune, "cancel neither changes the graph nor saves");
      await page.getByTestId("tool-shape").click();
      for (const look of ["natural", tone]) {
        if (look !== "natural") {
          await studio("botanical-tones-open");
          await page.locator(`#botanical-tone-${material}-${tone}`).click();
          await page.locator("#botanical-tones-close").click();
          assert.deepEqual((await state()).canonical, seated.canonical);
        }
        await studio("photo-open");
        await page.locator("#photo-tab-frame").click();
        await page.locator("#photo-view").selectOption("three-quarter");
        // Native range keyboard change, not DOM value injection.
        await page.locator("#photo-zoom").focus(); await page.keyboard.press("Home");
        // Fixed 2.8× view in both this component and the combined preview,
        // whose Closer range is wider. Step keys use the real native control.
        for (let i = 0; i < 225; i++) await page.keyboard.press("ArrowRight");
        await capture(`photo-${look}`);
        await page.locator("#photo-return").click();
      }
      // Twelve explicit 15-degree cutting turns expose the reverse in Front.
      // This is a deliberate pose edit, not a camera/mouse acquisition test.
      await page.getByTestId("edit-toggle").click();
      for (let i = 0; i < 12; i++) await page.locator("#turn-cutting-right").click();
      await page.keyboard.press("Escape");
      await capture("rear-toned");
      const saved = await state();
      await studio("garden-open"); await page.locator("#garden-name").fill(`${material} rendered study`);
      await page.locator("#garden-keep").click();
      await page.locator("#garden-backups > summary").click();
      const downloadPromise = page.waitForEvent("download"); await page.locator("#garden-export").click();
      const download = await downloadPromise, file = path.join(output, `violet-study-${material}-garden.json`);
      await download.saveAs(file);
      const backup = JSON.parse(await readFile(file, "utf8"));
      assert.equal(backup.entries.length, 1);
      assert.deepEqual(backup.entries[0].arrangement.plants, saved.canonical.plants);
      assert.equal(backup.entries[0].arrangement.scene.botanicalTones[material], tone);
      await page.reload({ waitUntil: "networkidle" });
      await page.locator('[data-testid="app-root"][data-ready="true"]').waitFor();
      assert.deepEqual((await state()).canonical.plants, saved.canonical.plants);
      const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("ikebana-web-alpha:studio-v2")));
      assert.equal(persisted.scene.botanicalTones[material], tone);
      record.backup = path.basename(file); record.status = "PASS";
      assert.deepEqual(record.errors, []);
    } catch (error) {
      record.status = "FAIL"; record.failure = error.stack ?? String(error);
      report.status = "FAIL";
      throw error;
    } finally {
      await writeFile(path.join(output, "violet-cuttings.json"), JSON.stringify(report, null, 2));
      await context.close();
    }
  }
  report.status = "PASS";
  await writeFile(path.join(output, "violet-cuttings.json"), JSON.stringify(report, null, 2));
  return report;
}
