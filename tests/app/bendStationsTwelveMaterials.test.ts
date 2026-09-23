import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalCameraPose } from "../../src/app/camera.ts";
import {
  planBendStationChange,
  preferenceAfterBranchChange,
  recordsFixedTouchStudy,
  resolveBendStations,
  selectBendStation,
  type BendStationId,
} from "../../src/app/bendStations.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { TELEMETRY_INSTRUMENT_VERSION } from "../../src/app/telemetry.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import {
  bendBranch,
  deserializePlantGraph,
  pruneBranch,
  sampleBranch,
  createArchingTrailer,
  createBareBranch,
  createBerryTwig,
  createBlossomSpray,
  createFernFrond,
  createFlowerVolume,
  createFloweringBranch,
  createFoliageFan,
  createLeafyShoot,
  createNoddingFlower,
  createReed,
  createSingleFlower,
  type Branch,
  type PlantGraph,
} from "../../src/core/index.ts";
import {
  assertAttachmentCoincidence,
  assertRestLengthsPreserved,
  segmentDirections,
} from "../core/helpers.ts";

const base = { x: 0, y: 0.55, z: 0 };
const seed = 8278;

type Specimen = {
  readonly group: "woody" | "leafy" | "reed" | "trailer" | "flower" | "frond" | "fan" | "berry";
  readonly material: string;
  readonly create: (id: string, specimenSeed: number) => PlantGraph;
};

const specimens: readonly Specimen[] = [
  { group: "woody", material: "flowering-branch", create: (id, specimenSeed) => createFloweringBranch(id, specimenSeed, base) },
  { group: "woody", material: "bare-branch", create: (id, specimenSeed) => createBareBranch(id, specimenSeed, base) },
  { group: "leafy", material: "leafy-shoot", create: (id, specimenSeed) => createLeafyShoot(id, specimenSeed, base) },
  { group: "reed", material: "reed", create: (id, specimenSeed) => createReed(id, specimenSeed, base) },
  { group: "trailer", material: "arching-trailer", create: (id, specimenSeed) => createArchingTrailer(id, specimenSeed, base) },
  { group: "flower", material: "single-flower", create: (id, specimenSeed) => createSingleFlower(id, specimenSeed, base) },
  { group: "flower", material: "flower-volume", create: (id, specimenSeed) => createFlowerVolume(id, specimenSeed, base) },
  { group: "flower", material: "blossom-spray", create: (id, specimenSeed) => createBlossomSpray(id, specimenSeed, base) },
  { group: "flower", material: "nodding-flower", create: (id, specimenSeed) => createNoddingFlower(id, specimenSeed, base) },
  { group: "frond", material: "fern-frond", create: (id, specimenSeed) => createFernFrond(id, specimenSeed, base) },
  { group: "fan", material: "foliage-fan", create: (id, specimenSeed) => createFoliageFan(id, specimenSeed, base) },
  { group: "berry", material: "berry-twig", create: (id, specimenSeed) => createBerryTwig(id, specimenSeed, base) },
];

type Shaping = "ineligible" | "one-station" | "split" | "same-sign" | "little-movement";

type MatrixRow = {
  readonly label: string;
  readonly branchId: string;
  readonly kind: string;
  readonly activeLength: number;
  readonly stations: number;
  readonly aliases: string;
  readonly separation: number | null;
  readonly shaping: Shaping;
  readonly proximal: number | null;
  readonly distal: number | null;
};

function eligible(branch: Branch): boolean {
  return branch.active && (branch.kind === "trunk" || branch.kind === "lateral" || branch.kind === "twig");
}

