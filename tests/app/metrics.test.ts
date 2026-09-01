import assert from "node:assert/strict";
import test from "node:test";

import { SessionMetrics } from "../../src/app/metrics.ts";

// Bug 1: no acquisition is attributable to a bend-experiment arm. On main,
// SessionMetrics has no notion of a bend variant at all (constructor takes no
// arguments, there is no setBendVariant, and recordAcquisition never returns
// the record it created), so nothing a caller does can make a record carry
// the arm that was active when it happened.
test("every recorded acquisition carries the bend variant active when it happened", () => {
  const metrics = new SessionMetrics("session-a", "touch");
  const firstHit = metrics.recordAcquisition({
    posture: "arrange",
    tool: "shape",
    result: "hit",
    operation: "bend",
    region: "middle",
  });
  assert.equal(firstHit.bendVariant, "touch");
  assert.equal(firstHit.sessionId, "session-a");

  metrics.setBendVariant("bead");
  const secondHit = metrics.recordAcquisition({
    posture: "arrange",
    tool: "shape",
    result: "hit",
    operation: "aim",
    region: "middle",
  });
  assert.equal(secondHit.bendVariant, "bead");
  // Switching the variant does not retroactively rewrite earlier records.
  assert.equal(firstHit.bendVariant, "touch");
});

// Bug 2: a flat hit/miss list cannot distinguish "harder to hit" (many misses
// before the eventual hit) from "hit on the third try quickly". On main there
// is no attempt grouping at all: no missesBeforeHit, no timeToAcquireMs.
test("misses before a hit accumulate into that attempt's miss count and elapsed time", () => {
  const metrics = new SessionMetrics("session-a", "bead");
  const base = { posture: "arrange" as const, tool: "shape" as const, region: "middle" as const };

  metrics.recordAcquisition({ ...base, result: "miss" });
  metrics.recordAcquisition({ ...base, result: "miss" });
  const hit = metrics.recordAcquisition({ ...base, result: "hit", operation: "aim" });

  assert.equal(hit.missesBeforeHit, 2);
  assert.equal(typeof hit.timeToAcquireMs, "number");
  assert.ok((hit.timeToAcquireMs ?? -1) >= 0);

  // A fresh attempt after a hit starts its own miss count from zero.
  const secondHit = metrics.recordAcquisition({ ...base, result: "hit", operation: "aim" });
  assert.equal(secondHit.missesBeforeHit, 0);
});

// Bug 3: a cancelled transaction must never be indistinguishable from (or
// misread as) a committed one. On main there is no per-acquisition outcome
// at all, so this information does not exist to compare.
test("a hit's transaction outcome distinguishes cancellation from commit", () => {
  const metrics = new SessionMetrics("session-a", "touch");
  const base = {
    posture: "arrange" as const,
    tool: "shape" as const,
    result: "hit" as const,
    operation: "bend" as const,
    region: "middle" as const,
  };

  const committedRecord = metrics.recordAcquisition(base);
  metrics.resolveAcquisition(committedRecord, "committed");

  const cancelledRecord = metrics.recordAcquisition(base);
  metrics.resolveAcquisition(cancelledRecord, "cancelled", { cancelReason: "pointer-cancel" });

  assert.equal(committedRecord.outcome, "committed");
  assert.equal(cancelledRecord.outcome, "cancelled");
  assert.notEqual(committedRecord.outcome, cancelledRecord.outcome);
  assert.equal(cancelledRecord.cancelReason, "pointer-cancel");
  assert.equal(metrics.committedTransactions, 1);
  assert.equal(metrics.cancelledTransactions, 1);
});
