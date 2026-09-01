import type { BendVariant } from "./config.ts";
import type { AcquisitionRecord, TransactionOutcome } from "./metrics.ts";

const STORAGE_KEY = "ikebana-web-alpha:telemetry-v1";

/**
 * Bumped when what `SessionMetrics` records or how `TelemetryStore` persists
 * it changes shape/meaning, independent of `storageVersion` (the container
 * format). A stored payload written by a different instrument version is
 * never trusted or partially merged with the current one — see `sanitize`.
 * "4": persisted validation (cancelReason only with outcome "cancelled",
 * canonical savedAt, oversized-raw/pre-write size rejection) and scheduling
 * (task-boundary flush with generation-token cancellation, explicit
 * priming) semantics changed.
 */
export const TELEMETRY_INSTRUMENT_VERSION = "4";

/** Practical bound on phone-session growth; oldest records drop first. */
const MAX_RECORDS_PER_VARIANT = 4000;

/**
 * The complete persisted payload (both variants, every field) must always
 * serialize under this many bytes. Enforced at flush time, not per-append,
 * by dropping the globally oldest record (by wall-clock time, across both
 * buckets) until it fits.
 */
const MAX_PAYLOAD_BYTES = 256 * 1024;

const VALID_POSTURES = new Set(["arrange", "inspect"]);
const VALID_TOOLS = new Set(["shape", "prune"]);
const VALID_RESULTS = new Set(["hit", "miss"]);
const VALID_REGIONS = new Set(["top", "middle", "bottom"]);
const VALID_OPERATIONS = new Set(["insert", "aim", "bend", "base", "prune", "camera"]);
const VALID_INPUT_METHODS = new Set(["pointer", "keyboard"]);

/** Which outcomes are semantically legal for a hit with this operation. */
const ALLOWED_OUTCOMES_BY_OPERATION: Record<string, ReadonlySet<TransactionOutcome>> = {
  insert: new Set(["committed", "cancelled", "declined"]),
  aim: new Set(["committed", "cancelled"]),
  bend: new Set(["committed", "cancelled"]),
  base: new Set(["committed", "cancelled"]),
  prune: new Set(["committed", "cancelled"]),
  camera: new Set(["released", "cancelled"]),
};

export type PersistedVariantTelemetry = {
  acquisitions: AcquisitionRecord[];
};

export type PersistedTelemetry = {
  storageVersion: 1;
  /** Persisted with the dataset itself, not only the export envelope. */
  instrumentVersion: string;
  savedAt: string;
  variants: {
    bead: PersistedVariantTelemetry;
    touch: PersistedVariantTelemetry;
  };
};

