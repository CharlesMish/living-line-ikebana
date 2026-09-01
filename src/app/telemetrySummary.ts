import type { AcquisitionRecord } from "./metrics.ts";

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export type BendAcquisitionSummary = {
  scope: "bend-only-resolved-hits";
  resolvedBendHits: number;
  committedBendHits: number;
  cancelledBendHits: number;
  rawMeanTimeToAcquireMs: number | null;
  rawMeanMissesBeforeHit: number | null;
  caveat: string;
};

/**
 * A bend-scoped, diagnostic-only summary of one variant's raw acquisitions.
 *
 * Scope is deliberately narrow: resolved bend hits only (`operation ===
 * "bend"`, a hit whose transaction has already committed or cancelled).
 * Camera acquisitions and both insert paths (pointer-drag and keyboard
 * activation) are never included here — they are not bend craft comparisons,
 * and camera specifically is never a graph commit. Raw per-acquisition
 * records for every operation remain available in the caller's persisted
 * store for debugging; this summary only narrows what is offered as a
 * *comparison*.
 *
 * What these numbers can answer: for acquisitions the instrument itself
 * resolved as bend hits, how many were committed vs. cancelled, and the mean
 * of the raw timeToAcquireMs/missesBeforeHit counters recorded for them.
 *
 * What they cannot answer, and must not be read as answering: which bend
 * variant is faster or easier to use. `missesBeforeHit` has no known
 * intended operation (a miss precedes any kind of hit) and may include
 * mis-taps aimed at an unrelated target; nothing here confirms the tester's
 * intent, whether the touch matched what they meant to touch, or whether the
 * resulting silhouette was correct. First-try acquisition, intended target,
 * correction count, and silhouette completion remain observer-recorded (see
 * `tests/browser/PHONE_WEB_TEST_CARD.md`) unless a future explicit trial
 * lifecycle records intent directly.
 */
export function summarizeBendAcquisitions(records: readonly AcquisitionRecord[]): BendAcquisitionSummary {
  const bendHits = records.filter((record) => record.operation === "bend" && record.result === "hit");
  const resolved = bendHits.filter((record) => record.outcome !== null);
  const committed = resolved.filter((record) => record.outcome === "committed");
  const cancelled = resolved.filter((record) => record.outcome === "cancelled");
  return {
    scope: "bend-only-resolved-hits",
    resolvedBendHits: resolved.length,
    committedBendHits: committed.length,
    cancelledBendHits: cancelled.length,
    rawMeanTimeToAcquireMs: mean(resolved.map((record) => record.timeToAcquireMs ?? 0)),
    rawMeanMissesBeforeHit: mean(resolved.map((record) => record.missesBeforeHit)),
    caveat:
      "Diagnostic only. Not validated as a measure of which variant is faster or " +
      "easier: misses have no known intended operation, and intent/target/silhouette " +
      "correctness are observer-recorded, not instrument-recorded.",
  };
}
