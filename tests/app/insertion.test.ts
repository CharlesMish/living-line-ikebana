import assert from "node:assert/strict";
import test from "node:test";

import { placementInputFromIntersection } from "../../src/app/IkebanaApp.ts";

test("leaving the kenzan edit plane invalidates a previously valid insertion", () => {
  const valid = placementInputFromIntersection({
    point: { x: 0.2, y: 0.55, z: -0.3 },
    clampedPoint: { x: 0.2, y: 0.55, z: -0.3 },
    valid: true,
  });
  assert.equal(valid.valid, true);

  const outsidePlane = placementInputFromIntersection(null);
  assert.equal(outsidePlane.valid, false);
  assert.deepEqual(outsidePlane.base, { x: 0, y: 0.55, z: 0 });
});