function bendAt(graph: PlantGraph, branchId: string, stationDistance: number, xAmount: number): PlantGraph {
  const branch = graph.branches.get(branchId);
  assert.ok(branch);
  const station = sampleBranch(branch, stationDistance);
  return bendBranch(graph, {
    branchId,
    stationDistance,
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
  const baseTurns = signedLocalTurns(before.points);
  return signedLocalTurns(after.points).map((turn, index) => turn - (baseTurns[index] ?? 0));
}

function extreme(values: number[]): number {
  return values.reduce((best, value) => Math.abs(value) > Math.abs(best) ? value : best, 0);
}

function organSignature(graph: PlantGraph): string[] {
  return [...graph.organs.values()]
    .map((organ) => [organ.id, organ.kind, organ.branchId, organ.distance, organ.spin, organ.scale, organ.active].join("|"))
    .sort();
}

function assertStockAndDetail(before: PlantGraph, after: PlantGraph, label: string): void {
  assert.equal(after.branches.size, before.branches.size, `${label} branch count`);
  assert.equal(after.organs.size, before.organs.size, `${label} organ count`);
  assert.deepEqual(organSignature(after), organSignature(before), `${label} attached detail`);
  assertRestLengthsPreserved(before, after, [...before.branches.keys()]);
  assertAttachmentCoincidence(after);
}

/**
 * Lower then opposite upper, compared with the resting curve.
 * This calls the existing solver. It does not add a station solver.
 */
function measureBranch(label: string, graph: PlantGraph, branch: Branch): MatrixRow {
  const stations = resolveBendStations(branch);
  const aliases = stations.map((station) => `${station.id}:${station.aliases.join("+")}`).join(" ");
  if (stations.length === 0) {
    return {
      label,
      branchId: branch.id,
      kind: branch.kind,
      activeLength: branch.activeLength,
      stations: 0,
      aliases: "",
      separation: null,
      shaping: "ineligible",
      proximal: null,
      distal: null,
    };
  }
  if (stations.length < 2) {
    return {
      label,
      branchId: branch.id,
      kind: branch.kind,
      activeLength: branch.activeLength,
      stations: stations.length,
      aliases,
      separation: 0,
      shaping: "one-station",
      proximal: null,
      distal: null,
    };
  }
  const lower = selectBendStation(branch, "lower");
  const upper = selectBendStation(branch, "upper");
  assert.ok(lower && upper);
  const paired = bendAt(bendAt(graph, branch.id, lower.distance, 0.45), branch.id, upper.distance, -0.45);
  assertStockAndDetail(graph, paired, `${label} paired`);
  const deltas = turnDeltas(branch, paired.branches.get(branch.id)!);
  const splitAt = Math.max(1, Math.floor(deltas.length * 0.45));
  const proximal = extreme(deltas.slice(0, splitAt));
  const distal = extreme(deltas.slice(splitAt));
  const peak = Math.max(...deltas.map((delta) => Math.abs(delta)));
  let shaping: Shaping = "little-movement";
  if (peak > 0.01 && proximal * distal < 0 && Math.abs(proximal) > 0.01 && Math.abs(distal) > 0.01) {
    shaping = "split";
  } else if (peak > 0.01) {
    shaping = "same-sign";
  }
  return {
    label,
    branchId: branch.id,
    kind: branch.kind,
    activeLength: branch.activeLength,
    stations: stations.length,
    aliases,
    separation: Math.abs(upper.distance - lower.distance),
    shaping,
    proximal,
    distal,
  };
}

function shortestLegalCut(branch: Branch): number {
  const minimum = branch.kind === "trunk" ? 0.62 : 0.045;
  const upper = Math.max(minimum, branch.activeLength - 0.025);
  return Math.min(branch.activeLength, minimum > upper ? upper : minimum);
}

function formatRow(row: MatrixRow): string {
  const length = row.activeLength.toFixed(3);
  const separation = row.separation === null ? "-" : row.separation.toFixed(3);
  const proximal = row.proximal === null ? "-" : row.proximal.toFixed(3);
  const distal = row.distal === null ? "-" : row.distal.toFixed(3);
  return `${row.label} ${row.branchId} ${row.kind} len=${length} stations=${row.stations} sep=${separation} ${row.shaping} proximal=${proximal} distal=${distal} [${row.aliases}]`;
}

const matrix: string[] = [];

function pushRow(row: MatrixRow): void {
  const line = formatRow(row);
  matrix.push(line);
  console.log(`BEND_STATIONS_ROW ${line}`);
}

describe("bend stations on the twelve-material tip", { concurrency: 1 }, () => {
test("twelve-material stems keep stock and attached detail across Lower then Upper", () => {
  for (const specimen of specimens) {
    const graph = specimen.create("plant-1", seed);
    const root = graph.branches.get(graph.rootBranchId);
    assert.ok(root);
    pushRow(measureBranch(`${specimen.group}/${specimen.material}`, graph, root));
    for (const branch of graph.branches.values()) {
      if (branch.id === root.id || !eligible(branch)) continue;
      pushRow(measureBranch(`${specimen.group}/${specimen.material}`, graph, branch));
    }
  }
  assert.ok(matrix.some((line) => line.includes("split")), "expected at least one opposite-station split");
});

test("a shortest legal prune keeps only distances the clamp still separates", () => {
  for (const specimen of specimens) {
    const graph = specimen.create("plant-1", seed);
    const root = graph.branches.get(graph.rootBranchId);
    assert.ok(root);
    const cut = shortestLegalCut(root);
    const pruned = pruneBranch(graph, root.id, cut);
    const shortened = pruned.branches.get(root.id);
    assert.ok(shortened);
    assert.ok(shortened.activeLength < root.activeLength - 1e-6, specimen.material);
    const stations = resolveBendStations(shortened);
    pushRow(measureBranch(`${specimen.group}/${specimen.material}/shortest`, pruned, shortened));
    if (stations.length === 1) {
      assert.ok(stations[0].aliases.length >= 2, `${specimen.material} collapse is unexplained`);
    }
    if (stations.length >= 2) {
      const distances = stations.map((station) => station.distance);
      for (let index = 1; index < distances.length; index += 1) {
        assert.ok(Math.abs(distances[index] - distances[index - 1]) > 1e-6, specimen.material);
      }
    }
    const plan = planBendStationChange({
      mode: "on",
      transactionActive: true,
      branch: shortened,
      current: "middle",
      requested: "upper",
    });
    const middle = selectBendStation(shortened, "middle");
    const upper = selectBendStation(shortened, "upper");
    const distinct = Boolean(
      middle && upper && Math.abs(middle.distance - upper.distance) > 1e-6,
    );
    assert.equal(plan.cancelFirst, distinct, specimen.material);
    assert.equal(plan.preference, distinct ? "upper" : "middle", specimen.material);
    if (stations.length === 1) {
      const bent = bendAt(pruned, shortened.id, stations[0].distance, 0.45);
      assertStockAndDetail(pruned, bent, `${specimen.material} shortened bend`);
    }
  }
});

test("station changes during a live edit cancel before the preference moves", () => {
  const cases = [
    ["woody", createBareBranch("plant-1", seed, base)],
    ["flower", createSingleFlower("plant-1", seed, base)],
    ["frond", createFernFrond("plant-1", seed, base)],
    ["leafy", createLeafyShoot("plant-1", seed, base)],
    ["reed", createReed("plant-1", seed, base)],
    ["trailer", createArchingTrailer("plant-1", seed, base)],
  ] as const;
  for (const [name, graph] of cases) {
    const branch = graph.branches.get(graph.rootBranchId)!;
    const stations = resolveBendStations(branch);
    assert.ok(stations.length >= 2, name);
    const events: string[] = [];
    const coordinator = new TransactionCoordinator(
      createDomainAdapters(),
      {
        plants: new Map([[graph.id, graph]]),
        camera: canonicalCameraPose("front"),
        selectedPlantId: graph.id,
        successfulPlantOrdinal: 3,
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
    const lower = selectBendStation(branch, "lower")!;
    const point = sampleBranch(branch, lower.distance).position;
    const before = JSON.stringify([...branch.points]);
    assert.equal(coordinator.beginBend(1, {
      plantId: graph.id,
      branchId: branch.id,
      beadStationDistance: lower.distance,
      touchMaterialDistance: lower.distance,
      context: {},
    }, { target: { x: point.x + 0.4, y: point.y, z: point.z } }).ok, true);
    assert.equal(coordinator.updateBend(1, {
      target: { x: point.x + 0.55, y: point.y + 0.15, z: point.z },
    }).ok, true);
    const plan = planBendStationChange({
      mode: "on",
      transactionActive: true,
      branch,
      current: "lower",
      requested: "upper",
    });
    assert.equal(plan.cancelFirst, true, name);
    assert.equal(plan.preference, "upper", name);
    assert.equal(coordinator.interrupt("experiment-command").ok, true);
    assert.deepEqual(events, [`cancel:experiment-command`]);
    const restored = coordinator.getDocumentSnapshot().plants.get(graph.id)!;
    assert.equal(JSON.stringify([...restored.branches.get(branch.id)!.points]), before);
    assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 3);
    assert.equal(recordsFixedTouchStudy("on"), false);
  }
});

test("a different branch returns the temporary station to Middle", () => {
  const woody = createFloweringBranch("plant-1", seed, base);
  const ids = [...woody.branches.values()].filter(eligible).map((branch) => branch.id);
  assert.ok(ids.length >= 2);
  assert.equal(preferenceAfterBranchChange(ids[0], ids[1], "upper"), "middle");
  assert.equal(preferenceAfterBranchChange(ids[0], ids[0], "upper"), "upper");
  const fern = createFernFrond("plant-2", 9255, base);
  assert.equal(
    preferenceAfterBranchChange(woody.rootBranchId, fern.rootBranchId, "lower"),
    "middle",
  );
});

test("bend-stations stays out of the fixed-versus-touch buckets", () => {
  assert.equal(TELEMETRY_INSTRUMENT_VERSION, "4");
  assert.equal(recordsFixedTouchStudy("on"), false);
  assert.equal(recordsFixedTouchStudy("off"), true);
  assert.equal(recordsFixedTouchStudy("excluded"), true);
  const ui = readFileSync(join(process.cwd(), "src/app/ui.ts"), "utf8");
  assert.match(ui, /Choose Lower, Middle, or Upper, then drag the pale point/);
  assert.match(ui, /Drag the pale point into a broad curve/);
  assert.match(ui, /stationChoices\.length >= 2/);
});

test("Arrangement A and B branches follow the same station rules", () => {
  const fixture = JSON.parse(readFileSync(
    join(process.cwd(), "tests/fixtures/polish-baseline-arrangements.plants.json"),
    "utf8",
  )) as {
    arrangements: Array<{
      title: string;
      plants: unknown[];
    }>;
  };
  assert.equal(fixture.arrangements.length, 2);
  const seenBranches: string[] = [];
  for (const arrangement of fixture.arrangements) {
    const graphs = arrangement.plants.map((plant) => deserializePlantGraph(plant));
    for (const graph of graphs) {
      for (const branch of graph.branches.values()) {
        if (!branch.active) continue;
        if (!eligible(branch)) {
          assert.deepEqual(resolveBendStations(branch), [], `${arrangement.title} ${branch.id}`);
          continue;
        }
        pushRow(measureBranch(`${arrangement.title}`, graph, branch));
        seenBranches.push(branch.id);
        const stations = resolveBendStations(branch);
        if (stations.length < 2) {
          const requested: BendStationId = "upper";
          const plan = planBendStationChange({
            mode: "on",
            transactionActive: true,
            branch,
            current: "middle",
            requested,
          });
          assert.equal(plan.cancelFirst, false, branch.id);
        }
      }
      const inactive = [...graph.organs.values()].filter((organ) => !organ.active).map((organ) => organ.id);
      if (inactive.length > 0) {
        const root = graph.branches.get(graph.rootBranchId)!;
        const station = selectBendStation(root, "middle");
        assert.ok(station, `${graph.id} root should still bend`);
        const bent = bendAt(graph, root.id, station.distance, 0.35);
        assert.deepEqual(
          [...bent.organs.values()].filter((organ) => !organ.active).map((organ) => organ.id).sort(),
          inactive.sort(),
        );
        assertStockAndDetail(graph, bent, `${arrangement.title} ${graph.id}`);
      }
    }
    const first = graphs[0].rootBranchId;
    const second = graphs[1].rootBranchId;
    assert.equal(preferenceAfterBranchChange(first, second, "lower"), "middle");
  }
  assert.ok(seenBranches.includes("plant-2:rachis"));
  assert.ok(seenBranches.includes("plant-1:trunk") || seenBranches.includes("plant-1:stem"));
});

test("exercise matrix covers the twelve materials and both arrangements", () => {
  assert.ok(matrix.length > 12, `matrix rows ${matrix.length}`);
  const row = (label: string) => {
    const line = matrix.find((entry) => entry.startsWith(`${label} `));
    assert.ok(line, label);
    return line;
  };
  assert.match(row("woody/bare-branch"), /stations=3 .* split/);
  assert.match(row("leafy/leafy-shoot"), /stations=3 .* split/);
  assert.match(row("reed/reed"), /stations=3 .* split/);
  assert.match(row("trailer/arching-trailer"), /stations=3 .* same-sign/);
  assert.match(row("flower/single-flower"), /stations=3 .* split/);
  assert.match(row("flower/nodding-flower"), /stations=3 .* split/);
  assert.match(row("frond/fern-frond"), /stations=3 .* split/);
  assert.match(row("woody/flowering-branch/shortest"), /stations=0 .* ineligible/);
  assert.match(row("flower/single-flower/shortest"), /stations=0 .* ineligible/);
  assert.match(row("leafy/leafy-shoot/shortest"), /stations=3 .* same-sign/);
  assert.match(row("reed/reed/shortest"), /stations=3 .* same-sign/);
  assert.match(row("berry/berry-twig/shortest"), /stations=3 .* same-sign/);
  assert.ok(matrix.some((entry) => entry.startsWith("Leafy fern and fan plant-2:rachis ") && /stations=3 .* split/.test(entry)));
  assert.ok(matrix.some((entry) => entry.startsWith("Berry and flower accents plant-4:stem ") && /stations=3 .* split/.test(entry)));
  console.log(`BEND_STATIONS_MATRIX\n${matrix.join("\n")}`);
});
});
