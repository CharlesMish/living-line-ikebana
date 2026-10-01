/**
 * Headless Chrome evidence for the polish baseline.
 * Product code is not modified. Draw counts are WebGL calls for one view
 * render, including the vessel. This machine is not a phone.
 *
 *   node tools/capture-polish-baseline.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = "docs/development/reports/polish-baseline";
const ARRANGEMENT_PATH = "artifacts/polish-baseline-arrangements.json";
const PORT = 9222;
const APP = "http://127.0.0.1:5173/?workbench=1&fresh=1&test=1";
const RELOAD = "http://127.0.0.1:5173/?workbench=1&test=1";
const GARDEN_KEY = "ikebana-web-alpha:workbench-garden-v1";
const SEED = 8278;
const VIEWS = ["front", "three-quarter", "above"];
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

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.next = 1;
    this.pending = new Map();
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
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
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
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
    const start = performance.now();
    document.querySelector(${JSON.stringify(`[data-testid="view-${view}"]`)}).click();
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      resolve({
        renderElapsedMs: performance.now() - start,
        calls: window.__gl.calls,
        triangles: Math.round(window.__gl.triangles),
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
        activeBranches: plant.branches.filter((branch) => branch.active !== false).length,
        organs: plant.organs.length,
        activeOrgans: plant.organs.filter((organ) => organ.active !== false).length,
        inactiveBranchIds: plant.branches.filter((branch) => branch.active === false).map((branch) => branch.id),
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

async function insertMaterial(cdp, materialId) {
  const result = await evaluate(cdp, `(() => {
    const before = window.__IKEBANA_TEST__.getCanonicalSnapshot().successfulPlantOrdinal;
    document.querySelector("#materials-toggle").click();
    const choice = document.querySelector(${JSON.stringify(`[data-material-choice="${materialId}"]`)});
    if (!choice) return { ok: false, reason: "missing-choice" };
    choice.click();
    const card = document.querySelector("#selected-cutting");
    card.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 }));
    const snap = window.__IKEBANA_TEST__.getCanonicalSnapshot();
    const plant = snap.plants.find((item) => item.id === "plant-" + (before + 1));
    return {
      ok: snap.successfulPlantOrdinal === before + 1,
      beforeOrdinal: before,
      ordinal: snap.successfulPlantOrdinal,
      selected: document.querySelector("#app").dataset.selectedMaterial,
      plant: plant ? { id: plant.id, seed: plant.seed, generatorVersion: plant.generatorVersion } : null,
      status: document.querySelector("#status")?.innerText ?? "",
    };
  })()`);
  if (!result?.ok) throw new Error(`insert ${materialId} failed: ${JSON.stringify(result)}`);
  await delay(200);
  return result;
}

function gestureExpression({ branchId, dx, dy, pointerId, release }) {
  return `(() => {
    const bridge = window.__IKEBANA_TEST__;
    const canvas = document.querySelector("canvas");
    const point = bridge.getScreenTargets().find((item) => item.branchId === ${JSON.stringify(branchId)});
    if (!point) return { missing: ${JSON.stringify(branchId)}, targets: bridge.getScreenTargets().map((item) => item.branchId) };
    const before = bridge.getState();
    const fire = (type, x, y, buttons, target) => {
      const event = new PointerEvent(type, {
        bubbles: true, pointerId: ${pointerId}, clientX: x, clientY: y, button: 0, buttons, pointerType: "mouse",
      });
      target.dispatchEvent(event);
    };
    fire("pointerdown", point.x, point.y, 1, canvas);
    fire("pointermove", point.x + ${dx}, point.y + ${dy}, 1, window);
    const during = bridge.getState();
    const cue = document.querySelector("#craft-cue")?.innerText ?? "";
    if (${release ? "true" : "false"}) {
      fire("pointerup", point.x + ${dx}, point.y + ${dy}, 0, window);
    }
    const after = bridge.getState();
    return {
      point, cue,
      beforeHash: before.canonicalHash,
      duringHash: during.canonicalHash,
      during: during.transaction,
      selectedDuring: during.selectedBranchId,
      afterHash: after.canonicalHash,
      afterTransaction: after.transaction,
      selectedAfter: after.selectedBranchId,
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
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const after = window.__IKEBANA_TEST__.getState();
    return {
      beforeHash: before.canonicalHash,
      beforeTransaction: before.transaction,
      afterHash: after.canonicalHash,
      afterTransaction: after.transaction,
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
        return {
          during: during.transaction,
          duringHash: during.canonicalHash,
          afterHash: after.canonicalHash,
          cue: document.querySelector("#craft-cue")?.innerText ?? "",
        };
      })()`);
      return { acquired: true, offset: [ox, oy], attempts, moved };
    }
    await cancelGesture(cdp);
  }
  return { acquired: false, attempts };
}

async function acquireAim(cdp, branchId, pointerBase, dx, dy) {
  const offsets = [[0, -120], [0, 120], [0, -180], [0, 180], [-36, -140], [36, 140], [0, -80], [0, 80], [-70, 30], [70, -30]];
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
    if (probe?.operation === "aim") {
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
        return {
          during: during.transaction,
          duringHash: during.canonicalHash,
          afterHash: after.canonicalHash,
          cue: document.querySelector("#craft-cue")?.innerText ?? "",
        };
      })()`);
      return { acquired: true, offset: [ox, oy], drag: [dx, dy], attempts, moved };
    }
    await cancelGesture(cdp);
  }
  return { acquired: false, attempts };
}

async function branchLengths(cdp) {
  return evaluate(cdp, `(() => {
    const snap = window.__IKEBANA_TEST__.getCanonicalSnapshot();
    return snap.plants.map((plant) => ({
      id: plant.id,
      branches: plant.branches.map((branch) => ({
        id: branch.id,
        active: branch.active !== false,
        activeLength: branch.activeLength,
      })),
    }));
  })()`);
}

async function keepArrangement(cdp, title) {
  const kept = await evaluate(cdp, `(() => {
    document.querySelector("#garden-open").click();
    const name = document.querySelector("#garden-name");
    name.value = ${JSON.stringify(title)};
    document.querySelector("#garden-keep-form").requestSubmit();
    const error = document.querySelector("#garden-error")?.textContent ?? "";
    const cards = [...document.querySelectorAll(".garden-card")].map((node) => node.innerText);
    return { error, cards, count: document.querySelector("#garden-count")?.textContent ?? "" };
  })()`);
  await delay(250);
  await closeDialogs(cdp);
  return kept;
}

async function gardenRaw(cdp) {
  return evaluate(cdp, `localStorage.getItem(${JSON.stringify(GARDEN_KEY)})`);
}

async function clearGarden(cdp) {
  await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(GARDEN_KEY)})`);
}

async function materialsFold(cdp) {
  await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);
  await delay(200);
  const before = await evaluate(cdp, `(() => {
    const options = document.querySelector("#material-options");
    const box = options.getBoundingClientRect();
    const items = [...options.querySelectorAll("[data-material-choice]")].map((node) => {
      const rect = node.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, box.top);
      const visibleBottom = Math.min(rect.bottom, box.bottom);
      const visible = Math.max(0, visibleBottom - visibleTop);
      return {
        id: node.getAttribute("data-material-choice"),
        name: node.innerText.replace(/\\s+/g, " ").trim(),
        fullyVisible: rect.top >= box.top - 0.5 && rect.bottom <= box.bottom + 0.5,
        visibleFraction: rect.height > 0 ? visible / rect.height : 0,
      };
    });
    return {
      clientHeight: options.clientHeight,
      scrollHeight: options.scrollHeight,
      scrollTop: options.scrollTop,
      box: { top: box.top, bottom: box.bottom, height: box.height },
      items,
    };
  })()`);
  const shotOpen = await shot(cdp, "materials-list-1280x800");
  await evaluate(cdp, `document.querySelector("#material-options").scrollTop = 9999`);
  await delay(120);
  const shotScrolled = await shot(cdp, "materials-list-1280x800-scrolled");
  const after = await evaluate(cdp, `(() => {
    const options = document.querySelector("#material-options");
    const box = options.getBoundingClientRect();
    return {
      scrollTop: options.scrollTop,
      items: [...options.querySelectorAll("[data-material-choice]")].map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          id: node.getAttribute("data-material-choice"),
          fullyVisible: rect.top >= box.top - 0.5 && rect.bottom <= box.bottom + 0.5,
        };
      }),
    };
  })()`);
  await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
  return { before, after, stills: [shotOpen, shotScrolled] };
}

mkdirSync(OUT, { recursive: true });
mkdirSync("artifacts", { recursive: true });
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
    window.__gl = { calls: 0, triangles: 0 };
    const wrap = (prototype) => {
      if (!prototype || prototype.__wrapped) return;
      const elements = prototype.drawElements;
      const arrays = prototype.drawArrays;
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
      prototype.__wrapped = true;
    };
    wrap(WebGL2RenderingContext.prototype);
    wrap(WebGLRenderingContext.prototype);
  `,
});

let report = {
  label: "Google Chrome headless, Linux. Draw counts include the vessel. Mode 4 is counted as triangles. Not a physical phone.",
  protocol: "Workbench or Garden view, then one view-button click, then three animation frames. Counters reset immediately before the click.",
  seed: SEED,
  specimens: [],
  costs: [],
  arrangements: [],
  smoke: [],
};

const smokeOnly = process.argv.includes("--smoke-only");
if (smokeOnly) {
  report = JSON.parse(readFileSync(`${OUT}/browser-capture.json`, "utf8"));
  report.smoke = [];
}

if (!smokeOnly) {
await navigate(cdp, APP);
report.environment = await environment(cdp);
console.log("environment", JSON.stringify(report.environment));

for (const material of MATERIALS) {
  await loadFixture(cdp, material, 1, SEED);
  const views = {};
  for (const view of VIEWS) {
    const counts = await renderView(cdp, view);
    const snap = await summary(cdp);
    const name = `${material}-seed${SEED}-count1-${view}`;
    const still = await shot(cdp, name);
    views[view] = { counts, canonicalHash: snap.canonicalHash, cameraHash: snap.cameraHash, still };
    console.log("specimen", material, view, counts.calls, counts.triangles, snap.canonicalHash);
  }
  const snap = await summary(cdp);
  report.specimens.push({
    material,
    obtained: "Workbench single-material fixture, count 1, starting seed 8278. Plant id plant-1. Workbench seed for index 0 is the starting seed.",
    summary: snap,
    views,
  });
}

await loadFixture(cdp, "round5-palette", 12, SEED);
const palette = { fixture: "round5-palette", seed: SEED, count: 12, views: {} };
for (const view of VIEWS) {
  const counts = await renderView(cdp, view);
  const snap = await summary(cdp);
  const still = view === "front" ? await shot(cdp, "round5-palette-seed8278-count12-front") : null;
  palette.views[view] = { counts, canonicalHash: snap.canonicalHash, still };
  console.log("palette", view, counts.calls, counts.triangles, snap.canonicalHash);
}
palette.summary = await summary(cdp);
report.costs.push(palette);

report.materialsMenu = await materialsFold(cdp);
console.log("materials fold", JSON.stringify(report.materialsMenu.before.items.map((item) => [item.id, item.fullyVisible, item.visibleFraction])));

async function buildArrangement(spec) {
  await navigate(cdp, APP);
  const insertions = [];
  for (const materialId of spec.materials) insertions.push(await insertMaterial(cdp, materialId));
  const seated = await summary(cdp);
  const aims = [];
  await evaluate(cdp, `document.querySelector('[data-testid="tool-shape"]').click()`);
  await renderView(cdp, "front");
  for (const aim of spec.aims) {
    const result = await pressBranch(cdp, aim.branchId, aim.dx, aim.dy, aim.pointerId);
    aims.push({ ...aim, result });
    await renderView(cdp, "front");
  }
  let prune = null;
  if (spec.prune) {
    await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
    await renderView(cdp, "front");
    const before = await summary(cdp);
    prune = await pressBranch(cdp, spec.prune.branchId, 0, 0, spec.prune.pointerId);
    prune.beforeSummary = before;
    prune.afterSummary = await summary(cdp);
  }
  const composed = await summary(cdp);
  const kept = await keepArrangement(cdp, spec.title);
  return { id: spec.id, title: spec.title, insertions, seatedHash: seated.canonicalHash, aims, prune, composed, kept };
}

await clearGarden(cdp);
await navigate(cdp, APP);
const arrangementA = await buildArrangement({
  id: "A",
  title: "Leafy fern and fan",
  materials: ["leafy-shoot", "fern-frond", "foliage-fan"],
  aims: [
    { branchId: "plant-2:rachis", dx: -72, dy: 8, pointerId: 201 },
    { branchId: "plant-3:stem", dx: 76, dy: -6, pointerId: 202 },
  ],
  prune: { branchId: "plant-2:pinna-4", pointerId: 203 },
});
const arrangementB = await buildArrangement({
  id: "B",
  title: "Berry and flower accents",
  materials: ["berry-twig", "blossom-spray", "flower-volume", "nodding-flower"],
  aims: [
    { branchId: "plant-2:stem", dx: -64, dy: 10, pointerId: 211 },
    { branchId: "plant-3:stem", dx: 48, dy: -18, pointerId: 212 },
    { branchId: "plant-4:stem", dx: 86, dy: 12, pointerId: 213 },
  ],
  prune: null,
});
const gardenExport = await gardenRaw(cdp);
if (!gardenExport) throw new Error("garden export missing");
writeFileSync(ARRANGEMENT_PATH, `${gardenExport.endsWith("\n") ? gardenExport : `${gardenExport}\n`}`);
const parsedGarden = JSON.parse(gardenExport);
report.arrangements.push({
  built: arrangementA,
  keptTitle: arrangementA.title,
  entry: parsedGarden.entries.find((entry) => entry.title === arrangementA.title)?.id ?? null,
});
report.arrangements.push({
  built: arrangementB,
  keptTitle: arrangementB.title,
  entry: parsedGarden.entries.find((entry) => entry.title === arrangementB.title)?.id ?? null,
});
console.log("kept", parsedGarden.entries.map((entry) => entry.title));

await clearGarden(cdp);
await navigate(cdp, APP);
const importResult = await evaluate(cdp, `(() => {
  document.querySelector("#garden-open").click();
  return { opened: document.querySelector("#garden-dialog")?.open === true };
})()`);
const documentRoot = await cdp.send("DOM.getDocument");
const fileNode = await cdp.send("DOM.querySelector", {
  nodeId: documentRoot.root.nodeId,
  selector: "#garden-file",
});
await cdp.send("DOM.setFileInputFiles", {
  nodeId: fileNode.nodeId,
  files: [resolve(ARRANGEMENT_PATH)],
});
await delay(500);
const imported = await evaluate(cdp, `(() => ({
  error: document.querySelector("#garden-error")?.textContent ?? "",
  count: document.querySelector("#garden-count")?.textContent ?? "",
  titles: [...document.querySelectorAll(".garden-card strong")].map((node) => node.textContent),
}))()`);
report.import = { dialogOpened: importResult, ...imported, path: ARRANGEMENT_PATH };
console.log("import", JSON.stringify(report.import));
if (!imported.titles.includes(arrangementA.title) || !imported.titles.includes(arrangementB.title)) {
  throw new Error(`import did not restore both arrangements: ${JSON.stringify(imported)}`);
}

for (const arrangement of [
  { spec: arrangementA, slug: "arrangement-a-leafy-fern-fan" },
  { spec: arrangementB, slug: "arrangement-b-berry-flower-accents" },
]) {
  await evaluate(cdp, `(() => {
    document.querySelector("#garden-open").click();
    const cards = [...document.querySelectorAll(".garden-card")];
    const card = cards.find((node) => (node.innerText || "").includes(${JSON.stringify(arrangement.spec.title)}));
    if (!card) throw new Error("missing garden card");
    card.querySelector(".garden-card-view").click();
  })()`);
  await delay(400);
  const viewing = await evaluate(cdp, `document.querySelector("#app").dataset.gardenViewing === "true"`);
  const views = {};
  for (const view of VIEWS) {
    const counts = await renderView(cdp, view);
    const snap = await summary(cdp);
    const still = await shot(cdp, `${arrangement.slug}-${view}`);
    views[view] = { counts, canonicalHash: snap.canonicalHash, cameraHash: snap.cameraHash, still };
    console.log(arrangement.slug, view, counts.calls, counts.triangles, snap.canonicalHash);
  }
  const snap = await summary(cdp);
  report.costs.push({
    fixture: arrangement.spec.title,
    source: "Garden import, then View",
    viewing,
    views,
    summary: snap,
    matchesKeepHash: snap.canonicalHash === arrangement.spec.composed.canonicalHash,
  });
  await evaluate(cdp, `document.querySelector("#garden-return").click()`);
  await delay(200);
}
}

async function smokeSpecimen(spec) {
  await navigate(cdp, APP);
  await loadFixture(cdp, spec.material, 1, SEED);
  await renderView(cdp, "front");
  await evaluate(cdp, `document.querySelector('[data-testid="tool-shape"]').click()`);
  const before = await summary(cdp);
  const beforeLengths = await branchLengths(cdp);
  const select = await pressBranch(cdp, spec.aimBranch, 0, 0, spec.pointerBase);
  await renderView(cdp, "front");
  const aim = await acquireAim(cdp, spec.aimBranch, spec.pointerBase + 1, spec.aimDx, spec.aimDy);
  if (!aim.acquired || aim.moved?.during?.operation !== "aim") {
    throw new Error(`aim did not acquire on ${spec.material}: ${JSON.stringify(aim.attempts)}`);
  }
  await renderView(cdp, "front");
  const aimStill = await shot(cdp, spec.aimStill);
  const bend = await acquireBend(cdp, spec.aimBranch, spec.pointerBase + 10);
  await renderView(cdp, "front");
  const bendStill = await shot(cdp, spec.bendStill);
  const afterBend = await summary(cdp);
  await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
  await renderView(cdp, "front");
  const preview = await previewBranch(cdp, spec.pruneBranch, spec.pruneDx, spec.pruneDy, spec.pointerBase + 30);
  const previewStill = await shot(cdp, spec.previewStill);
  const cancel = await cancelGesture(cdp);
  await renderView(cdp, "front");
  const afterCancel = await summary(cdp);
  const commit = await pressBranch(cdp, spec.pruneBranch, 0, 0, spec.pointerBase + 31);
  await renderView(cdp, "front");
  const commitStill = await shot(cdp, spec.commitStill);
  const afterCommit = await summary(cdp);
  const afterCommitLengths = await branchLengths(cdp);
  const hashBeforeReload = afterCommit.canonicalHash;
  await navigate(cdp, RELOAD);
  await renderView(cdp, "front");
  const afterReload = await summary(cdp);
  const reloadStill = await shot(cdp, spec.reloadStill);
  const kept = await keepArrangement(cdp, spec.gardenTitle);
  await evaluate(cdp, `(() => {
    document.querySelector("#garden-open").click();
    const cards = [...document.querySelectorAll(".garden-card")];
    const card = cards.find((node) => (node.innerText || "").includes(${JSON.stringify(spec.gardenTitle)}));
    if (!card) throw new Error("missing smoke garden card");
    card.querySelector(".garden-card-view").click();
  })()`);
  await delay(300);
  const viewing = await evaluate(cdp, `document.querySelector("#app").dataset.gardenViewing === "true"`);
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
  return {
    material: spec.material,
    before,
    beforeLengths,
    select,
    aim,
    aimStill,
    bend,
    bendStill,
    afterBend,
    preview,
    previewStill,
    cancel,
    afterCancel,
    commit,
    commitStill,
    afterCommit,
    afterCommitLengths,
    hashBeforeReload,
    afterReload,
    reloadStill,
    reloadMatches: afterReload.canonicalHash === hashBeforeReload,
    kept,
    viewing,
    viewed,
    viewStill,
    viewMatches: viewed.canonicalHash === hashBeforeReload,
    copied,
    copyStill,
    copyMatches: copied.canonicalHash === hashBeforeReload,
  };
}

await clearGarden(cdp);
report.smoke.push(await smokeSpecimen({
  material: "bare-branch",
  aimBranch: "plant-1:trunk",
  pruneBranch: "plant-1:distal",
  aimDx: 64,
  aimDy: -24,
  pruneDx: 10,
  pruneDy: -8,
  pointerBase: 300,
  aimStill: "smoke-bare-branch-aim-front",
  bendStill: "smoke-bare-branch-bend-front",
  previewStill: "smoke-bare-branch-prune-preview-front",
  commitStill: "smoke-bare-branch-prune-commit-front",
  reloadStill: "smoke-bare-branch-reload-front",
  viewStill: "smoke-bare-branch-garden-view-front",
  copyStill: "smoke-bare-branch-garden-copy-front",
  gardenTitle: "Smoke bare branch",
}));
console.log("smoke bare", report.smoke[0].reloadMatches, report.smoke[0].viewMatches, report.smoke[0].copyMatches, report.smoke[0].bend.acquired);

report.smoke.push(await smokeSpecimen({
  material: "fern-frond",
  aimBranch: "plant-1:rachis",
  pruneBranch: "plant-1:pinna-2",
  aimDx: 48,
  aimDy: 20,
  pruneDx: 8,
  pruneDy: 6,
  pointerBase: 400,
  aimStill: "smoke-fern-frond-aim-front",
  bendStill: "smoke-fern-frond-bend-front",
  previewStill: "smoke-fern-frond-prune-preview-front",
  commitStill: "smoke-fern-frond-prune-commit-front",
  reloadStill: "smoke-fern-frond-reload-front",
  viewStill: "smoke-fern-frond-garden-view-front",
  copyStill: "smoke-fern-frond-garden-copy-front",
  gardenTitle: "Smoke fern frond",
}));
console.log("smoke fern", report.smoke[1].reloadMatches, report.smoke[1].viewMatches, report.smoke[1].copyMatches, report.smoke[1].bend.acquired);

writeFileSync(`${OUT}/browser-capture.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log("wrote", `${OUT}/browser-capture.json`);
process.exit(0);
