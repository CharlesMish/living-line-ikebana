import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { getGeneratorDefinition } from "../../src/core/materialCatalog.ts";
import { toCanonicalPlantGraph, previewPrune } from "../../src/core/index.ts";
import { BOTANICAL_FAMILIES, resolveBotanicalAppearance, validateBotanicalTones } from "../../src/presentation/botanicalTones.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { botanicalSeed, createBellGeometry } from "../../src/presentation/botanicalGeometry.ts";
import { studioFixture } from "./studioFixture.ts";

function geometryInventory(group: THREE.Group) {
  const meshes: { object: THREE.Mesh; geometry: THREE.BufferGeometry; position: number[]; material: THREE.Material | THREE.Material[] }[] = [];
  group.traverse(object => {
    if (object instanceof THREE.Mesh) meshes.push({ object, geometry: object.geometry,
      position: Array.from(object.geometry.getAttribute("position")?.array ?? []), material: object.material });
  });
  return meshes;
}
function assertInventory(inventory: ReturnType<typeof geometryInventory>) {
  for (const mesh of inventory) {
    assert.equal(mesh.object.geometry, mesh.geometry);
    assert.equal(mesh.object.material, mesh.material);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute("position")?.array ?? []), mesh.position);
  }
}

test("tones preserve every baseline natural appearance and distinct flower families", () => {
  for (const family of BOTANICAL_FAMILIES) for (const version of family.versions) {
    if (!getGeneratorDefinition(version)) continue; // additive generators are supplied by the integration lanes
    const base = getMaterialAppearance(version);
    const natural = resolveBotanicalAppearance(version, base);
    assert.deepEqual(natural, { ...base, budColor: 0xa64f59 });
    for (const tone of family.tones) {
      assert.doesNotThrow(() => validateBotanicalTones({ [family.id]: tone.id }));
      const colored = resolveBotanicalAppearance(version, base, { [family.id]: tone.id });
      assert.equal(colored.leaf.form, base.leaf.form); assert.equal(colored.bloom.form, base.bloom.form);
      assert.equal(colored.bloom.hitRadius, base.bloom.hitRadius); assert.equal(colored.leaf.hitRadius, base.leaf.hitRadius);
    }
  }
  assert.equal(validateBotanicalTones({ "nodding-flower": "natural" }), undefined);
  for (const value of [null, [], "violet", { flower: "violet" }, { "nodding-flower": "rust" }, { "nodding-flower": false }]) assert.throws(() => validateBotanicalTones(value));
  const flowering = getMaterialAppearance("one-branch-v1");
  assert.equal(resolveBotanicalAppearance("one-branch-v1", flowering, { "nodding-flower": "violet" }).bloom, flowering.bloom);
});

test("changing tones reuses geometry, proxies and materials without mutating graphs or another studio", () => {
  for (const family of BOTANICAL_FAMILIES) {
    const version = family.versions.at(-1)!;
    const definition = getGeneratorDefinition(version); if (!definition) continue;
    const graph = definition.generate("plant-1", 8278, { x: 0, y: .55, z: 0 });
    const fixture = studioFixture(graph), control = studioFixture(graph);
    const graphBefore = toCanonicalPlantGraph(graph), cameraBefore = fixture.camera.matrixWorld.toArray();
    const inventory = geometryInventory(fixture.visual.group);
    const naturalBranches = [...fixture.visual.branches.values()].map((branch: any) => branch.mesh.material.color.getHex());
    const naturalOrgans = [...fixture.visual.organs.values()].map((organ: any) => organ.bodyMaterials.map((m: any) => m.color.getHex()));
    try {
      for (const tone of family.tones.slice(1)) {
        fixture.studio.setBotanicalTones({ [family.id]: tone.id });
        const appearance = resolveBotanicalAppearance(version, getMaterialAppearance(version), { [family.id]: tone.id });
        for (const [id, branch] of fixture.visual.branches) {
          const expected = appearance.branchColors[graph.branches.get(id)!.kind];
          assert.equal(branch.mesh.material.color.getHex(), expected); assert.equal(branch.doomed.material.color.getHex(), expected);
          if (branch.blade) {
            assert.equal(branch.blade.mesh.material.color.getHex(), appearance.leaf.color);
            assert.equal(branch.blade.doomed.material.color.getHex(), appearance.leaf.color);
          }
        }
        for (const [id, organ] of fixture.visual.organs) {
          const kind = graph.organs.get(id)!.kind;
          if (kind === "leaf") assert.equal(organ.bodyMaterials[0].color.getHex(), appearance.leaf.color);
          if (kind === "berry") assert.equal(organ.bodyMaterials[0].color.getHex(), appearance.berry!.color);
        }
        assertInventory(inventory);
        assert.deepEqual(toCanonicalPlantGraph(graph), graphBefore);
        assert.deepEqual(fixture.camera.matrixWorld.toArray(), cameraBefore);
        assert.deepEqual([...control.visual.branches.values()].map((branch: any) => branch.mesh.material.color.getHex()), naturalBranches);
        assert.deepEqual([...control.visual.organs.values()].map((organ: any) => organ.bodyMaterials.map((m: any) => m.color.getHex())), naturalOrgans);
      }
      fixture.studio.setBotanicalTones();
      assert.deepEqual([...fixture.visual.branches.values()].map((branch: any) => branch.mesh.material.color.getHex()), naturalBranches);
      assert.deepEqual([...fixture.visual.organs.values()].map((organ: any) => organ.bodyMaterials.map((m: any) => m.color.getHex())), naturalOrgans);
      for (const branch of fixture.visual.branches.values()) if (branch.blade) {
        assert.equal(branch.blade.mesh.material.color.getHex(), getMaterialAppearance(version).leaf.color);
        assert.equal(branch.blade.doomed.material.color.getHex(), getMaterialAppearance(version).leaf.color);
      }
      assertInventory(inventory);
    } finally { fixture.dispose(); control.dispose(); }
  }
});

