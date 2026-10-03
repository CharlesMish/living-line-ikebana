import assert from "node:assert/strict";
import test from "node:test";
import { createSparseCane, createPairedLeaf, SPARSE_CANE_VERSION, PAIRED_LEAF_VERSION } from "../../src/core/candidateStems.ts";
import { getMaterialDefinitions, getMaterialDefinition, getGeneratorDefinition,
  serializePlantGraph, deserializePlantGraph, validatePlantGraph, sampleBranch,
  bendBranch, aimBranch, legalBendStation, previewPrune, applyPrune, add, vec3 } from "../../src/core/index.ts";
import { assertAttachmentCoincidence, assertRestLengthsPreserved, localTurns } from "./helpers.ts";

const base = vec3(0, 0.55, 0);
const candidates = [createSparseCane, createPairedLeaf];

test("candidate generators are supported without changing the established catalog", () => {
  assert.deepEqual(getMaterialDefinitions().map(m => m.materialId), ["flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume", "arching-trailer", "foliage-fan", "blossom-spray", "nodding-flower", "berry-twig", "fern-frond"]);
  assert.equal(getMaterialDefinition("sparse-cane"), null);
  assert.equal(getMaterialDefinition("paired-leaf"), null);
  assert.equal(getGeneratorDefinition(SPARSE_CANE_VERSION)?.generate, createSparseCane);
  assert.equal(getGeneratorDefinition(PAIRED_LEAF_VERSION)?.generate, createPairedLeaf);
});

test("64 seeds per candidate retain deterministic, seated, attached and distinct structures", () => {
  for (const create of candidates) {
    const variants = new Set<string>();
    for (const seed of [8278, 9255, 10232, ...Array.from({ length: 61 }, (_, n) => n)]) {
      const graph = create("study", seed, base);
      assert.deepEqual(validatePlantGraph(graph), []);
      assertAttachmentCoincidence(graph);
      const text = serializePlantGraph(graph);
      assert.equal(text, serializePlantGraph(create("study", seed, base)));
      assert.equal(text, serializePlantGraph(deserializePlantGraph(text)));
      variants.add(text);
      assert.deepEqual(graph.branches.get(graph.rootBranchId)!.points[0], base);
      for (const b of graph.branches.values()) {
        if (b.kind === "petiole") assert.equal(legalBendStation(b), null);
        if (b.parentId === graph.rootBranchId) assert.ok(b.parentDistance > 0.98, "clear basal interval");
      }
      assert.equal(graph.organs.size, create === createSparseCane ? 5 : 8);
      assert.equal(graph.branches.size, create === createSparseCane ? 8 : 9);
    }
    assert.equal(variants.size, 64);
  }
});

test("multiple seeds and moderate/extreme bends preserve stock, attachments, detail and immutable acquisition", () => {
  for (const create of candidates) for (const seed of [8278, 9255, 10232, 0, 31, 60]) {
    const graph = create("study", seed, base);
    const original = serializePlantGraph(graph);
    for (const branch of graph.branches.values()) {
      const station = legalBendStation(branch);
      if (station === null) continue;
      for (const offset of [vec3(0.8, -0.2, 0.4), vec3(250, -150, -100)]) {
        const request = { branchId: branch.id, stationDistance: station,
          target: add(sampleBranch(branch, station).position, offset) };
        const bent = bendBranch(graph, request);
        assertAttachmentCoincidence(bent);
        assertRestLengthsPreserved(graph, bent);
        assert.deepEqual([...bent.organs.values()], [...graph.organs.values()]);
        assert.notDeepEqual(bent.branches.get(branch.id)!.points, branch.points);
        assert.ok(Math.max(...localTurns(bent.branches.get(branch.id)!.points)) < 0.6, "no local folded joint");
        assert.equal(serializePlantGraph(bent), serializePlantGraph(bendBranch(graph, request)));
        assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(bent))), serializePlantGraph(bent));
      }
      const grip = sampleBranch(branch, branch.activeLength * 0.8).position;
      const aimed = aimBranch(graph, branch.id, grip, add(grip, vec3(-1.2, 0.3, 0.5)));
      assertAttachmentCoincidence(aimed); assertRestLengthsPreserved(graph, aimed);
    }
    assert.equal(serializePlantGraph(graph), original);
  }
});

test("prune previews match exact active loss and preserve inactive records through later bends", () => {
  for (const create of candidates) for (const seed of [8278, 9255, 10232]) {
    const graph = create("study", seed, base), before = serializePlantGraph(graph);
    for (const branch of graph.branches.values()) {
      const plan = previewPrune(graph, branch.id, branch.activeLength * 0.52);
      assert.equal(serializePlantGraph(graph), before);
      const pruned = applyPrune(graph, plan);
      assertAttachmentCoincidence(pruned);
      assert.equal(pruned.branches.size, graph.branches.size);
      assert.equal(pruned.organs.size, graph.organs.size);
      assert.deepEqual([...pruned.branches.values()].filter(b => !b.active).map(b => b.id).sort(), plan.removedBranchIds);
      assert.deepEqual([...pruned.organs.values()].filter(o => !o.active).map(o => o.id).sort(), plan.removedOrganIds);
      for (const b of graph.branches.values()) if (b.id !== branch.id) {
        assert.deepEqual(pruned.branches.get(b.id), { ...b, active: !plan.removedBranchIds.includes(b.id) });
      }
      const root = pruned.branches.get(pruned.rootBranchId)!;
      const station = legalBendStation(root);
      if (station !== null) {
        const bent = bendBranch(pruned, { branchId: root.id, stationDistance: station,
          target: add(sampleBranch(root, station).position, vec3(0.5, 0, -0.4)) });
        assertAttachmentCoincidence(bent);
        for (const b of pruned.branches.values()) if (!b.active) assert.deepEqual(bent.branches.get(b.id), b);
      }
    }
  }
});

test("opening a cane branchlet or one opposite leaf leaves unrelated foliage unchanged", () => {
  const cane = createSparseCane("study", 8278, base);
  const twig = cane.branches.get("study:twig-1")!;
  const open = applyPrune(cane, previewPrune(cane, twig.id, 0.1));
  assert.equal([...open.organs.values()].filter(o => o.active).length, 2);
  for (const b of cane.branches.values()) if (b.id.includes("twig-2") || b.id.includes("petiole-2-")) assert.deepEqual(open.branches.get(b.id), b);
  const paired = createPairedLeaf("study", 8278, base);
  const petiole = paired.branches.get("study:petiole-2-1")!;
  const asymmetric = applyPrune(paired, previewPrune(paired, petiole.id, 0.06));
  assert.equal([...asymmetric.organs.values()].filter(o => o.active).length, 7);
  assert.equal(asymmetric.organs.get("study:leaf-2-1")!.active, false);
  assert.deepEqual(asymmetric.organs.get("study:leaf-2-2"), paired.organs.get("study:leaf-2-2"));
});
