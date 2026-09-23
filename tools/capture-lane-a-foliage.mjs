/**
 * Matched stills for Lane A foliage polish.
 * Product graphs are not edited here. Draw counts wrap drawElements/drawArrays
 * before page scripts, then one view click and three animation frames.
 * Headless Chrome on port 9222. Not a physical phone.
 *
 *   node tools/capture-lane-a-foliage.mjs <label>
 *
 * Optional query string is appended to the workbench URL so presentation
 * comparison switches can be captured without editing the default.
 *   LANE_A_QUERY="pinnate=baseline&fanLeaf=shared" node tools/capture-lane-a-foliage.mjs baseline
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const label = process.argv[2];
if (!label || label.includes("/") || label.includes("..")) {
  throw new Error("usage: node tools/capture-lane-a-foliage.mjs <label>");
}

const OUT = `docs/development/reports/polish-lane-a-foliage/${label}`;
const ARRANGEMENT_PATH = resolve("artifacts/polish-baseline-arrangements.json");
const PORT = 9222;
const query = process.env.LANE_A_QUERY ? `&${process.env.LANE_A_QUERY}` : "";
const APP = `http://127.0.0.1:5173/?workbench=1&fresh=1&test=1${query}`;
const SEED = 8278;
const VIEWS = (process.env.LANE_A_VIEWS ?? "front,three-quarter,above").split(",").filter(Boolean);
const SPECIMENS = (process.env.LANE_A_SPECIMENS ?? "fern-frond,foliage-fan,leafy-shoot,flowering-branch,arching-trailer").split(",").filter(Boolean);
const ARRANGEMENT_TITLE = "Leafy fern and fan";

function delay(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.close = () => ws.close();
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
    };
  })()`);
}

async function loadFixture(cdp, material, count, seed = SEED) {
  const loaded = await evaluate(cdp, `(() => {
    document.querySelector("#workbench-open").click();
    const select = document.querySelector("#workbench-material");
    const option = [...select.options].find((item) => item.value === ${JSON.stringify(material)});
    if (!option || option.disabled) return { ok: false, reason: "missing-or-disabled" };
    select.value = ${JSON.stringify(material)};
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#workbench-seed").value = ${JSON.stringify(String(seed))};
    document.querySelector("#workbench-count").value = ${JSON.stringify(String(count))};
    document.querySelector("#workbench-form").requestSubmit();
    return { ok: true, error: document.querySelector("#workbench-error")?.textContent ?? "" };
  })()`);
  if (!loaded?.ok) throw new Error(`fixture load failed: ${JSON.stringify(loaded)}`);
  await delay(450);
  const plants = await evaluate(cdp, `window.__IKEBANA_TEST__.getCanonicalSnapshot().plants.length`);
  if (plants !== count) throw new Error(`fixture ${material} x${count} loaded ${plants}`);
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
      view: state.view,
      tool: state.tool,
      plants: snap.plants.map((plant) => ({
        id: plant.id,
        seed: plant.seed,
        generatorVersion: plant.generatorVersion,
        activeOrgans: plant.organs.filter((organ) => organ.active !== false).length,
        inactiveOrganIds: plant.organs.filter((organ) => organ.active === false).map((organ) => organ.id),
      })),
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

const report = { label, query: process.env.LANE_A_QUERY ?? "", app: APP, specimens: [], arrangement: null };
await navigate(cdp, APP);
report.environment = await environment(cdp);
console.log("env", JSON.stringify(report.environment));

for (const material of SPECIMENS) {
  await loadFixture(cdp, material, 1, SEED);
  const views = {};
  for (const view of VIEWS) {
    if (material !== "fern-frond" && material !== "foliage-fan" && view !== "front") continue;
    const counts = await renderView(cdp, view);
    const snap = await summary(cdp);
    const still = await shot(cdp, `${material}-seed${SEED}-count1-${view}`);
    views[view] = { counts, canonicalHash: snap.canonicalHash, cameraHash: snap.cameraHash, still };
    console.log(material, view, counts.calls, counts.triangles, snap.canonicalHash);
  }
  report.specimens.push({ material, seed: SEED, count: 1, views });
}

if (process.env.LANE_A_SKIP_ARRANGEMENT === "1") {
  writeFileSync(`${OUT}/browser-capture.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log("wrote", `${OUT}/browser-capture.json`);
  cdp.close();
  process.exit(0);
}

await navigate(cdp, APP);
await evaluate(cdp, `document.querySelector("#garden-open").click()`);
await delay(200);
const documentRoot = await cdp.send("DOM.getDocument");
const fileNode = await cdp.send("DOM.querySelector", {
  nodeId: documentRoot.root.nodeId,
  selector: "#garden-file",
});
await cdp.send("DOM.setFileInputFiles", {
  nodeId: fileNode.nodeId,
  files: [ARRANGEMENT_PATH],
});
await delay(600);
const imported = await evaluate(cdp, `(() => ({
  error: document.querySelector("#garden-error")?.textContent ?? "",
  titles: [...document.querySelectorAll(".garden-card strong")].map((node) => node.textContent),
}))()`);
console.log("import", JSON.stringify(imported));
if (!imported.titles.includes(ARRANGEMENT_TITLE)) {
  throw new Error(`arrangement import failed: ${JSON.stringify(imported)}`);
}
await evaluate(cdp, `(() => {
  const cards = [...document.querySelectorAll(".garden-card")];
  const card = cards.find((node) => (node.innerText || "").includes(${JSON.stringify(ARRANGEMENT_TITLE)}));
  card.querySelector(".garden-card-view").click();
})()`);
await delay(400);
const views = {};
for (const view of VIEWS) {
  const counts = await renderView(cdp, view);
  const snap = await summary(cdp);
  const still = await shot(cdp, `arrangement-a-leafy-fern-fan-${view}`);
  views[view] = { counts, canonicalHash: snap.canonicalHash, cameraHash: snap.cameraHash, still };
  console.log("arrangement-a", view, counts.calls, counts.triangles, snap.canonicalHash);
}
report.arrangement = { title: ARRANGEMENT_TITLE, views, summary: await summary(cdp) };
writeFileSync(`${OUT}/browser-capture.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log("wrote", `${OUT}/browser-capture.json`);
cdp.close();
