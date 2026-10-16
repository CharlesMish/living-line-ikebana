/** Isolated renderer regression, not a player or phone-performance study.
 * Bundle the actual production adapter into a disposable page. The harness may
 * inspect private renderer objects; no test setter or mutation hook ships in app.
 * A same-renderer counterfactual toggles only zero-opacity picking materials.
 * Existing rendered-evidence cases cover app input, tones, Undo and Garden.
 */
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const harness = `
import * as THREE from "three";
import { ThreeStudio } from "./src/presentation/ThreeStudio.ts";
import { getMaterialDefinition } from "./src/core/materialCatalog.ts";
import { aimBranch, bendBranchAtFraction } from "./src/core/edit.ts";
import { sampleBranch } from "./src/core/arcLength.ts";
import { previewPrune, applyPrune } from "./src/core/prune.ts";
const check = (value, message) => { if (!value) throw new Error(message); };
const materials = ["flowering-branch", "berry-twig", "fern-frond", "lobed-leaf", "broad-blade"];
const graphs = materials.map((id, i) => getMaterialDefinition(id).generator.generate(
  "probe-" + i, 8278 + i * 977, { x: (i - 2) * .43, y: .55, z: (i % 2) * .3 }));
const canvas = document.querySelector("canvas");
const studio = new ThreeStudio(canvas, { maxPixelRatio: 1 });
studio.setGraphs(graphs);
const selection = { plantId: graphs[0].id, branchId: graphs[0].rootBranchId };
studio.setSelection(selection);
studio.setShapeAffordances({ visible: true, bendVariant: "bead", transactionActive: false });
const hitMeshes = current => {
  const hits = [current.baseHandle.hit, current.bendHandle.hit];
  for (const plant of current.plants.values()) {
    for (const branch of plant.branches.values()) hits.push(branch.hit);
    for (const organ of plant.organs.values()) hits.push(organ.hit);
  }
  return hits;
};
const rgba = current => {
  current.renderNow();
  const gl = current.renderer.getContext(), bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  check(gl.getError() === gl.NO_ERROR, "Framebuffer read has no GL error");
  check(bytes.some((v, i) => i % 4 !== 3 && v > 0), "Framebuffer contains actual colour");
  return bytes;
};
const pixelDifference = (a, b) => {
  check(a.length === b.length, "Framebuffer sizes match");
  let changed = 0, maximum = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { changed++; maximum = Math.max(maximum, Math.abs(a[i] - b[i])); }
  return { changedChannels: changed, maximumChannelDifference: maximum };
};
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
const coordinateFor = (mesh, stableId) => {
  // Read actual mesh triangle centres rather than guess screen positions.
  mesh.updateWorldMatrix(true, false);
  const positions = mesh.geometry.getAttribute("position"), index = mesh.geometry.getIndex();
  const count = index?.count ?? positions.count;
  for (let i = 0; i + 2 < count; i += Math.max(3, Math.floor(count / 240 / 3) * 3)) {
    const point = new THREE.Vector3();
    for (let j = 0; j < 3; j++) point.add(new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j));
    point.multiplyScalar(1 / 3).applyMatrix4(mesh.matrixWorld);
    const projected = studio.projectPoint(point);
    if (!projected.visible || projected.clientX < 0 || projected.clientX > 1100 || projected.clientY < 0 || projected.clientY > 850) continue;
    const hits = studio.collectHitCandidates(projected.clientX, projected.clientY);
    if (hits[0]?.stableId === stableId) return { x: projected.clientX, y: projected.clientY, stableId };
  }
  throw new Error("No visible sampled acquisition for " + stableId);
};
window.runRenderEfficiency = async expectOptimized => {
  const hits = hitMeshes(studio);
  check(hits.length > 30, "Five-material fixture has substantial proxy coverage");
  check(hits.every(mesh => mesh.material.opacity === 0), "All tested proxy materials are zero opacity");
  const defaultsHidden = hits.every(mesh => !mesh.material.visible);
  if (expectOptimized) check(defaultsHidden, "Normal hit materials start excluded from rendering");
  const firstPlant = studio.plants.get(graphs[0].id), lobedPlant = studio.plants.get(graphs[3].id);
  const broadPlant = studio.plants.get(graphs[4].id);
  const flower = Array.from(graphs[0].organs.values()).find(organ => organ.kind === "bloom");
  const leaf = Array.from(graphs[3].organs.values()).find(organ => organ.kind === "leaf");
  const targets = [
    { role: "branch", ...coordinateFor(firstPlant.branches.get(graphs[0].rootBranchId).hit, graphs[0].rootBranchId) },
    { role: "flower-proxy", ...coordinateFor(firstPlant.organs.get(flower.id).hit, flower.id) },
    { role: "exact-lobed-leaf", ...coordinateFor(lobedPlant.organs.get(leaf.id).hit, leaf.id) },
    { role: "exact-broad-blade", ...coordinateFor(broadPlant.branches.get(graphs[4].rootBranchId).blade.mesh, graphs[4].rootBranchId) },
  ];
  const picks = () => targets.map(target => ({ role: target.role, expected: target.stableId,
    candidates: studio.collectHitCandidates(target.x, target.y) }));
  hits.forEach(mesh => { mesh.material.visible = true; });
  const legacyPixels = rgba(studio), legacy = studio.getRendererStats(), legacyPicks = picks();
  hits.forEach(mesh => { mesh.material.visible = false; });
  const optimizedPixels = rgba(studio), optimized = studio.getRendererStats(), optimizedPicks = picks();
  const pixels = pixelDifference(legacyPixels, optimizedPixels);
  check(pixels.changedChannels === 0, "Excluding transparent proxies preserves every framebuffer channel");
  check(JSON.stringify(legacyPicks) === JSON.stringify(optimizedPicks), "Branch, bloom and exact leaf picking are identical");
  check(optimized.calls < legacy.calls, "Hidden materials actually remove draw calls");
  const checks = { defaultsHidden, proxyMeshes: hits.length, legacy, optimized, savedCalls: legacy.calls - optimized.calls,
    pixels, pixelSHA256: await digest(optimizedPixels), picks: optimizedPicks, targets, stages: [] };

  // Rebuild the same current graphs in a fresh adapter: stale signatures,
  // material state or buffers cannot hide behind a correct canonical graph.
  const matchFresh = (label, currentGraphs, tones) => {
    const referenceCanvas = document.createElement("canvas");
    referenceCanvas.style.cssText = "position:absolute;inset:0;width:1100px;height:850px;opacity:0;pointer-events:none";
    document.body.append(referenceCanvas);
    const reference = new ThreeStudio(referenceCanvas, { maxPixelRatio: 1, botanicalTones: tones });
    try {
      reference.setGraphs(currentGraphs); reference.setSelection(selection);
      reference.setShapeAffordances({ visible: true, bendVariant: "bead", transactionActive: false });
      hitMeshes(reference).forEach(mesh => { mesh.material.visible = false; });
      const delta = pixelDifference(rgba(studio), rgba(reference));
      check(delta.changedChannels === 0, label + " matches a fresh adapter exactly: " + JSON.stringify(delta));
      checks.stages.push({ label, ...delta, stats: studio.getRendererStats() });
    } finally { reference.dispose(); referenceCanvas.remove(); }
  };
  const source = graphs[0], branch = source.branches.get(source.rootBranchId), grabbed = sampleBranch(branch, branch.activeLength * .7).position;
  let current = graphs;
  for (let i = 1; i <= 12; i++) {
    current = [aimBranch(source, branch.id, grabbed, { ...grabbed, x: grabbed.x + i * .045 }), ...graphs.slice(1)];
    studio.setGraphs(current); studio.setSelection(selection); studio.renderNow();
  }
  matchFresh("twelve acquisition-relative Aim updates", current);
  const station = sampleBranch(branch, branch.activeLength * .54).position;
  for (let i = 1; i <= 12; i++) {
    current = [bendBranchAtFraction(source, branch.id, { ...station, x: station.x - i * .04 }), ...graphs.slice(1)];
    studio.setGraphs(current); studio.setSelection(selection); studio.renderNow();
  }
  matchFresh("twelve acquisition-relative Bend updates", current);
  studio.setGraphs(graphs); matchFresh("cancel restores original stock", graphs);
  const plan = previewPrune(source, branch.id, branch.activeLength * .55);
  studio.setCutPreview({ plantId: source.id, plan }); studio.renderNow();
  studio.setCutPreview(null); matchFresh("prune hover cancellation", graphs);
  current = [applyPrune(source, plan), ...graphs.slice(1)];
  studio.setGraphs(current); matchFresh("committed prune changes topology", current);
  studio.setGraphs(graphs); matchFresh("Undo snapshot restores topology", graphs);
  const tones = { "flowering-branch": "rose" };
  studio.setBotanicalTones(tones); matchFresh("botanical tone refresh", graphs, tones);

  const debugCanvas = document.createElement("canvas");
  debugCanvas.style.cssText = "position:absolute;inset:0;width:1100px;height:850px;opacity:0";
  document.body.append(debugCanvas);
  const debug = new ThreeStudio(debugCanvas, { maxPixelRatio: 1, debugHitTargets: true });
  try {
    debug.setGraphs(graphs);
    const debugHits = hitMeshes(debug);
    check(debugHits.every(mesh => mesh.material.visible && mesh.material.opacity > 0), "Debug proxy materials remain visible");
    const withDebug = rgba(debug);
    debugHits.forEach(mesh => { mesh.material.visible = false; });
    const withoutDebug = rgba(debug), debugPixels = pixelDifference(withDebug, withoutDebug);
    check(debugPixels.changedChannels > 0, "Debug hit surfaces make a real rendered difference");
    checks.debug = { proxyMeshes: debugHits.length, ...debugPixels };
  } finally { debug.dispose(); debugCanvas.remove(); }
  checks.fixture = graphs.map(graph => ({ id: graph.id, seed: graph.seed, generatorVersion: graph.generatorVersion }));
  studio.setBotanicalTones(undefined); studio.setGraphs(graphs); studio.renderNow();
  return checks;
};
`;

