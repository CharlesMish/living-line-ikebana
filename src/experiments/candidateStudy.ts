import { createSparseCane, createPairedLeaf } from "../core/candidateStems.ts";
import { createFloweringBranch, createLeafyShoot, createReed, sampleBranch, aimBranch,
  bendBranch, legalBendStation, previewPrune, applyPrune, clonePlantGraph,
  validatePlantGraph, toCanonicalPlantGraph, add, vec3, type PlantGraph } from "../core/index.ts";
import { ThreeStudio } from "../presentation/ThreeStudio.ts";
import { canonicalCameraPose } from "../app/camera.ts";

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>("canvas");
const studio = new ThreeStudio(canvas, { maxPixelRatio: 2 });
const material = el<HTMLSelectElement>("material");
const seed = el<HTMLInputElement>("seed");
const branches = el<HTMLSelectElement>("branch");
const cut = el<HTMLInputElement>("cut");
const generators = { "sparse-cane": createSparseCane, "paired-leaf": createPairedLeaf,
  "flowering-branch": createFloweringBranch, "leafy-shoot": createLeafyShoot, "reed": createReed };
type Material = keyof typeof generators;
type Mode = "aim" | "bend" | "prune" | "look";
let mode: Mode = "look", graphs: PlantGraph[] = [], undo: PlantGraph[] | null = null;
let selected: { plantId: string; branchId: string } | null = null;
let ordinal = 0;
let preview: PlantGraph | null = null;
let drag: { pointer: number; graph: PlantGraph; branchId: string; grabbed: ReturnType<typeof vec3>;
  station: number | null; plane: ReturnType<ThreeStudio["cameraFacingPlaneThrough"]> } | null = null;

const copy = () => graphs.map(clonePlantGraph);
function status(message: string) { el("status").textContent = message; }
function refresh() {
  studio.setGraphs(graphs.map(graph => mode !== "prune" && preview?.id === graph.id ? preview : graph));
  studio.setSelection(mode === "look" ? null : selected);
  studio.setShapeAffordances({ visible: mode !== "look", bendVariant: "bead", transactionActive: !!drag });
  const selectedGraph = graphs.find(g => g.id === selected?.plantId);
  branches.replaceChildren(...[...(selectedGraph?.branches.values() ?? [])].filter(b => b.active).map(b => {
    const option = document.createElement("option"); option.value = b.id; option.textContent = b.label + " · " + b.id.split(":")[1]; return option;
  }));
  if (selected) branches.value = selected.branchId;
  for (const value of ["aim", "bend", "prune", "look"]) el(value).setAttribute("aria-pressed", String(value === mode));
  (el("undo") as HTMLButtonElement).disabled = !undo;
}
function cancel() {
  if (drag && canvas.hasPointerCapture(drag.pointer)) canvas.releasePointerCapture(drag.pointer);
  drag = null; preview = null; studio.setCutPreview(null); refresh();
}
function commit(graph: PlantGraph) {
  const issues = validatePlantGraph(graph);
  if (issues.length) throw new Error(JSON.stringify(issues));
  undo = copy(); graphs = graphs.map(g => g.id === graph.id ? graph : g);
  preview = null; studio.setCutPreview(null); refresh();
  status(mode === "prune" ? "Cut committed. Removed records remain as inactive history; Undo can revise it."
    : "Committed. Stock length and attachment identity retained; Undo can revise it.");
}
function setMode(next: Mode) { cancel(); mode = next; refresh(); status(next === "look" ? "Look across the empty intervals in Front, Angle, and Back." : `Drag material to ${next}. Escape cancels.`); }
function insert() {
  cancel(); undo = copy();
  const n = ordinal++;
  const base = vec3(Math.sin(n * 2.4) * 0.65, 0.55, Math.cos(n * 2.4) * 0.45);
  const graph = generators[material.value as Material](`candidate-${ordinal}`, Number(seed.value) >>> 0, base);
  graphs.push(graph); selected = { plantId: graph.id, branchId: graph.rootBranchId };
  setMode("aim"); status("Seated a new cutting. Aim it, select a branchlet, or leave the open space alone.");
}
function scene(mixed = false) {
  cancel(); undo = copy(); graphs = []; ordinal = 0;
  const s = Number(seed.value) >>> 0;
  const cane = createSparseCane("candidate-1", s, vec3(-0.48, 0.55, 0.08));
  const paired = createPairedLeaf("candidate-2", s + 977, vec3(0.46, 0.55, -0.16));
  graphs.push(cane, paired); ordinal = 2;
  if (mixed) {
    const flowering = createFloweringBranch("candidate-3", s + 1954, vec3(0.13, 0.55, 0.47));
    const root = flowering.branches.get(flowering.rootBranchId)!;
    const grip = sampleBranch(root, root.activeLength * 0.8).position;
    graphs.push(aimBranch(flowering, root.id, grip, add(grip, vec3(-2.4, -0.4, 0.25)))); ordinal = 3;
  }
  selected = { plantId: cane.id, branchId: cane.rootBranchId }; setMode("look");
  el("caption").textContent = mixed ? "Mixed bowl · flowering reference + two candidates" : "Candidate pair · sparse cane / paired leaf";
}
function view(value: string) {
  cancel();
  if (value === "back") {
    const pose = canonicalCameraPose("front"); pose.position.z = -pose.position.z;
    studio.applyCameraPose(pose);
  } else studio.setCanonicalView(value === "angle" ? "three-quarter" : "front");
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === value)));
}
function cutPreview() {
  cancel(); const graph = graphs.find(g => g.id === selected?.plantId);
  const branch = graph?.branches.get(selected?.branchId ?? "");
  if (!graph || !branch) return;
  const plan = previewPrune(graph, branch.id, branch.activeLength * Number(cut.value) / 100);
  studio.setCutPreview({ plantId: graph.id, plan });
  status(`Preview removes ${plan.removedBranchIds.length} attached branches and ${plan.removedOrganIds.length} leaves/organs. Apply cut or Cancel.`);
}
el("insert").onclick = insert;
el("pair").onclick = () => scene(); el("mixed").onclick = () => scene(true);
for (const value of ["aim", "bend", "prune", "look"] as Mode[]) el(value).onclick = () => setMode(value);
el("clear").onclick = () => { cancel(); undo = copy(); graphs = []; selected = null; refresh(); };
el("cancel").onclick = () => { cancel(); status("Preview cancelled."); };
el("undo").onclick = () => { cancel(); if (undo) { graphs = undo; undo = null;
  const g = graphs[0]; selected = g ? { plantId: g.id, branchId: g.rootBranchId } : null; refresh(); status("Restored the previous bowl."); } };