function emptyTelemetry(): PersistedTelemetry {
  return {
    storageVersion: 1,
    instrumentVersion: TELEMETRY_INSTRUMENT_VERSION,
    savedAt: new Date(0).toISOString(),
    variants: {
      bead: { acquisitions: [] },
      touch: { acquisitions: [] },
    },
  };
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Exactly the string shape `Date.prototype.toISOString()` produces. */
const CANONICAL_ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isCanonicalIsoDate(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Validates, then reconstructs, one record as an allowlisted object — never
 * a pass-through of the parsed JSON. Undeclared/extra fields from a
 * tampered or future-schema payload are always dropped, never retained.
 * Returns `null` for anything that fails structural or semantic validation
 * (dropped, not partially trusted). Encodes:
 * - bucket/variant agreement — a record's own `bendVariant` must match the
 *   bucket it is stored under;
 * - resolved-hit requirement — a `"hit"` is only ever valid with a real,
 *   final, non-null `outcome` and a finite, nonnegative `timeToAcquireMs`;
 * - miss invariants — a `"miss"` never carries an `outcome` or a timing;
 * - semantic combination rules — a hit requires an `operation`; camera may
 *   resolve only `released`/`cancelled`; a graph edit (aim/bend/base/prune)
 *   may resolve only `committed`/`cancelled`; only `insert` may resolve
 *   `declined` (this layer cannot know whether a given insertion was
 *   actually invalid — the production app alone is responsible for only
 *   ever producing `declined` on an invalid release; see `IkebanaApp.ts`);
 *   only `insert` carries `materialId`/`inputMethod`, and it always carries
 *   both; `cancelReason` is only ever valid alongside `outcome ===
 *   "cancelled"`, and a `cancelled` outcome always carries a nonempty one;
 *   all timing values are finite and nonnegative.
 */
function canonicalizeAcquisitionRecord(value: unknown, expectedVariant: BendVariant): AcquisitionRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (!isFiniteNonNegative(record.at)) return null;
  if (!isFiniteNonNegative(record.wallClockMs)) return null;
  if (typeof record.sessionId !== "string" || record.sessionId.length === 0) return null;
  if (record.bendVariant !== expectedVariant) return null;
  if (!VALID_POSTURES.has(record.posture as string)) return null;
  if (!VALID_TOOLS.has(record.tool as string)) return null;
  if (!VALID_RESULTS.has(record.result as string)) return null;
  if (record.operation !== undefined && !VALID_OPERATIONS.has(record.operation as string)) return null;
  if (!VALID_REGIONS.has(record.region as string)) return null;
  if (!Number.isInteger(record.missesBeforeHit) || (record.missesBeforeHit as number) < 0) return null;
  if (record.materialId !== undefined && typeof record.materialId !== "string") return null;
  if (record.inputMethod !== undefined && !VALID_INPUT_METHODS.has(record.inputMethod as string)) return null;
  if (record.cancelReason !== undefined && typeof record.cancelReason !== "string") return null;
  // cancelReason is only ever meaningful alongside a cancelled outcome —
  // reject it outright on a miss (outcome null) or any other outcome.
  if (record.cancelReason !== undefined && record.outcome !== "cancelled") return null;

  const operation = record.operation as AcquisitionRecord["operation"];
  const isInsert = operation === "insert";
  // Only insert carries materialId/inputMethod, and it always carries both.
  if (isInsert) {
    if (typeof record.materialId !== "string" || record.materialId.length === 0) return null;
    if (!VALID_INPUT_METHODS.has(record.inputMethod as string)) return null;
  } else if (record.materialId !== undefined || record.inputMethod !== undefined) {
    return null;
  }

  if (record.result === "miss") {
    if (record.timeToAcquireMs !== null) return null;
    if (record.outcome !== null && record.outcome !== undefined) return null;
    if (record.transactionDurationMs !== undefined) return null;
    return {
      at: record.at as number,
      wallClockMs: record.wallClockMs as number,
      sessionId: record.sessionId as string,
      bendVariant: expectedVariant,
      posture: record.posture as AcquisitionRecord["posture"],
      tool: record.tool as AcquisitionRecord["tool"],
      result: "miss",
      region: record.region as AcquisitionRecord["region"],
      missesBeforeHit: record.missesBeforeHit as number,
      timeToAcquireMs: null,
      outcome: null,
    };
  }

  // result === "hit": only ever valid once its transaction is fully resolved.
  if (operation === undefined) return null; // hits require an operation.
  if (!isFiniteNonNegative(record.timeToAcquireMs)) return null;
  const allowedOutcomes = ALLOWED_OUTCOMES_BY_OPERATION[operation];
  if (!allowedOutcomes || !allowedOutcomes.has(record.outcome as TransactionOutcome)) return null;
  if (record.outcome === "cancelled" && (typeof record.cancelReason !== "string" || record.cancelReason.length === 0)) {
    return null;
  }
  if (record.transactionDurationMs !== undefined && !isFiniteNonNegative(record.transactionDurationMs)) return null;

  const canonical: AcquisitionRecord = {
    at: record.at as number,
    wallClockMs: record.wallClockMs as number,
    sessionId: record.sessionId as string,
    bendVariant: expectedVariant,
    posture: record.posture as AcquisitionRecord["posture"],
    tool: record.tool as AcquisitionRecord["tool"],
    result: "hit",
    operation,
    region: record.region as AcquisitionRecord["region"],
    missesBeforeHit: record.missesBeforeHit as number,
    timeToAcquireMs: record.timeToAcquireMs as number,
    outcome: record.outcome as TransactionOutcome,
  };
  if (isInsert) {
    canonical.materialId = record.materialId as string;
    canonical.inputMethod = record.inputMethod as AcquisitionRecord["inputMethod"];
  }
  if (typeof record.cancelReason === "string") canonical.cancelReason = record.cancelReason;
  if (record.transactionDurationMs !== undefined) canonical.transactionDurationMs = record.transactionDurationMs as number;
  return canonical;
}

function sanitizeBucket(value: unknown, variant: BendVariant): AcquisitionRecord[] {
  if (!Array.isArray(value)) return [];
  const canonicalized: AcquisitionRecord[] = [];
  for (const entry of value) {
    const record = canonicalizeAcquisitionRecord(entry, variant);
    if (record) canonicalized.push(record);
  }
  return canonicalized;
}

function sanitize(value: unknown): PersistedTelemetry {
  const candidate = value as Partial<PersistedTelemetry> | null;
  if (
    !candidate
    || candidate.storageVersion !== 1
    || !isCanonicalIsoDate(candidate.savedAt)
    || !candidate.variants
    || typeof candidate.variants !== "object"
  ) {
    return emptyTelemetry();
  }
  // A payload written by a different instrument version is never trusted or
  // partially merged with the current one: fail closed to empty rather than
  // silently mixing schemas.
  if (candidate.instrumentVersion !== TELEMETRY_INSTRUMENT_VERSION) {
    return emptyTelemetry();
  }
  return {
    storageVersion: 1,
    instrumentVersion: TELEMETRY_INSTRUMENT_VERSION,
    savedAt: candidate.savedAt,
    variants: {
      bead: { acquisitions: sanitizeBucket(candidate.variants.bead?.acquisitions, "bead") },
      touch: { acquisitions: sanitizeBucket(candidate.variants.touch?.acquisitions, "touch") },
    },
  };
}

function byteLengthOfString(text: string): number {
  return new TextEncoder().encode(text).length;
}

function byteLengthOfJson(value: unknown): number {
  return byteLengthOfString(JSON.stringify(value));
}

function findGloballyOldestRecord(
  payload: PersistedTelemetry,
): { variant: BendVariant; index: number } | null {
  let best: { variant: BendVariant; index: number; wallClockMs: number } | null = null;
  for (const variant of ["bead", "touch"] as const) {
    const bucket = payload.variants[variant].acquisitions;
    for (let index = 0; index < bucket.length; index += 1) {
      const wallClockMs = bucket[index].wallClockMs;
      if (best === null || wallClockMs < best.wallClockMs) {
        best = { variant, index, wallClockMs };
      }
    }
  }
  return best === null ? null : { variant: best.variant, index: best.index };
}

/**
 * Drops the globally oldest record (by wall-clock time, across both
 * buckets) repeatedly until the whole payload serializes under
 * `MAX_PAYLOAD_BYTES`, or there is nothing left to drop. Runs only at flush
 * time (see `TelemetryStore.flush`), never inside `append`, so a single
 * acquisition's append stays cheap regardless of total history size.
 */
function trimToByteBudget(payload: PersistedTelemetry): void {
  while (byteLengthOfJson(payload) > MAX_PAYLOAD_BYTES) {
    const oldest = findGloballyOldestRecord(payload);
    if (!oldest) break; // nothing left to drop; this is as small as it gets.
    payload.variants[oldest.variant].acquisitions.splice(oldest.index, 1);
  }
}

/**
 * Durable, cross-session acquisition telemetry keyed by bend-experiment
 * variant. Lives beside `CommittedStore`'s autosave key but is a separate
 * payload: telemetry is diagnostic, not botanical, and must never gate,
 * delay, or corrupt graph persistence.
 *
 * `append` only ever mutates a cheap in-memory cache and schedules a flush;
 * it never does a synchronous whole-history JSON.parse/stringify/setItem
 * itself, so the craft-critical commit path that calls it never blocks on
 * rewriting the entire telemetry history. Call `prime()` once, during app
 * initialization (after any one-shot `clearStudyData` handling), so that
 * initial hydration — the one real `localStorage.getItem`/`JSON.parse`/
 * per-record canonicalization pass — happens outside any interaction frame;
 * every `append`/`load` after that reads only the in-memory cache.
 *
 * The actual write — including the 256 KiB size trim — happens in a flush
 * scheduled to cross a task/render boundary (`setTimeout`, not a
 * microtask): a microtask alone runs before the browser gets a chance to
 * paint or do other work, so it does not actually relieve the current
 * frame the way a task-boundary handoff does. `flush()` can also be called
 * directly and synchronously where that is safe (tests, or app teardown —
 * never the craft-critical commit path), and always fails closed (never
 * throws past this layer). Every scheduled flush carries the generation it
 * was scheduled under; `clear()` and `flush()` both advance the generation,
 * so an obsolete callback that still manages to run (e.g. because some
 * environment's timer cancellation is unreliable) recognizes itself as
 * stale and is a no-op — it can never resurrect data a subsequent `clear()`
 * removed, nor race a later, newer scheduled write.
 *
 * Only ever call `append` with a fully resolved record (a miss, or a hit
 * whose transaction has already committed, cancelled, declined, or — for
 * camera — released). `append` independently re-validates and canonicalizes
 * that invariant before buffering, so a pending/live or malformed record can
 * never reach storage even if a caller forgets to resolve it first.
 */
export class TelemetryStore {
  private cache: PersistedTelemetry | null = null;
  private scheduledHandle: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor(private readonly key: string = STORAGE_KEY) {}

  /**
   * Forces hydration now. Call once during app initialization so the first
   * real `append`/`load` never touches storage. Idempotent and safe to call
   * more than once (a no-op once already primed).
   */
  prime(): void {
    this.ensureCache();
  }

  /** Always reflects the in-memory cache, including not-yet-flushed appends. */
  load(): PersistedTelemetry {
    const cache = this.ensureCache();
    return {
      storageVersion: cache.storageVersion,
      instrumentVersion: cache.instrumentVersion,
      savedAt: cache.savedAt,
      variants: {
        bead: { acquisitions: cache.variants.bead.acquisitions.map((record) => ({ ...record })) },
        touch: { acquisitions: cache.variants.touch.acquisitions.map((record) => ({ ...record })) },
      },
    };
  }

  append(variant: BendVariant, record: AcquisitionRecord): boolean {
    const canonical = canonicalizeAcquisitionRecord(record, variant);
    if (!canonical) return false;
    const cache = this.ensureCache();
    const bucket = cache.variants[variant].acquisitions;
    bucket.push(canonical);
    if (bucket.length > MAX_RECORDS_PER_VARIANT) {
      bucket.splice(0, bucket.length - MAX_RECORDS_PER_VARIANT);
    }
    cache.savedAt = new Date().toISOString();
    this.scheduleFlush();
    return true;
  }

  /**
   * Explicitly, synchronously wipes study data — never implied by an
   * ordinary specimen reset. Advances the generation and cancels any
   * not-yet-run scheduled flush so a stale write can't resurrect what was
   * just cleared, even if that flush somehow still runs.
   */
  clear(): void {
    this.cache = emptyTelemetry();
    this.cancelScheduledFlush();
    try {
      localStorage.removeItem(this.key);
    } catch {
      // Storage is an optional resilience layer; telemetry loss never blocks the toy.
    }
  }

  /**
   * Forces the buffered cache to storage now (with the byte trim applied).
   * Craft-critical code must never call this directly — that would defeat
   * buffering's purpose. It exists for deterministic tests and for safe,
   * non-critical teardown moments (visibility change, page hide).
   */
  flush(): boolean {
    this.cancelScheduledFlush();
    return this.writeCacheToStorage();
  }

  private cancelScheduledFlush(): void {
    this.generation += 1;
    if (this.scheduledHandle !== null) {
      clearTimeout(this.scheduledHandle);
      this.scheduledHandle = null;
    }
  }

  /**
   * Schedules a flush to run after the current task/render boundary — a
   * macrotask (`setTimeout`), deliberately not a microtask. A microtask
   * runs before the browser can paint or process other pending work, so it
   * does not actually get this write off the interaction frame; a task
   * boundary does.
   */
  private scheduleFlush(): void {
    if (this.scheduledHandle !== null) return; // already scheduled.
    const scheduledGeneration = this.generation;
    this.scheduledHandle = setTimeout(() => {
      this.scheduledHandle = null;
      // Stale: a clear()/flush() advanced the generation since this was
      // scheduled. Never write — even if this callback still ran despite
      // being "cancelled".
      if (scheduledGeneration !== this.generation) return;
      this.writeCacheToStorage();
    }, 0);
  }

  private writeCacheToStorage(): boolean {
    const cache = this.ensureCache();
    trimToByteBudget(cache);
    const json = JSON.stringify(cache);
    if (byteLengthOfString(json) > MAX_PAYLOAD_BYTES) {
      // Trimming could not bring even the record-free envelope under the
      // cap (a pathological savedAt/sessionId length, or a future bug).
      // Never write an over-budget payload under any circumstance.
      return false;
    }
    try {
      localStorage.setItem(this.key, json);
      return true;
    } catch {
      // Best-effort: a full quota or a disabled storage API must never
      // propagate past this diagnostic layer.
      return false;
    }
  }

  private ensureCache(): PersistedTelemetry {
    if (this.cache === null) this.cache = this.loadFromStorage();
    return this.cache;
  }

  private loadFromStorage(): PersistedTelemetry {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return emptyTelemetry();
      // Reject an already-oversized raw payload before ever parsing it —
      // whatever produced it did not respect MAX_PAYLOAD_BYTES, so it is
      // never trusted, canonicalized, or partially hydrated.
      if (byteLengthOfString(raw) > MAX_PAYLOAD_BYTES) return emptyTelemetry();
      return sanitize(JSON.parse(raw));
    } catch {
      return emptyTelemetry();
    }
  }
}
