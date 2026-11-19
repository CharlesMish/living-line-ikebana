import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { readExperimentConfig } from "../../src/app/config.ts";
import { bendBranch, createFloweringBranch, pruneBranch, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { prepareMaterialInsertion } from "../../src/core/materialCatalog.ts";
import type { Branch, PlantGraph } from "../../src/core/types.ts";
import { ThreeStudio } from "../../src/presentation/ThreeStudio.ts";
import { botanicalSeed, createLeafGeometry, createLeafVeinGeometry } from "../../src/presentation/botanicalGeometry.ts";
import { splitBranchAtMaterialDistance, updateTubeGeometry } from "../../src/presentation/geometry.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { naturalizeLeaf, naturalizeSeedDisc } from "../../src/presentation/organNaturalism.ts";
import { createSeedDiscGeometry } from "../../src/presentation/seedDiscGeometry.ts";
import { pointDistances, stemShapes, tubeSkin } from "../../src/presentation/stemShape.ts";

const BASE = { x: 0, y: 0.55, z: 0 };

function seat(materialId: string, base = BASE): PlantGraph {
  const prepared = prepareMaterialInsertion(materialId, 1, base);
  assert.ok(prepared.ok, materialId);
  return prepared.graph;
}

/** Mean distance of each ring's ten vertices from its centre, and the centre itself. */
function rings(graph: PlantGraph, branch: Branch) {
  const shape = stemShapes(graph).get(branch.id)!;
  const geometry = new THREE.BufferGeometry();
  updateTubeGeometry(geometry, branch.points, branch.radius, branch.referenceNormal, 10, true,
    tubeSkin(shape, pointDistances(branch.restLengths, branch.points.length), "natural"));
  const position = geometry.getAttribute("position");
  const result = branch.points.map((_, row) => {
    const center = new THREE.Vector3();
    const vertices = Array.from({ length: 10 }, (_, radial) => new THREE.Vector3().fromBufferAttribute(position, row * 10 + radial));
    for (const vertex of vertices) center.addScaledVector(vertex, 0.1);
    return { center, radius: vertices.reduce((sum, vertex) => sum + vertex.distanceTo(center), 0) / 10 };
  });
  const capCenter = new THREE.Vector3().fromBufferAttribute(position, position.count - 11);
  const capColor = Array.from({ length: 3 }, (_, axis) => geometry.getAttribute("color").getComponent(position.count - 11, axis));
  geometry.dispose();
  return { shape, rings: result, capCenter, capColor };
}

test("stem skins keep every ring centre on the graph and taper by stock distance", () => {
  for (const graph of [createFloweringBranch("plant-1", 8278, BASE), seat("reed"), seat("starry-pincushion"), seat("bare-branch")]) {
    for (const branch of graph.branches.values()) {
      const { rings: drawn } = rings(graph, branch);
      branch.points.forEach((point, row) => {
        assert.ok(drawn[row].center.distanceTo(new THREE.Vector3(point.x, point.y, point.z)) < 1e-6, `${graph.generatorVersion} ${branch.id}: tube follows graph`);
      });
      if (branch.kind === "trunk" && branch.points.length > 6) {
        assert.ok(drawn[1].radius > drawn.at(-3)!.radius, `${graph.generatorVersion} ${branch.id}: the stem narrows toward its tip`);
        assert.ok(drawn[1].radius <= branch.radius * 1.25 && drawn[1].radius >= branch.radius * 0.8, "the base stays near the persisted radius");
      }
    }
  }
});

test("bending and aiming never change a ring's thickness", () => {
  const graph = createFloweringBranch("plant-1", 8278, BASE);
  const root = graph.branches.get(graph.rootBranchId)!;
  const bent = bendBranch(graph, { branchId: root.id, stationDistance: 3, target: { x: 0.9, y: 3, z: 0.3 } });
  const before = rings(graph, root).rings.map((ring) => ring.radius);
  const after = rings(bent, bent.branches.get(root.id)!).rings.map((ring) => ring.radius);
  after.forEach((radius, index) => assert.ok(Math.abs(radius - before[index]) < 1e-6, `ring ${index}`));
});

test("a cut keeps the remaining stock exactly and shows a pale face; an uncut tip closes in its own colour", () => {
  const graph = seat("reed");
  const culm = graph.branches.get(graph.rootBranchId)!;
  const whole = rings(graph, culm);
  assert.equal(whole.shape.tip, "pointed");
  const last = culm.points.at(-1)!;
  assert.ok(whole.capCenter.distanceTo(new THREE.Vector3(last.x, last.y, last.z)) > 1e-4, "a growing point reaches past its last ring");
  assert.ok(whole.capColor[0] < 1.3, "an uncut tip is not drawn as a pale cut face");

  const cut = pruneBranch(graph, culm.id, culm.activeLength * 0.6);
  const shortened = rings(cut, cut.branches.get(culm.id)!);
  assert.equal(shortened.shape.tip, "cut");
  assert.ok(Math.abs(shortened.capColor[0] - 1.6) < 1e-6, "a cut shows the fresh pale face");
  // Every retained ring except the new cut end keeps its radius.
  for (let index = 0; index < shortened.rings.length - 1; index += 1) {
    assert.ok(Math.abs(shortened.rings[index].radius - whole.rings[index].radius) < 1e-6, `ring ${index} is not re-tapered by the cut`);
  }
});

test("near-tip preview and commit keep the same cut surface, including flower receptacles", () => {
  for (const material of ["reed", "bare-branch", "flowering-branch", "starry-pincushion"]) {
    const graph = seat(material);
    const branch = material === "starry-pincushion"
      ? graph.branches.get("plant-1:head-stalk-1")! : graph.branches.get(graph.rootBranchId)!;
    const distance = branch.activeLength - 0.025;
    const split = splitBranchAtMaterialDistance(branch, distance);
    const preview = new THREE.BufferGeometry();
    updateTubeGeometry(preview, split.proximal, branch.radius, branch.referenceNormal, 10, true,
      tubeSkin(stemShapes(graph).get(branch.id)!, split.proximalDistances, "cut"));
    const cut = pruneBranch(graph, branch.id, distance), kept = cut.branches.get(branch.id)!;
    const committed = new THREE.BufferGeometry();
    updateTubeGeometry(committed, kept.points, kept.radius, kept.referenceNormal, 10, true,
      tubeSkin(stemShapes(cut).get(branch.id)!, pointDistances(kept.restLengths, kept.points.length), "natural"));
    for (const attribute of ["position", "color"]) {
      const a = preview.getAttribute(attribute).array, b = committed.getAttribute(attribute).array;
      assert.equal(a.length, b.length);
      assert.ok(a.every((value, i) => Math.abs(value - b[i]) < 1e-6), material + ": " + attribute);
    }
    preview.dispose(); committed.dispose();
  }
});

test("side branches fit inside their parent where they leave, and the parent swells there", () => {
  for (const graph of [createFloweringBranch("plant-1", 8278, BASE), seat("bare-branch"), seat("silver-seed")]) {
    const shapes = stemShapes(graph);
    for (const branch of graph.branches.values()) {
      if (!branch.parentId) continue;
      const parent = shapes.get(branch.parentId)!;
      assert.ok(shapes.get(branch.id)!.baseRadius <= Math.max(parent.meanRadiusAt(branch.parentDistance), branch.radius * 0.45) + 1e-9,
        `${graph.generatorVersion} ${branch.id} fits its parent`);
    }
    const trunk = graph.branches.get(graph.rootBranchId)!;
    const child = [...graph.branches.values()].find((branch) => branch.parentId === trunk.id && branch.parentDistance > 0.3);
    if (child) {
      const trunkShape = shapes.get(trunk.id)!;
      assert.ok(trunkShape.meanRadiusAt(child.parentDistance) > trunkShape.meanRadiusAt(child.parentDistance + 0.6), "a collar where a branch leaves");
    }
  }
});

test("stem shapes depend on identity and stock, never on where the cutting is seated", () => {
  const here = seat("starry-pincushion");
  const there = seat("starry-pincushion", { x: 0.7, y: 0.55, z: -0.4 });
  for (const branch of here.branches.values()) {
    const a = stemShapes(here).get(branch.id)!, b = stemShapes(there).get(branch.id)!;
    // Rest lengths recomputed at another seat can differ in the last bit only.
    assert.ok(Math.abs(a.stockLength - b.stockLength) < 1e-9);
    for (const distance of [0, 0.3, 0.9, a.stockLength]) {
      assert.ok(Math.abs(a.radiusAt(distance, 1.1) - b.radiusAt(distance, 1.1)) < 1e-9);
      a.toneAt(distance).forEach((value, axis) => assert.ok(Math.abs(value - b.toneAt(distance)[axis]) < 1e-9));
    }
  }
});

test("leaf curls are deterministic, differ by organ, and stay inside a sphere proxy", () => {
  for (const version of ["one-branch-v1", "leafy-shoot-v1", "arching-trailer-v1", "lantern-spray-v1"]) {
    const appearance = getMaterialAppearance(version);
    const bound = { center: new THREE.Vector3(0, appearance.leaf.hitCenterY, 0), radius: appearance.leaf.hitRadius };
    const make = (seed: number) => {
      const leaf = createLeafGeometry(seed, appearance.leaf.form), vein = createLeafVeinGeometry(seed, appearance.leaf.form);
      const kept = naturalizeLeaf([leaf, vein], seed, appearance.leaf.form, bound);
      return { leaf, vein, kept };
    };
    const seed = botanicalSeed("plant-1:leaf-2", 8278);
    const one = make(seed), again = make(seed), other = make(botanicalSeed("plant-1:leaf-3", 8278));
    assert.deepEqual(Array.from(one.leaf.getAttribute("position").array), Array.from(again.leaf.getAttribute("position").array));
    assert.notDeepEqual(Array.from(one.leaf.getAttribute("position").array), Array.from(other.leaf.getAttribute("position").array));
    assert.ok(one.kept > 0.3, `${version}: most of the natural form survives its proxy (${one.kept})`);
    const authored = createLeafGeometry(seed, appearance.leaf.form);
    assert.notDeepEqual(Array.from(one.leaf.getAttribute("position").array), Array.from(authored.getAttribute("position").array));
    const proxy = new THREE.Sphere(bound.center, bound.radius);
    const vertex = new THREE.Vector3();
    for (const geometry of [one.leaf, one.vein]) {
      const position = geometry.getAttribute("position");
      for (let index = 0; index < position.count; index += 1) {
        assert.ok(proxy.containsPoint(vertex.fromBufferAttribute(position, index)), `${version}: curl stays inside its proxy`);
      }
      assert.ok(Array.from(geometry.getAttribute("normal").array).every(Number.isFinite));
    }
  }
});

test("seed discs and their rims bend together and stay finite", () => {
  const disc = createSeedDiscGeometry(42), rim = createSeedDiscGeometry(42);
  naturalizeSeedDisc([disc, rim], 42);
  assert.deepEqual(Array.from(disc.getAttribute("position").array), Array.from(rim.getAttribute("position").array));
  disc.computeBoundingBox();
  assert.ok(disc.boundingBox!.max.z - disc.boundingBox!.min.z > 0.03, "a dry septum is not a flat coin");
  assert.ok(Array.from(disc.getAttribute("normal").array).every(Number.isFinite));
});

test("the baseline surface draw leaves leaves exactly as authored, and the URL selects it", () => {
  const graph = createFloweringBranch("plant-1", 8278, BASE);
  const snapshot = JSON.stringify(toCanonicalPlantGraph(graph));
  const organ = [...graph.organs.values()].find((item) => item.kind === "leaf")!;
  const seed = botanicalSeed(organ.id, graph.seed);
  const authored = Array.from(createLeafGeometry(seed, "elliptic").getAttribute("position").array);
  const leafPositions = (surfaceDraw?: "baseline" | "natural") => {
    const studio = Object.assign(Object.create(ThreeStudio.prototype), { options: { debugHitTargets: false, surfaceDraw } });
    const visual = studio.createOrganVisual(graph, organ, false);
    const leaf = visual.group.children.find((child: THREE.Object3D) => child instanceof THREE.Mesh && child.geometry.name === "living-line/creased-leaf") as THREE.Mesh;
    return Array.from(leaf.geometry.getAttribute("position").array);
  };
  assert.deepEqual(leafPositions("baseline"), authored);
  assert.notDeepEqual(leafPositions(), authored, "natural is the accepted draw");
  assert.equal(JSON.stringify(toCanonicalPlantGraph(graph)), snapshot, "no surface draw touches the graph");
  assert.equal(readExperimentConfig(new URL("https://example.test/?surface=baseline")).surfaceDraw, "baseline");
  assert.equal(readExperimentConfig(new URL("https://example.test/?surface=chrome")).surfaceDraw, undefined);
});
