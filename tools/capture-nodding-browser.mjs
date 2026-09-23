/**
 * Headless Chrome capture for the nodding-flower study.
 * Counts WebGL draw calls for one frame. Not a physical-phone session.
 */
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = "docs/development/reports/nodding-flower-v1";
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

await cdp.send("Page.navigate", { url: "http://127.0.0.1:5173/?workbench=1&fresh=1" });
await delay(1500);
const ready = await evaluate(cdp, `document.querySelector("#app")?.dataset.ready`);
console.log("ready", ready);
const webgl = await evaluate(cdp, `(() => {
  const canvas = document.querySelector("canvas");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  return {
    canvas: canvas ? { cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, bufferWidth: canvas.width, bufferHeight: canvas.height } : null,
    dpr: window.devicePixelRatio,
    inner: { width: window.innerWidth, height: window.innerHeight },
    gl: Boolean(gl),
    userAgent: navigator.userAgent,
  };
})()`);
console.log("webgl", JSON.stringify(webgl));

async function loadFixture(material, count) {
  await evaluate(cdp, `(() => {
    document.querySelector("#workbench-open").click();
    const select = document.querySelector("#workbench-material");
    select.value = ${JSON.stringify(material)};
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#workbench-seed").value = "8278";
    document.querySelector("#workbench-count").value = ${JSON.stringify(String(count))};
    document.querySelector("#workbench-form").requestSubmit();
  })()`);
  await delay(800);
}

async function setView(view) {
  await evaluate(cdp, `document.querySelector('[data-testid="view-${view}"]').click()`);
  await delay(400);
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

async function captureEnvironment() {
  return evaluate(cdp, `(() => {
    const canvas = document.querySelector("canvas");
    const rect = canvas.getBoundingClientRect();
    return {
      cssViewport: { width: rect.width, height: rect.height },
      drawingBuffer: { width: canvas.width, height: canvas.height },
      devicePixelRatio: window.devicePixelRatio,
      browserWindow: { width: window.innerWidth, height: window.innerHeight },
      visualViewport: window.visualViewport ? { width: window.visualViewport.width, height: window.visualViewport.height, scale: window.visualViewport.scale } : null,
      userAgent: navigator.userAgent,
      topChrome: (() => {
        const rail = document.querySelector(".top-chrome");
        const box = rail.getBoundingClientRect();
        return { width: box.width, height: box.height };
      })(),
    };
  })()`);
}

const report = { captures: [] };
await loadFixture("nodding-flower", 1);
for (const view of ["front", "three-quarter", "above"]) {
  await setView(view);
  const counts = await frameCounts();
  const environment = await captureEnvironment();
  await shot(cdp, `browser-nodding-seed8278-count1-${view}`);
  report.captures.push({ fixture: "nodding-flower", seed: 8278, count: 1, view, counts, environment });
}

await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);
await delay(200);
await shot(cdp, "browser-materials-menu");
await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);

await loadFixture("single-flower", 1);
await setView("front");
report.captures.push({
  fixture: "single-flower",
  seed: 8278,
  count: 1,
  view: "front",
  counts: await frameCounts(),
  environment: await captureEnvironment(),
});
await shot(cdp, "browser-single-flower-seed8278-count1-front");

await loadFixture("reference-pair", 6);
await setView("front");
report.captures.push({
  fixture: "reference-pair",
  seed: 8278,
  count: 6,
  view: "front",
  counts: await frameCounts(),
  environment: await captureEnvironment(),
});
await shot(cdp, "browser-reference-pair-count6-front");

await loadFixture("nodding-flower", 12);
await setView("front");
report.captures.push({
  fixture: "nodding-flower",
  seed: 8278,
  count: 12,
  view: "front",
  counts: await frameCounts(),
  environment: await captureEnvironment(),
});
await shot(cdp, "browser-nodding-seed8278-count12-front");

await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await delay(400);
await loadFixture("nodding-flower", 1);
await setView("front");
report.captures.push({
  fixture: "nodding-flower",
  seed: 8278,
  count: 1,
  view: "front",
  viewport: "390x844",
  counts: await frameCounts(),
  environment: await captureEnvironment(),
});
await shot(cdp, "browser-nodding-narrow-390");

await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 800,
  height: 420,
  deviceScaleFactor: 1,
  mobile: false,
});
await delay(400);
await loadFixture("nodding-flower", 1);
await setView("front");
report.captures.push({
  fixture: "nodding-flower",
  seed: 8278,
  count: 1,
  view: "front",
  viewport: "800x420",
  counts: await frameCounts(),
  environment: await captureEnvironment(),
});
await shot(cdp, "browser-nodding-short-800x420");

writeFileSync(`${OUT}/browser-capture.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
