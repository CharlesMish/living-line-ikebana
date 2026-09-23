/**
 * Headless Chrome capture for the berry-twig candidate.
 * Draw counts are WebGL calls for one forced view render, including the vessel.
 * Frame samples are this machine, not a phone.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "docs/development/reports/berry-twig-v1";
const PORT = 9222;

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

await cdp.send("Page.navigate", { url: "http://127.0.0.1:5173/?workbench=1&fresh=1&test=1" });
await delay(1600);
const ready = await evaluate(cdp, `document.querySelector("#app")?.dataset.ready`);
if (ready !== "true") throw new Error(`app not ready: ${ready}`);

async function environment() {
  return evaluate(cdp, `(() => {
    const canvas = document.querySelector("canvas");
    const rect = canvas.getBoundingClientRect();
    const rail = document.querySelector(".top-chrome");
    const box = rail.getBoundingClientRect();
    const options = document.querySelector("#material-options");
    return {
      cssViewport: { width: rect.width, height: rect.height },
      drawingBuffer: { width: canvas.width, height: canvas.height },
      devicePixelRatio: window.devicePixelRatio,
      browserWindow: { width: window.innerWidth, height: window.innerHeight },
      userAgent: navigator.userAgent,
      topChrome: { width: box.width, height: box.height },
      materials: options ? {
        hidden: options.hidden,
        clientHeight: options.clientHeight,
        scrollHeight: options.scrollHeight,
        width: options.clientWidth,
      } : null,
      webgl: canvas.getContext("webgl2") ? "webgl2" : "webgl",
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
  await delay(700);
}

async function state() {
  return evaluate(cdp, `window.__IKEBANA_TEST__.getState()`);
}

async function renderView(view) {
  return evaluate(cdp, `new Promise((resolve) => {
    window.__gl.calls = 0;
    window.__gl.triangles = 0;
    const start = performance.now();
    document.querySelector(${JSON.stringify(`[data-testid="view-${view}"]`)}).click();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      resolve({
        renderElapsedMs: performance.now() - start,
        calls: window.__gl.calls,
        triangles: Math.round(window.__gl.triangles),
      });
    }));
  })`);
}

async function idleFrames() {
  return evaluate(cdp, `new Promise((resolve) => {
    window.__gl.calls = 0;
    const samples = [];
    let last = performance.now();
    let n = 0;
    const tick = (now) => {
      samples.push(now - last);
      last = now;
      n += 1;
      if (n < 20) requestAnimationFrame(tick);
      else {
        const body = samples.slice(1);
        const sorted = [...body].sort((a, b) => a - b);
        resolve({
          frames: body.length,
          glCalls: window.__gl.calls,
          medianMs: sorted[Math.floor(sorted.length / 2)],
          maxMs: sorted[sorted.length - 1],
        });
      }
    };
    requestAnimationFrame(tick);
  })`);
}

const report = {
  label: "Google Chrome headless, ANGLE SwiftShader, Linux. Not a physical phone.",
  captures: [],
};

async function captureFixture(material, count, views) {
  await loadFixture(material, count);
  for (const view of views) {
    const counts = await renderView(view);
    const env = await environment();
    const snap = await state();
    await shot(cdp, `${material}-seed8278-count${count}-${view}`);
    report.captures.push({ fixture: material, seed: 8278, count, view, counts, environment: env, canonicalHash: snap.canonicalHash, cameraHash: snap.cameraHash });
  }
}

await captureFixture("berry-twig", 1, ["front", "three-quarter", "above"]);
report.idleAfterCount1 = await idleFrames();

await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);
await delay(200);
const menu = await environment();
await shot(cdp, "materials-menu");
report.materialsMenu = menu.materials;
await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);

await captureFixture("references-plus-berry-twig", 6, ["front", "three-quarter", "above"]);
await captureFixture("berry-twig", 12, ["front"]);
await captureFixture("reference-pair", 6, ["front"]);

const beforePrune = await (async () => {
  await loadFixture("berry-twig", 1);
  await renderView("front");
  return state();
})();
await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
const target = await evaluate(cdp, `(() => {
  const targets = window.__IKEBANA_TEST__.getScreenTargets();
  return targets.find((item) => item.branchId === "plant-1:cluster-2")
    || targets.find((item) => item.branchId === "plant-1:cluster-1");
})()`);
if (!target) throw new Error("cluster screen target missing");
await cdp.send("Input.dispatchMouseEvent", {
  type: "mousePressed", x: target.x, y: target.y, button: "left", clickCount: 1,
});
await delay(80);
await cdp.send("Input.dispatchMouseEvent", {
  type: "mouseMoved", x: target.x + 24, y: target.y - 16, button: "left",
});
await delay(80);
await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
await delay(120);
await cdp.send("Input.dispatchMouseEvent", {
  type: "mouseReleased", x: target.x + 24, y: target.y - 16, button: "left", clickCount: 1,
});
await delay(200);
const afterCancel = await state();
await shot(cdp, "seed8278-prune-cancel-front");
report.pruneCancel = {
  target,
  beforeHash: beforePrune.canonicalHash,
  afterHash: afterCancel.canonicalHash,
  autosaveWrites: (await evaluate(cdp, `window.__IKEBANA_TEST__.getAutosaveAudit()`)).writes.length,
};

await cdp.send("Input.dispatchMouseEvent", {
  type: "mousePressed", x: target.x, y: target.y, button: "left", clickCount: 1,
});
await delay(60);
await cdp.send("Input.dispatchMouseEvent", {
  type: "mouseReleased", x: target.x, y: target.y, button: "left", clickCount: 1,
});
await delay(250);
const afterCut = await state();
await renderView("front");
await shot(cdp, "seed8278-cluster-cut-front");
report.pruneCommit = {
  beforeHash: afterCancel.canonicalHash,
  afterHash: afterCut.canonicalHash,
  ordinal: afterCut.successfulSeatOrdinal,
  inactiveBerries: await evaluate(cdp, `(() => {
    const plants = window.__IKEBANA_TEST__.getCanonicalSnapshot().plants;
    const plant = plants.find((item) => item.id === "plant-1");
    return plant.organs.filter((organ) => organ.kind === "berry" && organ.active === false).map((organ) => organ.id);
  })()`),
};

await evaluate(cdp, `document.querySelector('[data-testid="tool-shape"]').click()`);
const wood = await evaluate(cdp, `window.__IKEBANA_TEST__.getScreenTargets().find((item) => item.branchId === "plant-1:wood")`);
const beforeAim = await state();
await cdp.send("Input.dispatchMouseEvent", {
  type: "mousePressed", x: wood.x, y: wood.y, button: "left", clickCount: 1,
});
await delay(40);
await cdp.send("Input.dispatchMouseEvent", {
  type: "mouseMoved", x: wood.x + 80, y: wood.y - 40, button: "left",
});
await delay(40);
await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
await delay(80);
await cdp.send("Input.dispatchMouseEvent", {
  type: "mouseReleased", x: wood.x + 80, y: wood.y - 40, button: "left", clickCount: 1,
});
await delay(150);
const afterAimCancel = await state();
report.aimCancel = {
  beforeHash: beforeAim.canonicalHash,
  afterHash: afterAimCancel.canonicalHash,
};
await cdp.send("Input.dispatchMouseEvent", {
  type: "mousePressed", x: wood.x, y: wood.y, button: "left", clickCount: 1,
});
await delay(40);
await cdp.send("Input.dispatchMouseEvent", {
  type: "mouseMoved", x: wood.x + 70, y: wood.y - 30, button: "left",
});
await delay(40);
await cdp.send("Input.dispatchMouseEvent", {
  type: "mouseReleased", x: wood.x + 70, y: wood.y - 30, button: "left", clickCount: 1,
});
await delay(200);
await renderView("three-quarter");
await shot(cdp, "seed8278-aim-or-bend-three-quarter");
report.aimOrBend = {
  beforeHash: afterAimCancel.canonicalHash,
  afterHash: (await state()).canonicalHash,
};

await loadFixture("berry-twig", 1);
await renderView("front");
await evaluate(cdp, `(() => {
  document.querySelector("#garden-open").click();
  document.querySelector("#garden-name").value = "Berry twig seed 8278";
  document.querySelector("#garden-keep-form").requestSubmit();
})()`);
await delay(400);
await shot(cdp, "garden-kept");
await evaluate(cdp, `document.querySelector(".garden-card-view").click()`);
await delay(400);
await shot(cdp, "garden-view");
const viewing = await evaluate(cdp, `document.querySelector("#app").dataset.gardenViewing === "true"`);
await evaluate(cdp, `document.querySelector("#garden-copy").click()`);
await delay(200);
await evaluate(cdp, `document.querySelector("#garden-replace").click()`);
await delay(400);
const afterCopy = await state();
await shot(cdp, "garden-copy");
report.garden = {
  viewing,
  afterCopyHash: afterCopy.canonicalHash,
  ordinal: afterCopy.successfulSeatOrdinal,
  keptTitle: "Berry twig seed 8278",
};

await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
});
await delay(300);
await loadFixture("berry-twig", 1);
await renderView("front");
await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);
await delay(200);
report.narrow390 = await environment();
await shot(cdp, "narrow-390-materials");
await evaluate(cdp, `document.querySelector("#material-options").scrollTop = 400`);
await delay(100);
await shot(cdp, "narrow-390-materials-scrolled");

await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 844, height: 390, deviceScaleFactor: 1, mobile: false,
});
await delay(300);
await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);
await delay(150);
report.shortLandscape = await environment();
await shot(cdp, "short-landscape-materials");

writeFileSync(`${OUT}/browser-capture.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
