/**
 * Optional browser smoke test for the phone web alpha.
 *
 * It deliberately does not run as part of the dependency-free domain suite.
 * Real iPhone Safari remains authoritative for touch arbitration and browser
 * chrome. This catches shell regressions, missing QA hooks, launch-state drift,
 * raycaster-order leaks, preview autosaves, and idle WebGL context recovery.
 *
 * Run after starting a preview server:
 *
 *   IKEBANA_BROWSER_SMOKE=1 \
 *   IKEBANA_URL='http://127.0.0.1:4173/?test=1&bend=fixed' \
 *   node tests/browser/automated-smoke.mjs
 *
 * Playwright is intentionally optional for the first source build:
 *
 *   npm install --save-dev playwright
 *   npx playwright install webkit
 */

import assert from "node:assert/strict";

const enabled = process.env.IKEBANA_BROWSER_SMOKE === "1";

if (!enabled) {
  console.log(
    "SKIP browser smoke (set IKEBANA_BROWSER_SMOKE=1 and IKEBANA_URL to enable)",
  );
  process.exit(0);
}

let playwright;
try {
  playwright = await import("playwright");
} catch (error) {
  console.error(
    "Browser smoke requested, but Playwright is not installed. " +
      "Install it with `npm install --save-dev playwright` and " +
      "`npx playwright install webkit`.",
  );
  throw error;
}

const rawUrl = process.env.IKEBANA_URL ?? "http://127.0.0.1:4173/";
const url = new URL(rawUrl);
url.searchParams.set("test", "1");
if (!url.searchParams.has("bend")) url.searchParams.set("bend", "fixed");

const browserName = process.env.IKEBANA_BROWSER ?? "webkit";
const browserType = playwright[browserName];
assert.ok(
  browserType && typeof browserType.launch === "function",
  `Unknown Playwright browser: ${browserName}`,
);

const browser = await browserType.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: "en-US",
  reducedMotion: "reduce",
});
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(String(error)));

const results = [];
async function test(name, body) {
  try {
    await body();
    results.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "FAIL", error });
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

async function getBridgeState() {
  return page.evaluate(async () => {
    const bridge = window.__IKEBANA_TEST__;
    if (!bridge) throw new Error("window.__IKEBANA_TEST__ is missing");
    await bridge.ready;
    return bridge.getState();
  });
}

