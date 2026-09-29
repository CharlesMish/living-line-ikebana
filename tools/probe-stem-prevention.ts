import { createWorkbenchFixture } from '../src/app/workbench.ts';
import { fromCanonicalPlantGraph, sampleBranch } from '../src/core/index.ts';
import { StemPrevention } from '../src/app/stemPrevention.ts';
const graphs = createWorkbenchFixture('round5-palette', 8278, 12, { remember: false }).plants.map(fromCanonicalPlantGraph);
const timings: number[] = [];
const reasons: Record<string, number> = {};
for (const graph of graphs) {
    const localTimes: number[] = [];
    const localReasons: Record<string, number> = {};
    const root = graph.branches.get(graph.rootBranchId)!;
    const protection = new StemPrevention(() => true, () => graphs);
    const station = root.activeLength * .54, point = sampleBranch(root, station).position;
    const spec = { plantId: graph.id, branchId: root.id, stationDistance: station, variant: 'bead' as const, context: {} };
    for (let i = 0; i < 16; i++) {
        const now = performance.now();
        protection.bend(graph, spec, { ...point, x: point.x + .6 * Math.sin(i * .6), z: point.z + .35 * Math.cos(i * .6) });
        localTimes.push(performance.now() - now);
        localReasons[protection.feedback.reason] = (localReasons[protection.feedback.reason] ?? 0) + 1;
        timings.push(performance.now() - now);
        reasons[protection.feedback.reason] = (reasons[protection.feedback.reason] ?? 0) + 1;
    }
    console.log(graph.generatorVersion, Math.max(...localTimes), localReasons);
}
timings.sort((a, b) => a - b);
console.log(JSON.stringify({ samples: timings.length, median: timings[Math.floor(timings.length * .5)], p95: timings[Math.floor(timings.length * .95)], max: timings.at(-1), reasons }));
