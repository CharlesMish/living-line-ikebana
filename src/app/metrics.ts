import type { BendVariant } from "./config.ts";

export type ScreenRegion = "top" | "middle" | "bottom";

/**
 * `committed` — the acquired transaction released ordinarily and its graph
 * commit landed (or, for camera, the ordinary release finished).
 * `cancelled` — interruption or explicit cancellation rolled the transaction
 * back. This must never be able to read as `committed`.
 * `declined` — an ordinary release chose not to commit (currently only an
 * invalid insertion returned to the tray). Not a cancellation, not a commit.
 */
export type TransactionOutcome = "committed" | "cancelled" | "declined";

export type AcquisitionRecord = {
  /** `performance.now()` at acquisition; monotonic within this session only. */
  at: number;
  /** `Date.now()` at acquisition; stable across reloads for export ordering. */
  wallClockMs: number;
  /** Identifies one page load so exported records can be grouped per visit. */
  sessionId: string;
  /** The bend-experiment arm active at the moment of this acquisition. */
  bendVariant: BendVariant;
  posture: "arrange" | "inspect";
  tool: "shape" | "prune";
  result: "hit" | "miss";
  operation?: "insert" | "aim" | "bend" | "base" | "prune" | "camera";
  region: ScreenRegion;
  /** Misses that preceded this record within its in-progress attempt. */
  missesBeforeHit: number;
  /** Elapsed ms from the attempt's first miss (or this hit) to this hit. `null` for misses. */
  timeToAcquireMs: number | null;
  /** `null` while a hit's transaction is still open; never persisted in that state. */
  outcome: TransactionOutcome | null;
  cancelReason?: string;
  /** Elapsed ms from acquisition to the transaction's resolution. */
  transactionDurationMs?: number;
};

export type RecordAcquisitionInput = Pick<
  AcquisitionRecord,
  "posture" | "tool" | "result" | "region"
> &
  Partial<Pick<AcquisitionRecord, "operation">>;

/**
 * Session-scoped acquisition telemetry. `sessionId` and the active bend
 * variant are ambient state set once (and updated on variant switch), not a
 * per-call parameter — the original bug was that variant attribution was
 * left to each call site to remember, and every call site forgot.
 */
export class SessionMetrics {
  readonly acquisitions: AcquisitionRecord[] = [];
  cancelledTransactions = 0;
  committedTransactions = 0;
  declinedTransactions = 0;

  private bendVariant: BendVariant;
  private attemptMisses = 0;
  private attemptStartedAt: number | null = null;

  constructor(private readonly sessionId: string, initialBendVariant: BendVariant) {
    this.bendVariant = initialBendVariant;
  }

  setBendVariant(variant: BendVariant): void {
    this.bendVariant = variant;
  }

  /**
   * A flat hit/miss list can't distinguish "harder to hit" from "hit on the
   * third try quickly." Consecutive misses accumulate into the attempt that
   * ends at the next hit; that hit reports how many misses preceded it and
   * how long the whole attempt took.
   */
  recordAcquisition(input: RecordAcquisitionInput): AcquisitionRecord {
    const now = performance.now();
    let missesBeforeHit: number;
    let timeToAcquireMs: number | null;

    if (input.result === "miss") {
      this.attemptMisses += 1;
      if (this.attemptStartedAt === null) this.attemptStartedAt = now;
      missesBeforeHit = this.attemptMisses;
      timeToAcquireMs = null;
    } else {
      if (this.attemptStartedAt === null) this.attemptStartedAt = now;
      missesBeforeHit = this.attemptMisses;
      timeToAcquireMs = now - this.attemptStartedAt;
      this.attemptMisses = 0;
      this.attemptStartedAt = null;
    }

    const record: AcquisitionRecord = {
      ...input,
      sessionId: this.sessionId,
      bendVariant: this.bendVariant,
      at: now,
      wallClockMs: Date.now(),
      missesBeforeHit,
      timeToAcquireMs,
      outcome: null,
    };
    this.acquisitions.push(record);
    return record;
  }

  /**
   * Resolves a hit's transaction exactly once. A cancelled transaction is
   * marked `cancelled` (with its reason) and can never be mistaken for
   * `committed`; nothing here represents live/preview state.
   */
  resolveAcquisition(
    record: AcquisitionRecord,
    outcome: TransactionOutcome,
    options: { cancelReason?: string } = {},
  ): void {
    record.outcome = outcome;
    record.transactionDurationMs = Math.max(0, performance.now() - record.at);
    if (options.cancelReason) record.cancelReason = options.cancelReason;
    if (outcome === "committed") this.committedTransactions += 1;
    else if (outcome === "cancelled") this.cancelledTransactions += 1;
    else this.declinedTransactions += 1;
  }

  snapshot() {
    return {
      acquisitions: this.acquisitions.map((record) => ({ ...record })),
      cancelledTransactions: this.cancelledTransactions,
      committedTransactions: this.committedTransactions,
      declinedTransactions: this.declinedTransactions,
    };
  }

  reset() {
    this.acquisitions.length = 0;
    this.cancelledTransactions = 0;
    this.committedTransactions = 0;
    this.declinedTransactions = 0;
    this.attemptMisses = 0;
    this.attemptStartedAt = null;
  }
}

export function screenRegion(clientY: number, viewportHeight = window.innerHeight): ScreenRegion {
  const ratio = clientY / Math.max(1, viewportHeight);
  return ratio < 1 / 3 ? "top" : ratio < 2 / 3 ? "middle" : "bottom";
}

export function createSessionId(): string {
  const cryptoRef = globalThis.crypto as Crypto | undefined;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") return cryptoRef.randomUUID();
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
