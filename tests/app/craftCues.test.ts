import assert from "node:assert/strict";
import test from "node:test";
import { createFloweringBranch, previewPrune, applyPrune, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { cutCue } from "../../src/app/craftCues.ts";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";

test("cut descriptions agree with actual removed organs, including a bare shortened tip", () => {
  const graph = createFloweringBranch("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const before = JSON.stringify(toCanonicalPlantGraph(graph));
  for (const organ of graph.organs.values()) {
    const branch = graph.branches.get(organ.branchId)!;
    const plan = previewPrune(graph, branch.id, branch.activeLength * 0.5);
    const cue = cutCue(graph, plan, true);
    const after = applyPrune(graph, plan);
    assert.equal(after.organs.get(organ.id)!.active, false);
    const word = organ.kind === "bloom" ? "flower" : organ.kind;
    assert.ok(cue.detail.includes(`1 ${word}`));
    assert.ok(cue.detail.includes("release to cut"));
  }
  const root = graph.branches.get(graph.rootBranchId)!;
  const tipPlan = previewPrune(graph, root.id, root.activeLength);
  const tipCue = cutCue(graph, tipPlan, false);
  assert.ok(tipCue.title.includes("main stem"));
  // Regardless of descendant inventory, the shortened target is described.
  assert.ok(tipCue.detail.startsWith("Tip"));
  assert.equal(JSON.stringify(toCanonicalPlantGraph(graph)), before);
});

test("mouse cut hover is observational and clears when leaving; touch never opens hover", () => {
  const graph = createFloweringBranch("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const before = JSON.stringify(toCanonicalPlantGraph(graph));
  const canvas = {};
  let preview: unknown;
  let cue: unknown;
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    canvas, hovering: false,
    coordinator: {
      getDebugState: () => ({ posture: "arrange", tool: "prune" }),
      getDocumentSnapshot: () => ({ plants: new Map([[graph.id, graph]]) }),
    },
    studio: {
      collectHitCandidates: () => [{ plantId: graph.id, branchId: graph.rootBranchId, materialDistance: 3 }],
      setCutPreview: (value: unknown) => { preview = value; },
    },
    ui: { state: { experimentPanelOpen: false }, setCraftCue: (value: unknown) => { cue = value; } },
  });
  app.updateHover({ pointerType: "mouse", buttons: 0, target: canvas, clientX: 10, clientY: 10 });
  assert.ok(preview && cue);
  assert.equal(JSON.stringify(toCanonicalPlantGraph(graph)), before);
  // The stub deliberately exposes no selection, acquisition, telemetry or save
  // methods: calling any of them would fail this actual production hover path.
  app.updateHover({ pointerType: "mouse", buttons: 0, target: {} });
  assert.equal(preview, null);
  assert.equal(cue, null);
  app.updateHover({ pointerType: "touch", buttons: 0, target: canvas });
  assert.equal(preview, null);
});

test("bare attached stems and minimum-length no-op cuts have truthful cues", () => {
  const graph = createFloweringBranch("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  for (const organ of graph.organs.values()) organ.active = false;
  const plan = previewPrune(graph, graph.rootBranchId, 2);
  assert.ok(plan.removedBranchIds.length > 0);
  assert.ok(cutCue(graph, plan, false).detail.includes("attached stems"));
  const minimum = applyPrune(graph, previewPrune(graph, graph.rootBranchId, 0));
  const noOp = previewPrune(minimum, minimum.rootBranchId, 0);
  assert.equal(cutCue(minimum, noOp, false).title, "No further cut here");
});
