import assert from "node:assert/strict";
import test from "node:test";

import {
  bendVariantFromSearch,
  readExperimentConfig,
  resolveResetBendVariant,
  urlForBendVariant,
  urlWithoutClearStudyData,
} from "../../src/app/config.ts";
import { SessionMetrics } from "../../src/app/metrics.ts";

test("bare URL and ?bend=touch resolve to touch; ?bend=fixed maps to the bead bucket", () => {
  assert.equal(bendVariantFromSearch(""), "touch");
  assert.equal(bendVariantFromSearch("?"), "touch");
  assert.equal(bendVariantFromSearch("?fresh=1"), "touch");
  assert.equal(bendVariantFromSearch("?bend=touch"), "touch");
  assert.equal(bendVariantFromSearch("?bend=TOUCH"), "touch");
  assert.equal(bendVariantFromSearch("?bend=fixed"), "bead");
  assert.equal(bendVariantFromSearch("?bend=bead"), "bead");
  assert.equal(bendVariantFromSearch("https://example.test/app?bend=fixed&test=1"), "bead");
});

test("readExperimentConfig preserves ?fresh=1 and one-shot ?clearStudyData=1", () => {
  const fresh = readExperimentConfig(new URL("https://example.test/?fresh=1"));
  assert.equal(fresh.bendVariant, "touch");
  assert.equal(fresh.fresh, true);
  assert.equal(fresh.clearStudyData, false);

  const clear = readExperimentConfig(new URL("https://example.test/?clearStudyData=1&bend=fixed"));
  assert.equal(clear.bendVariant, "bead");
  assert.equal(clear.fresh, false);
  assert.equal(clear.clearStudyData, true);
});

test("urlForBendVariant writes the public query and never retains one-shot flags", () => {
  const current = new URL("https://example.test/?bend=fixed&fresh=1&clearStudyData=1&test=1");
  const touch = urlForBendVariant("touch", current);
  assert.equal(touch.searchParams.get("bend"), null);
  assert.equal(touch.searchParams.get("fresh"), null);
  assert.equal(touch.searchParams.get("clearStudyData"), null);
  assert.equal(touch.searchParams.get("test"), "1");

  const fixed = urlForBendVariant("bead", new URL("https://example.test/?bend=touch"));
  assert.equal(fixed.searchParams.get("bend"), "fixed");
});

test("urlWithoutClearStudyData strips only the one-shot flag", () => {
  const next = urlWithoutClearStudyData(new URL("https://example.test/?clearStudyData=1&bend=fixed&fresh=1"));
  assert.equal(next.searchParams.get("clearStudyData"), null);
  assert.equal(next.searchParams.get("bend"), "fixed");
  assert.equal(next.searchParams.get("fresh"), "1");
});

test("omitting resetForTest bendVariant preserves the live variant and telemetry bucket", () => {
  assert.equal(resolveResetBendVariant(undefined, "touch"), "touch");
  assert.equal(resolveResetBendVariant(undefined, "bead"), "bead");
  assert.equal(resolveResetBendVariant("touch", "bead"), "touch");
  assert.equal(resolveResetBendVariant("fixed", "touch"), "bead");
  assert.equal(resolveResetBendVariant("bead", "touch"), "bead");

  for (const current of ["touch", "bead"] as const) {
    const preserved = resolveResetBendVariant(undefined, current);
    const metrics = new SessionMetrics("session-omit", current);
    metrics.reset();
    metrics.setBendVariant(preserved);
    const record = metrics.recordAcquisition({
      posture: "arrange",
      tool: "shape",
      result: "hit",
      operation: "bend",
      region: "middle",
    });
    assert.equal(preserved, current);
    assert.equal(record.bendVariant, current);
  }
});