test("nodding bell recolors petals while preserving its green sleeve and exact natural color buffer on reset", () => {
  const graph = getGeneratorDefinition("nodding-flower-v2")!.generate("plant-1", 8278, { x: 0, y: .55, z: 0 });
  const fixture = studioFixture(graph);
  try {
    const bloom = [...graph.organs.values()].find(organ => organ.kind === "bloom")!;
    const bell = fixture.visual.organs.get(bloom.id).group.children.find((mesh: THREE.Mesh) => mesh.geometry?.name === "living-line/bell") as THREE.Mesh;
    assert.ok(bell);
    const position = bell.geometry.getAttribute("position"), colors = bell.geometry.getAttribute("color");
    const original = Array.from(colors.array);
    const base = getMaterialAppearance(graph.generatorVersion).bloom;
    const expected = createBellGeometry(botanicalSeed(bloom.id, graph.seed), { petal: 0x8c7abd, collar: base.collarColor! });
    fixture.studio.setBotanicalTones({ "nodding-flower": "violet" });
    let changed = 0;
    for (let i = 0; i < colors.count; i++) {
      for (let channel = 0; channel < 3; channel++) {
        const index = i * 3 + channel;
        assert.ok(Math.abs(colors.array[index] - expected.getAttribute("color").array[index]) < 2e-7);
        if (position.getY(i) <= .01) assert.equal(colors.array[index], original[index]);
        if (colors.array[index] !== original[index]) changed++;
      }
    }
    assert.ok(changed > 100); expected.dispose();
    fixture.studio.setBotanicalTones(); assert.deepEqual(Array.from(colors.array), original);
  } finally { fixture.dispose(); }
});

test("new and pending cuttings inherit tones; changing a tone preserves live prune opacity and selection", () => {
  const definition = getGeneratorDefinition("one-branch-v1")!;
  const graph = definition.generate("plant-1", 8278, { x: 0, y: .55, z: 0 });
  const fixture = studioFixture(graph);
  try {
    fixture.studio.setBotanicalTones({ "flowering-branch": "rose" });
    const pendingGraph = definition.generate("plant-2", 9255, { x: .2, y: .55, z: 0 });
    fixture.studio.pendingPlant = fixture.studio.createPlantVisual(pendingGraph, true);
    const bud = [...fixture.studio.pendingPlant.organs.values()].find((organ: any) => organ.bodyMaterials[0].color.getHex() === 0x934052);
    assert.ok(bud); assert.equal(bud.bodyMaterials[0].opacity, .45);
    const branch = graph.branches.get("plant-1:trunk")!;
    const plan = previewPrune(graph, branch.id, branch.activeLength * .7);
    fixture.studio.setCutPreview({ plantId: graph.id, plan });
    const opacities = [...fixture.visual.organs.values()].flatMap((organ: any) => organ.bodyMaterials.map((m: any) => m.opacity));
    fixture.studio.setBotanicalTones({ "flowering-branch": "porcelain" });
    assert.deepEqual([...fixture.visual.organs.values()].flatMap((organ: any) => organ.bodyMaterials.map((m: any) => m.opacity)), opacities);
    assert.equal(bud.bodyMaterials[0].color.getHex(), 0xb7999c); assert.equal(bud.bodyMaterials[0].opacity, .45);
    const fresh = definition.generate("plant-3", 10232, { x: -.2, y: .55, z: 0 }); fixture.studio.upsertGraph(fresh);
    const freshTrunk = fixture.studio.plants.get(fresh.id).branches.get("plant-3:trunk");
    assert.equal(freshTrunk.mesh.material.color.getHex(), 0x594539);
  } finally { fixture.dispose(); }
});
