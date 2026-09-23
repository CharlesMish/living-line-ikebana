import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalCameraPose } from "../../src/app/camera.ts";
import {
  BEND_STATION_FRACTIONS,
  bendStationsMode,
  planBendStationChange,
  preferenceAfterBranchChange,
  recordsFixedTouchStudy,
  resolveBendStations,
  selectBendStation,
} from "../../src/app/bendStations.ts";
import { readExperimentConfig, urlForBendVariant } from "../../src/app/config.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import {
  bendBranch,
  bendStationAtFraction,
  createArchingTrailer,
  createBareBranch,
  createLeafyShoot,
  createReed,
  distance,
  pruneBranch,
  sampleBranch,
  type Branch,
  type PlantGraph,
} from "../../src/core/index.ts";
import {
  assertAttachmentCoincidence,
  assertClose,
  assertRestLengthsPreserved,
  segmentDirections,
} from "../core/helpers.ts";

const base = { x: 0, y: 0.55, z: 0 };
const html = readFileSync(join(process.cwd(), "index.html"), "utf8");

function stem(graph: PlantGraph): Branch {
  const branch = graph.branches.get(graph.rootBranchId);
  assert.ok(branch);
  return branch;
}

function withStock(branch: Branch, restLengths: number[], kind: Branch["kind"] = "trunk"): Branch {
  const points = [{ x: 0, y: 0, z: 0 }];
  let cursor = 0;
  for (const length of restLengths) {
    cursor += length;
    points.push({ x: cursor, y: 0, z: 0 });
  }
  return {
    ...branch,
    kind,
    active: true,
    points,
    restLengths,
    activeLength: cursor,
  };
}

test("bend-stations is opt-in and touch excludes it at startup", () => {
  const off = readExperimentConfig(new URL("http://localhost/"));
  assert.equal(off.bendVariant, "bead");
  assert.equal(off.bendStationsRequested, false);
  assert.equal(off.bendStationsMode, "off");

  const on = readExperimentConfig(new URL("http://localhost/?experiment=bend-stations"));
  assert.equal(on.bendVariant, "bead");
  assert.equal(on.bendStationsMode, "on");

  const excluded = readExperimentConfig(new URL("http://localhost/?experiment=bend-stations&bend=touch"));
  assert.equal(excluded.bendVariant, "touch");
  assert.equal(excluded.bendStationsRequested, true);
  assert.equal(excluded.bendStationsMode, "excluded");
  assert.equal(bendStationsMode(true, "touch"), "excluded");
  assert.equal(bendStationsMode(true, "bead"), "on");
  assert.equal(bendStationsMode(false, "touch"), "off");

  const next = urlForBendVariant("touch", new URL("http://localhost/?experiment=bend-stations&fresh=1"));
  assert.equal(next.searchParams.get("bend"), "touch");
  assert.equal(next.searchParams.get("experiment"), "bend-stations");
  assert.equal(next.searchParams.get("fresh"), null);
});

