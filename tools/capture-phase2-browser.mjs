/**
 * Headless Chrome capture for the integrated Phase 2 tip.
 * Draw counts are WebGL calls for one forced view render, including the vessel.
 * This machine is not a phone.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "docs/development/reports/phase2-integration";
const PORT = 9222;
const APP = "http://127.0.0.1:5173/?workbench=1&fresh=1&test=1";

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
    throw new Error(JSON.stringify(result.exceptionDetails));
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

await cdp.send("Page.navigate", { url: APP });
await delay(1800);
const ready = await evaluate(cdp, `document.querySelector("#app")?.dataset.ready`);
if (ready !== "true") throw new Error(`app not ready: ${ready}`);

async function environment() {
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

async function renderView(view) {
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

async function state() {
  return evaluate(cdp, `window.__IKEBANA_TEST__.getState()`);
}

const report = {
  label: "Google Chrome headless, Linux. Draw counts include the vessel. Not a physical phone.",
  captures: [],
  exercises: [],
};

async function captureFixture(material, count, seed, views) {
  await loadFixture(material, count, seed);
  for (const view of views) {
    const counts = await renderView(view);
    const snap = await state();
    const name = `${material}-seed${seed}-count${count}-${view}`;
    await shot(cdp, name);
    report.captures.push({
      fixture: material,
      seed,
      count,
      view,
      counts,
      environment: await environment(),
      canonicalHash: snap.canonicalHash,
      cameraHash: snap.cameraHash,
      still: `${OUT}/${name}.png`,
    });
  }
}

for (const seed of [8278, 9255, 10232]) {
  const views = seed === 8278 ? ["front", "three-quarter", "above"] : ["front"];
  await captureFixture("berry-twig", 1, seed, views);
  await captureFixture("fern-frond", 1, seed, views);
}
await captureFixture("round5-candidates", 6, 8278, ["front", "three-quarter", "above"]);
await captureFixture("references-plus-berry-twig", 6, 8278, ["front"]);
await captureFixture("references-plus-fern-frond", 6, 8278, ["front"]);
await captureFixture("round5-palette", 12, 8278, ["front"]);
await captureFixture("berry-twig", 12, 8278, ["front"]);
await captureFixture("fern-frond", 12, 8278, ["front"]);
await captureFixture("reference-pair", 6, 8278, ["front"]);

await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);
await delay(250);
await shot(cdp, "materials-menu");
const menu = await evaluate(cdp, `(() => {
  const options = document.querySelector("#material-options");
  return {
    choices: [...document.querySelectorAll("[data-material-choice]")].map((node) => node.getAttribute("data-material-choice")),
    clientHeight: options.clientHeight,
    scrollHeight: options.scrollHeight,
  };
})()`);
report.materialsMenu = menu;
await evaluate(cdp, `document.querySelector("#material-options").scrollTop = 9999`);
await delay(120);
await shot(cdp, "materials-menu-scrolled");

function cancelDrag(branchId, dx, dy, pointerId) {
  return `(() => {
    const bridge = window.__IKEBANA_TEST__;
    const canvas = document.querySelector("canvas");
    const point = bridge.getScreenTargets().find((item) => item.branchId === ${JSON.stringify(branchId)});
    if (!point) return { missing: ${JSON.stringify(branchId)} };
    const beforeHash = bridge.getState().canonicalHash;
    const fire = (type, x, y, buttons) => {
      const event = new PointerEvent(type, {
        bubbles: true, pointerId: ${pointerId}, clientX: x, clientY: y, button: 0, buttons, pointerType: "mouse",
      });
      (type === "pointerdown" ? canvas : window).dispatchEvent(event);
    };
    fire("pointerdown", point.x, point.y, 1);
    fire("pointermove", point.x + ${dx}, point.y + ${dy}, 1);
    const during = bridge.getState();
    const cue = document.querySelector("#craft-cue")?.innerText ?? "";
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const after = bridge.getState();
    return {
      point, beforeHash, duringHash: during.canonicalHash, during: during.transaction, cue,
      afterHash: after.canonicalHash, afterTransaction: after.transaction,
    };
  })()`;
}

await loadFixture("berry-twig", 1, 8278);
await renderView("front");
await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
const berryCancel = await evaluate(cdp, cancelDrag("plant-1:cluster-2", 18, -12, 41));
await shot(cdp, "berry-seed8278-prune-cancel-front");
const berryCut = await evaluate(cdp, `(() => {
  const bridge = window.__IKEBANA_TEST__;
  const canvas = document.querySelector("canvas");
  const point = bridge.getScreenTargets().find((item) => item.branchId === "plant-1:cluster-2");
  const beforeHash = bridge.getState().canonicalHash;
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 42, clientX: point.x, clientY: point.y, button: 0, buttons: 1, pointerType: "mouse",
  }));
  window.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, pointerId: 42, clientX: point.x, clientY: point.y, button: 0, buttons: 0, pointerType: "mouse",
  }));
  const snap = bridge.getCanonicalSnapshot();
  const plant = snap.plants.find((item) => item.id === "plant-1");
  return {
    beforeHash,
    afterHash: bridge.getState().canonicalHash,
    ordinal: snap.successfulPlantOrdinal,
    inactiveBerries: plant.organs.filter((organ) => organ.kind === "berry" && organ.active === false).map((organ) => organ.id),
    activeBerries: plant.organs.filter((organ) => organ.kind === "berry" && organ.active !== false).map((organ) => organ.id),
    branchCount: plant.branches.length,
  };
})()`);
await renderView("front");
await shot(cdp, "berry-seed8278-cluster-cut-front");
report.exercises.push({ step: "berry-prune", berryCancel, berryCut });

await evaluate(cdp, `document.querySelector('[data-testid="tool-shape"]').click()`);
const berryAimCancel = await evaluate(cdp, cancelDrag("plant-1:wood", 70, -30, 51));
const berryAim = await evaluate(cdp, `(() => {
  const bridge = window.__IKEBANA_TEST__;
  const canvas = document.querySelector("canvas");
  const point = bridge.getScreenTargets().find((item) => item.branchId === "plant-1:wood");
  const beforeHash = bridge.getState().canonicalHash;
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 52, clientX: point.x, clientY: point.y, button: 0, buttons: 1, pointerType: "mouse",
  }));
  window.dispatchEvent(new PointerEvent("pointermove", {
    bubbles: true, pointerId: 52, clientX: point.x + 64, clientY: point.y - 28, button: 0, buttons: 1, pointerType: "mouse",
  }));
  window.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, pointerId: 52, clientX: point.x + 64, clientY: point.y - 28, button: 0, buttons: 0, pointerType: "mouse",
  }));
  return { beforeHash, afterHash: bridge.getState().canonicalHash, cue: document.querySelector("#craft-cue")?.innerText ?? "" };
})()`);
await renderView("three-quarter");
await shot(cdp, "berry-seed8278-aim-three-quarter");
report.exercises.push({ step: "berry-aim", berryAimCancel, berryAim });

await loadFixture("fern-frond", 1, 8278);
await renderView("front");
await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
const fernCancel = await evaluate(cdp, cancelDrag("plant-1:pinna-2", 6, 6, 61));
const fernPinna = await evaluate(cdp, `(() => {
  const bridge = window.__IKEBANA_TEST__;
  const canvas = document.querySelector("canvas");
  const point = bridge.getScreenTargets().find((item) => item.branchId === "plant-1:pinna-2");
  const beforeHash = bridge.getState().canonicalHash;
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 62, clientX: point.x, clientY: point.y, button: 0, buttons: 1, pointerType: "mouse",
  }));
  window.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, pointerId: 62, clientX: point.x, clientY: point.y, button: 0, buttons: 0, pointerType: "mouse",
  }));
  const plant = bridge.getCanonicalSnapshot().plants.find((item) => item.id === "plant-1");
  return {
    beforeHash,
    afterHash: bridge.getState().canonicalHash,
    bladeActive: plant.organs.find((organ) => organ.id === "plant-1:pinna-blade-2")?.active ?? null,
    activeBlades: plant.organs.filter((organ) => organ.kind === "leaf" && organ.active !== false).length,
    organCount: plant.organs.length,
    branchCount: plant.branches.length,
  };
})()`);
await renderView("front");
await shot(cdp, "fern-seed8278-pinna-cut-front");

const hashBeforeReload = await evaluate(cdp, `window.__IKEBANA_TEST__.getState().canonicalHash`);
await cdp.send("Page.navigate", { url: "http://127.0.0.1:5173/?workbench=1&test=1" });
await delay(1800);
const hashAfterReload = await evaluate(cdp, `window.__IKEBANA_TEST__.getState().canonicalHash`);
const reloaded = await evaluate(cdp, `(() => {
  const snap = window.__IKEBANA_TEST__.getCanonicalSnapshot();
  const plant = snap.plants.find((item) => item.id === "plant-1");
  return {
    plants: snap.plants.length,
    ordinal: snap.successfulPlantOrdinal,
    generator: plant?.generatorVersion ?? null,
    bladeActive: plant?.organs.find((organ) => organ.id === "plant-1:pinna-blade-2")?.active ?? null,
  };
})()`);
await renderView("front");
await shot(cdp, "fern-seed8278-after-reload-front");
report.exercises.push({ step: "fern-pinna-prune-reload", fernCancel, fernPinna, hashBeforeReload, hashAfterReload, reloaded });

await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
const fernRachis = await evaluate(cdp, `(() => {
  const bridge = window.__IKEBANA_TEST__;
  const canvas = document.querySelector("canvas");
  const point = bridge.getScreenTargets().find((item) => item.branchId === "plant-1:rachis");
  const beforeHash = bridge.getState().canonicalHash;
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 63, clientX: point.x, clientY: point.y, button: 0, buttons: 1, pointerType: "mouse",
  }));
  const cue = document.querySelector("#craft-cue")?.innerText ?? "";
  window.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, pointerId: 63, clientX: point.x, clientY: point.y, button: 0, buttons: 0, pointerType: "mouse",
  }));
  const plant = bridge.getCanonicalSnapshot().plants.find((item) => item.id === "plant-1");
  return {
    beforeHash,
    cue,
    afterHash: bridge.getState().canonicalHash,
    activeBlades: plant.organs.filter((organ) => organ.kind === "leaf" && organ.active !== false).map((organ) => organ.id),
    inactiveBlades: plant.organs.filter((organ) => organ.kind === "leaf" && organ.active === false).map((organ) => organ.id),
  };
})()`);
await renderView("three-quarter");
await shot(cdp, "fern-seed8278-rachis-cut-three-quarter");
report.exercises.push({ step: "fern-rachis-prune", fernRachis });

await loadFixture("fern-frond", 1, 8278);
await renderView("front");
await evaluate(cdp, `document.querySelector('[data-testid="tool-shape"]').click()`);
const fernAimCancel = await evaluate(cdp, cancelDrag("plant-1:rachis", 80, 24, 71));
const fernBend = await evaluate(cdp, `(() => {
  const bridge = window.__IKEBANA_TEST__;
  const canvas = document.querySelector("canvas");
  const point = bridge.getScreenTargets().find((item) => item.branchId === "plant-1:rachis");
  const beforeHash = bridge.getState().canonicalHash;
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 72, clientX: point.x, clientY: point.y, button: 0, buttons: 1, pointerType: "mouse",
  }));
  window.dispatchEvent(new PointerEvent("pointermove", {
    bubbles: true, pointerId: 72, clientX: point.x + 48, clientY: point.y + 36, button: 0, buttons: 1, pointerType: "mouse",
  }));
  window.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, pointerId: 72, clientX: point.x + 48, clientY: point.y + 36, button: 0, buttons: 0, pointerType: "mouse",
  }));
  return { beforeHash, afterHash: bridge.getState().canonicalHash, cue: document.querySelector("#craft-cue")?.innerText ?? "" };
})()`);
await renderView("above");
await shot(cdp, "fern-seed8278-aim-above");
report.exercises.push({ step: "fern-aim", fernAimCancel, fernBend });

await loadFixture("round5-candidates", 2, 8278);
await renderView("front");
const beforeGarden = await state();
await evaluate(cdp, `(() => {
  document.querySelector("#garden-open").click();
  document.querySelector("#garden-name").value = "Berry twig and fern frond";
  document.querySelector("#garden-keep-form").requestSubmit();
})()`);
await delay(400);
await shot(cdp, "garden-kept");
await evaluate(cdp, `document.querySelector(".garden-card-view").click()`);
await delay(500);
const viewing = await evaluate(cdp, `document.querySelector("#app").dataset.gardenViewing === "true"`);
await renderView("front");
await shot(cdp, "garden-view");
await evaluate(cdp, `(() => {
  document.querySelector("#garden-copy").click();
  const choice = document.querySelector("#garden-choice");
  if (choice && !choice.hidden) document.querySelector("#garden-replace").click();
})()`);
await delay(500);
const afterCopy = await state();
await shot(cdp, "garden-copy");
report.exercises.push({
  step: "garden",
  beforeHash: beforeGarden.canonicalHash,
  viewing,
  afterCopyHash: afterCopy.canonicalHash,
  ordinal: afterCopy.successfulSeatOrdinal,
});

const study = readFileSync("artifacts/phase2-arrangements-garden.json", "utf8");
await evaluate(cdp, `localStorage.setItem("ikebana-web-alpha:workbench-garden-v1", ${JSON.stringify(study)})`);
await cdp.send("Page.navigate", { url: APP });
await delay(1800);
for (const arrangement of [
  { id: "phase2-clusters-kept-pinna-cut", label: "kept", title: "Clusters kept" },
  { id: "phase2-cluster-cleared-rachis-cut", label: "opened", title: "One cluster cleared" },
]) {
  await evaluate(cdp, `(() => {
    document.querySelector("#garden-open").click();
    const cards = [...document.querySelectorAll(".garden-card")];
    const card = cards.find((node) => (node.innerText || "").includes(${JSON.stringify(arrangement.title)}));
    if (!card) throw new Error("missing garden card");
    card.querySelector(".garden-card-view").click();
  })()`);
  await delay(600);
  for (const view of ["front", "three-quarter", "above"]) {
    const counts = await renderView(view);
    await shot(cdp, `arrangement-${arrangement.label}-${view}`);
    report.captures.push({
      fixture: arrangement.id,
      view,
      counts,
      still: `${OUT}/arrangement-${arrangement.label}-${view}.png`,
      canonicalHash: (await state()).canonicalHash,
    });
  }
}

writeFileSync(`${OUT}/browser-capture.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  captures: report.captures.map((item) => ({
    fixture: item.fixture, seed: item.seed, count: item.count, view: item.view, counts: item.counts, hash: item.canonicalHash,
  })),
  exercises: report.exercises,
  materialsMenu: report.materialsMenu,
}, null, 2));
