import { createFernFrondV2, FERN_FROND_V2_VERSION } from "../../src/core/index.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import floweringFixture from "../../fixtures/plant-1-one-branch-v1.json";
import leafyFixture from "../../fixtures/plant-2-leafy-shoot-v1.json";
import fixture from "../../fixtures/plant-1-fern-frond-v1.json";
import studyBackup from "../../artifacts/fern-frond-garden.json";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { GARDEN_KEY, GardenStore, parseGarden } from "../../src/app/garden.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { legalBendStation } from "../../src/core/arcLength.ts";
import {
  FERN_FROND_VERSION,
  aimBranch,
  applyPrune,
  bendBranch,
  createFernFrond,
  createFloweringBranch,
  createFoliageFan,
  createLeafyShoot,
  deserializePlantGraph,
  getMaterialDefinition,
  prepareMaterialInsertion,
  previewPrune,
  sampleBranch,
  sampleMaterialFrame,
  serializePlantGraph,
  successfulSeatIdentity,
  toCanonicalPlantGraph,
  translatePlantBase,
  validatePlantGraph,
  add,
  vec3,
  type PlantGraph,
} from "../../src/core/index.ts";
import { FERN_FROND_RESPONSE, FOLIAGE_FAN_RESPONSE, LEAFY_RESPONSE } from "../../src/core/materialResponse.ts";
import { botanicalSeed as presentationSeed, createLeafGeometry } from "../../src/presentation/botanicalGeometry.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import {
  FERN_FROND_PINNA_CUT,
  FERN_FROND_STUDY_PLACEMENTS,
  buildFernFrondStudyGraph,
  buildFernFrondStudyGraphs,
  fernFrondDistalCutDistance,
  fernFrondStudyGardenDocument,
} from "./fernFrondStudy.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232, 23910, 69829] as const;

function visualSize(graph: PlantGraph) {
  const box = new THREE.Box3();
  for (const branch of graph.branches.values()) {
    if (!branch.active) continue;
    for (const point of branch.points) box.expandByPoint(new THREE.Vector3(point.x, point.y, point.z));
  }
  const appearance = getMaterialAppearance(graph.generatorVersion);
  for (const organ of graph.organs.values()) {
    if (!organ.active || organ.kind !== "leaf") continue;
    const branch = graph.branches.get(organ.branchId)!;
    const frame = sampleMaterialFrame(branch, Math.min(organ.distance, branch.activeLength));
    const tangent = new THREE.Vector3(frame.tangent.x, frame.tangent.y, frame.tangent.z).normalize();
    const normal = new THREE.Vector3(frame.normal.x, frame.normal.y, frame.normal.z).normalize();
    const binormal = new THREE.Vector3(frame.binormal.x, frame.binormal.y, frame.binormal.z).normalize();
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(binormal, tangent, normal));
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), organ.spin));
    const geometry = createLeafGeometry(presentationSeed(organ.id, graph.seed), appearance.leaf.form);
    geometry.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(frame.position.x, frame.position.y, frame.position.z),
      quaternion,
      new THREE.Vector3(organ.scale, organ.scale, organ.scale),
    ));
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox!);
    geometry.dispose();
  }
  return box.getSize(new THREE.Vector3());
}

test("fern-frond catalog uses v2 and the v1 golden remains reproducible", () => {
  const material = getMaterialDefinition("fern-frond");
  assert.ok(material);
  assert.equal(material.materialId, "fern-frond");
  assert.equal(material.generator.generatorVersion, FERN_FROND_V2_VERSION);
  assert.equal(material.generator.generate, createFernFrondV2);

  const prepared = prepareMaterialInsertion("fern-frond", 1, BASE);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.deepEqual(JSON.parse(serializePlantGraph(createFernFrond("plant-1", 8278, BASE))), fixture);
  assert.equal(prepared.graph.generatorVersion, FERN_FROND_V2_VERSION);
  assert.equal(prepared.graph.generatorVersion, "fern-frond-v2");
  assert.equal(prepared.graph.branches.size, 11);
  assert.equal(prepared.graph.organs.size, 10);
  assert.equal("materialId" in prepared.graph, false);
  assert.doesNotMatch(serializePlantGraph(prepared.graph), /"materialId"/);
  assert.equal(prepared.graph.branches.get("plant-1:rachis")!.stiffness, FERN_FROND_RESPONSE.rachis);

  const flowering = toCanonicalPlantGraph(createFloweringBranch("plant-1", 8278, BASE));
  assert.equal(flowering.branches.length, floweringFixture.branches.length);
  assert.equal(flowering.organs.length, floweringFixture.organs.length);
  assert.deepEqual(flowering.organs, floweringFixture.organs);
  assert.deepEqual(JSON.parse(serializePlantGraph(createLeafyShoot("plant-2", 9255, BASE))), leafyFixture);
});

