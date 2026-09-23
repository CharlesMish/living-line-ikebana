/**
 * Headless interaction pass for the accepted foliage polish.
 * Not a physical phone. Records one short clip of fern prune and fan aim.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

const OUT = "docs/development/reports/polish-lane-a-foliage/exercise";
const PORT = 9222;
const APP = "http://127.0.0.1:5173/?workbench=1&fresh=1&test=1";
const RELOAD = "http://127.0.0.1:5173/?workbench=1&test=1";

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

  close() {
    this.ws.close();
  }
}

async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("no page");
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
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
}

async function waitReady(cdp) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await evaluate(cdp, `document.querySelector("#app")?.dataset.ready`) === "true") return;
    await delay(250);
  }
  throw new Error("not ready");
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await delay(400);
  await waitReady(cdp);
}

async function loadFixture(cdp, material) {
  await evaluate(cdp, `(() => {
    document.querySelector("#workbench-open").click();
    const select = document.querySelector("#workbench-material");
    select.value = ${JSON.stringify(material)};
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#workbench-seed").value = "8278";
    document.querySelector("#workbench-count").value = "1";
    document.querySelector("#workbench-form").requestSubmit();
  })()`);
  await delay(500);
}

function stateExpression() {
  return `(() => {
    const bridge = window.__IKEBANA_TEST__;
    const state = bridge.getState();
    const audit = bridge.getAutosaveAudit();
    return {
      hash: state.canonicalHash,
      ordinal: state.successfulSeatOrdinal,
      tool: state.tool,
      transaction: state.transaction,
      selected: state.selectedBranchId,
      saves: audit.writes.length,
      lastSaveHash: audit.writes.at(-1)?.hash ?? null,
    };
  })()`;
}

mkdirSync(OUT, { recursive: true });
const cdp = await connect();
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
});
const report = { steps: [] };

async function remember(cdp, step) {
  const state = await evaluate(cdp, stateExpression());
  report.steps.push({ step, ...state });
  console.log(step, state.hash, state.transaction?.operation ?? "-", "saves", state.saves);
  return state;
}

async function drag(cdp, branchId, dx, dy, pointerId, { release = true, steps = 8 } = {}) {
  const point = await evaluate(cdp, `window.__IKEBANA_TEST__.getScreenTargets().find((item) => item.branchId === ${JSON.stringify(branchId)})`);
  if (!point) throw new Error(`missing ${branchId}`);
  const fire = async (type, x, y, buttons) => {
    await evaluate(cdp, `(() => {
      const target = ${type === "pointerdown" ? "document.querySelector('canvas')" : "window"};
      target.dispatchEvent(new PointerEvent(${JSON.stringify(type)}, {
        bubbles: true, pointerId: ${pointerId}, clientX: ${x}, clientY: ${y},
        button: 0, buttons: ${buttons}, pointerType: "mouse",
      }));
    })()`);
  };
  await fire("pointerdown", point.x, point.y, 1);
  for (let step = 1; step <= steps; step += 1) {
    await fire("pointermove", point.x + dx * step / steps, point.y + dy * step / steps, 1);
    await delay(40);
  }
  if (release) await fire("pointerup", point.x + dx, point.y + dy, 0);
  await delay(80);
  return point;
}

await cdp.send("Page.startScreencast", { format: "jpeg", quality: 60, everyNthFrame: 1 });
cdp.recording = true;

await navigate(cdp, APP);
await loadFixture(cdp, "fern-frond");
await evaluate(cdp, `document.querySelector('[data-testid="view-front"]').click()`);
await delay(200);
const fernLoaded = await remember(cdp, "fern-loaded");
await shot(cdp, "fern-loaded");

await evaluate(cdp, `document.querySelector('[data-testid="tool-shape"]').click()`);
await drag(cdp, "plant-1:pinna-3", 64, -28, 11);
await remember(cdp, "fern-aim-pinna");
await shot(cdp, "fern-aim-pinna");

await drag(cdp, "plant-1:rachis", 36, 28, 12);
await remember(cdp, "fern-bend-or-aim-rachis");
await shot(cdp, "fern-bend-rachis");

await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
const pinna = await evaluate(cdp, `window.__IKEBANA_TEST__.getScreenTargets().find((item) => item.branchId === "plant-1:pinna-4")`);
await evaluate(cdp, `(() => {
  const canvas = document.querySelector("canvas");
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 21, clientX: ${pinna.x}, clientY: ${pinna.y}, button: 0, buttons: 1, pointerType: "mouse",
  }));
  window.dispatchEvent(new PointerEvent("pointermove", {
    bubbles: true, pointerId: 21, clientX: ${pinna.x + 6}, clientY: ${pinna.y + 4}, button: 0, buttons: 1, pointerType: "mouse",
  }));
})()`);
await delay(120);
const preview = await remember(cdp, "fern-prune-preview");
await shot(cdp, "fern-prune-preview");
const cue = await evaluate(cdp, `document.querySelector("#craft-cue")?.innerText ?? ""`);
report.fernPreviewCue = cue;
await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
await delay(80);
const cancelled = await remember(cdp, "fern-prune-cancel");
await evaluate(cdp, `(() => {
  const canvas = document.querySelector("canvas");
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 22, clientX: ${pinna.x}, clientY: ${pinna.y}, button: 0, buttons: 1, pointerType: "mouse",
  }));
  window.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, pointerId: 22, clientX: ${pinna.x}, clientY: ${pinna.y}, button: 0, buttons: 0, pointerType: "mouse",
  }));
})()`);
await delay(120);
const committed = await remember(cdp, "fern-prune-commit");
await shot(cdp, "fern-prune-commit");
const fernOrgan = await evaluate(cdp, `(() => {
  const plant = window.__IKEBANA_TEST__.getCanonicalSnapshot().plants[0];
  const organ = plant.organs.find((item) => item.id === "plant-1:pinna-blade-4");
  return { active: organ.active, organs: plant.organs.length, inactive: plant.organs.filter((item) => item.active === false).map((item) => item.id) };
})()`);
report.fernOrgan = fernOrgan;

const fernHash = committed.hash;
await navigate(cdp, RELOAD);
const reloaded = await remember(cdp, "fern-reload");
report.fernReloadMatched = reloaded.hash === fernHash;
await shot(cdp, "fern-reload");

await evaluate(cdp, `(() => {
  document.querySelector("#garden-open").click();
  document.querySelector("#garden-name").value = "Lane A fern";
  document.querySelector("#garden-keep-form").requestSubmit();
})()`);
await delay(200);
await evaluate(cdp, `document.querySelector(".garden-card-view").click()`);
await delay(200);
const viewed = await remember(cdp, "fern-garden-view");
await evaluate(cdp, `(() => {
  document.querySelector("#garden-copy").click();
  const choice = document.querySelector("#garden-choice");
  if (choice && !choice.hidden) document.querySelector("#garden-replace").click();
})()`);
await delay(200);
const copied = await remember(cdp, "fern-garden-copy");
report.fernGarden = { viewed: viewed.hash, copied: copied.hash, kept: fernHash };

await navigate(cdp, APP);
await loadFixture(cdp, "foliage-fan");
await evaluate(cdp, `document.querySelector('[data-testid="view-front"]').click()`);
await evaluate(cdp, `document.querySelector('[data-testid="tool-shape"]').click()`);
await delay(150);
const fanLoaded = await remember(cdp, "fan-loaded");
await shot(cdp, "fan-loaded");
await drag(cdp, "plant-1:stem", 70, -12, 31);
await remember(cdp, "fan-aim-stem");
await shot(cdp, "fan-aim-stem");
await drag(cdp, "plant-1:stem", 28, 36, 32);
await remember(cdp, "fan-bend-or-aim-stem");
await shot(cdp, "fan-bend-stem");

await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
const arm = await evaluate(cdp, `window.__IKEBANA_TEST__.getScreenTargets().find((item) => item.branchId === "plant-1:arm-opening")`);
await evaluate(cdp, `(() => {
  const canvas = document.querySelector("canvas");
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 41, clientX: ${arm.x}, clientY: ${arm.y}, button: 0, buttons: 1, pointerType: "mouse",
  }));
  window.dispatchEvent(new PointerEvent("pointermove", {
    bubbles: true, pointerId: 41, clientX: ${arm.x + 4}, clientY: ${arm.y + 4}, button: 0, buttons: 1, pointerType: "mouse",
  }));
})()`);
await delay(120);
await remember(cdp, "fan-prune-preview");
await shot(cdp, "fan-prune-preview");
report.fanPreviewCue = await evaluate(cdp, `document.querySelector("#craft-cue")?.innerText ?? ""`);
const savesBeforeCancel = (await evaluate(cdp, stateExpression())).saves;
await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
await delay(80);
const fanCancelled = await remember(cdp, "fan-prune-cancel");
report.fanCancelAddedSave = fanCancelled.saves !== savesBeforeCancel;
await evaluate(cdp, `(() => {
  const canvas = document.querySelector("canvas");
  canvas.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, pointerId: 42, clientX: ${arm.x}, clientY: ${arm.y}, button: 0, buttons: 1, pointerType: "mouse",
  }));
  window.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, pointerId: 42, clientX: ${arm.x}, clientY: ${arm.y}, button: 0, buttons: 0, pointerType: "mouse",
  }));
})()`);
await delay(150);
const fanCommitted = await remember(cdp, "fan-prune-commit");
await shot(cdp, "fan-prune-commit");
report.fanOrgans = await evaluate(cdp, `(() => {
  const plant = window.__IKEBANA_TEST__.getCanonicalSnapshot().plants[0];
  return {
    organs: plant.organs.length,
    inactive: plant.organs.filter((item) => item.active === false).map((item) => item.id),
    openingLength: plant.branches.find((item) => item.id === "plant-1:arm-opening")?.activeLength ?? null,
  };
})()`);
const fanHash = fanCommitted.hash;
await navigate(cdp, RELOAD);
const fanReloaded = await remember(cdp, "fan-reload");
report.fanReloadMatched = fanReloaded.hash === fanHash;
await shot(cdp, "fan-reload");
await evaluate(cdp, `(() => {
  document.querySelector("#garden-open").click();
  document.querySelector("#garden-name").value = "Lane A fan";
  document.querySelector("#garden-keep-form").requestSubmit();
})()`);
await delay(200);
const cards = await evaluate(cdp, `[...document.querySelectorAll(".garden-card")].map((node) => node.innerText)`);
report.gardenCards = cards;
const fanCard = await evaluate(cdp, `(() => {
  const cards = [...document.querySelectorAll(".garden-card")];
  const card = cards.find((node) => (node.innerText || "").includes("Lane A fan"));
  card?.querySelector(".garden-card-view")?.click();
  return Boolean(card);
})()`);
await delay(200);
const fanViewed = await remember(cdp, "fan-garden-view");
await evaluate(cdp, `(() => {
  document.querySelector("#garden-copy").click();
  const choice = document.querySelector("#garden-choice");
  if (choice && !choice.hidden) document.querySelector("#garden-replace").click();
})()`);
await delay(200);
const fanCopied = await remember(cdp, "fan-garden-copy");
report.fanGarden = { found: fanCard, viewed: fanViewed.hash, copied: fanCopied.hash, kept: fanHash };

cdp.recording = false;
await cdp.send("Page.stopScreencast");
await delay(200);
console.log("frames", cdp.frames.length);
mkdirSync("/tmp/lane-a/frames", { recursive: true });
cdp.frames.forEach((data, index) => {
  writeFileSync(`/tmp/lane-a/frames/frame-${String(index).padStart(4, "0")}.jpg`, Buffer.from(data, "base64"));
});
writeFileSync(`${OUT}/exercise.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  fernLoaded: fernLoaded.hash,
  fernReloadMatched: report.fernReloadMatched,
  fernOrgan,
  fernGarden: report.fernGarden,
  fanLoaded: fanLoaded.hash,
  fanReloadMatched: report.fanReloadMatched,
  fanOrgans: report.fanOrgans,
  fanGarden: report.fanGarden,
  fernPreviewCue: report.fernPreviewCue,
  fanPreviewCue: report.fanPreviewCue,
  fanCancelAddedSave: report.fanCancelAddedSave,
}, null, 2));

await new Promise((resolve, reject) => {
  const child = spawn("ffmpeg", [
    "-y", "-framerate", "12",
    "-i", "/tmp/lane-a/frames/frame-%04d.jpg",
    "-vf", "scale=1280:800",
    "-pix_fmt", "yuv420p",
    `${OUT}/interaction-fern-fan.mp4`,
  ], { stdio: "inherit" });
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)));
});
cdp.close();
