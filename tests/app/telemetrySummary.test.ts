import assert from "node:assert/strict";
import test from "node:test";

import { summarizeBendAcquisitions } from "../../src/app/telemetrySummary.ts";
import type { AcquisitionRecord } from "../../src/app/metrics.ts";

function record(overrides: Partial<AcquisitionRecord>): AcquisitionRecord {
  return {
    at: 0,
    wallClockMs: Date.now(),
    sessionId: "session-a",
    bendVariant: "touch",
    posture: "arrange",
    tool: "shape",
    result: "hit",
    region: "middle",
    missesBeforeHit: 0,
    timeToAcquireMs: 10,
    outcome: "committed",
    ...overrides,
  };
}

test("comparative summary is bend-scoped: excludes camera and both insert paths, includes only resolved bend hits", () => {
  const records: AcquisitionRecord[] = [
    record({ operation: "bend", outcome: "committed" }),
    record({ operation: "bend", outcome: "cancelled" }),
    // A pending (unresolved) bend hit must never count as resolved.
    record({ operation: "bend", outcome: null, timeToAcquireMs: null }),
    // Camera is never a graph commit and is excluded from this comparison.
    record({ operation: "camera", outcome: "released" }),
    // Keyboard activation is excluded (not a touch craft acquisition).
    record({ operation: "insert", inputMethod: "keyboard", outcome: "committed" }),
    // Pointer-drag insertion is also excluded: this summary is bend-only.
    record({ operation: "insert", inputMethod: "pointer", outcome: "committed" }),
    // Aim/base/prune are craft operations too, but not "bend".
    record({ operation: "aim", outcome: "committed" }),
    record({ operation: "prune", outcome: "committed" }),
    // A miss has no known intended operation and is never a "bend" record.
    record({ operation: undefined, result: "miss", outcome: null, timeToAcquireMs: null, missesBeforeHit: 1 }),
  ];

  const summary = summarizeBendAcquisitions(records);
  assert.equal(summary.scope, "bend-only-resolved-hits");
  assert.equal(summary.resolvedBendHits, 2);
  assert.equal(summary.committedBendHits, 1);
  assert.equal(summary.cancelledBendHits, 1);
  assert.equal(typeof summary.rawMeanTimeToAcquireMs, "number");
  assert.ok(summary.caveat.length > 0);
});

test("an empty or entirely non-bend record set summarizes to zero, not an error", () => {
  const summary = summarizeBendAcquisitions([
    record({ operation: "camera", outcome: "released" }),
    record({ operation: "insert", inputMethod: "keyboard", outcome: "committed" }),
  ]);
  assert.equal(summary.resolvedBendHits, 0);
  assert.equal(summary.committedBendHits, 0);
  assert.equal(summary.cancelledBendHits, 0);
  assert.equal(summary.rawMeanTimeToAcquireMs, null);
  assert.equal(summary.rawMeanMissesBeforeHit, null);
});
