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

  await test("acquisitions carry a variant and distinguish committed from cancelled telemetry", async () => {
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({ clearAutosave: true, bendVariant: "touch" });
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

    const telemetry = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    const touchAcquisitions = telemetry.variants.touch.acquisitions;
    assert.equal(touchAcquisitions.length, 2);
    for (const record of touchAcquisitions) {
      assert.equal(record.bendVariant, "touch");
      assert.equal(typeof record.sessionId, "string");
    }
    const committed = touchAcquisitions.find((record) => record.outcome === "committed");
    const cancelled = touchAcquisitions.find((record) => record.outcome === "cancelled");
    assert.ok(committed, "expected one committed acquisition");
    assert.ok(cancelled, "expected one cancelled acquisition");
    assert.notEqual(committed.outcome, cancelled.outcome);
    assert.equal(cancelled.cancelReason, "pointer-cancel");

    const exportPayload = await page.evaluate(() => window.__IKEBANA_TEST__.getTelemetryExportPayload());
    assert.equal(exportPayload.summary.touch.committed, 1);
    assert.equal(exportPayload.summary.touch.cancelled, 1);
  });

  await test("?fresh=1 clears persisted telemetry across a reload", async () => {
    const before = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    const totalBefore =
      before.variants.bead.acquisitions.length + before.variants.touch.acquisitions.length;
    assert.ok(totalBefore > 0, "expected telemetry recorded by the prior test to persist");

    const freshUrl = new URL(url.href);
    freshUrl.searchParams.set("fresh", "1");
    const response = await page.goto(freshUrl.href, { waitUntil: "networkidle", timeout: 30_000 });
    assert.ok(response?.ok(), `Could not load ${freshUrl.href}: ${response?.status()}`);
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
    assert.equal(after.variants.bead.acquisitions.length, 0);
    assert.equal(after.variants.touch.acquisitions.length, 0);
  });

  await test("telemetry survives an ordinary reload (no ?fresh=1)", async () => {
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({ clearAutosave: true, bendVariant: "fixed" });
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