branches.onchange = () => { const id = branches.value; cancel(); if (selected) selected.branchId = id; refresh(); };
cut.oninput = cutPreview;
el("apply-cut").onclick = () => {
  cancel(); const graph = graphs.find(g => g.id === selected?.plantId);
  const branch = graph?.branches.get(selected?.branchId ?? "");
  if (graph && branch) commit(applyPrune(graph, previewPrune(graph, branch.id, branch.activeLength * Number(cut.value) / 100)));
};
material.onchange = () => {
  cancel(); const value = material.value;
  el("intent").textContent = value === "sparse-cane" ? "Quiet ascending line, two airy branchlets. Cut one branchlet to open a deliberate interval."
    : value === "paired-leaf" ? "Four opposite pairs make a low, measured rhythm. Remove one leaf to introduce asymmetry."
    : "Established material, included for direct silhouette comparison.";
  el("caption").textContent = material.selectedOptions[0].textContent;
};
canvas.onpointerdown = event => {
  if (mode === "look" || drag) return;
  const hit = studio.collectHitCandidates(event.clientX, event.clientY)[0];
  const graph = graphs.find(g => g.id === hit?.plantId);
  const branch = graph?.branches.get(hit?.branchId ?? "");
  if (!graph || !branch || !hit) return;
  selected = { plantId: graph.id, branchId: branch.id };
  const station = legalBendStation(branch);
  if (mode === "bend" && station === null) { refresh(); status("This leaf stalk cannot bend. Select the stem or a branchlet, or use Aim."); return; }
  const grabbed = mode === "bend" ? sampleBranch(branch, station!).position : hit.aimPoint ?? hit.worldPoint;
  drag = { pointer: event.pointerId, graph: clonePlantGraph(graph), branchId: branch.id,
    grabbed, station, plane: studio.cameraFacingPlaneThrough(grabbed) };
  canvas.setPointerCapture(event.pointerId); refresh();
};
canvas.onpointermove = event => {
  if (!drag || event.pointerId !== drag.pointer) return;
  const target = studio.intersectClientPlane(event.clientX, event.clientY, drag.plane);
  if (!target) return;
  if (mode === "prune") {
    const branch = drag.graph.branches.get(drag.branchId)!;
    const hit = studio.closestProjectedPointOnBranch(drag.graph.id, branch.id, event.clientX, event.clientY);
    if (hit) { const plan = previewPrune(drag.graph, branch.id, hit.materialDistance);
      preview = applyPrune(drag.graph, plan); studio.setCutPreview({ plantId: drag.graph.id, plan }); }
  } else preview = mode === "bend"
    ? bendBranch(drag.graph, { branchId: drag.branchId, stationDistance: drag.station!, target })
    : aimBranch(drag.graph, drag.branchId, drag.grabbed, target);
  refresh();
};
canvas.onpointerup = event => {
  if (!drag || event.pointerId !== drag.pointer) return;
  const result = preview; drag = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (result) commit(result); else refresh();
};
canvas.onpointercancel = cancel; canvas.onlostpointercapture = () => { if (drag) cancel(); };
window.addEventListener("keydown", event => { if (event.key === "Escape") cancel(); });
window.addEventListener("resize", cancel);
document.addEventListener("visibilitychange", () => { if (document.hidden) cancel(); });
window.addEventListener("pagehide", cancel);
canvas.addEventListener("webglcontextlost", cancel);
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(b => b.onclick = () => view(b.dataset.view!));
material.dispatchEvent(new Event("change")); scene(); view("front");
// In-memory diagnostic access; no storage, persistence, ordinal or production-app bridge.
Object.assign(window, { __CANDIDATE_STUDY__: {
  scene, view, getGraphs: () => graphs.map(toCanonicalPlantGraph),
  inventory: () => studio.getRenderInventory(),
  project: (plant: number, branchId: string, fraction = 0.54) => {
    const branch = graphs[plant].branches.get(branchId)!;
    return studio.projectPoint(sampleBranch(branch, branch.activeLength * fraction).position);
  },
  state: () => ({ mode, selected, preview: !!preview, transaction: !!drag }),
} });