test("the shell offers one Lower / Middle / Upper selector, hidden until the experiment turns it on", () => {
  assert.match(html, /id="bend-stations"[^>]*hidden/);
  assert.match(html, /data-testid="bend-station-lower"/);
  assert.match(html, /data-testid="bend-station-middle"/);
  assert.match(html, /data-testid="bend-station-upper"/);
  assert.match(html, />Lower</);
  assert.match(html, />Middle</);
  assert.match(html, />Upper</);
  assert.match(html, /id="bend-stations-exclusion"[^>]*hidden/);
  assert.equal([...html.matchAll(/data-bend-station="/g)].length, 3);
});

test("experimental fractions clamp through the legal station and collapse duplicates", () => {
  assert.deepEqual(BEND_STATION_FRACTIONS, { lower: 0.32, middle: 0.54, upper: 0.76 });
  const leafy = stem(createLeafyShoot("plant-1", 8278, base));
  const stations = resolveBendStations(leafy);
  assert.deepEqual(stations.map((station) => station.id), ["lower", "middle", "upper"]);
  for (const station of stations) {
    assertClose(station.distance, bendStationAtFraction(leafy, station.fraction)!, 1e-12, station.id);
    assert.ok(station.distance >= leafy.restLengths[0]);
    assert.ok(station.distance <= leafy.activeLength - leafy.restLengths.at(-1)!);
  }
  assert.equal(selectBendStation(leafy, "middle")?.fraction, 0.54);

  const collapsedEnds = withStock(leafy, [0.8, 0.05, 0.1]);
  const one = resolveBendStations(collapsedEnds);
  assert.equal(one.length, 1);
  assert.deepEqual(one[0]?.aliases, ["lower", "middle", "upper"]);
  assert.equal(selectBendStation(collapsedEnds, "upper")?.id, "lower");

  const sharedTip = withStock(leafy, [0.4, 0.05, 0.4]);
  const two = resolveBendStations(sharedTip);
  assert.deepEqual(two.map((station) => station.id), ["lower", "middle"]);
  assert.deepEqual(two[1]?.aliases, ["middle", "upper"]);
  assert.equal(selectBendStation(sharedTip, "upper")?.id, "middle");

  const petiole = { ...leafy, kind: "petiole" as const };
  assert.deepEqual(resolveBendStations(petiole), []);
  assert.equal(selectBendStation(petiole, "middle"), null);
});

test("branch changes return to Middle; the same branch keeps its station", () => {
  assert.equal(preferenceAfterBranchChange("plant-1:stem", "plant-1:twig", "upper"), "middle");
  assert.equal(preferenceAfterBranchChange("plant-1:stem", null, "upper"), "middle");
  assert.equal(preferenceAfterBranchChange("plant-1:stem", "plant-1:stem", "upper"), "upper");
  assert.equal(preferenceAfterBranchChange(null, null, "lower"), "lower");
});

test("a live station change cancels before the preference moves", () => {
  const graph = createLeafyShoot("plant-1", 8278, base);
  const branch = stem(graph);
  const idle = planBendStationChange({
    mode: "on",
    transactionActive: false,
    branch,
    current: "middle",
    requested: "lower",
  });
  assert.equal(idle.cancelFirst, false);
  assert.equal(idle.preference, "lower");

  const live = planBendStationChange({
    mode: "on",
    transactionActive: true,
    branch,
    current: "lower",
    requested: "upper",
  });
  assert.equal(live.cancelFirst, true);
  assert.equal(live.preference, "upper");

  const repeat = planBendStationChange({
    mode: "on",
    transactionActive: true,
    branch,
    current: "upper",
    requested: "upper",
  });
  assert.equal(repeat.cancelFirst, false);
  assert.equal(repeat.preference, "upper");

  const touch = planBendStationChange({
    mode: "excluded",
    transactionActive: true,
    branch,
    current: "middle",
    requested: "lower",
  });
  assert.equal(touch.cancelFirst, false);
  assert.equal(touch.preference, "middle");
});

test("active bend-stations sessions are left out of the fixed-versus-touch study", () => {
  assert.equal(recordsFixedTouchStudy("on"), false);
  assert.equal(recordsFixedTouchStudy("off"), true);
  assert.equal(recordsFixedTouchStudy("excluded"), true);
});

test("station bends freeze the chosen distance, cancel without save, and do not jump at the next station", () => {
  const graph = createLeafyShoot("plant-1", 8278, base);
  const branch = stem(graph);
  const lower = selectBendStation(branch, "lower");
  const upper = selectBendStation(branch, "upper");
  assert.ok(lower && upper);
  const events: string[] = [];
  const coordinator = new TransactionCoordinator(
    createDomainAdapters(),
    {
      plants: new Map([[graph.id, graph]]),
      camera: canonicalCameraPose("front"),
      selectedPlantId: graph.id,
      successfulPlantOrdinal: 4,
    },
    {
      posture: "arrange",
      tool: "shape",
      view: "front",
      bendVariant: "bead",
      onAutosave: () => events.push("save"),
      onCancel: (event) => events.push(`cancel:${event.reason}`),
    },
  );

  const before = JSON.stringify([...branch.points]);
  const station = sampleBranch(branch, lower.distance).position;
  assert.equal(coordinator.beginBend(1, {
    plantId: graph.id,
    branchId: branch.id,
    beadStationDistance: lower.distance,
    touchMaterialDistance: lower.distance,
    context: {},
  }, { target: { x: station.x + 0.4, y: station.y, z: station.z } }).ok, true);
  const active = coordinator.getDebugState().active;
  assert.equal(active?.kind, "bend");
  if (active?.kind === "bend") assertClose(active.stationDistance, lower.distance, 1e-12, "frozen station");
  assert.equal(coordinator.updateBend(1, {
    target: { x: station.x + 0.55, y: station.y + 0.1, z: station.z },
  }).ok, true);
  const during = coordinator.getDocumentSnapshot().plants.get(graph.id);
  assert.equal(JSON.stringify([...during!.branches.get(branch.id)!.points]), before);
  const preview = coordinator.getPresentationState().active;
  assert.equal(preview?.kind, "bend");
  if (preview?.kind === "bend") {
    assert.ok(distance(preview.graph.branches.get(branch.id)!.points.at(-1)!, branch.points.at(-1)!) > 0.01);
  }

  assert.equal(coordinator.interrupt("experiment-command").ok, true);
  assert.deepEqual(events, ["cancel:experiment-command"]);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 4);
  const restored = coordinator.getDocumentSnapshot().plants.get(graph.id)!;
  assert.equal(JSON.stringify([...restored.branches.get(branch.id)!.points]), before);

  const quiet = sampleBranch(restored.branches.get(branch.id)!, upper.distance).position;
  assert.equal(coordinator.beginBend(2, {
    plantId: graph.id,
    branchId: branch.id,
    beadStationDistance: upper.distance,
    touchMaterialDistance: upper.distance,
    context: {},
  }, { target: quiet }).ok, true);
  const started = coordinator.getPresentationState().active;
  assert.equal(started?.kind, "bend");
  if (started?.kind === "bend") {
    const next = started.graph.branches.get(branch.id)!;
    next.points.forEach((point, index) => {
      assertClose(distance(point, restored.branches.get(branch.id)!.points[index]!), 0, 1e-8, `point ${index}`);
    });
  }
  assert.equal(coordinator.interrupt("experiment-command").ok, true);
  assert.deepEqual(events, ["cancel:experiment-command", "cancel:experiment-command"]);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 4);
});

test("a prune keeps history, then a station switch still cancels before moving", () => {
  const graph = createLeafyShoot("plant-1", 8278, base);
  const branch = stem(graph);
  const events: string[] = [];
  const coordinator = new TransactionCoordinator(
    createDomainAdapters(),
    {
      plants: new Map([[graph.id, graph]]),
      camera: canonicalCameraPose("front"),
      selectedPlantId: graph.id,
      successfulPlantOrdinal: 2,
    },
    {
      posture: "arrange",
      tool: "shape",
      view: "front",
      bendVariant: "bead",
      onAutosave: () => events.push("save"),
      onCancel: () => events.push("cancel"),
    },
  );
  const beforeStations = resolveBendStations(branch);
  coordinator.commandTool("prune");
  const cut = branch.activeLength * 0.72;
  assert.equal(coordinator.beginPrune(1, {
    plantId: graph.id,
    branchId: branch.id,
    acquiredMaterialDistance: cut,
    context: {},
  }, { distance: cut }).ok, true);
  assert.equal(coordinator.release(1).ok, true);
  assert.deepEqual(events, ["save"]);
  const pruned = coordinator.getDocumentSnapshot().plants.get(graph.id)!;
  const prunedStem = pruned.branches.get(branch.id)!;
  assert.ok(prunedStem.activeLength < branch.activeLength);
  assert.equal(pruned.branches.size, graph.branches.size);
  assert.equal(pruned.organs.size, graph.organs.size);
  assert.equal([...pruned.branches.values(), ...pruned.organs.values()].some((item) => !item.active), true);
  const afterStations = resolveBendStations(prunedStem);
  assert.ok(afterStations.length >= 1);
  assert.ok(Math.abs(afterStations.find((station) => station.aliases.includes("middle"))!.distance
    - beforeStations.find((station) => station.aliases.includes("middle"))!.distance) > 1e-4);

  coordinator.commandTool("shape");
  const middle = selectBendStation(prunedStem, "middle")!;
  const point = sampleBranch(prunedStem, middle.distance).position;
  assert.equal(coordinator.beginBend(3, {
    plantId: graph.id,
    branchId: branch.id,
    beadStationDistance: middle.distance,
    touchMaterialDistance: middle.distance,
    context: {},
  }, { target: { x: point.x + 0.35, y: point.y, z: point.z } }).ok, true);
  assert.equal(coordinator.updateBend(3, {
    target: { x: point.x + 0.7, y: point.y + 0.05, z: point.z - 0.1 },
  }).ok, true);
  const plan = planBendStationChange({
    mode: "on",
    transactionActive: true,
    branch: prunedStem,
    current: "middle",
    requested: "lower",
  });
  assert.equal(plan.cancelFirst, true);
  const prunedPoints = JSON.stringify([...prunedStem.points]);
  assert.equal(coordinator.interrupt("experiment-command").ok, true);
  assert.deepEqual(events, ["save", "cancel"]);
  const afterCancel = coordinator.getDocumentSnapshot().plants.get(graph.id)!;
  assert.equal(JSON.stringify([...afterCancel.branches.get(branch.id)!.points]), prunedPoints);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 2);
  assertRestLengthsPreserved(pruned, afterCancel);
});

