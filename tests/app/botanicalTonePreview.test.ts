import assert from "node:assert/strict";
import test from "node:test";
import { botanicalToneInventory, botanicalToneSample } from "../../src/app/botanicalTonePreview.ts";
import { BOTANICAL_FAMILIES, resolveBotanicalAppearance } from "../../src/presentation/botanicalTones.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";

test("tone samples use resolved material part colors for every preset and durable version", () => {
  const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
  for (const family of BOTANICAL_FAMILIES) for (const version of family.versions) for (const tone of family.tones) {
    const actual = botanicalToneSample(family.id, tone.id, version);
    const expected = resolveBotanicalAppearance(version, getMaterialAppearance(version), { [family.id]: tone.id });
    const colorByPart = new Map([
      ["Wood", expected.branchColors.trunk], ["Stem", expected.branchColors.trunk], ["Leaves", expected.leaf.color],
      ["Flowers", expected.bloom.color], ["Berries", expected.berry?.color], ["Buds", expected.budColor],
    ]);
    for (const part of actual.parts) {
      assert.equal(part.color, hex(colorByPart.get(part.label)!));
      assert.ok(actual.svg.includes(part.color), `${version} ${tone.id}: ${part.label} appears in the sample`);
    }
    assert.ok(actual.svg.includes('aria-hidden="true"'), "the button supplies the accessible name");
    assert.ok(!actual.svg.includes("<image"), "no bitmap fetch/cache or GPU capture dependency");
  }
  assert.notEqual(botanicalToneSample("nodding-flower", "natural", "nodding-flower-v1").svg,
    botanicalToneSample("nodding-flower", "natural", "nodding-flower-v2").svg);
});

test("the sample parts correspond to organs actually present, rather than every appearance slot", () => {
  assert.deepEqual(botanicalToneSample("bare-branch", "natural").parts.map(p => p.label), ["Wood"]);
  assert.deepEqual(botanicalToneSample("berry-twig", "rust").parts.map(p => p.label), ["Wood", "Berries"]);
  assert.deepEqual(botanicalToneSample("blossom-spray", "butter").parts.map(p => p.label), ["Stem", "Flowers"]);
  assert.deepEqual(botanicalToneSample("lobed-leaf", "russet").parts.map(p => p.label), ["Wood", "Leaves"]);
  assert.throws(() => botanicalToneSample("lobed-leaf", "missing"));
  assert.throws(() => botanicalToneSample("lobed-leaf", "natural", "broad-blade-v1"));
});

test("inventory groups existing cuttings, uses their durable version and omits unsupported families", () => {
  const source = ["nodding-flower-v1", "reed-v1", "lobed-leaf-v1", "nodding-flower-v1", "arching-trailer-v1", "future"];
  const before = [...source];
  assert.deepEqual(botanicalToneInventory(source), [
    { familyId: "nodding-flower", generatorVersion: "nodding-flower-v1", count: 2 },
    { familyId: "lobed-leaf", generatorVersion: "lobed-leaf-v1", count: 1 },
  ]);
  assert.deepEqual(source, before);
  assert.deepEqual(botanicalToneInventory([]), []);
});
