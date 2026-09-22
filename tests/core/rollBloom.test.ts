import assert from "node:assert/strict";
import test from "node:test";

import { createSingleFlower } from "../../src/core/singleFlower.ts";
import { BLOOM_ROLL_LIMIT, rollBloomSpin } from "../../src/core/rollBloom.ts";
import { toCanonicalPlantGraph } from "../../src/core/serialization.ts";

const base = { x: 0, y: 0.55, z: 0 };

test("bloom roll changes only that organ's spin and recomputes from the snapshot", () => {
  const snapshot = createSingleFlower("plant-1", 8278, base);
  const bloom = snapshot.organs.get("plant-1:bloom")!;
  const before = JSON.stringify(toCanonicalPlantGraph(snapshot));
  const once = rollBloomSpin(snapshot, bloom.id, 0.4);
  const again = rollBloomSpin(snapshot, bloom.id, 0.4);
  const larger = rollBloomSpin(snapshot, bloom.id, 0.8);

  assert.equal(once.organs.get(bloom.id)!.spin, bloom.spin + 0.4);
  assert.equal(again.organs.get(bloom.id)!.spin, once.organs.get(bloom.id)!.spin);
  assert.equal(larger.organs.get(bloom.id)!.spin, bloom.spin + 0.8);
  assert.equal(snapshot.organs.get(bloom.id)!.spin, bloom.spin);
  assert.equal(JSON.stringify(toCanonicalPlantGraph(snapshot)), before);

  for (const [id, organ] of snapshot.organs) {
    if (id === bloom.id) continue;
    assert.equal(once.organs.get(id)!.spin, organ.spin);
  }
  for (const [id, branch] of snapshot.branches) {
    const rolled = once.branches.get(id)!;
    assert.equal(rolled.activeLength, branch.activeLength);
    assert.deepEqual(rolled.points, branch.points);
    assert.deepEqual(rolled.restLengths, branch.restLengths);
    assert.deepEqual(rolled.referenceNormal, branch.referenceNormal);
  }
});

test("bloom roll ignores leaves, inactive blooms, and non-finite input", () => {
  const snapshot = createSingleFlower("plant-1", 8278, base);
  const leaf = snapshot.organs.get("plant-1:leaf-1")!;
  const untouched = rollBloomSpin(snapshot, leaf.id, 1);
  assert.equal(untouched.organs.get(leaf.id)!.spin, leaf.spin);

  const inactive = rollBloomSpin(snapshot, "plant-1:bloom", 0.5);
  inactive.organs.get("plant-1:bloom")!.active = false;
  const held = rollBloomSpin(inactive, "plant-1:bloom", 0.5);
  assert.equal(held.organs.get("plant-1:bloom")!.spin, inactive.organs.get("plant-1:bloom")!.spin);

  const bloom = snapshot.organs.get("plant-1:bloom")!;
  assert.equal(rollBloomSpin(snapshot, bloom.id, Number.NaN).organs.get(bloom.id)!.spin, bloom.spin);
  assert.equal(
    rollBloomSpin(snapshot, bloom.id, 9).organs.get(bloom.id)!.spin,
    bloom.spin + BLOOM_ROLL_LIMIT,
  );
  assert.equal(
    rollBloomSpin(snapshot, bloom.id, -9).organs.get(bloom.id)!.spin,
    bloom.spin - BLOOM_ROLL_LIMIT,
  );
});
