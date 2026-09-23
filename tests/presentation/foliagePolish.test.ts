import assert from "node:assert/strict";
import test from "node:test";
import { readExperimentConfig } from "../../src/app/config.ts";
import {
  ACCEPTED_PINNATE_DRAW,
  createLeafGeometry,
  type FanLeafDraw,
  type PinnateDraw,
} from "../../src/presentation/botanicalGeometry.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";

/** Rounded position hash of the elliptic and lanceolate blades at the polish tip. */
function positionHash(draw: Parameters<typeof createLeafGeometry>[2], form: "elliptic" | "lanceolate" | "pinnate" = "elliptic") {
  const geometry = createLeafGeometry(8278, form, draw);
  const positions = geometry.getAttribute("position").array;
  let hash = 2166136261;
  for (const value of positions) {
    const rounded = Math.round(value * 1e5);
    hash = Math.imul(hash ^ (rounded >>> 0), 16777619) >>> 0;
  }
  geometry.dispose();
  return hash.toString(16);
}

function bandSpan(draw: PinnateDraw, y0: number, y1: number) {
  const geometry = createLeafGeometry(8278, "pinnate", { pinnate: draw });
  const positions = geometry.getAttribute("position");
  let max = 0;
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    if (y < y0 || y >= y1) continue;
    max = Math.max(max, Math.abs(positions.getX(index)));
  }
  const triangles = (geometry.index?.count ?? 0) / 3;
  geometry.dispose();
  return { max, triangles };
}

test("shared elliptic and lanceolate blades keep their pre-polish surfaces", () => {
  assert.equal(positionHash(undefined, "elliptic"), "8817a40c");
  assert.equal(positionHash({ fanLeaf: "shared" }, "elliptic"), "8817a40c");
  assert.equal(positionHash(undefined, "lanceolate"), "d85a146d");
  assert.notEqual(positionHash({ fanLeaf: "spray" }), positionHash({ fanLeaf: "shared" }));
  assert.notEqual(positionHash({ fanLeaf: "separated" }), positionHash({ fanLeaf: "spray" }));
});

test("accepted pinnate draw keeps a costa notch and a reaching pinnule", () => {
  assert.equal(ACCEPTED_PINNATE_DRAW, "tapered");
  const notch = bandSpan("tapered", 0.38, 0.46);
  const reach = bandSpan("tapered", 0.52, 0.62);
  assert.ok(notch.max < 0.03, `notch span ${notch.max}`);
  assert.ok(reach.max > 0.25, `pinnule reach ${reach.max}`);
  const geometry = createLeafGeometry(8278, "pinnate");
  assert.equal(geometry.name, "living-line/pinnate-pinna");
  geometry.dispose();
});

test("baseline and quilled pinna draws stay recoverable and still divided", () => {
  const baselineNotch = bandSpan("baseline", 0.38, 0.46);
  const baselineReach = bandSpan("baseline", 0.52, 0.62);
  assert.ok(baselineNotch.max < 0.03);
  assert.ok(baselineReach.max > 0.25);
  const quilled = bandSpan("quilled", 0.54, 0.6);
  const quilledReach = bandSpan("quilled", 0.3, 0.42);
  assert.ok(quilled.max < 0.03, "quilled keeps a costa-only gap");
  assert.ok(quilledReach.max > 0.22, "quilled pinnules still reach");
  assert.ok(bandSpan("quilled", 0, 1.2).triangles > bandSpan("tapered", 0, 1.2).triangles);
});

test("fan spray and separated blades stay inside the existing elliptic proxy", () => {
  const appearance = getMaterialAppearance("foliage-fan-v1");
  assert.equal(appearance.leaf.form, "elliptic");
  assert.equal(appearance.leaf.profile, "spray");
  assert.equal(appearance.branchColors.trunk, 0x7c9a34);
  assert.notEqual(appearance.leaf.color, getMaterialAppearance("leafy-shoot-v1").leaf.color);
  assert.equal(appearance.leaf.hitRadius, 0.37);
  assert.equal(appearance.leaf.hitCenterY, 0.247);
  for (const profile of ["spray", "separated", "shared"] as const satisfies readonly FanLeafDraw[]) {
    const geometry = createLeafGeometry(8278, "elliptic", { fanLeaf: profile });
    const positions = geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index += 1) {
      const dx = positions.getX(index);
      const dy = positions.getY(index) - 0.247;
      const dz = positions.getZ(index);
      assert.ok(Math.hypot(dx, dy, dz) <= 0.37 + 1e-6, `${profile} left the elliptic proxy`);
    }
    geometry.dispose();
  }
});

test("pinnate and fanLeaf query switches are comparison-only and ignore unknown values", () => {
  const selected = readExperimentConfig(new URL("http://local/?workbench=1&pinnate=quilled&fanLeaf=separated"));
  assert.equal(selected.pinnateDraw, "quilled");
  assert.equal(selected.fanLeafDraw, "separated");
  const ignored = readExperimentConfig(new URL("http://local/?pinnate=fern-frond-v2&fanLeaf=bigger"));
  assert.equal(ignored.pinnateDraw, undefined);
  assert.equal(ignored.fanLeafDraw, undefined);
  const absent = readExperimentConfig(new URL("http://local/?workbench=1"));
  assert.equal(absent.pinnateDraw, undefined);
  assert.equal(absent.fanLeafDraw, undefined);
});