test("fern-frond-v1 is a slender divided frond, distinct from the leafy shoot and the foliage fan", () => {
  for (const seed of SEEDS) {
    const fern = createFernFrond("plant-1", seed, BASE);
    const leafy = createLeafyShoot("plant-1", seed, BASE);
    const fan = createFoliageFan("plant-1", seed, BASE);
    assert.deepEqual(validatePlantGraph(fern), []);
    assert.equal(serializePlantGraph(fern), serializePlantGraph(createFernFrond("plant-1", seed, BASE)));
    const rachis = fern.branches.get("plant-1:rachis")!;
    const leafyStem = leafy.branches.get(leafy.rootBranchId)!;
    const fanStem = fan.branches.get(fan.rootBranchId)!;
    assert.equal(rachis.kind, "trunk");
    assert.equal(rachis.points.length, 17);
    assert.equal(rachis.radius, 0.027);
    assert.equal(rachis.stiffness, FERN_FROND_RESPONSE.rachis);
    assert.ok(rachis.radius < fanStem.radius);
    assert.ok(rachis.activeLength > fanStem.activeLength + 0.8);
    assert.ok(rachis.activeLength < leafyStem.activeLength - 0.6);
    assert.ok(rachis.activeLength > 3.6 && rachis.activeLength < 4);
    assert.equal([...fern.branches.values()].some((branch) => branch.kind === "lateral"), false);
    assert.equal([...fan.branches.values()].filter((branch) => branch.kind === "lateral").length, 3);
    assert.equal(legalBendStation(rachis) !== null, true);
    const pinnae = [...fern.branches.values()].filter((branch) => branch.kind === "petiole");
    assert.equal(pinnae.length, 8);
    assert.deepEqual(pinnae.map((branch) => branch.id), [
      "plant-1:pinna-1", "plant-1:pinna-2", "plant-1:pinna-3", "plant-1:pinna-4",
      "plant-1:pinna-5", "plant-1:pinna-6", "plant-1:pinna-7", "plant-1:pinna-8",
    ]);
    const distances = pinnae.map((branch) => branch.parentDistance);
    assert.ok(distances[0]! > 0.95, "the rachis keeps a basal grip below the first pinna");
    for (let index = 1; index < distances.length; index += 1) {
      assert.ok(distances[index]! > distances[index - 1]! + 0.2);
    }
    for (const stalk of pinnae) {
      assert.equal(stalk.stiffness, FERN_FROND_RESPONSE.stalk);
      assert.equal(stalk.points.length, 4);
      assert.equal(legalBendStation(stalk), null);
      assert.equal(stalk.parentId, rachis.id);
    }
    const blades = [...fern.organs.values()];
    assert.equal(blades.length, 8);
    assert.equal(blades.every((organ) => organ.kind === "leaf" && organ.active), true);
    const fernMax = Math.max(...blades.map((organ) => organ.scale));
    const leafyMax = Math.max(...[...leafy.organs.values()].map((organ) => organ.scale));
    assert.ok(fernMax < leafyMax - 0.1);
    assert.ok(fernMax < 0.95);
    const fernSize = visualSize(fern);
    const leafySize = visualSize(leafy);
    const fanSize = visualSize(fan);
    assert.ok(fernSize.y > fanSize.y + 0.6, `frond height ${fernSize.y} should clear the fan ${fanSize.y}`);
    assert.ok(leafySize.y > fernSize.y + 0.6, `leafy height ${leafySize.y} should clear the frond ${fernSize.y}`);
    assert.ok(fanSize.x > fernSize.x + 0.15, `fan width ${fanSize.x} should exceed the frond ${fernSize.x}`);
    assert.ok(fernSize.z < 0.55, `frond depth ${fernSize.z} should stay a flat feather`);
    assert.ok(leafySize.z > fernSize.z + 1);
    assert.ok(fanSize.z > fernSize.z + 0.5);
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(fern))), serializePlantGraph(fern));
  }
  const appearance = getMaterialAppearance("fern-frond-v1");
  const leafyAppearance = getMaterialAppearance("leafy-shoot-v1");
  const fanAppearance = getMaterialAppearance("foliage-fan-v1");
  assert.equal(appearance.leaf.form, "pinnate");
  assert.equal(leafyAppearance.leaf.form, "lanceolate");
  assert.equal(fanAppearance.leaf.form, "elliptic");
  assert.equal(appearance.branchColors.trunk, 0x2c5c45);
  assert.notEqual(appearance.branchColors.trunk, leafyAppearance.branchColors.trunk);
  assert.notEqual(appearance.branchColors.trunk, fanAppearance.branchColors.trunk);
  assert.notEqual(appearance.leaf.color, leafyAppearance.leaf.color);
  assert.notEqual(appearance.leaf.color, fanAppearance.leaf.color);
  assert.equal(LEAFY_RESPONSE.stem < FERN_FROND_RESPONSE.rachis, true);
  assert.equal(FERN_FROND_RESPONSE.rachis < FOLIAGE_FAN_RESPONSE.stem, true);

  const pinna = createLeafGeometry(8278, "pinnate");
  const positions = pinna.getAttribute("position");
  const span = (y0: number, y1: number) => {
    let max = 0;
    for (let index = 0; index < positions.count; index += 1) {
      const y = positions.getY(index);
      if (y < y0 || y >= y1) continue;
      max = Math.max(max, Math.abs(positions.getX(index)));
    }
    return max;
  };
  assert.ok(span(0.38, 0.46) < 0.03, "a notch between pinnules keeps only the costa");
  assert.ok(span(0.52, 0.62) > 0.25, "a pinnule reaches out from the costa");
  assert.equal(pinna.name, "living-line/pinnate-pinna");
  const lance = createLeafGeometry(8278, "lanceolate");
  assert.equal(lance.name, "living-line/creased-leaf");
  pinna.dispose();
  lance.dispose();
});

