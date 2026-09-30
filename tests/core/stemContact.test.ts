import assert from 'node:assert/strict';
import test from 'node:test';
import { stem } from '../fixtures/stemOverlapFixture.ts';
import { aimPointSpeeds, bendPointSpeeds, contactEnvironment, insertionContacts, limitStemMotion, contactRadius } from '../../src/core/stemContact.ts';
import { applyBendRotation, bendRotationVector, translatePendingGraph } from '../../src/core/edit.ts';
import { length, distance, scale, vec3 as p, normalize, rotateVector } from '../../src/core/math.ts';
import { rotationPath, rotationQuaternion } from '../../src/core/rotationPath.ts';
import { createFlowerVolume, createNoddingFlowerV2, createFernFrondV2, sampleBranch, serializePlantGraph, validatePlantGraph } from '../../src/core/index.ts';
import { assertRestLengthsPreserved, assertAttachmentCoincidence } from './helpers.ts';
const moving = () => stem('a', [p(-.6, 0), p(-.6, 2)], .02);
const fixed = () => stem('b', [p(0, 0), p(0, 2)], .03);
test('straight base translation certifies clear near-tangent travel without using up the advancement budget', () => {
    const a = moving(), b = stem('b', [p(0, 1, -.9), p(0, 1, .9)], .03);
    const gap = contactRadius(a.branches.get(a.rootBranchId)!, b.branches.get(b.rootBranchId)!);
    const start = translatePendingGraph(a, p(-gap - 5e-6, 0));
    const delta = p(0, 0, .36), env = contactEnvironment(start, [b]);
    const motion = { at: (t: number) => translatePendingGraph(start, p(-gap - 5e-6, 0, .36 * t)), speeds: new Map([[a.rootBranchId, .36]]), translation: delta };
    const result = limitStemMotion(motion, env);
    assert.equal(result.reason, 'clear');
    assert.equal(result.fraction, 1);
    assert.equal(insertionContacts(result.graph, env).length, 0);
    assertRestLengthsPreserved(start, result.graph);
});
test('translation certificate cannot tunnel through a clear-ended crossing or a second obstacle', () => {
    const a = moving(), b = fixed(), env = contactEnvironment(a, [b]);
    const result = limitStemMotion({ at: t => translatePendingGraph(a, p(-.6 + 1.2 * t, 0)), speeds: new Map([[a.rootBranchId, 1.2]]), translation: p(1.2, 0) }, env);
    assert.equal(result.reason, 'contact');
    assert.ok(result.fraction < .5);
    const start = translatePendingGraph(a, p(-.048005, 0));
    const rail = stem('rail', [p(0, 1, -.9), p(0, 1, .9)], .03);
    const blocker = stem('blocker', [p(-.048005, 0, .2), p(-.048005, 2, .2)], .03);
    const obstacles = contactEnvironment(start, [rail, blocker]);
    const stopped = limitStemMotion({ at: t => translatePendingGraph(start, p(-.048005, 0, .36 * t)), speeds: new Map([[a.rootBranchId, .36]]), translation: p(0, 0, .36) }, obstacles);
    assert.equal(stopped.reason, 'contact');
    assert.equal(stopped.marks[0].plantB, 'blocker');
    assert.equal(insertionContacts(stopped.graph, obstacles).length, 0);
});
test('translation separation can use a vertical plane even when the endpoint passes the obstacle in x', () => {
    const b = stem('b', [p(0, -1, -.9), p(0, -1, .9)], .03);
    for (const clearance of [5e-6, 1e-12]) {
        const a = stem('a', [p(-.048 - clearance, 0), p(-.048 - clearance, 2)], .02);
        const env = contactEnvironment(a, [b]);
        const delta = p(.3, 0, .2);
        const result = limitStemMotion({ at: t => translatePendingGraph(a, p(a.branches.get(a.rootBranchId)!.points[0].x + delta.x * t, 0, delta.z * t)), speeds: new Map([[a.rootBranchId, length(delta)]]), translation: delta }, env);
        assert.equal(result.reason, 'clear', 'vertical separating plane remains clear even if x passes the rail');
        for (let i = 0; i <= 50; i++) assert.equal(insertionContacts(translatePendingGraph(a, p(a.branches.get(a.rootBranchId)!.points[0].x + delta.x * i / 50, 0, delta.z * i / 50)), env).length, 0);
    }
});
test('translation certificates preserve clearance for skew segments and fail closed at numerical contact', () => {
    for (let i = 0; i < 24; i++) {
        const angle = i * .29;
        const a = stem('a', [p(-.12, 0, -.2), p(-.08, 2, .17)], .02);
        const b = stem('b', [p(0, .8, -.8), p(.03, 1.1, .8)], .03);
        const delta = p(.3 * Math.sin(angle), 0, .35 * Math.cos(angle));
        const root = a.branches.get(a.rootBranchId)!, start = root.points[0];
        const at = (t: number) => translatePendingGraph(a, p(start.x + delta.x * t, start.y, start.z + delta.z * t));
        const env = contactEnvironment(a, [b]);
        const result = limitStemMotion({ at, speeds: new Map([[root.id, length(delta)]]), translation: delta }, env);
        assert.equal(insertionContacts(result.graph, env).length, 0);
        for (let j = 0; j <= 40; j++) assert.equal(insertionContacts(at(result.fraction * j / 40), env).length, 0, `case ${i}, step ${j}`);
    }
    const a = stem('a', [p(-.048 - 1e-12, 0), p(-.048 - 1e-12, 2)], .02);
    const b = stem('b', [p(0, 1, -.9), p(0, 1, .9)], .03);
    const result = limitStemMotion({ at: t => translatePendingGraph(a, p(-.048 - 1e-12, 0, .36 * t)), speeds: new Map([[a.rootBranchId, .36]]), translation: p(0, 0, .36) }, contactEnvironment(a, [b]));
    assert.notEqual(result.reason, 'clear', 'the certificate retains its positive roundoff guard');
    assert.equal(insertionContacts(result.graph, contactEnvironment(a, [b])).length, 0);
});
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