try {
  const response = await page.goto(url.href, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
  assert.ok(response?.ok(), `Could not load ${url.href}: ${response?.status()}`);

  await page.waitForFunction(
    () =>
      Boolean(
        window.__IKEBANA_TEST__ &&
          document.querySelector('[data-testid="app-root"][data-ready="true"]'),
      ),
    undefined,
    { timeout: 20_000 },
  );

  await test("stable DOM hooks exist", async () => {
    const required = [
      "app-root",
      "scene-canvas",
      "material-flowering-branch",
      "posture-arrange",
      "posture-step-back",
      "tool-shape",
      "tool-prune",
      "view-front",
      "view-three-quarter",
      "view-above",
      "status",
    ];
    const missing = await page.evaluate((testIds) => {
      return testIds.filter(
        (testId) => !document.querySelector(`[data-testid="${testId}"]`),
      );
    }, required);
    assert.deepEqual(missing, []);
  });

  await test("mobile shell owns in-app gestures without disabling accessibility zoom", async () => {
    const shell = await page.evaluate(() => {
      const viewport = document.querySelector('meta[name="viewport"]')?.content ?? "";
      const root = document.querySelector('[data-testid="app-root"]');
      const scene = document.querySelector('[data-testid="scene-canvas"]');
      if (!(root instanceof HTMLElement) || !(scene instanceof HTMLElement)) {
        throw new Error("App root or scene canvas is missing");
      }
      const rootStyle = getComputedStyle(root);
      const sceneStyle = getComputedStyle(scene);
      const bodyStyle = getComputedStyle(document.body);
      return {
        viewport,
        rootOverscroll: rootStyle.overscrollBehavior,
        sceneTouchAction: sceneStyle.touchAction,
        bodyOverflowX: bodyStyle.overflowX,
        bodyOverflowY: bodyStyle.overflowY,
      };
    });

    assert.match(shell.viewport, /width\s*=\s*device-width/i);
    assert.match(shell.viewport, /initial-scale\s*=\s*1(?:\.0)?/i);
    assert.match(shell.viewport, /viewport-fit\s*=\s*cover/i);
    assert.doesNotMatch(shell.viewport, /user-scalable\s*=\s*no/i);
    assert.doesNotMatch(shell.viewport, /maximum-scale\s*=\s*1(?:\.0)?/i);
    assert.equal(shell.sceneTouchAction, "none");
    assert.ok(
      shell.rootOverscroll === "none" || shell.rootOverscroll === "none none",
      `Expected overscroll-behavior:none, got ${shell.rootOverscroll}`,
    );
    assert.equal(shell.bodyOverflowX, "hidden");
    assert.equal(shell.bodyOverflowY, "hidden");
  });

  await test("launch state is empty Front + Arrange + Shape", async () => {
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({
        clearAutosave: true,
        clearTelemetry: true,
        bendVariant: new URL(location.href).searchParams.get("bend") ?? "fixed",
      });
    });
    const state = await getBridgeState();
    assert.equal(state.ready, true);
    assert.equal(state.posture, "arrange");
    assert.equal(state.tool, "shape");
    assert.equal(state.view, "front");
    assert.equal(state.transaction, null);
    assert.equal(state.selectedPlantId, null);
    assert.equal(state.selectedBranchId, null);
    assert.equal(state.successfulSeatOrdinal, 0);
  });

  await test("hit resolution ignores candidate array/raycaster order", async () => {
    const resolved = await page.evaluate(() => {
      const bridge = window.__IKEBANA_TEST__;
      const cases = [
        [
          {
            stableId: "other-near",
            tier: "other-plant",
            screenDistance: 0.1,
            rayDepth: 0.1,
          },
          {
            stableId: "selected-far",
            tier: "selected-plant",
            screenDistance: 40,
            rayDepth: 40,
          },
          {
            stableId: "handle-farthest",
            tier: "selected-handle",
            screenDistance: 80,
            rayDepth: 80,
          },
        ],
        [
          {
            stableId: "z-screen-far",
            tier: "selected-plant",
            screenDistance: 3,
            rayDepth: 1,
          },
          {
            stableId: "a-screen-near",
            tier: "selected-plant",
            screenDistance: 2,
            rayDepth: 99,
          },
        ],
        [
          {
            stableId: "z-depth-far",
            tier: "selected-plant",
            screenDistance: 2,
            rayDepth: 4,
          },
          {
            stableId: "a-depth-near",
            tier: "selected-plant",
            screenDistance: 2,
            rayDepth: 3,
          },
        ],
        [
          {
            stableId: "z-stable",
            tier: "selected-plant",
            screenDistance: 2,
            rayDepth: 3,
          },
          {
            stableId: "a-stable",
            tier: "selected-plant",
            screenDistance: 2,
            rayDepth: 3,
          },
        ],
      ];

      return cases.map((candidates) => {
        const forward = bridge.resolveHitForTest(candidates)?.stableId ?? null;
        const reverse = bridge.resolveHitForTest([...candidates].reverse())?.stableId ?? null;
        return { forward, reverse };
      });
    });

    assert.deepEqual(resolved, [
      { forward: "handle-farthest", reverse: "handle-farthest" },
      { forward: "a-screen-near", reverse: "a-screen-near" },
      { forward: "a-depth-near", reverse: "a-depth-near" },
      { forward: "a-stable", reverse: "a-stable" },
    ]);
  });

  await test("autosave audit contains committed snapshots only", async () => {
    const audit = await page.evaluate(() =>
      window.__IKEBANA_TEST__.getAutosaveAudit(),
    );
    assert.ok(Array.isArray(audit.writes));
    for (const write of audit.writes) {
      assert.equal(write.transactionActive, false);
      assert.equal(write.reason, "commit");
      assert.equal(typeof write.canonicalHash, "string");
      assert.ok(write.canonicalHash.length > 0);
      assert.equal(Number.isInteger(write.commitSequence), true);
    }
  });

  await test("acquisitions carry a variant, and camera/keyboard acquisitions never read as a graph commit", async () => {
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({ clearAutosave: true, clearTelemetry: true, bendVariant: "touch" });
    });

    // Keyboard-equivalent activation commits an insert synchronously.
    await page.evaluate(() => {
      document
        .querySelector('[data-testid="material-flowering-branch"]')
        .dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    });

    // A pointerdown on the tray opens an insert transaction; cancel it explicitly.
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="material-flowering-branch"]');
      const rect = button.getBoundingClientRect();
      button.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 101,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          button: 0,
        }),
      );
    });
    await page.evaluate(() => window.__IKEBANA_TEST__.interruptForTest("pointercancel"));

    // A Step Back camera drag: begin, move, and release on empty canvas space.
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({ clearAutosave: false, clearTelemetry: false, bendVariant: "touch" });
      document.querySelector('[data-testid="posture-step-back"]').click();
    });
    await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="scene-canvas"]');
      const rect = canvas.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 202, clientX: x, clientY: y, button: 0 }));
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 202, clientX: x, clientY: y }));
    });

    const telemetry = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    const touchAcquisitions = telemetry.variants.touch.acquisitions;
    for (const record of touchAcquisitions) {
      assert.equal(record.bendVariant, "touch");
      assert.equal(typeof record.sessionId, "string");
    }
    const committedInsert = touchAcquisitions.find(
      (record) => record.operation === "insert" && record.inputMethod === "keyboard",
    );
    const cancelledInsert = touchAcquisitions.find(
      (record) => record.operation === "insert" && record.inputMethod === "pointer",
    );
    const cameraRecord = touchAcquisitions.find((record) => record.operation === "camera");
    assert.ok(committedInsert, "expected one committed keyboard-insert acquisition");
    assert.equal(committedInsert.outcome, "committed");
    assert.equal(committedInsert.materialId, "flowering-branch");
    assert.ok(cancelledInsert, "expected one cancelled pointer-drag insert acquisition");
    assert.equal(cancelledInsert.outcome, "cancelled");
    assert.equal(cancelledInsert.cancelReason, "pointer-cancel");
    assert.ok(cameraRecord, "expected one camera acquisition");
    // The core assertion for this correction pass: camera is never "committed".
    assert.equal(cameraRecord.outcome, "released");
    assert.notEqual(cameraRecord.outcome, "committed");

    // Raw records keep camera/keyboard-insert for debugging, but the
    // comparative summary must exclude them entirely (bend-only, resolved).
    const exportPayload = await page.evaluate(() => window.__IKEBANA_TEST__.getTelemetryExportPayload());
    assert.equal(exportPayload.summary.touch.scope, "bend-only-resolved-hits");
    assert.equal(exportPayload.summary.touch.resolvedBendHits, 0);
    assert.equal(exportPayload.summary.touch.committedBendHits, 0);
    assert.equal(exportPayload.summary.touch.cancelledBendHits, 0);
    assert.equal(typeof exportPayload.instrumentVersion, "string");
    assert.equal(typeof exportPayload.privacyStatement, "string");
    assert.match(exportPayload.privacyStatement, /locally/i);

    // Return to Arrange for later tests.
    await page.evaluate(() => document.querySelector('[data-testid="posture-arrange"]').click());
  });

  await test("?fresh=1 preserves study telemetry; ?clearStudyData=1 is the only thing that wipes it", async () => {
    const before = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    const totalBefore =
      before.variants.bead.acquisitions.length + before.variants.touch.acquisitions.length;
    assert.ok(totalBefore > 0, "expected telemetry recorded by the prior test to persist");

    const freshUrl = new URL(url.href);
    freshUrl.searchParams.set("fresh", "1");
    const freshResponse = await page.goto(freshUrl.href, { waitUntil: "networkidle", timeout: 30_000 });
    assert.ok((freshResponse?.status() ?? 0) < 400, `Could not load ${freshUrl.href}: ${freshResponse?.status()}`);
    await page.waitForFunction(
      () =>
        Boolean(
          window.__IKEBANA_TEST__ &&
            document.querySelector('[data-testid="app-root"][data-ready="true"]'),
        ),
      undefined,
      { timeout: 20_000 },
    );

    const afterFresh = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    const totalAfterFresh =
      afterFresh.variants.bead.acquisitions.length + afterFresh.variants.touch.acquisitions.length;
    assert.equal(
      totalAfterFresh,
      totalBefore,
      "an ordinary specimen reset (?fresh=1) must never delete study telemetry",
    );

    const clearUrl = new URL(url.href);
    clearUrl.searchParams.set("clearStudyData", "1");
    const clearResponse = await page.goto(clearUrl.href, { waitUntil: "networkidle", timeout: 30_000 });
    assert.ok((clearResponse?.status() ?? 0) < 400, `Could not load ${clearUrl.href}: ${clearResponse?.status()}`);
    await page.waitForFunction(
      () =>
        Boolean(
          window.__IKEBANA_TEST__ &&
            document.querySelector('[data-testid="app-root"][data-ready="true"]'),
        ),
      undefined,
      { timeout: 20_000 },
    );

    const afterClear = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    assert.equal(afterClear.variants.bead.acquisitions.length, 0);
    assert.equal(afterClear.variants.touch.acquisitions.length, 0);
  });

  await test("telemetry survives an ordinary reload with neither flag", async () => {
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({ clearAutosave: true, clearTelemetry: true, bendVariant: "fixed" });
    });
    await page.evaluate(() => {
      document
        .querySelector('[data-testid="material-flowering-branch"]')
        .dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    });
    const before = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    assert.equal(before.variants.bead.acquisitions.length, 1);

    // A repeat load of the exact same URL may be answered "304 Not Modified"
    // from cache; that is still a successful navigation, just not `.ok()`.
    const response = await page.goto(url.href, { waitUntil: "networkidle", timeout: 30_000 });
    assert.ok(
      (response?.status() ?? 0) < 400,
      `Could not load ${url.href}: ${response?.status()}`,
    );
    await page.waitForFunction(
      () =>
        Boolean(
          window.__IKEBANA_TEST__ &&
            document.querySelector('[data-testid="app-root"][data-ready="true"]'),
        ),
      undefined,
      { timeout: 20_000 },
    );

    const after = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    assert.equal(after.variants.bead.acquisitions.length, 1);
  });

  await test("Export is persistent chrome: a hold-drag is cancelled first, then export proceeds", async () => {
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({ clearAutosave: true, clearTelemetry: true, bendVariant: "fixed" });
    });
    // Open the info panel so its export button is reachable, as a second
    // finger/click would reach it during a real hold-drag.
    await page.evaluate(() => document.querySelector("#experiment-toggle").click());
    await page.waitForSelector("#experiment-panel:not([hidden])");

    // Begin a hold-drag from the tray (an active, uncommitted insert transaction).
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="material-flowering-branch"]');
      const rect = button.getBoundingClientRect();
      button.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 303,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          button: 0,
        }),
      );
    });
    const midDrag = await getBridgeState();
    assert.equal(midDrag.transaction?.operation, "insert", "expected an active insert transaction mid-drag");

    // A second control (Export) is tapped during the hold-drag.
    await page.evaluate(() => document.querySelector("#telemetry-export-trigger").click());

    const afterExportTap = await getBridgeState();
    assert.equal(afterExportTap.transaction, null, "export must cancel the active transaction first");

    const telemetry = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    const cancelledByExport = telemetry.variants.bead.acquisitions.find(
      (record) => record.operation === "insert" && record.cancelReason === "experiment-command",
    );
    assert.ok(cancelledByExport, "expected the held drag's acquisition to resolve as cancelled by the export command");
    assert.equal(cancelledByExport.outcome, "cancelled");

    // A later ordinary release of the same (already-cancelled) pointer is a no-op.
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 303, clientX: 1, clientY: 1 }));
    });
    const afterRelease = await getBridgeState();
    assert.equal(afterRelease.transaction, null);
    assert.equal(afterRelease.canonicalHash, afterExportTap.canonicalHash);

    await page.evaluate(() => document.querySelector("#experiment-close").click());
  });

  await test("study telemetry running out of storage quota never prevents the botanical graph from saving", async () => {
    const quotaContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const quotaPage = await quotaContext.newPage();
    const quotaPageErrors = [];
    quotaPage.on("pageerror", (error) => quotaPageErrors.push(String(error)));
    // Simulate a full quota (or a disabled storage API) for the telemetry
    // key specifically, while the graph-autosave key keeps working.
    await quotaPage.addInitScript(() => {
      const telemetryKey = "ikebana-web-alpha:telemetry-v1";
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function patchedSetItem(key, value) {
        if (key === telemetryKey) {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
    });

    try {
      const response = await quotaPage.goto(url.href, { waitUntil: "networkidle", timeout: 30_000 });
      assert.ok((response?.status() ?? 0) < 400, `Could not load ${url.href}: ${response?.status()}`);
      await quotaPage.waitForFunction(
        () =>
          Boolean(
            window.__IKEBANA_TEST__ &&
              document.querySelector('[data-testid="app-root"][data-ready="true"]'),
          ),
        undefined,
        { timeout: 20_000 },
      );
      await quotaPage.evaluate(async () => {
        await window.__IKEBANA_TEST__.resetForTest({ clearAutosave: true, clearTelemetry: false, bendVariant: "fixed" });
      });

      // A real graph commit (keyboard activation) while every telemetry
      // write throws.
      await quotaPage.evaluate(() => {
        document
          .querySelector('[data-testid="material-flowering-branch"]')
          .dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
      });

      const state = await quotaPage.evaluate(() => window.__IKEBANA_TEST__.getState());
      assert.equal(state.successfulSeatOrdinal, 1, "the graph commit must succeed even though telemetry storage throws");

      const audit = await quotaPage.evaluate(() => window.__IKEBANA_TEST__.getAutosaveAudit());
      assert.ok(audit.writes.length >= 1, "expected the graph autosave write to have been attempted and recorded");

      const graphPayload = await quotaPage.evaluate(() => localStorage.getItem("ikebana-web-alpha:studio-v1"));
      assert.ok(graphPayload, "expected the committed graph to actually be persisted to storage");
      assert.equal(JSON.parse(graphPayload).plants.length, 1);

      assert.deepEqual(quotaPageErrors, [], "a throwing telemetry write must never surface as an uncaught page error");
    } finally {
      await quotaContext.close();
    }
  });

  await test("dismissing the Share sheet is a distinct 'cancelled' result, never a silent download", async () => {
    const shareContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const sharePage = await shareContext.newPage();
    const downloads = [];
    sharePage.on("download", (download) => downloads.push(download));
    await sharePage.addInitScript(() => {
      Object.defineProperty(window.navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(window.navigator, "share", {
        configurable: true,
        value: () => Promise.reject(new DOMException("Abort due to cancellation of share.", "AbortError")),
      });
    });

    try {
      const response = await sharePage.goto(url.href, { waitUntil: "networkidle", timeout: 30_000 });
      assert.ok((response?.status() ?? 0) < 400, `Could not load ${url.href}: ${response?.status()}`);
      await sharePage.waitForFunction(
        () =>
          Boolean(
            window.__IKEBANA_TEST__ &&
              document.querySelector('[data-testid="app-root"][data-ready="true"]'),
          ),
        undefined,
        { timeout: 20_000 },
      );
      await sharePage.evaluate(async () => {
        await window.__IKEBANA_TEST__.resetForTest({ clearAutosave: true, clearTelemetry: true, bendVariant: "fixed" });
      });
      await sharePage.evaluate(() => document.querySelector("#experiment-toggle").click());
      await sharePage.waitForSelector("#experiment-panel:not([hidden])");
      await sharePage.evaluate(() => document.querySelector("#telemetry-export-trigger").click());
      await sharePage.waitForFunction(
        () => (document.querySelector('[data-testid="status"]')?.textContent ?? "").toLowerCase().includes("cancelled"),
        undefined,
        { timeout: 5_000 },
      );

      const statusText = await sharePage.evaluate(() => document.querySelector('[data-testid="status"]').textContent.trim());
      assert.match(statusText, /export cancelled/i);
      assert.equal(downloads.length, 0, "a deliberate share dismissal must never fall through to a silent download");

      const fallbackVisible = await sharePage.evaluate(() => {
        const panel = document.querySelector("#telemetry-export-panel");
        return panel && !panel.hidden;
      });
      assert.equal(fallbackVisible, false, "a deliberate cancellation must not open the manual-copy fallback either");
    } finally {
      await shareContext.close();
    }
  });

  await test("idle WebGL context loss does not alter canonical state", async () => {
    const result = await page.evaluate(async () => {
      const bridge = window.__IKEBANA_TEST__;
      const before = bridge.getState();
      const inventoryBefore = bridge.getRenderInventory();
      const lost = await bridge.loseContextForTest();
      if (!lost) return { skipped: true };
      const restored = await bridge.restoreContextForTest();
      if (!restored) throw new Error("Context was lost but did not restore");
      const after = bridge.getState();
      const inventoryAfter = bridge.getRenderInventory();
      return {
        skipped: false,
        beforeHash: before.canonicalHash,
        afterHash: after.canonicalHash,
        inventoryBefore,
        inventoryAfter,
        transaction: after.transaction,
      };
    });

    if (result.skipped) {
      console.log("  SKIP WEBGL_lose_context extension unavailable");
      return;
    }
    assert.equal(result.afterHash, result.beforeHash);
    assert.equal(result.transaction, null);
    assert.deepEqual(result.inventoryAfter, result.inventoryBefore);
  });

  await test("test bridge reports screen targets and six-way reach regions", async () => {
    const targets = await page.evaluate(() =>
      window.__IKEBANA_TEST__.getScreenTargets(),
    );
    assert.ok(Array.isArray(targets));
    const legalRegions = new Set([
      "top-left",
      "top-right",
      "middle-left",
      "middle-right",
      "bottom-left",
      "bottom-right",
    ]);
    for (const target of targets) {
      assert.equal(Number.isFinite(target.x), true);
      assert.equal(Number.isFinite(target.y), true);
      assert.ok(legalRegions.has(target.region), `Bad reach region: ${target.region}`);
    }
  });

  await test("page emitted no runtime errors", async () => {
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
  });
} finally {
  await context.close();
  await browser.close();
}

const failed = results.filter((result) => result.status === "FAIL");
if (failed.length > 0) {
  console.error(`\n${failed.length} browser smoke check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${results.length} browser smoke checks passed.`);
  console.log(
    "Run tests/browser/PHONE_WEB_TEST_CARD.md on physical iPhone Safari; " +
      "automation does not validate real touch ownership or browser chrome.",
  );
}
