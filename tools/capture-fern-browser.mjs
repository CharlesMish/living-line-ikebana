/**
 * Headless Chrome capture for the fern-frond candidate.
 * Counts WebGL draw calls for one frame and samples requestAnimationFrame
 * deltas. This is not a physical-phone session.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const OUT = "docs/development/reports/fern-frond-v1";
const PORT = 9222;
const URL = "http://127.0.0.1:5173/?workbench=1&fresh=1&test=1";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.next = 1;
    this.pending = new Map();
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.next;
    this.next += 1;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error(`no page target: ${JSON.stringify(targets)}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
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
    throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
  }
  return result.result.value;
}

async function shot(cdp, name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
}

mkdirSync(OUT, { recursive: true });
const cdp = await connect();
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Emulation.clearDeviceMetricsOverride");
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

await cdp.send("Page.navigate", { url: URL });
await delay(1600);
const ready = await evaluate(cdp, `document.querySelector("#app")?.dataset.ready`);
console.log("ready", ready);

async function loadFixture(material, count, seed = 8278) {
  await evaluate(cdp, `(() => {
    document.querySelector("#workbench-open").click();
    const select = document.querySelector("#workbench-material");
    select.value = ${JSON.stringify(material)};
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#workbench-seed").value = ${JSON.stringify(String(seed))};
    document.querySelector("#workbench-count").value = ${JSON.stringify(String(count))};
    document.querySelector("#workbench-form").requestSubmit();
  })()`);
  await delay(900);
}

async function setView(view) {
  await evaluate(cdp, `document.querySelector('[data-testid="view-${view}"]').click()`);
  await delay(450);
}

async function frameCounts() {
  return evaluate(cdp, `new Promise((resolve) => {
    window.__gl.calls = 0;
    window.__gl.triangles = 0;
    const current = document.querySelector("[data-view]")?.dataset.view || "front";
    const other = current === "above" ? "front" : "above";
    document.querySelector('[data-testid="view-' + other + '"]').click();
    document.querySelector('[data-testid="view-' + current + '"]').click();
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve({ ...window.__gl }))));
  })`);
}

async function frameTiming() {
  return evaluate(cdp, `new Promise((resolve) => {
    const samples = [];
    let last = performance.now();
    const step = (now) => {
      samples.push(now - last);
      last = now;
      if (samples.length < 40) requestAnimationFrame(step);
      else {
        const sorted = [...samples].sort((a, b) => a - b);
        const sum = samples.reduce((total, value) => total + value, 0);
        resolve({
          frames: samples.length,
          meanMs: sum / samples.length,
          medianMs: sorted[Math.floor(sorted.length / 2)],
          maxMs: sorted[sorted.length - 1],
          minMs: sorted[0],
        });
      }
    };
    requestAnimationFrame(step);
  })`);
}

async function captureEnvironment() {
  return evaluate(cdp, `(() => {
    const canvas = document.querySelector("canvas");
    const rect = canvas.getBoundingClientRect();
    const rail = document.querySelector(".top-chrome");
    const box = rail.getBoundingClientRect();
    return {
      cssViewport: { width: rect.width, height: rect.height },
      drawingBuffer: { width: canvas.width, height: canvas.height },
      devicePixelRatio: window.devicePixelRatio,
      browserWindow: { width: window.innerWidth, height: window.innerHeight },
      visualViewport: window.visualViewport ? { width: window.visualViewport.width, height: window.visualViewport.height, scale: window.visualViewport.scale } : null,
      userAgent: navigator.userAgent,
      topChrome: { width: box.width, height: box.height },
      rendererPixelRatioCapNote: "Living Line caps renderer pixel ratio at 1.8. This capture does not read the Three renderer object.",
    };
  })()`);
}

async function bridge() {
  return evaluate(cdp, `window.__IKEBANA_TEST__.getState()`);
}

async function snapshot() {
  return evaluate(cdp, `window.__IKEBANA_TEST__.getCanonicalSnapshot()`);
}

async function inventory() {
  return evaluate(cdp, `window.__IKEBANA_TEST__.getRenderInventory()`);
}

const report = { captures: [], exercise: [] };
const environment = await captureEnvironment();
console.log("env", JSON.stringify(environment));

async function captureFixture(fixture, count, seed, views) {
  await loadFixture(fixture, count, seed);
  for (const view of views) {
    await setView(view);
    const counts = await frameCounts();
    const timing = view === "front" ? await frameTiming() : null;
    const env = await captureEnvironment();
    const name = `browser-${fixture}-seed${seed}-count${count}-${view}`;
    await shot(cdp, name);
    const entry = { fixture, seed, count, view, counts, timing, environment: env, inventory: await inventory() };
    report.captures.push(entry);
    console.log(name, JSON.stringify(counts), timing ? JSON.stringify(timing) : "");
  }
}

await captureFixture("fern-frond", 1, 8278, ["front", "three-quarter", "above"]);
await captureFixture("fern-frond", 1, 9255, ["front"]);
await captureFixture("fern-frond", 1, 10232, ["front"]);
await captureFixture("leafy-shoot", 1, 8278, ["front"]);
await captureFixture("foliage-fan", 1, 8278, ["front"]);
await captureFixture("references-plus-fern-frond", 6, 8278, ["front", "three-quarter", "above"]);
await captureFixture("fern-frond", 12, 8278, ["front"]);

await loadFixture("fern-frond", 1, 8278);
await setView("front");
const beforeGesture = await bridge();
report.exercise.push({ step: "loaded", state: beforeGesture });

const gestureResult = await evaluate(cdp, `(() => {
  const bridge = window.__IKEBANA_TEST__;
  const canvas = document.querySelector("canvas");
  const log = [];
  const target = (branchId) => bridge.getScreenTargets().find((item) => item.branchId === branchId);
  const fire = (type, x, y, pointerId) => {
    const event = new PointerEvent(type, {
      bubbles: true,
      pointerId,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      pointerType: "touch",
    });
    if (type === "pointerdown") canvas.dispatchEvent(event);
    else window.dispatchEvent(event);
  };
  const drag = (branchId, dx, dy, pointerId) => {
    const point = target(branchId);
    if (!point) return { branchId, missing: true };
    const before = bridge.getState();
    fire("pointerdown", point.x, point.y, pointerId);
    const acquired = bridge.getState();
    fire("pointermove", point.x + dx, point.y + dy, pointerId);
    fire("pointerup", point.x + dx, point.y + dy, pointerId);
    const after = bridge.getState();
    return {
      branchId,
      point: { x: point.x, y: point.y },
      beforeHash: before.canonicalHash,
      acquired: acquired.transaction,
      afterHash: after.canonicalHash,
      afterTransaction: after.transaction,
    };
  };
  log.push({ step: "aim-pinna", ...drag("plant-1:pinna-3", 70, -30, 11) });
  log.push({ step: "select-rachis", ...drag("plant-1:rachis", 8, -6, 12) });
  log.push({ step: "bend-or-aim-rachis", ...drag("plant-1:rachis", 90, 40, 13) });
  return log;
})()`);
report.exercise.push({ step: "shape", gestureResult });
console.log("shape", JSON.stringify(gestureResult));
await shot(cdp, "browser-fern-after-shape");

const cancelResult = await evaluate(cdp, `(() => {
  const bridge = window.__IKEBANA_TEST__;
  const canvas = document.querySelector("canvas");
  const point = bridge.getScreenTargets().find((item) => item.branchId === "plant-1:pinna-6");
  const before = bridge.getState().canonicalHash;
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 21, clientX: point.x, clientY: point.y, button: 0, buttons: 1, pointerType: "touch",
  }));
  window.dispatchEvent(new PointerEvent("pointermove", {
    bubbles: true, pointerId: 21, clientX: point.x + 80, clientY: point.y - 20, button: 0, buttons: 1, pointerType: "touch",
  }));
  const during = bridge.getState();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const after = bridge.getState();
  return { before, during: during.transaction, duringHash: during.canonicalHash, afterHash: after.canonicalHash, afterTransaction: after.transaction };
})()`);
report.exercise.push({ step: "cancel-aim", cancelResult });
console.log("cancel", JSON.stringify(cancelResult));

const pruneResult = await evaluate(cdp, `(() => {
  document.querySelector('[data-testid="tool-prune"]').click();
  const bridge = window.__IKEBANA_TEST__;
  const canvas = document.querySelector("canvas");
  const point = bridge.getScreenTargets().find((item) => item.branchId === "plant-1:pinna-2");
  const before = bridge.getCanonicalSnapshot();
  const beforeHash = bridge.getState().canonicalHash;
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 31, clientX: point.x, clientY: point.y, button: 0, buttons: 1, pointerType: "touch",
  }));
  window.dispatchEvent(new PointerEvent("pointermove", {
    bubbles: true, pointerId: 31, clientX: point.x + 4, clientY: point.y + 4, button: 0, buttons: 1, pointerType: "touch",
  }));
  const preview = bridge.getState();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const cancelled = bridge.getState();
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 32, clientX: point.x, clientY: point.y, button: 0, buttons: 1, pointerType: "touch",
  }));
  window.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, pointerId: 32, clientX: point.x, clientY: point.y, button: 0, buttons: 0, pointerType: "touch",
  }));
  const committed = bridge.getCanonicalSnapshot();
  const blade = committed.plants[0].organs.find((organ) => organ.id === "plant-1:pinna-blade-2");
  return {
    beforeHash,
    previewTransaction: preview.transaction,
    cancelledHash: cancelled.canonicalHash,
    committedHash: bridge.getState().canonicalHash,
    bladeActive: blade?.active ?? null,
    organCount: committed.plants[0].organs.length,
    branchCount: committed.plants[0].branches.length,
    beforeOrgans: before.plants[0].organs.length,
  };
})()`);
report.exercise.push({ step: "prune-pinna", pruneResult });
console.log("prune", JSON.stringify(pruneResult));
await shot(cdp, "browser-fern-after-prune");

const hashBeforeReload = await evaluate(cdp, `window.__IKEBANA_TEST__.getState().canonicalHash`);
await cdp.send("Page.navigate", { url: "http://127.0.0.1:5173/?workbench=1&test=1" });
await delay(1600);
const hashAfterReload = await evaluate(cdp, `window.__IKEBANA_TEST__.getState().canonicalHash`);
const reloadedBlade = await evaluate(cdp, `(() => {
  const snap = window.__IKEBANA_TEST__.getCanonicalSnapshot();
  const organ = snap.plants[0]?.organs.find((item) => item.id === "plant-1:pinna-blade-2");
  return { plants: snap.plants.length, ordinal: snap.successfulPlantOrdinal, bladeActive: organ?.active ?? null, generator: snap.plants[0]?.generatorVersion };
})()`);
report.exercise.push({ step: "reload", hashBeforeReload, hashAfterReload, reloadedBlade });
console.log("reload", hashBeforeReload, hashAfterReload, JSON.stringify(reloadedBlade));
await setView("front");
await shot(cdp, "browser-fern-after-reload");

const garden = await evaluate(cdp, `(() => {
  const bridge = window.__IKEBANA_TEST__;
  const beforeKeep = bridge.getState().canonicalHash;
  document.querySelector("#garden-open").click();
  document.querySelector("#garden-name").value = "Fern frond study";
  document.querySelector("#garden-keep-form").requestSubmit();
  const card = document.querySelector(".garden-card-view");
  const title = card?.innerText ?? "";
  card?.click();
  const viewed = bridge.getState().canonicalHash;
  document.querySelector("#garden-copy").click();
  const choice = document.querySelector("#garden-choice");
  const choiceHidden = choice ? choice.hidden : null;
  if (choice && !choice.hidden) document.querySelector("#garden-replace").click();
  const copied = bridge.getState().canonicalHash;
  const keptRaw = localStorage.getItem("ikebana-web-alpha:workbench-garden-v1");
  const kept = JSON.parse(keptRaw);
  return {
    beforeKeep,
    viewed,
    copied,
    choiceHidden,
    title,
    keptTitle: kept.entries[0]?.title ?? null,
    keptPlants: kept.entries[0]?.arrangement.plants.length ?? null,
    keptGenerator: kept.entries[0]?.arrangement.plants[0]?.generatorVersion ?? null,
    keptBladeActive: kept.entries[0]?.arrangement.plants[0]?.organs.find((organ) => organ.id === "plant-1:pinna-blade-2")?.active ?? null,
    workingHash: bridge.getState().canonicalHash,
  };
})()`);
report.exercise.push({ step: "garden", garden });
console.log("garden", JSON.stringify(garden));
await shot(cdp, "browser-fern-garden-copy");

const study = readFileSync("artifacts/fern-frond-garden.json", "utf8");
await evaluate(cdp, `localStorage.setItem("ikebana-web-alpha:workbench-garden-v1", ${JSON.stringify(study)})`);
await cdp.send("Page.navigate", { url: "http://127.0.0.1:5173/?workbench=1&fresh=1&test=1" });
await delay(1600);
await evaluate(cdp, `(() => {
  document.querySelector("#garden-open").click();
  document.querySelector(".garden-card-view").click();
})()`);
await delay(500);
for (const view of ["front", "three-quarter", "above"]) {
  await setView(view);
  await shot(cdp, `study-${view}`);
  report.captures.push({
    fixture: "fern-study-garden",
    seed: "8278-9255-10232-11209",
    count: 4,
    view,
    counts: await frameCounts(),
    environment: await captureEnvironment(),
  });
}

await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
});
await delay(400);
await loadFixture("fern-frond", 1, 8278);
await setView("front");
await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);
await delay(250);
const pickerPortrait = await evaluate(cdp, `(() => {
  const panel = document.querySelector("#material-options");
  const choice = document.querySelector('[data-testid="material-choice-fern-frond"]');
  return {
    scrollHeight: panel.scrollHeight,
    clientHeight: panel.clientHeight,
    fernInDom: Boolean(choice),
  };
})()`);
await shot(cdp, "picker-portrait-390x844");
report.exercise.push({ step: "picker-portrait", pickerPortrait, environment: await captureEnvironment() });

await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 844, height: 360, deviceScaleFactor: 1, mobile: false,
});
await delay(400);
await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);
await delay(250);
const pickerLandscape = await evaluate(cdp, `(() => {
  const panel = document.querySelector("#material-options");
  return {
    scrollHeight: panel.scrollHeight,
    clientHeight: panel.clientHeight,
    fernInDom: Boolean(document.querySelector('[data-testid="material-choice-fern-frond"]')),
  };
})()`);
await shot(cdp, "picker-landscape-844x360");
report.exercise.push({ step: "picker-landscape", pickerLandscape, environment: await captureEnvironment() });

writeFileSync(`${OUT}/browser-capture.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log("wrote", `${OUT}/browser-capture.json`);
cdp.ws.close();
