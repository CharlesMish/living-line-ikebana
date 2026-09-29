import { add, distance, length, lerp, scale, subtract, type Vec3 } from './math.ts';
import { descendantIds, childrenOf } from './graph.ts';
import { legalBendStation, sampleBranch } from './arcLength.ts';
import { bendInfluenceProfile } from './edit.ts';
import { closestStemSegments, structuralStems, type StemOverlap } from './stemOverlaps.ts';
import type { PlantGraph, Branch } from './types.ts';
export const contactRadius = (a: Branch, b: Branch) => a.radius + b.radius - Math.max(1e-5, .1 * Math.min(a.radius, b.radius));
const pairKey = (a: string, plant: string, b: string) => JSON.stringify([a, plant, b]);
type Segment = {
    a: Vec3;
    b: Vec3;
    min: Vec3;
    max: Vec3;
};
function segments(branch: Branch): Segment[] {
    return branch.points.slice(1).map((b, i) => {
        const a = branch.points[i];
        return { a, b, min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) }, max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) } };
    });
}
function boxDistance(a: Segment, b: Segment): number {
    const x = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x), y = Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y), z = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
    return Math.hypot(x, y, z);
}
type Obstacle = {
    plant: string;
    branch: Branch;
    segments: Segment[];
};
export interface ContactEnvironment {
    obstacles: Obstacle[];
    exempt: Set<string>;
}
function hit(graph: PlantGraph, a: Branch, plant: string, b: Branch, sa: Segment, sb: Segment) {
    const [pa, pb] = closestStemSegments(sa.a, sa.b, sb.a, sb.b);
    const gap = distance(pa, pb) - contactRadius(a, b);
    const mark: StemOverlap = { plantA: graph.id, branchA: a.id, plantB: plant, branchB: b.id, position: scale(add(pa, pb), .5), penetration: Math.max(0, -gap) };
    return { gap, mark };
}
function firstOverlap(graph: PlantGraph, a: Branch, obstacle: Obstacle) {
    const r = contactRadius(a, obstacle.branch);
    for (const sa of segments(a))
        for (const sb of obstacle.segments) {
            if (boxDistance(sa, sb) > r)
                continue;
            const found = hit(graph, a, obstacle.plant, obstacle.branch, sa, sb);
            if (found.gap <= 0)
                return found.mark;
        }
    return null;
}
/** Capture pre-existing intersecting branch pairs, never an entire plant exemption. */
export function contactEnvironment(snapshot: PlantGraph, others: Iterable<PlantGraph>, waiveExisting = true): ContactEnvironment {
    const obstacles = structuralStems([...others].filter(g => g.id !== snapshot.id)).map(o => ({ ...o, segments: segments(o.branch) }));
    const exempt = new Set<string>();
    if (waiveExisting)
        for (const { branch: a } of structuralStems([snapshot]))
            for (const b of obstacles) {
                if (firstOverlap(snapshot, a, b))
                    exempt.add(pairKey(a.id, b.plant, b.branch.id));
            }
    return { obstacles, exempt };
}
export function insertionContacts(graph: PlantGraph, env: ContactEnvironment): StemOverlap[] {
    const marks: StemOverlap[] = [];
    for (const { branch: a } of structuralStems([graph]))
        for (const b of env.obstacles) {
            const mark = firstOverlap(graph, a, b);
            if (mark)
                marks.push(mark);
        }
    return marks;
}
export type PointSpeeds = ReadonlyMap<string, number | readonly number[]>;
export function aimPointSpeeds(snapshot: PlantGraph, branchId: string, rotationDelta: number): Map<string, number[]> {
    const result = new Map<string, number[]>(), branch = snapshot.branches.get(branchId);
    if (!branch)
        return result;
    const ids = descendantIds(snapshot, branchId);
    ids.add(branchId);
    for (const id of ids) {
        const child = snapshot.branches.get(id);
        if (child?.active)
            result.set(id, child.points.map(p => rotationDelta * distance(p, branch.points[0])));
    }
    return result;
}
/**
 * Selected segment exp(profile*w) has angular speed <= profile*|dw|. Point
 * speed is the sum of preceding segment length * angular speed. Child anchors
 * interpolate fixed rest-arc endpoints. Shortest-arc remapping q(u,v) has
 * |omega| <= 1.2|v'| when angle(u,v)<=1 rad: its unnormalized quaternion is
 * (u cross v,1+u dot v), norm>=2cos(.5), derivative norm=|v'|.
 * Normalization cannot increase derivative beyond |v'|/norm; angular speed
 * is 2|q'|, hence the factor 1/cos(.5)<1.2. Descendant rotation angle never
 * exceeds its parent's; the same bound applies recursively. No sampled estimate.
 */
