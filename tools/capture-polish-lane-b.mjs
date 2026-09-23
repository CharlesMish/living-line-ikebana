/**
 * Headless Chrome evidence for polish lane B (flowers and berries).
 * Draw counts are WebGL calls for one view render, including the vessel.
 * This machine is not a phone.
 *
 *   node tools/capture-polish-lane-b.mjs before
 *   node tools/capture-polish-lane-b.mjs after --smoke
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LABEL = process.argv[2] ?? "before";
const SMOKE = process.argv.includes("--smoke") || process.argv.includes("--smoke-only");
const SMOKE_ONLY = process.argv.includes("--smoke-only");
const OUT = `docs/development/reports/polish-lane-b/${LABEL}`;
const ARRANGEMENT_PATH = resolve("/tmp/polish-baseline-arrangements.json");
const PORT = 9222;
const APP = "http://127.0.0.1:5173/?workbench=1&fresh=1&test=1";
const RELOAD = "http://127.0.0.1:5173/?workbench=1&test=1";
const SEED = 8278;
const VIEWS = ["front", "three-quarter", "above"];
const MATERIALS = ["berry-twig", "blossom-spray", "flower-volume", "nodding-flower"];

function delay(ms) {
  return new Promise((done) => setTimeout(done, ms));
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
        organs: plant.organs.length,
        activeOrgans: plant.organs.filter((organ) => organ.active !== false).length,
        inactiveOrganIds: plant.organs.filter((organ) => organ.active === false).map((organ) => organ.id),
      })),
    };
  })()`);
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
    if (${release ? "true" : "false"}) {
      fire("pointerup", point.x + ${dx}, point.y + ${dy}, 0, window);
    }
    const after = bridge.getState();
    return {
      point, cue,
      beforeHash: before.canonicalHash,
      duringHash: during.canonicalHash,
      during: during.transaction,
      afterHash: after.canonicalHash,
      afterTransaction: after.transaction,
      ordinal: after.successfulSeatOrdinal,
    };
  })()`;
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
      cue: document.querySelector("#craft-cue")?.innerText ?? "",
    };
  })()`);
}

async function acquireBend(cdp, branchId, pointerBase) {
  const offsets = [[0, 0], [0, -16], [0, 16], [-16, 0], [16, 0], [0, -32], [0, 32], [-24, -18], [24, 18]];
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
      return { x, y, operation: during.transaction?.operation ?? null };
    })()`);
    attempts.push({ offset: [ox, oy], operation: probe?.operation ?? null });
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
  const offsets = [[0, -120], [0, 120], [0, -180], [0, 180], [0, -80], [0, 80], [-70, 30], [70, -30]];
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
      return { x, y, operation: during.transaction?.operation ?? null };
    })()`);
    attempts.push({ offset: [ox, oy], operation: probe?.operation ?? null });
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
        return { during: during.transaction, duringHash: during.canonicalHash, afterHash: after.canonicalHash };
      })()`);
      return { acquired: true, offset: [ox, oy], drag: [dx, dy], attempts, moved };
    }
    await cancelGesture(cdp);
  }
  return { acquired: false, attempts };
}

async function orbitClip(cdp, slug) {
  await evaluate(cdp, `document.querySelector('[data-testid="posture-step-back"]').click()`);
  await delay(150);
  const frames = 28;
  const dir = `${OUT}/orbit-frames`;
  mkdirSync(dir, { recursive: true });
  await evaluate(cdp, `(() => {
    const canvas = document.querySelector("canvas");
    const rect = canvas.getBoundingClientRect();
    window.__orbit = { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.42 };
    canvas.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, pointerId: 77, clientX: window.__orbit.x, clientY: window.__orbit.y,
      button: 0, buttons: 1, pointerType: "mouse",
    }));
    return window.__IKEBANA_TEST__.getState().transaction;
  })()`);
  for (let frame = 0; frame < frames; frame += 1) {
    const dx = Math.round((frame / (frames - 1)) * 520);
    const dy = Math.round(Math.sin((frame / (frames - 1)) * Math.PI) * 40);
    await evaluate(cdp, `(() => {
      window.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true, pointerId: 77,
        clientX: window.__orbit.x + ${dx}, clientY: window.__orbit.y + ${dy},
        button: 0, buttons: 1, pointerType: "mouse",
      }));
      return window.__IKEBANA_TEST__.getState().view;
    })()`);
    await delay(30);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${dir}/${String(frame).padStart(2, "0")}.png`, Buffer.from(data, "base64"));
  }
  await evaluate(cdp, `(() => {
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, pointerId: 77,
      clientX: window.__orbit.x + 520, clientY: window.__orbit.y,
      button: 0, buttons: 0, pointerType: "mouse",
    }));
    return window.__IKEBANA_TEST__.getState().transaction;
  })()`);
  const mp4 = resolve(`${OUT}/${slug}.mp4`);
  execFileSync("ffmpeg", [
    "-y", "-framerate", "12", "-i", `${dir}/%02d.png`,
    "-vf", "scale=960:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    mp4,
  ], { stdio: "inherit" });
  return mp4;
}

async function viewArrangement(cdp, title) {
  await evaluate(cdp, `(() => {
    document.querySelector("#garden-open").click();
    const cards = [...document.querySelectorAll(".garden-card")];
    const card = cards.find((node) => (node.innerText || "").includes(${JSON.stringify(title)}));
    if (!card) throw new Error("missing garden card");
    card.querySelector(".garden-card-view").click();
  })()`);
  await delay(400);
  const viewing = await evaluate(cdp, `document.querySelector("#app").dataset.gardenViewing === "true"`);
  if (!viewing) throw new Error(`garden view did not open for ${title}`);
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

const report = {
  label: LABEL,
  protocol: "Workbench or Garden view, then one view-button click, then three animation frames. Counters reset immediately before the click. Vessel included. Not a phone.",
  seed: SEED,
  specimens: [],
  costs: [],
};

await navigate(cdp, APP);
report.environment = await environment(cdp);
console.log("environment", JSON.stringify(report.environment));

if (!SMOKE_ONLY) {
for (const material of MATERIALS) {
  await loadFixture(cdp, material, 1, SEED);
  const views = {};
  for (const view of VIEWS) {
    const counts = await renderView(cdp, view);
    const snap = await summary(cdp);
    const still = await shot(cdp, `${material}-seed${SEED}-count1-${view}`);
    views[view] = { counts, canonicalHash: snap.canonicalHash, cameraHash: snap.cameraHash, still };
    console.log("specimen", material, view, counts.calls, counts.triangles, snap.canonicalHash);
  }
  report.specimens.push({ material, summary: await summary(cdp), views });
  if (material === "flower-volume") {
    report.orbit = await orbitClip(cdp, "flower-volume-seed8278-count1-orbit");
    console.log("orbit", report.orbit);
    await evaluate(cdp, `document.querySelector('[data-testid="posture-arrange"]').click()`);
  }
}

await navigate(cdp, APP);
const importOpen = await evaluate(cdp, `(() => {
  document.querySelector("#garden-open").click();
  return document.querySelector("#garden-dialog")?.open === true;
})()`);
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
  count: document.querySelector("#garden-count")?.textContent ?? "",
  titles: [...document.querySelectorAll(".garden-card strong")].map((node) => node.textContent),
}))()`);
report.import = { dialogOpened: importOpen, ...imported };
console.log("import", JSON.stringify(report.import));
if (!imported.titles?.includes("Berry and flower accents")) {
  throw new Error(`arrangement B missing: ${JSON.stringify(imported)}`);
}

await viewArrangement(cdp, "Berry and flower accents");
const arrangement = { title: "Berry and flower accents", views: {} };
for (const view of VIEWS) {
  const counts = await renderView(cdp, view);
  const snap = await summary(cdp);
  const still = await shot(cdp, `arrangement-b-berry-flower-accents-${view}`);
  arrangement.views[view] = { counts, canonicalHash: snap.canonicalHash, cameraHash: snap.cameraHash, still };
  console.log("arrangement-b", view, counts.calls, counts.triangles, snap.canonicalHash);
}
arrangement.summary = await summary(cdp);
report.costs.push(arrangement);
await evaluate(cdp, `document.querySelector("#garden-return").click()`);
}

if (SMOKE) {
  report.smoke = [];
  const specs = [
    { material: "berry-twig", stem: "plant-1:wood", prune: "plant-1:cluster-2", title: "Lane B berry" },
    { material: "blossom-spray", stem: "plant-1:stem", prune: "plant-1:group-2", title: "Lane B blossom" },
    { material: "flower-volume", stem: "plant-1:stem", prune: "plant-1:group-2", title: "Lane B volume" },
    { material: "nodding-flower", stem: "plant-1:stem", prune: "plant-1:neck", title: "Lane B nodding" },
  ];
  for (const spec of specs) {
    await navigate(cdp, APP);
    await loadFixture(cdp, spec.material, 1, SEED);
    await renderView(cdp, "front");
    const seated = await summary(cdp);
    const targets = await evaluate(cdp, `window.__IKEBANA_TEST__.getScreenTargets().map((item) => item.branchId)`);
    const stem = targets.includes(spec.stem) ? spec.stem : targets[0];
    const pruneBranch = targets.includes(spec.prune) ? spec.prune : targets[targets.length - 1];
    await evaluate(cdp, `document.querySelector('[data-testid="tool-shape"]').click()`);
    const aim = await acquireAim(cdp, stem, 300, 48, -16);
    const afterAim = await summary(cdp);
    const bend = await acquireBend(cdp, stem, 400);
    const afterBend = await summary(cdp);
    await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
    const preview = await evaluate(cdp, gestureExpression({
      branchId: pruneBranch, dx: 0, dy: 0, pointerId: 510, release: false,
    }));
    const previewStill = await shot(cdp, `smoke-${spec.material}-prune-preview-front`);
    const cancelled = await cancelGesture(cdp);
    const afterCancel = await summary(cdp);
    const committed = await evaluate(cdp, gestureExpression({
      branchId: pruneBranch, dx: 0, dy: 0, pointerId: 511, release: true,
    }));
    const afterCommit = await summary(cdp);
    await shot(cdp, `smoke-${spec.material}-prune-commit-front`);
    await navigate(cdp, RELOAD);
    await delay(300);
    const reloaded = await summary(cdp);
    await shot(cdp, `smoke-${spec.material}-reload-front`);
    const kept = await evaluate(cdp, `(() => {
      document.querySelector("#garden-open").click();
      const name = document.querySelector("#garden-name");
      name.value = ${JSON.stringify(spec.title)};
      document.querySelector("#garden-keep-form").requestSubmit();
      return {
        error: document.querySelector("#garden-error")?.textContent ?? "",
        cards: [...document.querySelectorAll(".garden-card strong")].map((node) => node.textContent),
      };
    })()`);
    await viewArrangement(cdp, spec.title);
    const viewed = await summary(cdp);
    await shot(cdp, `smoke-${spec.material}-garden-view-front`);
    await evaluate(cdp, `document.querySelector("#garden-copy").click()`);
    await evaluate(cdp, `(() => {
      const choice = document.querySelector("#garden-choice");
      if (choice && !choice.hidden) document.querySelector("#garden-replace").click();
    })()`);
    await delay(300);
    const copied = await summary(cdp);
    await shot(cdp, `smoke-${spec.material}-garden-copy-front`);
    report.smoke.push({
      material: spec.material,
      stem,
      pruneBranch,
      seatedHash: seated.canonicalHash,
      aim,
      afterAimHash: afterAim.canonicalHash,
      bend,
      afterBendHash: afterBend.canonicalHash,
      preview: { cue: preview.cue, during: preview.during, hash: preview.duringHash },
      previewStill,
      cancelled,
      afterCancelHash: afterCancel.canonicalHash,
      committed: { cue: committed.cue, during: committed.during, hash: committed.afterHash },
      afterCommitHash: afterCommit.canonicalHash,
      ordinal: afterCommit.ordinal,
      reloadedHash: reloaded.canonicalHash,
      kept,
      viewedHash: viewed.canonicalHash,
      copiedHash: copied.canonicalHash,
    });
    console.log("smoke", spec.material, seated.canonicalHash, afterCommit.canonicalHash, reloaded.canonicalHash);
  }
}

writeFileSync(`${OUT}/browser-capture.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log("wrote", `${OUT}/browser-capture.json`);