test("aim and bend keep frond stock; one pinna cut and a distal rachis cut stay local", () => {
  for (const seed of SEEDS) {
    const graph = createFernFrond("plant-1", seed, BASE);
    const before = serializePlantGraph(graph);
    const rachis = graph.branches.get("plant-1:rachis")!;
    const pinna = graph.branches.get("plant-1:pinna-4")!;
    const grabbed = sampleBranch(pinna, pinna.activeLength * 0.7);
    const aimed = aimBranch(graph, pinna.id, grabbed.position, add(grabbed.position, vec3(0.35, 0.15, -0.2)));
    assert.deepEqual(validatePlantGraph(aimed), []);
    for (const branch of graph.branches.values()) {
      assert.deepEqual(aimed.branches.get(branch.id)!.restLengths, branch.restLengths);
    }
    const station = rachis.activeLength * 0.54;
    const bent = bendBranch(graph, {
      branchId: rachis.id,
      stationDistance: station,
      target: add(sampleBranch(rachis, station).position, vec3(0.4, -0.2, 0.12)),
    });
    assert.deepEqual(validatePlantGraph(bent), []);
    assert.deepEqual(bent.branches.get(rachis.id)!.restLengths, rachis.restLengths);
    assert.notDeepEqual(bent.branches.get(rachis.id)!.points, rachis.points);
    for (const id of ["plant-1:pinna-1", "plant-1:pinna-8"]) {
      assert.deepEqual(bent.branches.get(id)!.restLengths, graph.branches.get(id)!.restLengths);
    }
    assert.equal(serializePlantGraph(graph), before);

    const one = previewPrune(graph, pinna.id, FERN_FROND_PINNA_CUT);
    assert.equal(serializePlantGraph(graph), before, "prune preview writes nothing");
    assert.deepEqual(one.removedBranchIds, []);
    assert.deepEqual(one.removedOrganIds, ["plant-1:pinna-blade-4"]);
    const cutOne = applyPrune(graph, one);
    assert.deepEqual(validatePlantGraph(cutOne), []);
    assert.equal(cutOne.branches.size, graph.branches.size);
    assert.equal(cutOne.organs.size, graph.organs.size);
    assert.equal(cutOne.organs.get("plant-1:pinna-blade-4")!.active, false);
    assert.equal(cutOne.branches.get(pinna.id)!.active, true);
    assert.ok(cutOne.branches.get(pinna.id)!.activeLength < pinna.activeLength);
    for (const [id, organ] of graph.organs) {
      const kept = cutOne.organs.get(id)!;
      if (id === "plant-1:pinna-blade-4") {
        assert.equal(kept.scale, organ.scale);
        assert.equal(kept.spin, organ.spin);
        continue;
      }
      assert.deepEqual(kept, organ);
    }

    const distal = fernFrondDistalCutDistance(graph);
    const plan = previewPrune(graph, rachis.id, distal);
    assert.deepEqual(plan.removedBranchIds, [
      "plant-1:pinna-5", "plant-1:pinna-6", "plant-1:pinna-7", "plant-1:pinna-8",
    ]);
    assert.deepEqual(plan.removedOrganIds, [
      "plant-1:pinna-blade-5", "plant-1:pinna-blade-6", "plant-1:pinna-blade-7", "plant-1:pinna-blade-8",
    ]);
    const cut = applyPrune(graph, plan);
    assert.deepEqual(validatePlantGraph(cut), []);
    assert.equal(cut.branches.get("plant-1:pinna-4")!.active, true);
    assert.equal(cut.organs.get("plant-1:pinna-blade-4")!.active, true);
    assert.equal(cut.organs.get("plant-1:pinna-blade-5")!.active, false);
    assert.deepEqual(cut.branches.get("plant-1:pinna-1"), graph.branches.get("plant-1:pinna-1"));
    assert.deepEqual(cut.organs.get("plant-1:pinna-blade-1"), graph.organs.get("plant-1:pinna-blade-1"));
    assert.equal(cut.branches.get("plant-1:pinna-8")!.active, false);
    assert.deepEqual(cut.branches.get("plant-1:pinna-8")!.points, graph.branches.get("plant-1:pinna-8")!.points);
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(cut))), serializePlantGraph(cut));
  }
});