function bendToward(graph: PlantGraph, fraction: number, xAmount: number): PlantGraph {
  const branch = stem(graph);
  const distance = bendStationAtFraction(branch, fraction);
  assert.ok(distance !== null);
  const station = sampleBranch(branch, distance);
  return bendBranch(graph, {
    branchId: branch.id,
    stationDistance: distance,
    target: { x: station.position.x + xAmount, y: station.position.y, z: station.position.z },
  });
}

function signedLocalTurns(points: Branch["points"]): number[] {
  const directions = segmentDirections(points);
  return directions.slice(0, -1).map((first: { x: number; y: number; z: number }, index: number) => {
    const second = directions[index + 1];
    const crossZ = first.x * second.y - first.y * second.x;
    const crossX = first.y * second.z - first.z * second.y;
    const crossY = first.z * second.x - first.x * second.z;
    const angle = Math.acos(Math.max(-1, Math.min(1, first.x * second.x + first.y * second.y + first.z * second.z)));
    const sign = Math.sign(crossZ || crossX || crossY);
    return sign * angle;
  });
}

function turnDeltas(before: Branch, after: Branch): number[] {
  const base = signedLocalTurns(before.points);
  return signedLocalTurns(after.points).map((turn, index) => turn - base[index]);
}

function extreme(values: number[]): number {
  return values.reduce((best, value) => Math.abs(value) > Math.abs(best) ? value : best, 0);
}

