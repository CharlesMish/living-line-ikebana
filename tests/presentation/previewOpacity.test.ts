import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { applyPrune, createFloweringBranch, createLobedLeaf, previewPrune, serializePlantGraph } from "../../src/core/index.ts";
import { studioFixture } from "./studioFixture.ts";

// CPU regression for the renderer's program-invalidation contract. Checking
// opacity alone misses stale GPU programs: Three observes material.version.
for (const [name, create] of [["flower", createFloweringBranch], ["lobed leaf", createLobedLeaf]] as const) {
  test(`${name} preview invalidates changed shader modes once and restores them on cancel`, () => {
    const graph = create("plant-1", 8278, { x: 0, y: .55, z: 0 });
    const fixture = studioFixture(graph), { studio, visual } = fixture;
    try {
      const canonical = serializePlantGraph(graph);
      const plan = previewPrune(graph, graph.rootBranchId, .8);
      assert.ok(plan.removedOrganIds.length > 0);
      const materials = [...visual.organs.values()].flatMap((organ: any) => organ.bodyMaterials) as THREE.MeshStandardMaterial[];
      const versions = materials.map(material => material.version);
      studio.setCutPreview({ plantId: graph.id, plan });
      const changed = materials.filter((material, index) => {
        assert.equal(material.version, versions[index] + (material.transparent ? 1 : 0), "invalidate only changed opacity mode");
        return material.transparent;
      });
      assert.ok(changed.length > 0);
      const previewVersions = materials.map(material => material.version);
      studio.setCutPreview({ plantId: graph.id, plan });
      studio.upsertGraph(graph);
      assert.deepEqual(materials.map(material => material.version), previewVersions, "steady preview does not recompile every sync");
      studio.setCutPreview(null);
      materials.forEach((material, index) => {
        assert.equal(material.transparent, false);
        assert.equal(material.opacity, 1);
        assert.equal(material.depthWrite, true);
        assert.equal(material.version, versions[index] + (changed.includes(material) ? 2 : 0), "restore the opaque/double-sided program");
      });
      const restoredVersions = materials.map(material => material.version);
      studio.upsertGraph(graph);
      studio.setCutPreview(null);
      assert.deepEqual(materials.map(material => material.version), restoredVersions, "idle sync stays clean");
      assert.equal(serializePlantGraph(graph), canonical);
    } finally { fixture.dispose(); }
  });
}

test("cut then restored graph invalidates the retained flower's preview shader", () => {
  const graph = createFloweringBranch("plant-1", 8278, { x: 0, y: .55, z: 0 });
  const fixture = studioFixture(graph), { studio, visual } = fixture;
  try {
    const bloom = [...graph.organs.values()].find(organ => organ.kind === "bloom")!;
    const plan = previewPrune(graph, bloom.branchId, bloom.distance * .5);
    const material = visual.organs.get(bloom.id).bodyMaterials[0] as THREE.MeshStandardMaterial;
    const originalVersion = material.version;
    studio.setCutPreview({ plantId: graph.id, plan });
    assert.equal(material.version, originalVersion + 1);
    studio.upsertGraph(applyPrune(graph, plan));
    studio.setCutPreview(null);
    assert.equal(visual.organs.get(bloom.id).group.visible, false);
    // Undo upserts the exact retained graph and therefore the same material.
    studio.upsertGraph(graph);
    assert.equal(visual.organs.get(bloom.id).bodyMaterials[0], material);
    assert.equal(visual.organs.get(bloom.id).group.visible, true);
    assert.equal(material.version, originalVersion + 2);
    assert.equal(material.transparent, false);
  } finally { fixture.dispose(); }
});