test("a loaded frond keeps its copied stiffness instead of reapplying the profile", () => {
  const graph = createFernFrond("plant-1", 8278, BASE);
  const rachis = graph.branches.get("plant-1:rachis")!;
  assert.equal(rachis.stiffness, FERN_FROND_RESPONSE.rachis);
  rachis.stiffness = 0.91;
  const loaded = deserializePlantGraph(serializePlantGraph(graph));
  assert.equal(loaded.branches.get("plant-1:rachis")!.stiffness, 0.91);
  assert.notEqual(loaded.branches.get("plant-1:rachis")!.stiffness, FERN_FROND_RESPONSE.rachis);
  assert.equal(loaded.branches.get("plant-1:pinna-2")!.stiffness, FERN_FROND_RESPONSE.stalk);
});

test("the study bowl keeps a leafy line, a fan, a whole frond, and a shortened frond", () => {
  const graphs = buildFernFrondStudyGraphs();
  assert.equal(graphs.length, 4);
  const [leafy, fan, full, opened] = graphs;
  assert.equal(leafy!.generatorVersion, "leafy-shoot-v1");
  assert.equal(fan!.generatorVersion, "foliage-fan-v1");
  assert.equal(full!.generatorVersion, "fern-frond-v1");
  assert.equal(opened!.generatorVersion, "fern-frond-v1");
  assert.equal(leafy!.seed, 8278);
  assert.equal(fan!.seed, 9255);
  assert.equal(full!.seed, 10232);
  assert.equal(opened!.seed, successfulSeatIdentity(4).seed);
  assert.equal([...opened!.organs.values()].filter((organ) => organ.active).length, 4);
  assert.equal(opened!.organs.get("plant-4:pinna-blade-4")!.active, true);
  assert.equal(opened!.organs.get("plant-4:pinna-blade-5")!.active, false);
  assert.equal(opened!.branches.get("plant-4:pinna-8")!.active, false);
  const stock = translatePlantBase(createFernFrond("plant-4", successfulSeatIdentity(4).seed, BASE), FERN_FROND_STUDY_PLACEMENTS[3]!.base);
  assert.deepEqual(opened!.branches.get("plant-4:pinna-1"), stock.branches.get("plant-4:pinna-1"));
  assert.deepEqual(opened!.organs.get("plant-4:pinna-blade-2"), stock.organs.get("plant-4:pinna-blade-2"));
  for (const graph of graphs) {
    assert.deepEqual(validatePlantGraph(graph!), []);
    const root = graph!.branches.get(graph!.rootBranchId)!.points[0]!;
    assert.ok(Math.hypot(root.x, root.z) <= 1.22 + 1e-8);
  }

  const loaded = parseGarden(JSON.stringify(studyBackup));
  const built = fernFrondStudyGardenDocument();
  assert.deepEqual(loaded, JSON.parse(JSON.stringify(built)));
  assert.equal(loaded.entries[0]?.title, "A feather beside a leafy line and a fan");
  assert.deepEqual(loaded.entries[0]?.arrangement.camera, canonicalCameraPose("front"));
  const values = new Map<string, string>();
  const garden = new GardenStore(GARDEN_KEY, {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  });
  garden.load();
  garden.keep(built.entries[0]!);
  const copy = structuredClone(garden.load().entries[0]!.arrangement);
  const copied = deserializePlantGraph(copy.plants[2]!);
  copy.plants[2] = toCanonicalPlantGraph(applyPrune(
    copied,
    previewPrune(copied, copied.rootBranchId, fernFrondDistalCutDistance(copied)),
  ));
  assert.deepEqual(
    garden.load().entries[0]!.arrangement,
    JSON.parse(JSON.stringify(built.entries[0]!.arrangement)),
  );
  assert.notDeepEqual(copy.plants[2], garden.load().entries[0]!.arrangement.plants[2]);
});