export function bendPointSpeeds(snapshot: PlantGraph, branchId: string, rotationDelta: number, requestedStation?: number): Map<string, number[]> {
    const result = new Map<string, number[]>(), source = snapshot.branches.get(branchId);
    if (!source?.active)
        return result;
    const station = legalBendStation(source, requestedStation);
    if (station === null)
        return result;
    const angular = bendInfluenceProfile(source, station).map(p => p * rotationDelta);
    const points = [0];
    source.restLengths.forEach((r, i) => points.push(points[i] + r * angular[i]));
    const visit = (branch: Branch, speeds: number[], angles: number[]) => {
        result.set(branch.id, speeds);
        for (const child of childrenOf(snapshot, branch.id))
            if (child.active) {
                const at = sampleBranch(branch, child.parentDistance), i = at.segmentIndex;
                const anchor = speeds[i] + (speeds[i + 1] - speeds[i]) * at.segmentT;
                const turn = 1.2 * angles[i];
                visit(child, child.points.map(p => anchor + turn * distance(p, child.points[0])), child.restLengths.map(() => turn));
            }
    };
    visit(source, points, angular);
    return result;
}
export interface ContactMotion {
    at(t: number): PlantGraph;
    speeds: PointSpeeds;
}
export interface LimitedMotion {
    graph: PlantGraph;
    fraction: number;
    reason: 'clear' | 'contact' | 'budget';
    marks: StemOverlap[];
}
const CLEARANCE = 1e-5, MAX_STEPS = 48, MAX_PAIR_CHECKS = 40000;
/** Conservative advancement: gap / max endpoint speed certifies the whole interval. */
export function limitStemMotion(motion: ContactMotion, env: ContactEnvironment): LimitedMotion {
    let t = 0, graph = motion.at(0), marks: StemOverlap[] = [], pairChecks = 0;
    type Pair = {
        id: string;
        index: number;
        obstacle: Obstacle;
        segment: Segment;
        speed: number;
    };
    const pairs: Pair[] = [];
    // Swept broad phase. Every point remains within its speed bound of t=0,
    // so pairs beyond this expanded segment box cannot meet anywhere on the path.
    for (const { branch: a } of structuralStems([graph])) {
        const speeds = motion.speeds.get(a.id);
        if (speeds === undefined)
            continue;
        const moving = segments(a);
        for (const obstacle of env.obstacles) {
            if (env.exempt.has(pairKey(a.id, obstacle.plant, obstacle.branch.id)))
                continue;
            const radius = contactRadius(a, obstacle.branch);
            for (let i = 0; i < moving.length; i++) {
                const speed = typeof speeds === 'number' ? speeds : Math.max(speeds[i], speeds[i + 1]);
                if (speed <= 1e-14)
                    continue;
                for (const segment of obstacle.segments)
                    if (boxDistance(moving[i], segment) - radius <= speed + CLEARANCE)
                        pairs.push({ id: a.id, index: i, obstacle, segment, speed });
            }
        }
    }
    for (let step = 0; step < MAX_STEPS; step++) {
        let advance = 1 - t, fullClear = true;
        marks = [];
        const geometry = new Map<string, Segment[]>();
        const near: {
            pair: Pair;
            gap: number;
            mark: StemOverlap;
        }[] = [];
        for (const pair of pairs) {
            if (++pairChecks > MAX_PAIR_CHECKS)
                return { graph, fraction: t, reason: 'budget', marks };
            const a = graph.branches.get(pair.id)!;
            if (!geometry.has(a.id))
                geometry.set(a.id, segments(a));
            const sa = geometry.get(a.id)![pair.index], b = pair.obstacle.branch;
            const lower = boxDistance(sa, pair.segment) - contactRadius(a, b);
            if (lower >= pair.speed * advance + CLEARANCE)
                continue;
            const found = hit(graph, a, pair.obstacle.plant, b, sa, pair.segment);
            if (found.gap - pair.speed * (1 - t) < CLEARANCE)
                fullClear = false;
            if (found.gap <= 2 * CLEARANCE)
                near.push({ pair, gap: found.gap, mark: found.mark });
            const safe = Math.max(0, found.gap) / pair.speed;
            if (safe < advance) {
                advance = safe;
                marks = [found.mark];
            }
        }
        if (fullClear && advance >= 1 - t)
            return { graph: motion.at(1), fraction: 1, reason: 'clear', marks: [] };
        if (advance <= 1e-8)
            return { graph, fraction: t, reason: near.length ? 'contact' : 'budget', marks };
        const nextT = t + advance * .9, next = motion.at(nextT);
        // This probe is itself certified. Permit separation instead of turning the
        // safety margin into a sticky zero-gap wall. Approaching contact stays put.
        for (const { pair, gap, mark } of near) {
            const branch = next.branches.get(pair.id)!;
            const nextHit = hit(next, branch, pair.obstacle.plant, pair.obstacle.branch, segments(branch)[pair.index], pair.segment);
            if (nextHit.gap < gap - 1e-12)
                return { graph, fraction: t, reason: 'contact', marks: [mark] };
        }
        t = nextT;
        graph = next;
    }
    return { graph, fraction: t, reason: 'budget', marks };
}
export const interpolateParameter = (from: Vec3, to: Vec3, fraction: number) => lerp(from, to, fraction);
export const parameterDistance = (from: Vec3, to: Vec3) => length(subtract(to, from));
