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
 *   IKEBANA_URL='http://127.0.0.1:4173/?test=1' \
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
      "contextual-row",
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

  await test("bare URL, ?bend=touch, and ?bend=fixed select the documented bend buckets", async () => {
    const cases = [
      { search: "?test=1", expected: "touch" },
      { search: "?test=1&bend=touch", expected: "touch" },
      { search: "?test=1&bend=fixed", expected: "fixed" },
    ];
    for (const entry of cases) {
      const probe = new URL(url.origin + url.pathname + entry.search);
      const response = await page.goto(probe.href, { waitUntil: "networkidle", timeout: 30_000 });
      assert.ok((response?.status() ?? 0) < 400, `Could not load ${probe.href}: ${response?.status()}`);
      await page.waitForFunction(
        () =>
          Boolean(
            window.__IKEBANA_TEST__ &&
              document.querySelector('[data-testid="app-root"][data-ready="true"]'),
          ),
        undefined,
        { timeout: 20_000 },
      );
      const state = await getBridgeState();
      const rootVariant = await page.evaluate(
        () => document.querySelector('[data-testid="app-root"]').dataset.bendVariant,
      );
      assert.equal(state.bendVariant, entry.expected, `${entry.search} should launch ${entry.expected}`);
      assert.equal(rootVariant, entry.expected);
    }
    const restore = await page.goto(url.href, { waitUntil: "networkidle", timeout: 30_000 });
    assert.ok((restore?.status() ?? 0) < 400, `Could not reload ${url.href}: ${restore?.status()}`);
    await page.waitForFunction(
      () =>
        Boolean(
          window.__IKEBANA_TEST__ &&
            document.querySelector('[data-testid="app-root"][data-ready="true"]'),
        ),
      undefined,
      { timeout: 20_000 },
    );
  });

  await test("launch state is empty Front + Arrange + Shape", async () => {
    await page.evaluate(async () => {
      const requested = new URL(location.href).searchParams.get("bend");
      await window.__IKEBANA_TEST__.resetForTest({
        clearAutosave: true,
        clearTelemetry: true,
        bendVariant: requested === "fixed" || requested === "bead" ? "fixed" : "touch",
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

  async function chromeSnapshot() {
    return page.evaluate(() => {
      const style = (element) => {
        if (!(element instanceof HTMLElement)) return null;
        const computed = getComputedStyle(element);
        return {
          hidden: element.hidden,
          inert: element.inert,
          ariaHidden: element.getAttribute("aria-hidden"),
          pointerEvents: computed.pointerEvents,
          display: computed.display,
          focusable: [...element.querySelectorAll("button")].map((button) => ({
            testId: button.dataset.testid,
            tabIndex: button.tabIndex,
            disabled: button.disabled,
          })),
        };
      };
      const rect = (element) => {
        if (!(element instanceof HTMLElement) || element.hidden) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
      };
      const intersects = (left, right) =>
        left &&
        right &&
        left.left < right.right - 0.5 &&
        left.right > right.left + 0.5 &&
        left.top < right.bottom - 0.5 &&
        left.bottom > right.top + 0.5;
      const tray = document.querySelector('[data-testid="chrome-tray"]');
      const tools = document.querySelector('[data-testid="chrome-tools"]');
      const views = document.querySelector('[data-testid="chrome-views"]');
      const trayBox = rect(tray);
      const kenzan = { x: innerWidth / 2, y: innerHeight * 0.52 };
      const trayCenter = trayBox
        ? { x: (trayBox.left + trayBox.right) / 2, y: (trayBox.top + trayBox.bottom) / 2 }
        : null;
      const corridor = trayCenter
        ? {
            left: Math.min(trayCenter.x, kenzan.x) - 56,
            right: Math.max(trayCenter.x, kenzan.x) + 56,
            top: Math.min(trayCenter.y, kenzan.y),
            bottom: Math.max(trayCenter.y, kenzan.y),
          }
        : null;
      const pinField = {
        left: kenzan.x - 72,
        top: kenzan.y - 72,
        right: kenzan.x + 72,
        bottom: kenzan.y + 72,
      };
      const persistent = [
        ...document.querySelectorAll(
          "button[data-posture], button[data-tool], button[data-view], #experiment-toggle",
        ),
      ]
        .filter((element) => element instanceof HTMLElement)
        .filter((element) => {
          if (element.closest("[hidden], [inert]")) return false;
          const computed = getComputedStyle(element);
          return computed.display !== "none" && computed.pointerEvents !== "none" && computed.visibility !== "hidden";
        })
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            testId: element.dataset.testid ?? element.id,
            left: box.left,
            top: box.top,
            right: box.right,
            bottom: box.bottom,
          };
        });
      return {
        posture: document.querySelector('[data-testid="app-root"]').dataset.posture,
        contextual: document.querySelector('[data-testid="app-root"]').dataset.contextual,
        tools: style(tools),
        views: style(views),
        tray: style(tray),
        trayBox,
        corridor,
        pinField,
        persistent,
        corridorHits: corridor
          ? persistent.filter((box) => intersects(box, corridor)).map((box) => box.testId)
          : [],
        pinFieldHits: persistent.filter((box) => intersects(box, pinField)).map((box) => box.testId),
      };
    });
  }

  await test("contextual chrome rows follow posture and stay out of the insertion corridor", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({
        clearAutosave: true,
        clearTelemetry: true,
        bendVariant: "touch",
      });
    });
    const arrange = await chromeSnapshot();
    assert.equal(arrange.posture, "arrange");
    assert.equal(arrange.contextual, "tools");
    assert.equal(arrange.tools.hidden, false);
    assert.equal(arrange.tools.inert, false);
    assert.notEqual(arrange.tools.display, "none");
    assert.equal(arrange.views.hidden, true);
    assert.equal(arrange.views.inert, true);
    assert.equal(arrange.views.display, "none");
    assert.equal(arrange.tray.hidden, false);
    assert.equal(arrange.views.pointerEvents, "none");
    for (const button of arrange.views.focusable) assert.equal(button.tabIndex, -1);
    assert.deepEqual(arrange.corridorHits, []);
    assert.deepEqual(arrange.pinFieldHits, []);

    const before = await getBridgeState();
    await page.evaluate(() => document.querySelector('[data-testid="posture-step-back"]').click());
    const stepBack = await chromeSnapshot();
    const afterPosture = await getBridgeState();
    assert.equal(stepBack.contextual, "views");
    assert.equal(stepBack.tools.hidden, true);
    assert.equal(stepBack.tools.inert, true);
    assert.equal(stepBack.tools.display, "none");
    assert.equal(stepBack.views.hidden, false);
    assert.notEqual(stepBack.views.display, "none");
    assert.equal(stepBack.tray.hidden, true);
    assert.equal(stepBack.tray.display, "none");
    assert.equal(stepBack.tray.inert, true);
    for (const button of stepBack.tools.focusable) assert.equal(button.tabIndex, -1);
    assert.equal(afterPosture.canonicalHash, before.canonicalHash);
    assert.equal(afterPosture.cameraHash, before.cameraHash);
    assert.equal(afterPosture.successfulSeatOrdinal, 0);

    await page.evaluate(() => document.querySelector('[data-testid="view-above"]').click());
    const afterView = await getBridgeState();
    assert.equal(afterView.view, "above");
    assert.equal(afterView.canonicalHash, before.canonicalHash);

    await page.evaluate(() => document.querySelector('[data-testid="posture-arrange"]').click());
    const restored = await chromeSnapshot();
    assert.equal(restored.tray.hidden, false);
    assert.equal(restored.tools.hidden, false);
    assert.equal(restored.views.hidden, true);
  });

  await test("empty space in the contextual row hits the studio, not invisible chrome", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const hit = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="contextual-row"]');
      const tools = document.querySelector('[data-testid="chrome-tools"]');
      const canvas = document.querySelector('[data-testid="scene-canvas"]');
      const studio = document.getElementById("studio");
      if (!(row instanceof HTMLElement) || !(tools instanceof HTMLElement)) {
        throw new Error("contextual row or tools missing");
      }
      const rowBox = row.getBoundingClientRect();
      const toolsBox = tools.getBoundingClientRect();
      const x = rowBox.left + 12;
      const y = (rowBox.top + rowBox.bottom) / 2;
      const insideRow = x >= rowBox.left && x <= rowBox.right && y >= rowBox.top && y <= rowBox.bottom;
      const insidePill = x >= toolsBox.left && x <= toolsBox.right && y >= toolsBox.top && y <= toolsBox.bottom;
      const rowStyle = getComputedStyle(row);
      const element = document.elementFromPoint(x, y);
      return {
        insideRow,
        insidePill,
        rowPointerEvents: rowStyle.pointerEvents,
        hitTestId: element instanceof HTMLElement ? element.dataset.testid ?? element.id : null,
        hitClass: element instanceof HTMLElement ? element.className : null,
        hitTag: element?.nodeName ?? null,
        isCanvas: element === canvas || canvas?.contains(element),
        isStudio: element === studio || studio?.contains(element),
        isRow: element === row || row.contains(element),
      };
    });
    assert.equal(hit.insideRow, true);
    assert.equal(hit.insidePill, false);
    assert.equal(hit.rowPointerEvents, "none");
    assert.equal(hit.isRow, false);
    assert.ok(hit.isStudio || hit.isCanvas, `empty row point hit ${hit.hitTag}.${hit.hitClass} (${hit.hitTestId})`);
  });

  await test("crown and upper material clear the occupied top-chrome rectangle including safe-area", async () => {
    const cases = [
      { width: 390, height: 844, safeTop: 47 },
      { width: 390, height: 844, safeTop: 59 },
      { width: 430, height: 932, safeTop: 47 },
      { width: 430, height: 932, safeTop: 59 },
    ];
    for (const viewport of cases) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const result = await page.evaluate(async (safeTop) => {
        document.documentElement.style.setProperty("--safe-top", `${safeTop}px`);
        window.dispatchEvent(new Event("resize"));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const bridge = window.__IKEBANA_TEST__;
        if (!bridge?.projectWorldPointForTest) throw new Error("projectWorldPointForTest is missing");
        const header = document.querySelector(".top-chrome");
        const stack = document.querySelector(".chrome-stack");
        const info = document.querySelector(".chrome-info");
        const canvas = document.querySelector('[data-testid="scene-canvas"]');
        if (!(header instanceof HTMLElement) || !(stack instanceof HTMLElement) || !(canvas instanceof HTMLElement)) {
          throw new Error("top chrome or canvas missing");
        }
        const occupiedBottom = Math.max(
          header.getBoundingClientRect().bottom,
          stack.getBoundingClientRect().bottom,
          info instanceof HTMLElement ? info.getBoundingClientRect().bottom : 0,
        );
        const crown = bridge.projectWorldPointForTest({ x: 0, y: 6.53, z: 0 });
        const upper = bridge.projectWorldPointForTest({ x: 0, y: 5.2, z: 0 });
        return {
          occupiedBottom,
          headerBottom: header.getBoundingClientRect().bottom,
          stackBottom: stack.getBoundingClientRect().bottom,
          canvasTop: canvas.getBoundingClientRect().top,
          crownY: crown.y,
          upperY: upper.y,
          crownVisible: crown.visible,
          upperVisible: upper.visible,
        };
      }, viewport.safeTop);
      const label = `${viewport.width}×${viewport.height} safe-top ${viewport.safeTop}`;
      assert.ok(result.occupiedBottom > viewport.safeTop, `${label}: occupied chrome did not include safe-area (${result.occupiedBottom})`);
      assert.ok(
        result.crownY > result.occupiedBottom,
        `${label}: crown at ${result.crownY} does not clear occupied chrome ${result.occupiedBottom}`,
      );
      assert.ok(
        result.upperY > result.occupiedBottom,
        `${label}: upper material at ${result.upperY} does not clear occupied chrome ${result.occupiedBottom}`,
      );
    }
    await page.evaluate(() => {
      document.documentElement.style.removeProperty("--safe-top");
      window.dispatchEvent(new Event("resize"));
    });
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await test("resetForTest without bendVariant preserves the live variant and telemetry bucket", async () => {
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({
        clearAutosave: true,
        clearTelemetry: true,
        bendVariant: "touch",
      });
    });
    const afterTouchOmit = await page.evaluate(async () => {
      const before = window.__IKEBANA_TEST__.getState();
      await window.__IKEBANA_TEST__.resetForTest({
        clearAutosave: true,
        clearTelemetry: true,
      });
      const after = window.__IKEBANA_TEST__.getState();
      const payload = window.__IKEBANA_TEST__.getTelemetryExportPayload();
      return {
        before: before.bendVariant,
        after: after.bendVariant,
        dataset: document.querySelector('[data-testid="app-root"]').dataset.bendVariant,
        currentBendVariant: payload.currentBendVariant,
      };
    });
    assert.equal(afterTouchOmit.before, "touch");
    assert.equal(afterTouchOmit.after, "touch");
    assert.equal(afterTouchOmit.dataset, "touch");
    assert.equal(afterTouchOmit.currentBendVariant, "touch");

    const afterFixedOmit = await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({
        clearAutosave: true,
        clearTelemetry: true,
        bendVariant: "fixed",
      });
      const before = window.__IKEBANA_TEST__.getState();
      await window.__IKEBANA_TEST__.resetForTest({
        clearAutosave: false,
        clearTelemetry: false,
      });
      const after = window.__IKEBANA_TEST__.getState();
      const payload = window.__IKEBANA_TEST__.getTelemetryExportPayload();
      const telemetry = window.__IKEBANA_TEST__.getPersistedTelemetry();
      return {
        before: before.bendVariant,
        after: after.bendVariant,
        dataset: document.querySelector('[data-testid="app-root"]').dataset.bendVariant,
        currentBendVariant: payload.currentBendVariant,
        buckets: Object.keys(telemetry.variants).sort(),
      };
    });
    assert.equal(afterFixedOmit.before, "fixed");
    assert.equal(afterFixedOmit.after, "fixed");
    assert.equal(afterFixedOmit.dataset, "fixed");
    assert.equal(afterFixedOmit.currentBendVariant, "bead");
    assert.deepEqual(afterFixedOmit.buckets, ["bead", "touch"]);
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({
        clearAutosave: true,
        clearTelemetry: true,
        bendVariant: "touch",
      });
    });
  });

  await test("an acquired insertion keeps ownership while crossing the former mid-screen control strip", async () => {
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({
        clearAutosave: true,
        clearTelemetry: true,
        bendVariant: "touch",
      });
    });
    const before = await getBridgeState();
    const trayBox = await page.locator('[data-testid="material-flowering-branch"]').boundingBox();
    assert.ok(trayBox, "tray material must be present in Arrange");
    const start = { x: trayBox.x + trayBox.width / 2, y: trayBox.y + trayBox.height / 2 };
    const mid = { x: 390 / 2, y: 844 * 0.72 };
    const invalid = { x: 28, y: 844 * 0.40 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const acquired = await getBridgeState();
    assert.equal(acquired.transaction?.operation, "insert");
    await page.mouse.move(mid.x, mid.y, { steps: 12 });
    const crossed = await getBridgeState();
    assert.equal(crossed.transaction?.operation, "insert");
    assert.equal(crossed.posture, "arrange");
    assert.equal(crossed.tool, "shape");
    assert.equal(crossed.view, before.view);
    assert.equal(crossed.canonicalHash, before.canonicalHash);
    await page.mouse.move(invalid.x, invalid.y, { steps: 8 });
    await page.mouse.up();
    const afterRelease = await getBridgeState();
    assert.equal(afterRelease.successfulSeatOrdinal, 0);
    assert.equal(afterRelease.canonicalHash, before.canonicalHash);
  });

  await test("phone and desktop viewports keep persistent chrome out of the tray-to-kenzan corridor", async () => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(async () => {
        await window.__IKEBANA_TEST__.resetForTest({
          clearAutosave: true,
          clearTelemetry: true,
          bendVariant: "touch",
        });
      });
      const snapshot = await chromeSnapshot();
      assert.deepEqual(
        snapshot.corridorHits,
        [],
        `${viewport.width}×${viewport.height}: interactive chrome intersects the insertion corridor: ${snapshot.corridorHits.join(", ")}`,
      );
      if (viewport.height > viewport.width) {
        assert.deepEqual(
          snapshot.pinFieldHits,
          [],
          `${viewport.width}×${viewport.height}: interactive chrome covers the usable pin field: ${snapshot.pinFieldHits.join(", ")}`,
        );
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
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

  await test("?clearStudyData=1 is one-shot: it clears once, strips itself from the URL, and never re-clears on a later reload", async () => {
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
    assert.equal(
      afterClear.variants.bead.acquisitions.length + afterClear.variants.touch.acquisitions.length,
      0,
    );

    const searchAfterClear = await page.evaluate(() => location.search);
    assert.doesNotMatch(
      searchAfterClear,
      /clearStudyData/,
      "clearStudyData must be removed from the URL (via replaceState) immediately after it is acted on",
    );

    // Collect a new record after the one-shot clear.
    await page.evaluate(() => {
      document
        .querySelector('[data-testid="material-flowering-branch"]')
        .dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    });
    const collected = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    const totalCollected =
      collected.variants.bead.acquisitions.length + collected.variants.touch.acquisitions.length;
    assert.equal(totalCollected, 1);

    // Give the deferred flush a turn, then reload the current (now
    // flag-free) URL. If clearStudyData had stuck around, this would wipe
    // the just-collected record again.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    const currentUrl = page.url();
    assert.doesNotMatch(currentUrl, /clearStudyData/);
    const reloadResponse = await page.goto(currentUrl, { waitUntil: "networkidle", timeout: 30_000 });
    assert.ok((reloadResponse?.status() ?? 0) < 400, `Could not reload ${currentUrl}: ${reloadResponse?.status()}`);
    await page.waitForFunction(
      () =>
        Boolean(
          window.__IKEBANA_TEST__ &&
            document.querySelector('[data-testid="app-root"][data-ready="true"]'),
        ),
      undefined,
      { timeout: 20_000 },
    );

    const afterReload = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    const totalAfterReload =
      afterReload.variants.bead.acquisitions.length + afterReload.variants.touch.acquisitions.length;
    assert.equal(totalAfterReload, 1, "the record collected after the one-shot clear must survive an ordinary reload");
  });

  await test("a canonical-view change resets in-progress attempt state, same as posture/tool/variant", async () => {
    await page.evaluate(async () => {
      await window.__IKEBANA_TEST__.resetForTest({ clearAutosave: true, clearTelemetry: true, bendVariant: "fixed" });
    });
    // A miss: an empty-space tap with no acquirable target.
    await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="scene-canvas"]');
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 404,
          clientX: rect.left + 2,
          clientY: rect.top + 2,
          button: 0,
        }),
      );
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 404, clientX: rect.left + 2, clientY: rect.top + 2 }));
    });
    const beforeViewChange = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    const missCount =
      beforeViewChange.variants.bead.acquisitions.length + beforeViewChange.variants.touch.acquisitions.length;
    assert.ok(missCount >= 1, "expected the empty-space tap to record a miss");

    // A canonical view change is the boundary under test.
    await page.evaluate(() => document.querySelector('[data-testid="view-above"]').click());

    // A committed hit (keyboard insert) after the boundary must start its
    // own attempt at zero misses, not inherit the miss from before the view change.
    await page.evaluate(() => {
      document
        .querySelector('[data-testid="material-flowering-branch"]')
        .dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    });
    const after = await page.evaluate(() => window.__IKEBANA_TEST__.getPersistedTelemetry());
    const insertRecord = [...after.variants.bead.acquisitions, ...after.variants.touch.acquisitions].find(
      (record) => record.operation === "insert",
    );
    assert.ok(insertRecord, "expected the keyboard insertion to be recorded");
    assert.equal(
      insertRecord.missesBeforeHit,
      0,
      "a canonical view change must reset in-progress attempt state, same as posture/tool/variant",
    );

    await page.evaluate(() => document.querySelector('[data-testid="view-front"]').click());
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

      // Telemetry writes are deferred to a later timer task; give the
      // scheduled flush a turn to run and (harmlessly, internally) fail before
      // asserting no uncaught page error resulted from it.
      await quotaPage.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
      assert.deepEqual(quotaPageErrors, [], "a throwing telemetry write must never surface as an uncaught page error");
    } finally {
      await quotaContext.close();
    }
  });

  await test("a shared-origin quota: telemetry occupying storage never prevents a graph save that would otherwise fit", async () => {
    const sharedQuotaContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const sharedQuotaPage = await sharedQuotaContext.newPage();
    // A realistic shared-origin quota: every key competes for the same
    // budget, unlike the per-key-throw test above. ~20 KB is small enough
    // that pre-occupying most of it with telemetry blocks a real single-
    // plant graph save, but the graph alone comfortably fits once telemetry
    // yields (clears) its share.
    await sharedQuotaPage.addInitScript(() => {
      const BUDGET_BYTES = 20_000;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function patchedSetItem(key, value) {
        let totalExcludingThisKey = 0;
        for (let index = 0; index < this.length; index += 1) {
          const existingKey = this.key(index);
          if (existingKey === key) continue;
          totalExcludingThisKey += existingKey.length + (this.getItem(existingKey) ?? "").length;
        }
        if (totalExcludingThisKey + key.length + value.length > BUDGET_BYTES) {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
    });

    try {
      const response = await sharedQuotaPage.goto(url.href, { waitUntil: "networkidle", timeout: 30_000 });
      assert.ok((response?.status() ?? 0) < 400, `Could not load ${url.href}: ${response?.status()}`);
      await sharedQuotaPage.waitForFunction(
        () =>
          Boolean(
            window.__IKEBANA_TEST__ &&
              document.querySelector('[data-testid="app-root"][data-ready="true"]'),
          ),
        undefined,
        { timeout: 20_000 },
      );
      await sharedQuotaPage.evaluate(async () => {
        await window.__IKEBANA_TEST__.resetForTest({ clearAutosave: true, clearTelemetry: true, bendVariant: "fixed" });
      });

      // Occupy most of the virtual quota with junk telemetry directly
      // (deterministic; not dependent on how many real gestures it'd take).
      const seeded = await sharedQuotaPage.evaluate(() => {
        try {
          const junkAcquisition = (index) => ({
            at: index,
            wallClockMs: index,
            sessionId: "seed-session",
            bendVariant: "bead",
            posture: "arrange",
            tool: "shape",
            result: "hit",
            operation: "aim",
            region: "middle",
            missesBeforeHit: 0,
            timeToAcquireMs: 5,
            outcome: "committed",
          });
          const acquisitions = Array.from({ length: 40 }, (_, index) => junkAcquisition(index));
          const payload = {
            storageVersion: 1,
            instrumentVersion: window.__IKEBANA_TEST__.getPersistedTelemetry().instrumentVersion,
            savedAt: new Date().toISOString(),
            variants: { bead: { acquisitions }, touch: { acquisitions: [] } },
          };
          localStorage.setItem("ikebana-web-alpha:telemetry-v1", JSON.stringify(payload));
          return true;
        } catch {
          return false;
        }
      });
      assert.equal(seeded, true, "expected the junk telemetry seed itself to fit under the virtual quota");

      const occupiedBefore = await sharedQuotaPage.evaluate(
        () => localStorage.getItem("ikebana-web-alpha:telemetry-v1")?.length ?? 0,
      );
      assert.ok(occupiedBefore > 0, "expected telemetry to actually occupy shared storage before the graph commit");

      // A real graph commit (keyboard activation): alone it fits under the
      // budget, but not stacked on top of the seeded telemetry — the first
      // save attempt must fail, triggering eviction, then a retry that fits.
      await sharedQuotaPage.evaluate(() => {
        document
          .querySelector('[data-testid="material-flowering-branch"]')
          .dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
      });

      const state = await sharedQuotaPage.evaluate(() => window.__IKEBANA_TEST__.getState());
      assert.equal(
        state.successfulSeatOrdinal,
        1,
        "telemetry must yield storage so a graph that would otherwise fit can still save",
      );

      const graphPayload = await sharedQuotaPage.evaluate(() => localStorage.getItem("ikebana-web-alpha:studio-v1"));
      assert.ok(graphPayload, "expected the committed graph to actually be persisted after eviction+retry");
      assert.equal(JSON.parse(graphPayload).plants.length, 1);

      const telemetryAfter = await sharedQuotaPage.evaluate(() =>
        window.__IKEBANA_TEST__.getPersistedTelemetry(),
      );
      const totalAfter =
        telemetryAfter.variants.bead.acquisitions.length + telemetryAfter.variants.touch.acquisitions.length;
      // The 40 seeded junk records must be gone (evicted); only this one
      // commit's own telemetry (recorded after the successful retry) remains.
      assert.equal(
        totalAfter,
        1,
        "eviction must have actually cleared the blocking seeded telemetry, leaving only this commit's own record",
      );
      assert.equal(telemetryAfter.variants.bead.acquisitions[0]?.sessionId === "seed-session", false);
    } finally {
      await sharedQuotaContext.close();
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