function curvaturePair(graph: PlantGraph) {
  const before = stem(graph);
  const paired = bendToward(bendToward(graph, BEND_STATION_FRACTIONS.lower, 0.45), BEND_STATION_FRACTIONS.upper, -0.45);
  const strong = bendToward(graph, BEND_STATION_FRACTIONS.middle, 0.9);
  const pairedDeltas = turnDeltas(before, stem(paired));
  const strongDeltas = turnDeltas(before, stem(strong));
  const split = Math.floor(pairedDeltas.length * 0.45);
  return {
    graph,
    paired,
    strong,
    proximal: extreme(pairedDeltas.slice(0, split)),
    distal: extreme(pairedDeltas.slice(split)),
    pairPeak: Math.max(...pairedDeltas.map((delta) => Math.abs(delta))),
    strongPeak: Math.max(...strongDeltas.map((delta) => Math.abs(delta))),
    strongSignificant: strongDeltas.filter((delta) => Math.abs(delta) > 0.008),
  };
}

test("a lower bend plus an opposite upper bend changes curvature, not only total deflection", () => {
  for (const [name, graph] of [
    ["leafy", createLeafyShoot("plant-1", 8278, base)],
    ["reed", createReed("plant-1", 8278, base)],
    ["woody", createBareBranch("plant-1", 8278, base)],
  ] as const) {
    const result = curvaturePair(graph);
    assert.ok(result.proximal * result.distal < 0, `${name} proximal ${result.proximal} distal ${result.distal}`);
    assert.ok(Math.abs(result.proximal) > 0.01 && Math.abs(result.distal) > 0.01, name);
    assert.ok(result.strongPeak > result.pairPeak, `${name} stronger midpoint is still one curve`);
    assert.ok(result.strongSignificant.length > 0, `${name} midpoint bend moved`);
    assert.ok(
      result.strongSignificant.every((delta) => Math.sign(delta) === Math.sign(result.strongSignificant[0])),
      `${name} midpoint stays one sign`,
    );
    assertRestLengthsPreserved(graph, result.paired);
    assertRestLengthsPreserved(graph, result.strong);
    assertAttachmentCoincidence(result.paired);
    assert.equal(result.paired.branches.size, graph.branches.size);
    assert.equal([...result.paired.branches.values()].filter((item) => !item.active).length, 0);
  }
});

test("the arching trailer is bent separately and is not promised the same curve", () => {
  const graph = createArchingTrailer("plant-1", 8278, base);
  const before = stem(graph);
  const paired = bendToward(bendToward(graph, 0.32, 0.45), 0.76, -0.45);
  const after = stem(paired);
  assertRestLengthsPreserved(graph, paired);
  assertAttachmentCoincidence(paired);
  const moved = segmentDirections(after.points).some((direction: { x: number }, index: number) => {
    const old = segmentDirections(before.points)[index];
    return Math.abs(direction.x - old.x) + Math.abs(direction.y - old.y) + Math.abs(direction.z - old.z) > 0.01;
  });
  assert.equal(moved, true);
  // The authored arch is not required to match the leafy, reed, or woody sign split.
  const deltas = turnDeltas(before, after);
  assert.ok(deltas.some((delta) => Math.abs(delta) > 0.005));
});
