/**
 * Matched headless evidence for the foliage + flower + picker integration.
 * Product code is not modified. Draw counts follow the polish-baseline wrap:
 * drawElements / drawArrays only, mode 4 as triangles, vessel included,
 * counters reset, one view click, three animation frames.
 * Instanced draws are counted beside that wrap and are not added into it.
 *
 *   POLISH_OUT=docs/development/reports/polish-integration/after \
 *   POLISH_ORIGIN=http://127.0.0.1:5173 \
 *   POLISH_SMOKE=1 POLISH_CLIP=1 \
 *   node tools/capture-polish-integration.mjs
 *
 * Chrome must already be listening on POLISH_CDP (default 9222).
 * Not a physical phone.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const OUT = process.env.POLISH_OUT ?? "docs/development/reports/polish-integration/after";
const ORIGIN = process.env.POLISH_ORIGIN ?? "http://127.0.0.1:5173";
const PORT = Number(process.env.POLISH_CDP ?? 9222);
const APP = `${ORIGIN}/?workbench=1&fresh=1&test=1`;
const RELOAD = `${ORIGIN}/?workbench=1&test=1`;
const ARRANGEMENT_PATH = resolve("artifacts/polish-baseline-arrangements.json");
const GARDEN_KEY = "ikebana-web-alpha:workbench-garden-v1";
const SEED = 8278;
const VIEWS = ["front", "three-quarter", "above"];
const DO_SMOKE = process.env.POLISH_SMOKE === "1";
const DO_CLIP = process.env.POLISH_CLIP === "1";
const MATERIALS = [
  "flowering-branch",
  "leafy-shoot",
  "bare-branch",
  "single-flower",
  "reed",
  "flower-volume",
  "arching-trailer",
  "foliage-fan",
  "blossom-spray",
  "nodding-flower",
  "berry-twig",
  "fern-frond",
];
const HASH_A = "3b1e9ad9";
const HASH_B = "1f7e3e94";

function delay(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.next = 1;
    this.pending = new Map();
    this.frames = [];
    this.recording = false;
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Page.screencastFrame") {
        if (this.recording) this.frames.push(message.params.data);
        this.send("Page.screencastFrameAck", { sessionId: message.params.sessionId }).catch(() => {});
        return;
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve: done, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else done(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.next;
    this.next += 1;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((done, reject) => this.pending.set(id, { resolve: done, reject }));
  }
}

async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error(`no page target: ${JSON.stringify(targets)}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    ws.addEventListener("open", done);
    ws.addEventListener("error", reject);
  });
  return new Cdp(ws);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function shot(cdp, name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  const file = `${OUT}/${name}.png`;
  writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}

async function waitReady(cdp) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ready = await evaluate(cdp, `document.querySelector("#app")?.dataset.ready`);
    if (ready === "true") return;
    await delay(250);
  }
  throw new Error("app not ready");
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await delay(400);
  await waitReady(cdp);
}

async function environment(cdp) {
  return evaluate(cdp, `(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      cssViewport: { width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height },
      drawingBuffer: { width: canvas.width, height: canvas.height },
      devicePixelRatio: window.devicePixelRatio,
      browserWindow: { width: window.innerWidth, height: window.innerHeight },
      userAgent: navigator.userAgent,
      webgl: canvas.getContext("webgl2") ? "webgl2" : "webgl",
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
    };
  })()`);
}

async function loadFixture(cdp, material, count, seed = SEED) {
  const loaded = await evaluate(cdp, `(() => {
    document.querySelector("#workbench-open").click();
    const select = document.querySelector("#workbench-material");
    const option = [...select.options].find((item) => item.value === ${JSON.stringify(material)});
    if (!option || option.disabled) return { ok: false, reason: "missing-or-disabled", material: ${JSON.stringify(material)} };
    select.value = ${JSON.stringify(material)};
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#workbench-seed").value = ${JSON.stringify(String(seed))};
    document.querySelector("#workbench-count").value = ${JSON.stringify(String(count))};
    document.querySelector("#workbench-form").requestSubmit();
    return { ok: true, error: document.querySelector("#workbench-error")?.textContent ?? "" };
  })()`);
  if (!loaded?.ok) throw new Error(`fixture load failed: ${JSON.stringify(loaded)}`);
  await delay(500);
  const plants = await evaluate(cdp, `window.__IKEBANA_TEST__.getCanonicalSnapshot().plants.length`);
  if (plants !== count) throw new Error(`fixture ${material} x${count} loaded ${plants} plants; error=${loaded.error}`);
}

async function renderView(cdp, view) {
  return evaluate(cdp, `new Promise((resolve) => {
    window.__gl.calls = 0;
    window.__gl.triangles = 0;
    window.__gl.instancedCalls = 0;
    window.__gl.instancedTriangles = 0;
    const start = performance.now();
    document.querySelector(${JSON.stringify(`[data-testid="view-${view}"]`)}).click();
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      resolve({
        renderElapsedMs: performance.now() - start,
        calls: window.__gl.calls,
        triangles: Math.round(window.__gl.triangles),
        instancedCalls: window.__gl.instancedCalls,
        instancedTriangles: Math.round(window.__gl.instancedTriangles),
      });
    })));
  })`);
}

async function summary(cdp) {
  return evaluate(cdp, `(() => {
    const bridge = window.__IKEBANA_TEST__;
    const snap = bridge.getCanonicalSnapshot();
    const state = bridge.getState();
    return {
      canonicalHash: state.canonicalHash,
      cameraHash: state.cameraHash,
      ordinal: snap.successfulPlantOrdinal,
      seatOrdinal: state.successfulSeatOrdinal,
      bendVariant: state.bendVariant,
      tool: state.tool,
      view: state.view,
      posture: state.posture,
      selectedBranchId: state.selectedBranchId,
      transaction: state.transaction,
      plants: snap.plants.map((plant) => ({
        id: plant.id,
        seed: plant.seed,
        generatorVersion: plant.generatorVersion,
        branches: plant.branches.length,
        organs: plant.organs.length,
        activeBranches: plant.branches.filter((branch) => branch.active !== false).length,
        activeOrgans: plant.organs.filter((organ) => organ.active !== false).length,
        inactiveOrganIds: plant.organs.filter((organ) => organ.active === false).map((organ) => organ.id),
      })),
    };
  })()`);
}

async function closeDialogs(cdp) {
  await evaluate(cdp, `(() => {
    for (const dialog of document.querySelectorAll("dialog")) {
      if (dialog.open) dialog.close();
    }
  })()`);
}

async function clearGarden(cdp) {
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(GARDEN_KEY)})`);
}

function gestureExpression({ branchId, dx, dy, pointerId, release }) {
  return `(() => {
    const bridge = window.__IKEBANA_TEST__;
    const canvas = document.querySelector("canvas");
    const point = bridge.getScreenTargets().find((item) => item.branchId === ${JSON.stringify(branchId)});
    if (!point) return { missing: ${JSON.stringify(branchId)}, targets: bridge.getScreenTargets().map((item) => item.branchId) };
    const before = bridge.getState();
    const fire = (type, x, y, buttons, target) => {
      target.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: ${pointerId}, clientX: x, clientY: y, button: 0, buttons, pointerType: "mouse",
      }));
    };
    fire("pointerdown", point.x, point.y, 1, canvas);
    fire("pointermove", point.x + ${dx}, point.y + ${dy}, 1, window);
    const during = bridge.getState();
    const cue = document.querySelector("#craft-cue")?.innerText ?? "";
    if (${release ? "true" : "false"}) fire("pointerup", point.x + ${dx}, point.y + ${dy}, 0, window);
    const after = bridge.getState();
    return {
      point, cue,
      beforeHash: before.canonicalHash,
      duringHash: during.canonicalHash,
      during: during.transaction,
      selectedDuring: during.selectedBranchId,
      afterHash: after.canonicalHash,
      afterTransaction: after.transaction,
      ordinal: after.successfulSeatOrdinal,
    };
  })()`;
}

async function pressBranch(cdp, branchId, dx, dy, pointerId) {
  return evaluate(cdp, gestureExpression({ branchId, dx, dy, pointerId, release: true }));
}

async function previewBranch(cdp, branchId, dx, dy, pointerId) {
  return evaluate(cdp, gestureExpression({ branchId, dx, dy, pointerId, release: false }));
}

async function cancelGesture(cdp) {
  return evaluate(cdp, `(() => {
    const before = window.__IKEBANA_TEST__.getState();
    const writesBefore = window.__IKEBANA_TEST__.getAutosaveAudit().writes.length;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const after = window.__IKEBANA_TEST__.getState();
    return {
      beforeHash: before.canonicalHash,
      beforeTransaction: before.transaction,
      afterHash: after.canonicalHash,
      afterTransaction: after.transaction,
      addedSave: window.__IKEBANA_TEST__.getAutosaveAudit().writes.length > writesBefore,
    };
  })()`);
}

async function acquireBend(cdp, branchId, pointerBase) {
  const offsets = [[0, 0], [0, -16], [0, 16], [-16, 0], [16, 0], [-24, -18], [24, -18], [-24, 18], [24, 18], [0, -32], [0, 32]];
  const attempts = [];
  for (let index = 0; index < offsets.length; index += 1) {
    const [ox, oy] = offsets[index];
    const probe = await evaluate(cdp, `(() => {
      const bridge = window.__IKEBANA_TEST__;
      const canvas = document.querySelector("canvas");
      const point = bridge.getScreenTargets().find((item) => item.branchId === ${JSON.stringify(branchId)});
      if (!point) return { missing: true };
      const x = point.x + ${ox};
      const y = point.y + ${oy};
      canvas.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, pointerId: ${pointerBase + index}, clientX: x, clientY: y, button: 0, buttons: 1, pointerType: "mouse",
      }));
      const during = bridge.getState();
      return { x, y, operation: during.transaction?.operation ?? null, hash: during.canonicalHash };
    })()`);
    attempts.push({ offset: [ox, oy], operation: probe?.operation ?? null, missing: probe?.missing ?? false });
    if (probe?.operation === "bend") {
      const moved = await evaluate(cdp, `(() => {
        const bridge = window.__IKEBANA_TEST__;
        const x = ${probe.x} + 36;
        const y = ${probe.y} + 28;
        window.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true, pointerId: ${pointerBase + index}, clientX: x, clientY: y, button: 0, buttons: 1, pointerType: "mouse",
        }));
        const during = bridge.getState();
        window.dispatchEvent(new PointerEvent("pointerup", {
          bubbles: true, pointerId: ${pointerBase + index}, clientX: x, clientY: y, button: 0, buttons: 0, pointerType: "mouse",
        }));
        const after = bridge.getState();
        return { during: during.transaction, duringHash: during.canonicalHash, afterHash: after.canonicalHash };
      })()`);
      return { acquired: true, offset: [ox, oy], attempts, moved };
    }
    await cancelGesture(cdp);
  }
  return { acquired: false, attempts };
}

async function acquireAim(cdp, branchId, pointerBase, dx, dy) {
  const offsets = [
    [0, -120], [0, 120], [0, -180], [0, 180], [-36, -140], [36, 140], [0, -80], [0, 80], [-70, 30], [70, -30],
    // A short stem, such as the nodding flower, keeps its tip inside these nearer samples.
    [0, -40], [0, -60], [0, -20], [0, 40], [0, 60], [0, -16], [12, -48], [-12, -48],
  ];
  const attempts = [];
  for (let index = 0; index < offsets.length; index += 1) {
    const [ox, oy] = offsets[index];
    const probe = await evaluate(cdp, `(() => {
      const bridge = window.__IKEBANA_TEST__;
      const canvas = document.querySelector("canvas");
      const point = bridge.getScreenTargets().find((item) => item.branchId === ${JSON.stringify(branchId)});
      if (!point) return { missing: true };
      const x = point.x + ${ox};
      const y = point.y + ${oy};
      canvas.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, pointerId: ${pointerBase + index}, clientX: x, clientY: y, button: 0, buttons: 1, pointerType: "mouse",
      }));
      const during = bridge.getState();
      return { x, y, operation: during.transaction?.operation ?? null, branch: during.selectedBranchId, hash: during.canonicalHash };
    })()`);
    attempts.push({ offset: [ox, oy], operation: probe?.operation ?? null, branch: probe?.branch ?? null, missing: probe?.missing ?? false });
    if (probe?.operation === "aim" && probe.branch === branchId) {
      const moved = await evaluate(cdp, `(() => {
        const bridge = window.__IKEBANA_TEST__;
        const x = ${probe.x} + ${dx};
        const y = ${probe.y} + ${dy};
        window.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true, pointerId: ${pointerBase + index}, clientX: x, clientY: y, button: 0, buttons: 1, pointerType: "mouse",
        }));
        const during = bridge.getState();
        window.dispatchEvent(new PointerEvent("pointerup", {
          bubbles: true, pointerId: ${pointerBase + index}, clientX: x, clientY: y, button: 0, buttons: 0, pointerType: "mouse",
        }));
        const after = bridge.getState();
        return { during: during.transaction, duringHash: during.canonicalHash, afterHash: after.canonicalHash };
      })()`);
      return { acquired: true, offset: [ox, oy], drag: [dx, dy], attempts, moved };
    }
    await cancelGesture(cdp);
  }
  return { acquired: false, attempts };
}

async function branchLengths(cdp, branchId) {
  return evaluate(cdp, `(() => {
    const snap = window.__IKEBANA_TEST__.getCanonicalSnapshot();
    for (const plant of snap.plants) {
      const branch = plant.branches.find((item) => item.id === ${JSON.stringify(branchId)});
      if (branch) return { activeLength: branch.activeLength, restLength: branch.restLength ?? branch.activeLength, active: branch.active !== false };
    }
    return null;
  })()`);
}

async function keepArrangement(cdp, title) {
  const kept = await evaluate(cdp, `(() => {
    document.querySelector("#garden-open").click();
    const name = document.querySelector("#garden-name");
    name.value = ${JSON.stringify(title)};
    document.querySelector("#garden-keep-form").requestSubmit();
    return {
      error: document.querySelector("#garden-error")?.textContent ?? "",
      count: document.querySelector("#garden-count")?.textContent ?? "",
    };
  })()`);
  await delay(250);
  await closeDialogs(cdp);
  return kept;
}

async function listFold(cdp) {
  return evaluate(cdp, `(() => {
    const options = document.querySelector("#material-options");
    const box = options.getBoundingClientRect();
    const above = document.querySelector("[data-testid='materials-more-above']");
    const below = document.querySelector("[data-testid='materials-more-below']");
    const items = [...options.querySelectorAll("[data-material-choice]")].map((node) => {
      const rect = node.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, box.top);
      const visibleBottom = Math.min(rect.bottom, box.bottom);
      const visible = Math.max(0, visibleBottom - visibleTop);
      return {
        id: node.getAttribute("data-material-choice"),
        pressed: node.getAttribute("aria-pressed") === "true",
        fullyVisible: rect.top >= box.top - 0.5 && rect.bottom <= box.bottom + 0.5,
        visibleFraction: rect.height > 0 ? visible / rect.height : 0,
      };
    });
    let underFade = null;
    if (below && !below.hidden) {
      const rect = below.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 6);
      underFade = hit?.closest?.("[data-material-choice]")?.getAttribute("data-material-choice")
        ?? hit?.id
        ?? hit?.className
        ?? null;
    }
    return {
      clientHeight: options.clientHeight,
      scrollHeight: options.scrollHeight,
      scrollTop: options.scrollTop,
      cuesPresent: Boolean(above && below),
      aboveHidden: above ? above.hidden : null,
      belowHidden: below ? below.hidden : null,
      underFade,
      items,
    };
  })()`);
}

mkdirSync(OUT, { recursive: true });
const cdp = await connect();
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("DOM.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    window.__gl = { calls: 0, triangles: 0, instancedCalls: 0, instancedTriangles: 0 };
    const wrap = (prototype) => {
      if (!prototype || prototype.__polishWrapped) return;
      const elements = prototype.drawElements;
      const arrays = prototype.drawArrays;
      const elementsInstanced = prototype.drawElementsInstanced;
      const arraysInstanced = prototype.drawArraysInstanced;
      prototype.drawElements = function (mode, count) {
        window.__gl.calls += 1;
        if (mode === 4) window.__gl.triangles += count / 3;
        return elements.apply(this, arguments);
      };
      prototype.drawArrays = function (mode, first, count) {
        window.__gl.calls += 1;
        if (mode === 4) window.__gl.triangles += count / 3;
        return arrays.apply(this, arguments);
      };
      if (elementsInstanced) {
        prototype.drawElementsInstanced = function (mode, count, type, offset, primcount) {
          window.__gl.instancedCalls += 1;
          if (mode === 4) window.__gl.instancedTriangles += (count / 3) * primcount;
          return elementsInstanced.apply(this, arguments);
        };
      }
      if (arraysInstanced) {
        prototype.drawArraysInstanced = function (mode, first, count, primcount) {
          window.__gl.instancedCalls += 1;
          if (mode === 4) window.__gl.instancedTriangles += count * primcount;
          return arraysInstanced.apply(this, arguments);
        };
      }
      prototype.__polishWrapped = true;
    };
    wrap(WebGL2RenderingContext.prototype);
    wrap(WebGLRenderingContext.prototype);
  `,
});

const report = {
  label: "Google Chrome headless, Linux. Protocol counts are drawElements/drawArrays only, vessel included. Instanced counts are separate. Not a physical phone.",
  origin: ORIGIN,
  seed: SEED,
  specimens: [],
  costs: [],
  arrangements: [],
  picker: null,
  smoke: [],
};

await navigate(cdp, APP);
report.environment = await environment(cdp);
console.log("environment", JSON.stringify(report.environment));

for (const material of MATERIALS) {
  await loadFixture(cdp, material, 1, SEED);
  const views = {};
  for (const view of VIEWS) {
    const counts = await renderView(cdp, view);
    const snap = await summary(cdp);
    const still = await shot(cdp, `${material}-seed${SEED}-count1-${view}`);
    views[view] = { counts, canonicalHash: snap.canonicalHash, still };
    console.log("specimen", material, view, counts.calls, counts.triangles, counts.instancedCalls, counts.instancedTriangles, snap.canonicalHash);
  }
  report.specimens.push({ material, summary: await summary(cdp), views });
}

await loadFixture(cdp, "round5-palette", 12, SEED);
const palette = { fixture: "round5-palette", seed: SEED, count: 12, views: {} };
for (const view of VIEWS) {
  const counts = await renderView(cdp, view);
  const snap = await summary(cdp);
  const still = view === "front" ? await shot(cdp, "round5-palette-seed8278-count12-front") : null;
  palette.views[view] = { counts, canonicalHash: snap.canonicalHash, still };
  console.log("palette", view, counts.calls, counts.triangles, counts.instancedTriangles, snap.canonicalHash);
}
palette.summary = await summary(cdp);
report.costs.push(palette);

await navigate(cdp, APP);
await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);
await delay(200);
const pickerClosed = await summary(cdp);
const foldTop = await listFold(cdp);
await shot(cdp, "materials-list-1280x800");
const selected = await evaluate(cdp, `(() => {
  const before = window.__IKEBANA_TEST__.getCanonicalSnapshot();
  const choice = document.querySelector("[data-material-choice='fern-frond']");
  choice.click();
  const after = window.__IKEBANA_TEST__.getCanonicalSnapshot();
  const state = window.__IKEBANA_TEST__.getState();
  return {
    menuOpen: document.querySelector("#app").dataset.materialMenu === "open",
    selected: document.querySelector("#app").dataset.selectedMaterial,
    source: document.querySelector("#selected-cutting")?.getAttribute("aria-label") ?? "",
    plantsBefore: before.plants.length,
    plantsAfter: after.plants.length,
    ordinalBefore: before.successfulPlantOrdinal,
    ordinalAfter: after.successfulPlantOrdinal,
    hashBefore: state.canonicalHash,
    hash: window.__IKEBANA_TEST__.getState().canonicalHash,
  };
})()`);
await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);
await delay(250);
const foldReopen = await listFold(cdp);
await shot(cdp, "materials-list-1280x800-selected-reopen");
await evaluate(cdp, `document.querySelector("#material-options").scrollTop = 0`);
await delay(80);
const foldReset = await listFold(cdp);
await evaluate(cdp, `document.querySelector("#material-options").scrollTop = 9999`);
await delay(80);
const foldEnd = await listFold(cdp);
await shot(cdp, "materials-list-1280x800-scrolled");
await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
const pickerAfter = await summary(cdp);
report.picker = {
  emptyHash: pickerClosed.canonicalHash,
  foldTop,
  selected,
  foldReopen,
  foldReset,
  foldEnd,
  afterHash: pickerAfter.canonicalHash,
  plants: pickerAfter.plants.length,
  ordinal: pickerAfter.ordinal,
};
console.log("picker", JSON.stringify({
  selected: selected.selected,
  plants: selected.plantsAfter,
  ordinal: selected.ordinalAfter,
  reopenScroll: foldReopen.scrollTop,
  cues: foldTop.cuesPresent,
  belowAtTop: foldTop.belowHidden,
  underFade: foldTop.underFade,
}));
if (selected.plantsAfter !== 0 || selected.ordinalAfter !== 0) {
  throw new Error(`picker select inserted a plant: ${JSON.stringify(selected)}`);
}
if (foldTop.cuesPresent) {
  if (foldTop.belowHidden !== false || foldTop.aboveHidden !== true) {
    throw new Error(`expected a below cue at the top of the list: ${JSON.stringify(foldTop)}`);
  }
  if (foldEnd.aboveHidden !== false || foldEnd.belowHidden !== true) {
    throw new Error(`expected an above cue at the end of the list: ${JSON.stringify(foldEnd)}`);
  }
  const fern = foldReopen.items.find((item) => item.id === "fern-frond");
  if (!fern?.pressed || !fern.fullyVisible) {
    throw new Error(`reopened list did not show the pressed fern row: ${JSON.stringify(foldReopen)}`);
  }
}

await clearGarden(cdp);
await navigate(cdp, APP);
await evaluate(cdp, `document.querySelector("#garden-open").click()`);
const documentRoot = await cdp.send("DOM.getDocument");
const fileNode = await cdp.send("DOM.querySelector", { nodeId: documentRoot.root.nodeId, selector: "#garden-file" });
await cdp.send("DOM.setFileInputFiles", { nodeId: fileNode.nodeId, files: [ARRANGEMENT_PATH] });
await delay(600);
const imported = await evaluate(cdp, `(() => ({
  error: document.querySelector("#garden-error")?.textContent ?? "",
  count: document.querySelector("#garden-count")?.textContent ?? "",
  titles: [...document.querySelectorAll(".garden-card strong")].map((node) => node.textContent),
}))()`);
report.import = imported;
console.log("import", JSON.stringify(imported));
if (!imported.titles.includes("Leafy fern and fan") || !imported.titles.includes("Berry and flower accents")) {
  throw new Error(`import missing arrangements: ${JSON.stringify(imported)}`);
}

for (const arrangement of [
  { title: "Leafy fern and fan", slug: "arrangement-a-leafy-fern-fan", hash: HASH_A },
  { title: "Berry and flower accents", slug: "arrangement-b-berry-flower-accents", hash: HASH_B },
]) {
  await evaluate(cdp, `(() => {
    document.querySelector("#garden-open").click();
    const card = [...document.querySelectorAll(".garden-card")].find((node) => (node.innerText || "").includes(${JSON.stringify(arrangement.title)}));
    if (!card) throw new Error("missing garden card");
    card.querySelector(".garden-card-view").click();
  })()`);
  await delay(400);
  const views = {};
  for (const view of VIEWS) {
    const counts = await renderView(cdp, view);
    const snap = await summary(cdp);
    const still = await shot(cdp, `${arrangement.slug}-${view}`);
    views[view] = { counts, canonicalHash: snap.canonicalHash, still };
    console.log(arrangement.slug, view, counts.calls, counts.triangles, counts.instancedTriangles, snap.canonicalHash);
    if (snap.canonicalHash !== arrangement.hash) {
      throw new Error(`${arrangement.slug} ${view} hash ${snap.canonicalHash} !== ${arrangement.hash}`);
    }
  }
  report.arrangements.push({ title: arrangement.title, expectedHash: arrangement.hash, summary: await summary(cdp), views });
  await evaluate(cdp, `document.querySelector("#garden-return").click()`);
  await delay(200);
}

async function smokeSpecimen(spec) {
  await clearGarden(cdp);
  await navigate(cdp, APP);
  await loadFixture(cdp, spec.material, 1, SEED);
  await renderView(cdp, "front");
  await evaluate(cdp, `document.querySelector('[data-testid="tool-shape"]').click()`);
  const before = await summary(cdp);
  const stockBefore = await branchLengths(cdp, spec.aimBranch);
  const acquired = await pressBranch(cdp, spec.aimBranch, 0, 0, spec.pointerBase);
  if (acquired.missing) throw new Error(`missing aim target ${spec.material}: ${JSON.stringify(acquired)}`);
  await renderView(cdp, "front");
  const aim = await acquireAim(cdp, spec.aimBranch, spec.pointerBase + 1, spec.aimDx, spec.aimDy);
  if (!aim.acquired) throw new Error(`aim failed ${spec.material}: ${JSON.stringify(aim.attempts)}`);
  await renderView(cdp, "front");
  const aimStill = await shot(cdp, spec.aimStill);
  const stockAfterAim = await branchLengths(cdp, spec.aimBranch);
  const bend = await acquireBend(cdp, spec.aimBranch, spec.pointerBase + 20);
  if (!bend.acquired) throw new Error(`bend failed ${spec.material}: ${JSON.stringify(bend.attempts)}`);
  await renderView(cdp, "front");
  const bendStill = await shot(cdp, spec.bendStill);
  const stockAfterBend = await branchLengths(cdp, spec.aimBranch);
  await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
  await renderView(cdp, "front");
  const preview = await previewBranch(cdp, spec.pruneBranch, spec.pruneDx, spec.pruneDy, spec.pointerBase + 40);
  if (preview.missing || preview.during?.operation !== "prune") {
    throw new Error(`prune preview failed ${spec.material}: ${JSON.stringify(preview)}`);
  }
  const previewStill = await shot(cdp, spec.previewStill);
  const cancel = await cancelGesture(cdp);
  const afterCancel = await summary(cdp);
  const commit = await pressBranch(cdp, spec.pruneBranch, 0, 0, spec.pointerBase + 41);
  if (commit.during?.operation !== "prune" && commit.afterTransaction) {
    throw new Error(`prune commit did not run ${spec.material}: ${JSON.stringify(commit)}`);
  }
  await renderView(cdp, "front");
  const commitStill = await shot(cdp, spec.commitStill);
  const afterCommit = await summary(cdp);
  const hashBeforeReload = afterCommit.canonicalHash;
  await navigate(cdp, RELOAD);
  await renderView(cdp, "front");
  const afterReload = await summary(cdp);
  const reloadStill = await shot(cdp, spec.reloadStill);
  const kept = await keepArrangement(cdp, spec.gardenTitle);
  await evaluate(cdp, `(() => {
    document.querySelector("#garden-open").click();
    const card = [...document.querySelectorAll(".garden-card")].find((node) => (node.innerText || "").includes(${JSON.stringify(spec.gardenTitle)}));
    if (!card) throw new Error("missing smoke garden card");
    card.querySelector(".garden-card-view").click();
  })()`);
  await delay(300);
  await renderView(cdp, "front");
  const viewed = await summary(cdp);
  const viewStill = await shot(cdp, spec.viewStill);
  await evaluate(cdp, `(() => {
    document.querySelector("#garden-copy").click();
    const choice = document.querySelector("#garden-choice");
    if (choice && !choice.hidden) document.querySelector("#garden-replace").click();
  })()`);
  await delay(300);
  await renderView(cdp, "front");
  const copied = await summary(cdp);
  const copyStill = await shot(cdp, spec.copyStill);
  const result = {
    material: spec.material,
    beforeHash: before.canonicalHash,
    ordinal: before.ordinal,
    acquired: acquired.selectedDuring ?? acquired.during?.operation ?? null,
    aimAcquired: aim.acquired,
    aimHash: aim.moved?.afterHash,
    bendAcquired: bend.acquired,
    bendHash: bend.moved?.afterHash,
    stockBefore,
    stockAfterAim,
    stockAfterBend,
    previewCue: preview.cue,
    previewHashUnchanged: preview.duringHash === before.canonicalHash || preview.duringHash === aim.moved?.afterHash || preview.beforeHash === preview.duringHash,
    previewDuringHash: preview.duringHash,
    previewBeforeHash: preview.beforeHash,
    cancelHash: cancel.afterHash,
    cancelCleared: cancel.afterTransaction == null,
    cancelAddedSave: cancel.addedSave,
    commitHash: afterCommit.canonicalHash,
    inactiveOrganIds: afterCommit.plants[0]?.inactiveOrganIds ?? [],
    reloadHash: afterReload.canonicalHash,
    reloadMatches: afterReload.canonicalHash === hashBeforeReload,
    viewHash: viewed.canonicalHash,
    viewMatches: viewed.canonicalHash === hashBeforeReload,
    copyHash: copied.canonicalHash,
    copyMatches: copied.canonicalHash === hashBeforeReload,
    seatOrdinal: afterCommit.seatOrdinal,
    keptError: kept.error,
    stills: { aimStill, bendStill, previewStill, commitStill, reloadStill, viewStill, copyStill },
  };
  if (stockBefore?.activeLength !== stockAfterBend?.activeLength) {
    throw new Error(`stock length changed on ${spec.material}: ${JSON.stringify(result)}`);
  }
  if (!result.cancelCleared || result.cancelHash !== preview.beforeHash) {
    throw new Error(`cancel did not roll back ${spec.material}: ${JSON.stringify(result)}`);
  }
  if (result.cancelAddedSave) throw new Error(`cancel wrote a save on ${spec.material}`);
  if (!result.reloadMatches || !result.viewMatches || !result.copyMatches) {
    throw new Error(`persistence mismatch ${spec.material}: ${JSON.stringify(result)}`);
  }
  if (result.seatOrdinal !== before.seatOrdinal) {
    throw new Error(`ordinal advanced on ${spec.material}: ${JSON.stringify(result)}`);
  }
  return result;
}

if (DO_SMOKE) {
  const specs = [
    ["fern-frond", "plant-1:rachis", "plant-1:pinna-4", 48, 20, 8, 6, 400],
    ["foliage-fan", "plant-1:stem", "plant-1:arm-opening", 70, -12, 0, 0, 500],
    ["berry-twig", "plant-1:wood", "plant-1:cluster-2", 40, -16, 0, 0, 600],
    ["blossom-spray", "plant-1:stem", "plant-1:group-2", -48, 18, 0, 0, 700],
    ["flower-volume", "plant-1:stem", "plant-1:group-2", 36, -20, 0, 0, 800],
    ["nodding-flower", "plant-1:stem", "plant-1:neck", 28, 24, 0, 0, 900],
  ];
  for (const [material, aimBranch, pruneBranch, aimDx, aimDy, pruneDx, pruneDy, pointerBase] of specs) {
    const slug = material;
    const result = await smokeSpecimen({
      material, aimBranch, pruneBranch, aimDx, aimDy, pruneDx, pruneDy, pointerBase,
      aimStill: `smoke-${slug}-aim-front`,
      bendStill: `smoke-${slug}-bend-front`,
      previewStill: `smoke-${slug}-prune-preview-front`,
      commitStill: `smoke-${slug}-prune-commit-front`,
      reloadStill: `smoke-${slug}-reload-front`,
      viewStill: `smoke-${slug}-garden-view-front`,
      copyStill: `smoke-${slug}-garden-copy-front`,
      gardenTitle: `Integration smoke ${material}`,
    });
    report.smoke.push(result);
    console.log("smoke", material, result.reloadMatches, result.viewMatches, result.copyMatches, result.previewCue);
  }
}

if (DO_CLIP) {
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 60, everyNthFrame: 1 });
  cdp.recording = true;
  await navigate(cdp, APP);
  await loadFixture(cdp, "fern-frond", 1, SEED);
  await renderView(cdp, "front");
  await evaluate(cdp, `document.querySelector('[data-testid="tool-shape"]').click()`);
  await delay(280);
  await acquireAim(cdp, "plant-1:pinna-3", 1200, 40, 16);
  await delay(280);
  await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
  await delay(220);
  await previewBranch(cdp, "plant-1:pinna-4", 0, 0, 1210);
  await delay(500);
  await cancelGesture(cdp);
  await delay(280);
  await pressBranch(cdp, "plant-1:pinna-4", 0, 0, 1211);
  await delay(400);
  await loadFixture(cdp, "foliage-fan", 1, SEED);
  await renderView(cdp, "front");
  await delay(280);
  await acquireAim(cdp, "plant-1:stem", 1300, 64, -10);
  await delay(400);
  cdp.recording = false;
  await cdp.send("Page.stopScreencast");
  await delay(200);
  const frameDir = "/tmp/polish-integration-frames";
  mkdirSync(frameDir, { recursive: true });
  cdp.frames.forEach((data, index) => {
    writeFileSync(`${frameDir}/frame-${String(index).padStart(4, "0")}.jpg`, Buffer.from(data, "base64"));
  });
  const clip = `${OUT}/interaction-fern-fan.mp4`;
  await new Promise((done, reject) => {
    const child = spawn("ffmpeg", [
      "-y", "-framerate", "8",
      "-i", `${frameDir}/frame-%04d.jpg`,
      "-vf", "scale=1280:800",
      "-pix_fmt", "yuv420p",
      clip,
    ], { stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? done() : reject(new Error(`ffmpeg ${code}`)));
  });
  report.clip = { frames: cdp.frames.length, file: clip };
  console.log("clip", report.clip.frames, clip);
}

writeFileSync(`${OUT}/browser-capture.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log("wrote", `${OUT}/browser-capture.json`);