test("registering fern-frond leaves reference-pair and round 4 profiles unchanged", () => {
  const pair = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  const mixed = createWorkbenchFixture("mixed", 8278, 6, { remember: false });
  assert.deepEqual(mixed, pair);
  const round4 = createWorkbenchFixture("round4-candidates", 8278, 6, { remember: false });
  assert.deepEqual(round4.plants.map((plant) => plant.generatorVersion), [
    "foliage-fan-v1", "blossom-spray-v1", "nodding-flower-v1",
    "foliage-fan-v1", "blossom-spray-v1", "nodding-flower-v1",
  ]);
  const palette = createWorkbenchFixture("round4-palette", 8278, 12, { remember: false });
  assert.equal(palette.plants.some((plant) => plant.generatorVersion === "fern-frond-v1"), false);
  const comparison = createWorkbenchFixture("references-plus-fern-frond", 8278, 6, { remember: false });
  assert.deepEqual(comparison.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "fern-frond-v1",
    "one-branch-v1", "leafy-shoot-v1", "fern-frond-v1",
  ]);
  assert.deepEqual(comparison.plants.find((plant) => plant.id === "plant-1"), pair.plants.find((plant) => plant.id === "plant-1"));
  assert.deepEqual(comparison.plants.find((plant) => plant.id === "plant-2"), pair.plants.find((plant) => plant.id === "plant-2"));
  const dynamic = createWorkbenchFixture("all-registered-materials", 8278, 6, { remember: false });
  assert.equal(dynamic.plants.some((plant) => plant.generatorVersion === "fern-frond-v1"), false);
});

test("golden fern-frond fixture file is the serialized plant-1 graph", () => {
  const raw = readFileSync(new URL("../../fixtures/plant-1-fern-frond-v1.json", import.meta.url), "utf8");
  assert.equal(raw, `${serializePlantGraph(createFernFrond("plant-1", 8278, BASE), 2)}\n`);
});

test("buildFernFrondStudyGraph is the cut used by the garden backup", () => {
  const opened = buildFernFrondStudyGraph(FERN_FROND_STUDY_PLACEMENTS[3]!);
  assert.equal(opened.id, "plant-4");
  assert.equal(opened.branches.get("plant-4:pinna-5")!.active, false);
  assert.equal(opened.organs.get("plant-4:pinna-blade-1")!.active, true);
});