async function runHarness({ browser, baseURL, output, sourceRoot, name, expectOptimized }) {
  const bundle = await build({ stdin: { contents: harness, loader: "js", resolveDir: sourceRoot }, bundle: true,
    write: false, format: "iife", platform: "browser", target: "es2022", logLevel: "silent" });
  const context = await browser.newContext({ viewport: { width: 1100, height: 850 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  const result = { name, status: "RUNNING", input: "Isolated production renderer with explicit test fixture and core-edit API calls; not player input", errors };
  try {
    const url = new URL("__render-efficiency-harness", baseURL).href;
    await page.route(url, route => route.fulfill({ contentType: "text/html", body: '<!doctype html><style>html,body{margin:0}canvas{display:block;width:1100px;height:850px}</style><canvas></canvas>' }));
    await page.goto(url);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    result.measurement = await page.evaluate(value => window.runRenderEfficiency(value), expectOptimized);
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    assert.deepEqual(errors, []); result.status = "PASS";
    return result;
  } catch (error) { result.status = "FAIL"; result.failure = error.stack ?? String(error); throw error;
  } finally { await writeFile(path.join(output, `${name}.json`), JSON.stringify(result, null, 2)); await context.close(); }
}

export async function checkRenderingEfficiency({ browser, baseURL, output, sourceRoot = process.cwd() }) {
  await mkdir(output, { recursive: true });
  const result = { status: "RUNNING", note: "Resource counts, exact framebuffer comparisons and picking checks; not FPS or physical-phone timing." };
  try {
    result.candidate = await runHarness({ browser, baseURL, output, sourceRoot, name: "render-efficiency-candidate", expectOptimized: true });
    if (process.env.IKEBANA_RENDER_BASELINE_DIR) {
      result.baseline = await runHarness({ browser, baseURL, output, sourceRoot: path.resolve(process.env.IKEBANA_RENDER_BASELINE_DIR), name: "render-efficiency-baseline", expectOptimized: false });
      assert.deepEqual(result.baseline.measurement.fixture, result.candidate.measurement.fixture);
      assert.equal(result.baseline.measurement.pixelSHA256, result.candidate.measurement.pixelSHA256, "Old/new source render the same fixture pixels");
      assert.deepEqual(result.baseline.measurement.picks, result.candidate.measurement.picks, "Old/new source collect identical candidates");
    }
    result.status = "PASS"; return result;
  } catch (error) { result.status = "FAIL"; result.failure = error.stack ?? String(error); throw error;
  } finally { await writeFile(path.join(output, "render-efficiency.json"), JSON.stringify(result, null, 2)); }
}
