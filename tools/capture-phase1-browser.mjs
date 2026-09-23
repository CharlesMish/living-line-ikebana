/**
 * Fresh headless Chrome evidence for the Phase 1 materials tip.
 * Not a physical-phone session. Desktop emulation is not phone signoff.
 *
 * Serves the already-built dist (vite preview). Requires Chrome remote
 * debugging on port 9222.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const SHA = "f666db8c1b9e46fc9daef05dba09a895844f8e86";
const OUT = "docs/development/reports/phase1-materials";
const PORT = 9222;
const ORIGIN = "http://127.0.0.1:4173";

const CATALOG = [
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
];

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

const report = {
  sha: SHA,
  physicalPhone: "not run",
  shots: [],
  checks: [],
};

function check(name, ok, detail) {
  report.checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${JSON.stringify(detail)}` : ""}`);
}

async function shot(cdp, name, label) {
  await evaluate(cdp, `(() => {
    let el = document.getElementById("phase1-label");
    if (!el) {
      el = document.createElement("div");
      el.id = "phase1-label";
      el.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;pointer-events:none;background:rgba(20,16,12,.82);color:#fff8ee;font:12px/1.35 ui-monospace,monospace;padding:6px 8px;white-space:pre-wrap;";
      document.body.appendChild(el);
    }
    el.textContent = ${JSON.stringify(label)};
  })()`);
  await delay(40);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  const file = `${OUT}/${name}.png`;
  writeFileSync(file, Buffer.from(data, "base64"));
  report.shots.push({ name, file, label });
  console.log("shot", name);
}

async function setViewport(cdp, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
  await delay(250);
}

async function goto(cdp, path) {
  await cdp.send("Page.navigate", { url: `${ORIGIN}${path}` });
  await delay(400);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const ready = await evaluate(cdp, `document.querySelector("#app")?.dataset.ready === "true" && Boolean(window.__IKEBANA_TEST__)`);
    if (ready) return;
    await delay(200);
  }
  throw new Error(`app not ready at ${path}`);
}

async function state(cdp) {
  return evaluate(cdp, `window.__IKEBANA_TEST__.getState()`);
}

async function snapshot(cdp) {
  return evaluate(cdp, `window.__IKEBANA_TEST__.getCanonicalSnapshot()`);
}

async function cue(cdp) {
  return evaluate(cdp, `(() => {
    const node = document.querySelector("#craft-cue");
    return {
      hidden: node ? node.hidden : true,
      title: node?.querySelector("[data-cue-title]")?.textContent ?? "",
      detail: node?.querySelector("[data-cue-detail]")?.textContent ?? "",
    };
  })()`);
}

async function pointer(cdp, type, selector, x, y, buttons) {
  await evaluate(cdp, `(() => {
    const target = ${selector === "window" ? "window" : `document.querySelector(${JSON.stringify(selector)})`};
    if (!target) throw new Error("missing pointer target");
    target.dispatchEvent(new PointerEvent(${JSON.stringify(type)}, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 7,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: ${buttons},
      clientX: ${x},
      clientY: ${y},
    }));
  })()`);
}

async function keyEscape(cdp) {
  await evaluate(cdp, `window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))`);
}

async function settle(cdp) {
  await evaluate(cdp, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))`);
}

function labelFor(viewport, profile, seed, note) {
  return [
    `SHA ${SHA}`,
    `profile ${profile}  seed ${seed}`,
    `viewport ${viewport}`,
    `browser Headless Chrome 148.0.7778.96  SwiftShader`,
    note,
    "physical phone: not run",
  ].join("\n");
}

async function openMaterials(cdp) {
  const open = await evaluate(cdp, `document.querySelector("#material-options")?.hidden === false`);
  if (!open) {
    await evaluate(cdp, `document.querySelector("#materials-toggle").click()`);
    await delay(80);
  }
}

async function materialsMetrics(cdp) {
  return evaluate(cdp, `(() => {
    const panel = document.querySelector("#material-options");
    const choices = [...document.querySelectorAll("[data-material-choice]")].map((button) => button.dataset.materialChoice);
    const last = document.querySelector('[data-material-choice="nodding-flower"]');
    const lastBox = last.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    return {
      choices,
      hidden: panel.hidden,
      scrollHeight: panel.scrollHeight,
      clientHeight: panel.clientHeight,
      scrollTop: panel.scrollTop,
      lastInView: lastBox.top >= panelBox.top - 1 && lastBox.bottom <= panelBox.bottom + 1,
      source: document.querySelector("[data-material-id]")?.dataset.materialId ?? null,
      sourceName: document.querySelector(".material-name")?.textContent ?? null,
    };
  })()`);
}

async function loadFixture(cdp, material, count, seed = 8278) {
  await evaluate(cdp, `(() => {
    document.querySelector("#workbench-open").click();
    const select = document.querySelector("#workbench-material");
    select.value = ${JSON.stringify(material)};
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#workbench-seed").value = ${JSON.stringify(String(seed))};
    document.querySelector("#workbench-count").value = ${JSON.stringify(String(count))};
    document.querySelector("#workbench-form").requestSubmit();
  })()`);
  await delay(500);
  await settle(cdp);
}

function plantSummary(snap) {
  return {
    ordinal: snap.successfulPlantOrdinal,
    plants: snap.plants.map((plant) => ({
      id: plant.id,
      seed: plant.seed,
      generatorVersion: plant.generatorVersion,
      branches: plant.branches.length,
      organs: plant.organs.length,
      activeBranches: plant.branches.filter((branch) => branch.active).map((branch) => ({
        id: branch.id,
        kind: branch.kind,
        activeLength: branch.activeLength,
        rest: branch.restLengths.reduce((sum, length) => sum + length, 0),
      })),
      inactiveBranchIds: plant.branches.filter((branch) => !branch.active).map((branch) => branch.id),
      activeOrgans: plant.organs.filter((organ) => organ.active).map((organ) => organ.id),
      inactiveOrgans: plant.organs.filter((organ) => !organ.active).map((organ) => organ.id),
    })),
  };
}

async function findCue(cdp, predicate, origin, span) {
  const found = [];
  await pointer(cdp, "pointermove", '[data-testid="scene-canvas"]', origin.x, origin.y, 0);
  const originCue = await cue(cdp);
  if (predicate(originCue)) return [{ x: origin.x, y: origin.y, ...originCue }];
  for (let y = origin.y - span.up; y <= origin.y + span.down; y += span.step) {
    for (let x = origin.x - span.left; x <= origin.x + span.right; x += span.step) {
      await pointer(cdp, "pointermove", '[data-testid="scene-canvas"]', x, y, 0);
      const current = await cue(cdp);
      if (predicate(current)) found.push({ x, y, ...current });
      if (found.length >= 1) return found;
    }
  }
  return found;
}

async function probePrune(cdp, x, y) {
  const before = await state(cdp);
  await pointer(cdp, "pointerdown", '[data-testid="scene-canvas"]', x, y, 1);
  await settle(cdp);
  const live = await state(cdp);
  const current = await cue(cdp);
  await keyEscape(cdp);
  await settle(cdp);
  const after = await state(cdp);
  return {
    x,
    y,
    branchId: live.transaction?.branchId ?? null,
    operation: live.transaction?.operation ?? null,
    materialDistance: live.transaction?.materialDistance ?? null,
    cue: current,
    cancelled: after.transaction === null && after.canonicalHash === before.canonicalHash,
  };
}

mkdirSync(OUT, { recursive: true });
const cdp = await connect();
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
const version = await cdp.send("Browser.getVersion");
report.browser = version;

await setViewport(cdp, 1280, 800);
await goto(cdp, "/?fresh=1&test=1");
await evaluate(cdp, `localStorage.clear()`);
await goto(cdp, "/?fresh=1&test=1");
const environment = await evaluate(cdp, `(() => {
  const canvas = document.querySelector("canvas");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  const rect = canvas.getBoundingClientRect();
  return {
    userAgent: navigator.userAgent,
    webgl: Boolean(gl),
    renderer: gl ? gl.getParameter(gl.RENDERER) : null,
    inner: { width: innerWidth, height: innerHeight },
    canvas: { left: rect.left, top: rect.top, width: rect.width, height: rect.height, bufferWidth: canvas.width, bufferHeight: canvas.height },
    dpr: devicePixelRatio,
  };
})()`);
report.environment = environment;
check("webgl", environment.webgl, environment);

const portrait = "390x844";
await setViewport(cdp, 390, 844);
await delay(200);
await openMaterials(cdp);
let metrics = await materialsMetrics(cdp);
check("portrait catalog order", JSON.stringify(metrics.choices) === JSON.stringify(CATALOG), metrics.choices);
check("portrait panel scrolls", metrics.scrollHeight > metrics.clientHeight, {
  scrollHeight: metrics.scrollHeight,
  clientHeight: metrics.clientHeight,
});
await shot(cdp, "materials-portrait-390x844-open", labelFor(portrait, "player-empty", "none", "Materials open, top of list. Selection has not inserted."));
await evaluate(cdp, `document.querySelector("#material-options").scrollTop = document.querySelector("#material-options").scrollHeight`);
await delay(80);
metrics = await materialsMetrics(cdp);
check("portrait last material reachable", metrics.lastInView, metrics);
await shot(cdp, "materials-portrait-390x844-scrolled-nodding", labelFor(portrait, "player-empty", "none", "Scrolled to nodding-flower, the last catalog row."));
const beforeSelect = await snapshot(cdp);
await evaluate(cdp, `document.querySelector('[data-material-choice="nodding-flower"]').click()`);
await delay(80);
metrics = await materialsMetrics(cdp);
const afterSelect = await snapshot(cdp);
check("portrait select does not insert", afterSelect.plants.length === 0 && afterSelect.successfulPlantOrdinal === 0 && metrics.source === "nodding-flower", {
  source: metrics.source,
  plants: afterSelect.plants.length,
  ordinal: afterSelect.successfulPlantOrdinal,
  hashChanged: JSON.stringify(beforeSelect) !== JSON.stringify(afterSelect),
});
await shot(cdp, "materials-portrait-390x844-nodding-selected", labelFor(portrait, "player-empty", "none", "Nodding flower selected. Bowl still empty."));

const landscape = "844x360";
await setViewport(cdp, 844, 360);
await delay(200);
await openMaterials(cdp);
metrics = await materialsMetrics(cdp);
check("landscape catalog order", JSON.stringify(metrics.choices) === JSON.stringify(CATALOG), metrics.choices);
check("landscape panel scrolls", metrics.scrollHeight > metrics.clientHeight, {
  scrollHeight: metrics.scrollHeight,
  clientHeight: metrics.clientHeight,
});
await shot(cdp, "materials-landscape-844x360-open", labelFor(landscape, "player-empty", "none", "Short landscape. Materials open."));
await evaluate(cdp, `document.querySelector("#material-options").scrollTop = document.querySelector("#material-options").scrollHeight`);
await delay(80);
metrics = await materialsMetrics(cdp);
check("landscape last material reachable", metrics.lastInView, metrics);
await shot(cdp, "materials-landscape-844x360-scrolled-nodding", labelFor(landscape, "player-empty", "none", "Scrolled to the last material in a short landscape window."));
await evaluate(cdp, `document.querySelector('[data-material-choice="leafy-shoot"]').click()`);
await delay(80);
metrics = await materialsMetrics(cdp);
const afterLeafy = await snapshot(cdp);
check("landscape select does not insert", metrics.source === "leafy-shoot" && afterLeafy.plants.length === 0, metrics.source);
await shot(cdp, "materials-landscape-844x360-leafy-selected", labelFor(landscape, "player-empty", "none", "Leafy shoot selected. Nothing was inserted."));

await setViewport(cdp, 1280, 800);
await delay(200);
const wide = "1280x800";
await openMaterials(cdp);
await evaluate(cdp, `document.querySelector("#material-options").scrollTop = document.querySelector("#material-options").scrollHeight`);
await delay(60);
await shot(cdp, "materials-1280x800-scrolled-nodding", labelFor(wide, "player-empty", "none", "Wide viewport, list scrolled to nodding-flower."));
await evaluate(cdp, `document.querySelector('[data-material-choice="flowering-branch"]').click()`);
await delay(80);

const sourceBox = await evaluate(cdp, `(() => {
  const rect = document.querySelector('[data-testid="material-source"]').getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
})()`);
const beforeInsert = await snapshot(cdp);
await pointer(cdp, "pointerdown", '[data-testid="material-source"]', sourceBox.x, sourceBox.y, 1);
let validPoint = null;
for (let y = 520; y >= 360 && !validPoint; y -= 20) {
  for (let x = 520; x <= 760 && !validPoint; x += 40) {
    await pointer(cdp, "pointermove", '[data-testid="scene-canvas"]', x, y, 1);
    const status = await evaluate(cdp, `document.querySelector("#status")?.textContent ?? ""`);
    if (status.includes("Over the pins")) validPoint = { x, y, status };
  }
}
check("insert preview can reach the pins", Boolean(validPoint), validPoint);
if (validPoint) {
  await shot(cdp, "insert-preview-over-pins", labelFor(wide, "player", "pending-8278", "Insertion preview over the pins. Not yet released."));
  await pointer(cdp, "pointermove", '[data-testid="scene-canvas"]', 40, 40, 1);
  await pointer(cdp, "pointerup", "window", 40, 40, 0);
  await settle(cdp);
  const cancelled = await snapshot(cdp);
  check("invalid insert commits nothing", cancelled.plants.length === 0 && cancelled.successfulPlantOrdinal === beforeInsert.successfulPlantOrdinal, plantSummary(cancelled));
  await shot(cdp, "insert-cancelled", labelFor(wide, "player-empty", "none", "Invalid release. Bowl empty. Ordinal unchanged."));
  await pointer(cdp, "pointerdown", '[data-testid="material-source"]', sourceBox.x, sourceBox.y, 1);
  await pointer(cdp, "pointermove", '[data-testid="scene-canvas"]', validPoint.x, validPoint.y, 1);
  await pointer(cdp, "pointerup", "window", validPoint.x, validPoint.y, 0);
  await settle(cdp);
}
const seated = await snapshot(cdp);
check("valid insert seats plant-1", seated.plants.length === 1 && seated.plants[0].id === "plant-1" && seated.plants[0].generatorVersion === "one-branch-v1" && seated.plants[0].seed === 8278 && seated.successfulPlantOrdinal === 1, plantSummary(seated));
await shot(cdp, "insert-committed-front", labelFor(wide, "player flowering-branch", "8278", "Committed insert. Front."));

const stockBefore = JSON.stringify(seated.plants[0].branches.map((branch) => [branch.id, branch.restLengths]));
const hashBeforeAim = (await state(cdp)).canonicalHash;
const targets = await evaluate(cdp, `window.__IKEBANA_TEST__.getScreenTargets()`);
const trunk = targets.find((target) => target.branchId.endsWith(":trunk") || target.role === "branch");
check("screen target for aim", Boolean(trunk), trunk);
if (trunk) {
  await pointer(cdp, "pointerdown", '[data-testid="scene-canvas"]', trunk.x, trunk.y + 30, 1);
  await pointer(cdp, "pointermove", '[data-testid="scene-canvas"]', trunk.x + 80, trunk.y - 40, 1);
  await settle(cdp);
  const aiming = await state(cdp);
  check("aim acquires", aiming.transaction?.operation === "aim", aiming.transaction);
  await shot(cdp, "aim-preview", labelFor(wide, "player flowering-branch", "8278", "Aim preview held. Not released."));
  await keyEscape(cdp);
  await settle(cdp);
  const afterCancel = await state(cdp);
  check("aim cancel restores", afterCancel.transaction === null && afterCancel.canonicalHash === hashBeforeAim, {
    hash: afterCancel.canonicalHash,
    before: hashBeforeAim,
  });
  await shot(cdp, "aim-cancelled", labelFor(wide, "player flowering-branch", "8278", "Escape cancelled the aim. Graph unchanged."));
  await pointer(cdp, "pointerdown", '[data-testid="scene-canvas"]', trunk.x, trunk.y + 30, 1);
  await pointer(cdp, "pointermove", '[data-testid="scene-canvas"]', trunk.x + 70, trunk.y - 30, 1);
  await pointer(cdp, "pointerup", "window", trunk.x + 70, trunk.y - 30, 0);
  await settle(cdp);
  const aimed = await snapshot(cdp);
  const stockAfterAim = JSON.stringify(aimed.plants[0].branches.map((branch) => [branch.id, branch.restLengths]));
  check("aim commit preserves stock", stockAfterAim === stockBefore && aimed.successfulPlantOrdinal === 1, {
    hashChanged: (await state(cdp)).canonicalHash !== hashBeforeAim,
  });
  await shot(cdp, "aim-committed", labelFor(wide, "player flowering-branch", "8278", "Aim released. Stock lengths unchanged."));
}

const hashBeforeBend = (await state(cdp)).canonicalHash;
const bendTargets = await evaluate(cdp, `window.__IKEBANA_TEST__.getScreenTargets()`);
const bendTrunk = bendTargets.find((target) => String(target.branchId).endsWith(":trunk")) ?? trunk;
const bendHits = await findCue(
  cdp,
  (current) => current.title.startsWith("Bend "),
  bendTrunk ?? { x: 640, y: 420 },
  { left: 48, right: 48, up: 48, down: 48, step: 8 },
);
check("bend bead is hoverable", bendHits.length > 0, bendHits[0] ?? null);
if (bendHits[0]) {
  const bend = bendHits[0];
  await pointer(cdp, "pointerdown", '[data-testid="scene-canvas"]', bend.x, bend.y, 1);
  await pointer(cdp, "pointermove", '[data-testid="scene-canvas"]', bend.x + 90, bend.y + 20, 1);
  await settle(cdp);
  const bending = await state(cdp);
  check("bend acquires", bending.transaction?.operation === "bend", bending.transaction);
  await shot(cdp, "bend-preview", labelFor(wide, "player flowering-branch", "8278", "Bend preview held."));
  await keyEscape(cdp);
  await settle(cdp);
  const bentCancel = await state(cdp);
  check("bend cancel restores", bentCancel.transaction === null && bentCancel.canonicalHash === hashBeforeBend, bentCancel.canonicalHash);
  await shot(cdp, "bend-cancelled", labelFor(wide, "player flowering-branch", "8278", "Escape cancelled the bend."));
  await pointer(cdp, "pointerdown", '[data-testid="scene-canvas"]', bend.x, bend.y, 1);
  await pointer(cdp, "pointermove", '[data-testid="scene-canvas"]', bend.x - 70, bend.y + 30, 1);
  await pointer(cdp, "pointerup", "window", bend.x - 70, bend.y + 30, 0);
  await settle(cdp);
  const bent = await snapshot(cdp);
  const stockAfterBend = JSON.stringify(bent.plants[0].branches.map((branch) => [branch.id, branch.restLengths]));
  check("bend commit preserves stock", stockAfterBend === stockBefore && bent.successfulPlantOrdinal === 1, {
    hashChanged: (await state(cdp)).canonicalHash !== hashBeforeBend,
  });
  await shot(cdp, "bend-committed", labelFor(wide, "player flowering-branch", "8278", "Bend released. Stock lengths unchanged."));
}

const playerHash = (await state(cdp)).canonicalHash;
const playerStorage = await evaluate(cdp, `localStorage.getItem("ikebana-web-alpha:studio-v1")`);
await goto(cdp, "/?test=1");
const reloaded = await state(cdp);
const reloadedSnap = await snapshot(cdp);
check("player reload keeps the committed bowl", reloaded.canonicalHash === playerHash && reloadedSnap.plants[0]?.generatorVersion === "one-branch-v1", {
  hash: reloaded.canonicalHash,
  expected: playerHash,
});
await shot(cdp, "player-reload-front", labelFor(wide, "player flowering-branch", "8278", "Reloaded without fresh=1. Committed aim and bend remain."));

await setViewport(cdp, 1280, 800);
await goto(cdp, "/?workbench=1&fresh=1&test=1");
const playerStorageDuringWorkbench = await evaluate(cdp, `localStorage.getItem("ikebana-web-alpha:studio-v1")`);
check("workbench does not rewrite the player bowl", playerStorageDuringWorkbench === playerStorage, {
  same: playerStorageDuringWorkbench === playerStorage,
});

await loadFixture(cdp, "foliage-fan", 1, 8278);
let fan = await snapshot(cdp);
check("foliage-fan fixture", fan.plants.length === 1 && fan.plants[0].generatorVersion === "foliage-fan-v1" && fan.plants[0].seed === 8278, plantSummary(fan));
const intactHash = (await state(cdp)).canonicalHash;
const intactSummary = plantSummary(fan);
await shot(cdp, "fan-intact-front", labelFor(wide, "foliage-fan", "8278", "Intact foliage fan. Front. Workbench fixture."));
await evaluate(cdp, `document.querySelector('[data-testid="view-three-quarter"]').click()`);
await delay(250);
await shot(cdp, "fan-intact-three-quarter", labelFor(wide, "foliage-fan", "8278", "Intact foliage fan. Three-quarter."));
await evaluate(cdp, `document.querySelector('[data-testid="view-front"]').click()`);
await delay(200);
await evaluate(cdp, `document.querySelector('[data-testid="tool-prune"]').click()`);
await delay(80);

const fanTargets = await evaluate(cdp, `window.__IKEBANA_TEST__.getScreenTargets()`);
const armTarget = fanTargets.find((target) => String(target.branchId).endsWith(":arm-opening"));
check("opening arm has a screen target", Boolean(armTarget), armTarget);
await pointer(cdp, "pointermove", '[data-testid="scene-canvas"]', armTarget.x, armTarget.y, 0);
const midCue = await cue(cdp);
report.openingArmMidpointFront = { ...armTarget, cue: midCue };
check("front midpoint of the opening arm is not the arm cut", midCue.title !== "Cut branch" || !midCue.detail.includes("3 leaves"), midCue);

const leafProbe = await probePrune(cdp, armTarget.x, armTarget.y);
const armProbes = [];
for (const offset of [
  [-23, 17], [-16, 12], [-33, 25], [-28, 20], [-20, 15], [-12, 9], [-36, 28], [-8, 6],
]) {
  const probe = await probePrune(cdp, armTarget.x + offset[0], armTarget.y + offset[1]);
  armProbes.push(probe);
  if (probe.branchId?.endsWith(":arm-opening") && probe.cancelled) break;
}
const openingProbe = armProbes.find((probe) => probe.branchId?.endsWith(":arm-opening") && probe.cancelled);
report.armAcquisition = { midpoint: leafProbe, probes: armProbes };
check("front midpoint acquires the leaf stalk, not the arm", leafProbe.branchId?.endsWith(":petiole-opening-1") && leafProbe.cancelled, leafProbe);
check("ordinary pointer can acquire the opening arm", Boolean(openingProbe), openingProbe ?? armProbes);

async function previewAt(point, name, note) {
  await pointer(cdp, "pointermove", '[data-testid="scene-canvas"]', point.x, point.y, 0);
  await settle(cdp);
  const current = await cue(cdp);
  const live = await state(cdp);
  await shot(cdp, name, labelFor(wide, "foliage-fan", "8278", note));
  return { cue: current, hash: live.canonicalHash, transaction: live.transaction };
}

if (openingProbe) {
  const armHits = [openingProbe];
  const first = await previewAt(armHits[0], "fan-preview-front", `Prune hover on opening arm at ${Math.round(armHits[0].x)},${Math.round(armHits[0].y)}. Preview only.`);
  check("front arm preview names the branch and three leaves", first.cue.title === "Cut branch" && first.cue.detail.includes("3 leaves") && first.transaction === null && first.hash === intactHash, first.cue);
  await evaluate(cdp, `document.querySelector('[data-testid="scene-canvas"]').dispatchEvent(new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" }))`);
  await settle(cdp);
  const cleared = await cue(cdp);
  const clearedState = await state(cdp);
  check("leaving the arm clears the preview", cleared.hidden && clearedState.canonicalHash === intactHash && clearedState.transaction === null, cleared);
  await shot(cdp, "fan-preview-cancelled-front", labelFor(wide, "foliage-fan", "8278", "Pointer left the arm. Preview cleared. Graph unchanged."));
  const second = await previewAt(armHits[0], "fan-preview-again-front", "Second prune hover on the same opening-arm point.");
  check("second front preview matches", second.cue.title === "Cut branch" && second.hash === intactHash, second.cue);
  await evaluate(cdp, `document.querySelector('[data-testid="view-three-quarter"]').click()`);
  await delay(200);
  const quarterTargets = await evaluate(cdp, `window.__IKEBANA_TEST__.getScreenTargets()`);
  const quarterArm = quarterTargets.find((target) => String(target.branchId).endsWith(":arm-opening"));
  const quarterProbe = await probePrune(cdp, quarterArm.x, quarterArm.y);
  const quarterHits = quarterProbe.branchId?.endsWith(":arm-opening") ? [quarterProbe] : [];
  report.armAcquisition.threeQuarter = quarterProbe;
  check("three-quarter pointer can preview the opening arm", quarterHits.length > 0, quarterProbe);
  if (quarterHits[0]) {
    const quarter = await previewAt(quarterHits[0], "fan-preview-three-quarter", "Three-quarter hover on the opening arm midpoint. This station is farther along the arm than the front basal cut.");
    check("three-quarter preview is still the arm", quarter.cue.title === "Cut branch" && quarter.hash === intactHash && quarterProbe.branchId.endsWith(":arm-opening"), quarter.cue);
    await evaluate(cdp, `document.querySelector('[data-testid="scene-canvas"]').dispatchEvent(new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" }))`);
    await settle(cdp);
    const quarterCleared = await state(cdp);
    check("three-quarter preview cancel restores the fan", quarterCleared.canonicalHash === intactHash && quarterCleared.transaction === null, quarterCleared.canonicalHash);
    await shot(cdp, "fan-preview-cancelled-three-quarter", labelFor(wide, "foliage-fan", "8278", "Three-quarter preview cleared. Graph unchanged."));
  }
  await evaluate(cdp, `document.querySelector('[data-testid="view-front"]').click()`);
  await delay(180);
  await pointer(cdp, "pointerdown", '[data-testid="scene-canvas"]', armHits[0].x, armHits[0].y, 1);
  await settle(cdp);
  const acquired = await state(cdp);
  const acquiredCue = await cue(cdp);
  check("pointerdown acquires the opening arm", acquired.transaction?.operation === "prune" && acquired.transaction?.branchId?.endsWith(":arm-opening"), {
    transaction: acquired.transaction,
    cue: acquiredCue,
  });
  await shot(cdp, "fan-acquired-preview-front", labelFor(wide, "foliage-fan", "8278", "Pointer held on the opening arm. Release will commit this cut."));
  if (acquired.transaction?.branchId?.endsWith(":arm-opening")) {
    await pointer(cdp, "pointerup", "window", armHits[0].x, armHits[0].y, 0);
    await settle(cdp);
    fan = await snapshot(cdp);
    const summary = plantSummary(fan);
    const opening = summary.plants[0].activeBranches.find((branch) => branch.id.endsWith(":arm-opening"));
    const answering = summary.plants[0].activeBranches.find((branch) => branch.id.endsWith(":arm-answering"));
    const crown = summary.plants[0].activeBranches.find((branch) => branch.id.endsWith(":arm-crown"));
    const inactive = summary.plants[0].inactiveBranchIds;
    check("committed arm cut keeps history and the other arms", Boolean(opening) && opening.activeLength < 0.55 && answering && crown && inactive.some((id) => id.endsWith(":petiole-opening-1")) && summary.plants[0].inactiveOrgans.filter((id) => id.includes("opening")).length === 3 && summary.plants[0].branches === intactSummary.plants[0].branches, summary);
    await evaluate(cdp, `document.querySelector('[data-testid="view-front"]').click()`);
    await delay(150);
    await shot(cdp, "fan-committed-front", labelFor(wide, "foliage-fan", "8278", "Committed opening-arm cut. Front."));
    await evaluate(cdp, `document.querySelector('[data-testid="view-three-quarter"]').click()`);
    await delay(200);
    await shot(cdp, "fan-committed-three-quarter", labelFor(wide, "foliage-fan", "8278", "Committed opening-arm cut. Three-quarter."));
    const committedHash = (await state(cdp)).canonicalHash;
    await goto(cdp, "/?workbench=1&test=1");
    const reloadedFan = await snapshot(cdp);
    const reloadedState = await state(cdp);
    check("fan reload keeps the committed arm cut", reloadedState.canonicalHash === committedHash && reloadedFan.plants[0].generatorVersion === "foliage-fan-v1", {
      hash: reloadedState.canonicalHash,
      expected: committedHash,
    });
    await evaluate(cdp, `document.querySelector('[data-testid="view-front"]').click()`);
    await delay(150);
    await shot(cdp, "fan-reload-front", labelFor(wide, "foliage-fan", "8278", "Reloaded workbench save. Opening-arm cut remains."));
    await evaluate(cdp, `document.querySelector('[data-testid="view-three-quarter"]').click()`);
    await delay(200);
    await shot(cdp, "fan-reload-three-quarter", labelFor(wide, "foliage-fan", "8278", "Reloaded workbench save. Three-quarter."));
    report.fanCommitted = plantSummary(reloadedFan);
  } else {
    await keyEscape(cdp);
    check("did not commit a non-arm target", false, acquired.transaction);
  }
}

const one = "one-branch-v1";
const leafy = "leafy-shoot-v1";
const bare = "bare-branch-v1";
const single = "single-flower-v1";
const reed = "reed-v1";
const volume = "flower-volume-v1";
const trailer = "arching-trailer-v1";
const fanVersion = "foliage-fan-v1";
const spray = "blossom-spray-v1";
const nodding = "nodding-flower-v1";
const profiles = [
  ["reference-pair", 2, [one, leafy]],
  ["reference-pair", 6, [one, leafy, one, leafy, one, leafy]],
  ["all-four", 6, [one, leafy, bare, single, one, leafy]],
  ["round3-three", 6, [reed, volume, trailer, reed, volume, trailer]],
  ["round3-palette", 6, [one, leafy, bare, single, reed, volume]],
  ["round4-candidates", 6, [fanVersion, spray, nodding, fanVersion, spray, nodding]],
  ["round4-palette", 6, [one, leafy, bare, single, reed, volume]],
  ["round4-palette", 12, [one, leafy, bare, single, reed, volume, trailer, fanVersion, spray, nodding, one, leafy]],
  ["references-plus-foliage-fan", 6, [one, leafy, fanVersion, one, leafy, fanVersion]],
  ["blossom-compare", 6, [one, volume, spray, one, volume, spray]],
  ["references-plus-nodding-flower", 6, [one, leafy, nodding, one, leafy, nodding]],
];
const picker = await evaluate(cdp, `[...document.querySelectorAll("#workbench-material option")].map((option) => ({ id: option.value, disabled: option.disabled, label: option.textContent }))`);
report.workbenchPicker = picker;
check("mixed is not a separate picker row", !picker.some((option) => option.id === "mixed"), picker.map((option) => option.id));
check("named round profiles are listed", ["reference-pair", "all-four", "round3-three", "round3-palette", "round4-candidates", "round4-palette", "references-plus-foliage-fan", "blossom-compare"].every((id) => picker.some((option) => option.id === id)));

for (const [id, count, expected] of profiles) {
  await loadFixture(cdp, id, count, 8278);
  const snap = await snapshot(cdp);
  const versions = [...snap.plants]
    .sort((left, right) => Number(left.id.split("-")[1]) - Number(right.id.split("-")[1]))
    .map((plant) => plant.generatorVersion);
  check(`profile ${id} x${count}`, JSON.stringify(versions) === JSON.stringify(expected), versions);
  if (id === "round4-palette" && count === 12) {
    await evaluate(cdp, `document.querySelector('[data-testid="view-front"]').click()`);
    await delay(150);
    await shot(cdp, "profile-round4-palette-count12-front", labelFor(wide, "round4-palette", "8278", "Count 12. Two flowering, two leafy, and one of each other material, in cycle order."));
  }
  if (id === "round4-candidates" && count === 6) {
    await evaluate(cdp, `document.querySelector('[data-testid="view-front"]').click()`);
    await delay(150);
    await shot(cdp, "profile-round4-candidates-count6-front", labelFor(wide, "round4-candidates", "8278", "Count 6. Two of foliage fan, blossom spray, and nodding flower."));
  }
}
await loadFixture(cdp, "reference-pair", 2, 8278);
await shot(cdp, "profile-reference-pair-count2-front", labelFor(wide, "reference-pair", "8278", "reference-pair remains flowering branch then leafy shoot."));

const playerBeforeGarden = await evaluate(cdp, `localStorage.getItem("ikebana-web-alpha:studio-v1")`);
const playerGardenBefore = await evaluate(cdp, `localStorage.getItem("ikebana-web-alpha:garden-v1")`);
await evaluate(cdp, `(() => {
  document.querySelector("#garden-open").click();
  document.querySelector("#garden-name").value = "phase1 workbench only";
  document.querySelector("#garden-keep-form").requestSubmit();
})()`);
await delay(300);
const keys = await evaluate(cdp, `({
  player: localStorage.getItem("ikebana-web-alpha:studio-v1"),
  playerGarden: localStorage.getItem("ikebana-web-alpha:garden-v1"),
  workbench: localStorage.getItem("ikebana-web-alpha:workbench-studio-v1"),
  workbenchGarden: localStorage.getItem("ikebana-web-alpha:workbench-garden-v1"),
})`);
check("garden keep stays in the workbench namespace", keys.player === playerBeforeGarden && keys.playerGarden === playerGardenBefore && keys.workbenchGarden && keys.workbenchGarden.includes("phase1 workbench only"), {
  playerUnchanged: keys.player === playerStorage,
  playerGardenUnchanged: keys.playerGarden === playerGardenBefore,
  workbenchGarden: Boolean(keys.workbenchGarden),
});
await shot(cdp, "workbench-garden-keep", labelFor(wide, "reference-pair", "8278", "Garden keep from the workbench. Player storage is a different key."));

await goto(cdp, "/?test=1");
const returned = await snapshot(cdp);
check("returning to the player studio keeps the player bowl", returned.plants[0]?.generatorVersion === "one-branch-v1" && returned.plants.length === 1, plantSummary(returned));
await shot(cdp, "player-bowl-after-workbench", labelFor(wide, "player flowering-branch", "8278", "Back on the player studio. Workbench Garden did not replace this bowl."));

report.failed = report.checks.filter((item) => !item.ok).length;
writeFileSync(`${OUT}/capture-report.json`, JSON.stringify(report, null, 2));
console.log(`done failed=${report.failed} shots=${report.shots.length}`);
process.exit(report.failed ? 1 : 0);
