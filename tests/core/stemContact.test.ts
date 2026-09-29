import assert from 'node:assert/strict';
import test from 'node:test';
import { stem } from '../fixtures/stemOverlapFixture.ts';
import { aimPointSpeeds, bendPointSpeeds, contactEnvironment, insertionContacts, limitStemMotion } from '../../src/core/stemContact.ts';
import { applyBendRotation, bendRotationVector, translatePendingGraph } from '../../src/core/edit.ts';
import { length, distance, scale, vec3 as p, normalize, rotateVector } from '../../src/core/math.ts';
import { rotationPath, rotationQuaternion } from '../../src/core/rotationPath.ts';
import { createFlowerVolume, createNoddingFlowerV2, createFernFrondV2, sampleBranch, serializePlantGraph, validatePlantGraph } from '../../src/core/index.ts';
import { assertRestLengthsPreserved, assertAttachmentCoincidence } from './helpers.ts';
const moving = () => stem('a', [p(-.6, 0), p(-.6, 2)], .02);
const fixed = () => stem('b', [p(0, 0), p(0, 2)], .03);
test('swept translation stops at first contact even when both endpoints are clear; same visual crossing at different depth stays free', () => {
    const a = moving(), b = fixed(), env = contactEnvironment(a, [b]);
    const motion = { at: (t: number) => translatePendingGraph(a, p(-.6 + 1.2 * t, 0)), speeds: new Map([['a:trunk', 1.2]]) };
    assert.equal(insertionContacts(motion.at(1), env).length, 0);
    const result = limitStemMotion(motion, env);
    assert.equal(result.reason, 'contact');
    assert.ok(result.fraction > .4 && result.fraction < .5);
    assert.equal(insertionContacts(result.graph, env).length, 0);
    assert.equal(result.marks.length, 1);
    const farther = stem('b', [p(0, 0, .2), p(0, 2, .2)], .03);
    assert.equal(limitStemMotion(motion, contactEnvironment(a, [farther])).fraction, 1);
    assertRestLengthsPreserved(a, result.graph);
});
test('multiple obstacles stop at the first, and pre-existing exemptions apply to branch pairs only', () => {
    const a = moving(), b = fixed(), c = stem('c', [p(-.3, 0), p(-.3, 2)], .02);
    const env = contactEnvironment(a, [b, c]);
    const result = limitStemMotion({ at: t => translatePendingGraph(a, p(-.6 + 1.2 * t, 0)), speeds: new Map([['a:trunk', 1.2]]) }, env);
    assert.equal(result.marks[0].plantB, 'c');
    const overlapping = stem('old', [p(-.6, 0), p(-.6, 2)], .03);
    const legacy = contactEnvironment(a, [overlapping, c]);
    assert.equal(legacy.exempt.size, 1);
    const escaped = limitStemMotion({ at: t => translatePendingGraph(a, p(-.6 + 1.2 * t, 0)), speeds: new Map([['a:trunk', 1.2]]) }, legacy);
    assert.ok(escaped.fraction > 0);
    assert.equal(escaped.marks[0].plantB, 'c');
    const clearStart = escaped.graph;
    assert.equal(contactEnvironment(clearStart, [overlapping]).exempt.size, 0, 'waiver expires on the next grab');
});
test('uncertified work budget holds a known-clear pose instead of accepting a jump', () => {
    const a = moving(), env = contactEnvironment(a, [fixed()]);
    const result = limitStemMotion({ at: t => translatePendingGraph(a, p(-.6 + t, 0)), speeds: new Map([['a:trunk', 1e10]]) }, env);
    assert.notEqual(result.reason, 'clear');
    assert.ok(result.fraction < 1e-6);
    assert.equal(insertionContacts(result.graph, env).length, 0);
});
test('rigid rotation floor finds an interior dip even when endpoints are permitted', () => {
    // Rotate around x from +z to -z through -y: endpoint y=0, middle y=-1.
    const path = rotationPath(p(0, 0, 0), p(Math.PI, 0, 0));
    assert.ok(path.floorFraction(p(0, 0, 1), -.1) < .04);
    const away = rotationPath(p(0, 0, 0), p(-1, 0, 0));
    assert.equal(away.floorFraction(p(0, 0, 1), 0), 1, 'a pose on its floor can move upward');
});
test('bend speed bounds cover all active descendants under axis changes; reconstruction preserves stock and attachments', () => {
    for (const generate of [createFlowerVolume, createNoddingFlowerV2, createFernFrondV2]) {
        const graph = generate('plant-1', 8278, p(0, .55, 0));
        const root = graph.branches.get(graph.rootBranchId)!;
        const request = { branchId: root.id, stationDistance: root.activeLength * .54, target: p(1, 2, 0) };
        const from = p(.25, 0, .15), to = p(-.2, 0, -.3), delta = distance(from, to);
        const speeds = bendPointSpeeds(graph, root.id, delta);
        let previous = applyBendRotation(graph, request, from);
        for (let i = 1; i <= 20; i++) {
            const t = i / 20, next = applyBendRotation(graph, request, p(from.x + (to.x - from.x) * t, 0, from.z + (to.z - from.z) * t));
            assertRestLengthsPreserved(graph, next);
            assertAttachmentCoincidence(next);
            for (const [id, b] of next.branches)
                if (b.active) {
                    const before = previous.branches.get(id)!;
                    for (let j = 0; j < b.points.length; j++)
                        assert.ok(distance(b.points[j], before.points[j]) <= (speeds.get(id)?.[j] ?? 0) / 20 + 1e-8, id);
                }
            previous = next;
        }
        assert.equal(validatePlantGraph(previous).length, 0);
    }
});
