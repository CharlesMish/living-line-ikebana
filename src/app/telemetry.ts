import type { BendVariant } from "./config.ts";
import type { AcquisitionRecord, TransactionOutcome } from "./metrics.ts";

const STORAGE_KEY = "ikebana-web-alpha:telemetry-v1";

/** Practical bound on phone-session growth; oldest records drop first. */
const MAX_RECORDS_PER_VARIANT = 4000;

const VALID_POSTURES = new Set(["arrange", "inspect"]);
const VALID_TOOLS = new Set(["shape", "prune"]);
const VALID_RESULTS = new Set(["hit", "miss"]);
const VALID_REGIONS = new Set(["top", "middle", "bottom"]);
const VALID_OPERATIONS = new Set(["insert", "aim", "bend", "base", "prune", "camera"]);
const VALID_INPUT_METHODS = new Set(["pointer", "keyboard"]);
const VALID_OUTCOMES = new Set<TransactionOutcome>(["committed", "cancelled", "declined", "released"]);

export type PersistedVariantTelemetry = {
  acquisitions: AcquisitionRecord[];
};

export type PersistedTelemetry = {
  storageVersion: 1;
  savedAt: string;
  variants: {
    bead: PersistedVariantTelemetry;
    touch: PersistedVariantTelemetry;
  };
};

function emptyTelemetry(): PersistedTelemetry {
  return {
    storageVersion: 1,
    savedAt: new Date(0).toISOString(),
    variants: {
      bead: { acquisitions: [] },
      touch: { acquisitions: [] },
    },
  };
}

/**
 * Strict per-record validation, enforced identically at hydration and at
 * `append()`. Encodes:
 * - bucket/variant agreement — a record's own `bendVariant` must match the
 *   bucket it is stored under;
 * - resolved-hit requirement — a `"hit"` is only ever valid with a real,
 *   final, non-null `outcome` and a finite `timeToAcquireMs`; a pending/live
 *   hit can never pass;
 * - miss invariants — a `"miss"` never carries an `outcome` or
 *   `timeToAcquireMs`, because a miss never opens a transaction.
 * Anything that fails is dropped rather than partially trusted.
 */
function isValidAcquisitionRecord(value: unknown, expectedVariant: BendVariant): value is AcquisitionRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  if (typeof record.at !== "number" || !Number.isFinite(record.at)) return false;
  if (typeof record.wallClockMs !== "number" || !Number.isFinite(record.wallClockMs)) return false;
  if (typeof record.sessionId !== "string" || record.sessionId.length === 0) return false;
  if (record.bendVariant !== expectedVariant) return false;
  if (!VALID_POSTURES.has(record.posture as string)) return false;
  if (!VALID_TOOLS.has(record.tool as string)) return false;
  if (!VALID_RESULTS.has(record.result as string)) return false;
  if (record.operation !== undefined && !VALID_OPERATIONS.has(record.operation as string)) return false;
  if (!VALID_REGIONS.has(record.region as string)) return false;
  if (!Number.isInteger(record.missesBeforeHit) || (record.missesBeforeHit as number) < 0) return false;
  if (record.materialId !== undefined && typeof record.materialId !== "string") return false;
  if (record.inputMethod !== undefined && !VALID_INPUT_METHODS.has(record.inputMethod as string)) return false;
  if (record.cancelReason !== undefined && typeof record.cancelReason !== "string") return false;

  if (record.result === "miss") {
    if (record.timeToAcquireMs !== null) return false;
    if (record.outcome !== null && record.outcome !== undefined) return false;
    if (record.transactionDurationMs !== undefined) return false;
    return true;
  }

  // result === "hit": only ever valid once its transaction is fully resolved.
  if (typeof record.timeToAcquireMs !== "number" || !Number.isFinite(record.timeToAcquireMs)) return false;
  if (!VALID_OUTCOMES.has(record.outcome as TransactionOutcome)) return false;
  if (
    record.transactionDurationMs !== undefined
    && (typeof record.transactionDurationMs !== "number" || record.transactionDurationMs < 0)
  ) return false;
  return true;
}

function sanitizeBucket(value: unknown, variant: BendVariant): AcquisitionRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is AcquisitionRecord => isValidAcquisitionRecord(entry, variant));
}

function sanitize(value: unknown): PersistedTelemetry {
  const candidate = value as Partial<PersistedTelemetry> | null;
  if (
    !candidate
    || candidate.storageVersion !== 1
    || typeof candidate.savedAt !== "string"
    || !candidate.variants
    || typeof candidate.variants !== "object"
  ) {
    return emptyTelemetry();
  }
  return {
    storageVersion: 1,
    savedAt: candidate.savedAt,
    variants: {
      bead: { acquisitions: sanitizeBucket(candidate.variants.bead?.acquisitions, "bead") },
      touch: { acquisitions: sanitizeBucket(candidate.variants.touch?.acquisitions, "touch") },
    },
  };
}

/**
 * Durable, cross-session acquisition telemetry keyed by bend-experiment
 * variant. Lives beside `CommittedStore`'s autosave key but is a separate
 * payload: telemetry is diagnostic, not botanical, and must never gate,
 * delay, or corrupt graph persistence. Callers must always persist the
 * committed botanical graph first and treat this store as best-effort; every
 * method here fails closed (returns `false`/drops data) instead of throwing.
 *
 * Only ever call `append` with a fully resolved record (a miss, or a hit
 * whose transaction has already committed, cancelled, declined, or — for
 * camera — released). `append` independently re-validates that invariant
 * before writing, so a pending/live record can never reach storage even if
 * a caller forgets to resolve it first.
 */
export class TelemetryStore {
  constructor(private readonly key: string = STORAGE_KEY) {}

  load(): PersistedTelemetry {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return emptyTelemetry();
      return sanitize(JSON.parse(raw));
    } catch {
      return emptyTelemetry();
    }
  }

  append(variant: BendVariant, record: AcquisitionRecord): boolean {
    if (!isValidAcquisitionRecord(record, variant)) return false;
    try {
      const current = this.load();
      const bucket = current.variants[variant].acquisitions;
      bucket.push({ ...record });
      if (bucket.length > MAX_RECORDS_PER_VARIANT) {
        bucket.splice(0, bucket.length - MAX_RECORDS_PER_VARIANT);
      }
      current.savedAt = new Date().toISOString();
      localStorage.setItem(this.key, JSON.stringify(current));
      return true;
    } catch {
      // Best-effort: a full quota or a disabled storage API must never
      // propagate past this diagnostic layer.
      return false;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // Storage is an optional resilience layer; telemetry loss never blocks the toy.
    }
  }
}
