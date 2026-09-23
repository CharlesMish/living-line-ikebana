import assert from "node:assert/strict";
import test from "node:test";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { parseGarden } from "../../src/app/garden.ts";
import { createWorkbenchFixture, describeFixture } from "../../src/app/workbench.ts";
import {
  createBerryTwig,
  createFernFrond,
  successfulSeatIdentity,
  translatePlantBase,
  validatePlantGraph,
} from "../../src/core/index.ts";
import backup from "../../artifacts/phase2-arrangements-garden.json";
import {
  BERRY_CLUSTER_CLEAR_DISTANCE,
  PHASE2_KEPT_PLACEMENTS,
  PHASE2_OPENED_PLACEMENTS,
  buildPhase2KeptGraphs,
  buildPhase2OpenedGraphs,
  phase2ArrangementsGardenDocument,
} from "./phase2Arrangements.ts";

const ORIGIN = { x: 0, y: 0.55, z: 0 };

test("phase 2 bowls freeze seat seeds and the two player choices", () => {
  assert.deepEqual(PHASE2_KEPT_PLACEMENTS.map((placement) => successfulSeatIdentity(placement.ordinal)), [
    { id: "plant-1", seed: 8278 },
    { id: "plant-2", seed: 9255 },
    { id: "plant-3", seed: 10232 },
  ]);
  assert.deepEqual(PHASE2_OPENED_PLACEMENTS.map((placement) => successfulSeatIdentity(placement.ordinal).seed), [
    8278, 9255, 10232, 11209,
  ]);

  const [flowering, berriesKept, pinnaCut] = buildPhase2KeptGraphs();
  assert.equal(flowering!.generatorVersion, "one-branch-v1");
  assert.equal(berriesKept!.generatorVersion, "berry-twig-v1");
  assert.equal(pinnaCut!.generatorVersion, "fern-frond-v1");
  assert.equal([...berriesKept!.organs.values()].every((organ) => organ.active), true);
  assert.equal(pinnaCut!.organs.get("plant-3:pinna-blade-2")!.active, false);
  assert.equal([...pinnaCut!.organs.values()].filter((organ) => organ.active).length, 7);
  const intactFern = translatePlantBase(
    createFernFrond("plant-3", 10232, ORIGIN),
    PHASE2_KEPT_PLACEMENTS[2]!.base,
  );
  assert.deepEqual(pinnaCut!.organs.get("plant-3:pinna-blade-1"), intactFern.organs.get("plant-3:pinna-blade-1"));
  assert.deepEqual(pinnaCut!.branches.get("plant-3:pinna-1"), intactFern.branches.get("plant-3:pinna-1"));
  assert.equal(pinnaCut!.branches.get("plant-3:pinna-2")!.active, true);
  assert.ok(pinnaCut!.branches.get("plant-3:pinna-2")!.activeLength < intactFern.branches.get("plant-3:pinna-2")!.activeLength);

  const [leafy, clusterCleared, rachisCut, fan] = buildPhase2OpenedGraphs();
  assert.equal(leafy!.generatorVersion, "leafy-shoot-v1");
  assert.equal(fan!.generatorVersion, "foliage-fan-v1");
  assert.equal(clusterCleared!.seed, 9255);
  assert.equal(rachisCut!.seed, 10232);
  const intactBerry = translatePlantBase(
    createBerryTwig("plant-2", 9255, ORIGIN),
    PHASE2_OPENED_PLACEMENTS[1]!.base,
  );
  const clearedBerries = [...clusterCleared!.organs.values()].filter((organ) => organ.kind === "berry" && !organ.active);
  assert.ok(clearedBerries.length >= 3);
  assert.ok(clearedBerries.every((organ) => organ.id.startsWith("plant-2:berry-2-")));
  assert.equal([...clusterCleared!.organs.values()].filter((organ) => organ.id.startsWith("plant-2:berry-1-") && organ.active).length, 3);
  assert.equal(clusterCleared!.branches.get("plant-2:cluster-2")!.active, true);
  assert.ok(clusterCleared!.branches.get("plant-2:cluster-2")!.activeLength <= BERRY_CLUSTER_CLEAR_DISTANCE + 1e-8);
  assert.deepEqual(clusterCleared!.branches.get("plant-2:cluster-1"), intactBerry.branches.get("plant-2:cluster-1"));
  assert.deepEqual(clusterCleared!.organs.get("plant-2:berry-1-1"), intactBerry.organs.get("plant-2:berry-1-1"));
  assert.equal([...rachisCut!.organs.values()].filter((organ) => organ.active).length, 4);
  assert.equal(rachisCut!.organs.get("plant-3:pinna-blade-4")!.active, true);
  assert.equal(rachisCut!.organs.get("plant-3:pinna-blade-5")!.active, false);
  const intactOpenedFern = translatePlantBase(
    createFernFrond("plant-3", 10232, ORIGIN),
    PHASE2_OPENED_PLACEMENTS[2]!.base,
  );
  assert.deepEqual(rachisCut!.organs.get("plant-3:pinna-blade-1"), intactOpenedFern.organs.get("plant-3:pinna-blade-1"));

  for (const graph of [...buildPhase2KeptGraphs(), ...buildPhase2OpenedGraphs()]) {
    assert.deepEqual(validatePlantGraph(graph), []);
    const root = graph.branches.get(graph.rootBranchId)!.points[0]!;
    assert.ok(Math.hypot(root.x, root.z) <= 1.22 + 1e-8);
  }

  const round4 = describeFixture(createWorkbenchFixture("round4-palette", 8278, 12, { remember: false }));
  assert.equal(round4.plantsInIdentityOrder.some((plant) =>
    plant.generatorVersion === "berry-twig-v1" || plant.generatorVersion === "fern-frond-v1"), false);
});

test("the phase 2 garden backup is the two frozen bowls", () => {
  const loaded = parseGarden(JSON.stringify(backup));
  const built = phase2ArrangementsGardenDocument();
  assert.deepEqual(loaded, JSON.parse(JSON.stringify(built)));
  assert.deepEqual(backup, JSON.parse(JSON.stringify(built)));
  assert.deepEqual(loaded.entries.map((entry) => entry.title), [
    "Clusters kept, one pinna cut",
    "One cluster cleared, upper frond cut",
  ]);
  assert.deepEqual(loaded.entries[0]?.arrangement.camera, canonicalCameraPose("front"));
  assert.equal(loaded.entries[0]?.arrangement.successfulPlantOrdinal, 3);
  assert.equal(loaded.entries[1]?.arrangement.successfulPlantOrdinal, 4);
});
