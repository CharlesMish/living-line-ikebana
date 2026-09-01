import assert from "node:assert/strict";
import test from "node:test";

import { TelemetryStore, TELEMETRY_INSTRUMENT_VERSION } from "../../src/app/telemetry.ts";

const STORAGE_KEY = "ikebana-web-alpha:telemetry-v1";

class MemoryStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

function installMemoryStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  (globalThis as { localStorage?: unknown }).localStorage = storage;
  return storage;
}

function acquisition(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    at: 12,
    wallClockMs: Date.now(),
    sessionId: "session-a",
    bendVariant: "touch" as const,
    posture: "arrange" as const,
    tool: "shape" as const,
    result: "hit" as const,
    operation: "bend" as const,
    region: "middle" as const,
    missesBeforeHit: 0,
    timeToAcquireMs: 40,
    outcome: "committed" as const,
    ...overrides,
  };
}

function rawStoredPayload(variants: Record<string, unknown[]>) {
  return {
    storageVersion: 1,
    instrumentVersion: TELEMETRY_INSTRUMENT_VERSION,
    savedAt: new Date().toISOString(),
    variants: {
      bead: { acquisitions: variants.bead ?? [] },
      touch: { acquisitions: variants.touch ?? [] },
    },
  };
}

test("persisted telemetry starts empty and is keyed by bend variant", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  const loaded = store.load();
  assert.deepEqual(loaded.variants.bead.acquisitions, []);
  assert.deepEqual(loaded.variants.touch.acquisitions, []);
});

test("a cancelled transaction is distinguishable from a committed one in persisted data", () => {
  installMemoryStorage();
  const store = new TelemetryStore();

  store.append("touch", acquisition({ outcome: "committed" }));
  store.append("touch", acquisition({ outcome: "cancelled", cancelReason: "pointer-cancel" }));

  const loaded = store.load();
  assert.equal(loaded.variants.touch.acquisitions.length, 2);
  const [committed, cancelled] = loaded.variants.touch.acquisitions;
  assert.equal(committed.outcome, "committed");
  assert.equal(cancelled.outcome, "cancelled");
  assert.notEqual(committed.outcome, cancelled.outcome);
  // The cancelled record must never have been written with a committed
  // outcome at any point; each record is appended once, already resolved.
  assert.equal(cancelled.cancelReason, "pointer-cancel");
});

test("a camera release is distinguishable from a graph commit ('released' is never 'committed')", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  const ok = store.append(
    "touch",
    acquisition({ operation: "camera", outcome: "released", tool: "shape" }),
  );
  assert.equal(ok, true);
  const [record] = store.load().variants.touch.acquisitions;
  assert.equal(record.outcome, "released");
  assert.notEqual(record.outcome, "committed");
});

test("telemetry survives a reload (a fresh store instance reading the same key, after a flush)", () => {
  const storage = installMemoryStorage();
  const firstLoadSession = new TelemetryStore();
  firstLoadSession.append("bead", acquisition({ bendVariant: "bead" }));
  // append() only buffers in memory and schedules a deferred flush; force it
  // now so a brand-new store instance (simulating a reload) can see it.
  firstLoadSession.flush();

  const secondLoadSession = new TelemetryStore();
  const reloaded = secondLoadSession.load();
  assert.equal(reloaded.variants.bead.acquisitions.length, 1);
  assert.ok(storage.getItem(STORAGE_KEY));
});

test("append() buffers in memory without a synchronous storage write; flush() performs the deferred write", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  let writes = 0;
  const originalSetItem = localStorage.setItem.bind(localStorage);
  (localStorage as unknown as { setItem: typeof localStorage.setItem }).setItem = (key, value) => {
    writes += 1;
    originalSetItem(key, value);
  };

  store.append("touch", acquisition());
  assert.equal(writes, 0, "append() must not synchronously rewrite the whole stored history");
  // load() must still reflect the buffered append immediately (read-your-own-write).
  assert.equal(store.load().variants.touch.acquisitions.length, 1);

  const flushed = store.flush();
  assert.equal(flushed, true);
  assert.equal(writes, 1, "flush() performs exactly the deferred write");
});

test("append() schedules a flush that runs on its own (a microtask), without an explicit flush() call", async () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  store.append("touch", acquisition());
  assert.equal(localStorage.getItem(STORAGE_KEY), null, "not yet written synchronously");

  await Promise.resolve();
  await Promise.resolve();

  const raw = localStorage.getItem(STORAGE_KEY);
  assert.ok(raw, "the scheduled microtask flush must eventually write without any explicit flush() call");
  assert.equal(JSON.parse(raw).variants.touch.acquisitions.length, 1);
});

test("clear() explicitly wipes study data (distinct from an ordinary specimen reset)", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  store.append("touch", acquisition());
  assert.equal(store.load().variants.touch.acquisitions.length, 1);

  store.clear();
  const reloaded = store.load();
  assert.deepEqual(reloaded.variants.bead.acquisitions, []);
  assert.deepEqual(reloaded.variants.touch.acquisitions, []);
});

test("clear() cancels a pending scheduled flush so stale buffered data can't resurrect after clearing", async () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  store.append("touch", acquisition());
  store.clear();

  await Promise.resolve();
  await Promise.resolve();

  const raw = localStorage.getItem(STORAGE_KEY);
  assert.equal(raw, null, "clear() must remove storage, and no stale flush may write the cleared record back");
});

test("the complete persisted payload stays under the 256 KiB bound by dropping the oldest records first", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  // Each record is a few hundred bytes; appending many across both variants
  // must eventually exceed 256 KiB and force a trim at flush time.
  for (let index = 0; index < 1500; index += 1) {
    store.append(index % 2 === 0 ? "bead" : "touch", acquisition({
      wallClockMs: index, // strictly increasing "age": index 0 is oldest.
      sessionId: `session-${index}`,
      cancelReason: index % 3 === 0 ? "pointer-cancel" : undefined,
      outcome: index % 3 === 0 ? "cancelled" : "committed",
    }));
  }

  const flushed = store.flush();
  assert.equal(flushed, true);

  const raw = localStorage.getItem(STORAGE_KEY);
  assert.ok(raw);
  const byteLength = new TextEncoder().encode(raw).length;
  assert.ok(byteLength <= 256 * 1024, `expected <= 256 KiB, got ${byteLength} bytes`);

  const loaded = store.load();
  const remaining = [...loaded.variants.bead.acquisitions, ...loaded.variants.touch.acquisitions];
  assert.ok(remaining.length > 0, "trimming must not be forced to remove everything for a realistic history");
  assert.ok(remaining.length < 1500, "the oversized history must actually have been trimmed");
  // Oldest-first eviction: no surviving record may be older (by wallClockMs)
  // than the oldest surviving record's neighbors that got dropped — i.e.
  // the minimum surviving wallClockMs must be greater than 0 (index 0 was
  // the very oldest and must have been dropped first).
  const minSurvivingWallClock = Math.min(...remaining.map((record) => record.wallClockMs));
  assert.ok(minSurvivingWallClock > 0, "the globally oldest records must be evicted first");
});

test("append() rejects bucket/variant disagreement instead of trusting the caller", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  // Appending a "bead" record into the "touch" bucket must fail closed.
  const ok = store.append("touch", acquisition({ bendVariant: "bead" }));
  assert.equal(ok, false);
  assert.equal(store.load().variants.touch.acquisitions.length, 0);
});

test("append() refuses an unresolved (pending) hit: hits are only ever persisted with a final outcome", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  const ok = store.append("touch", acquisition({ outcome: null }));
  assert.equal(ok, false);
  assert.equal(store.load().variants.touch.acquisitions.length, 0);
});

test("append() enforces miss invariants: a miss never carries an outcome or a timing", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  const missWithOutcome = store.append(
    "touch",
    acquisition({ result: "miss", outcome: "committed", timeToAcquireMs: null, operation: undefined }),
  );
  const missWithTiming = store.append(
    "touch",
    acquisition({ result: "miss", outcome: null, timeToAcquireMs: 12, operation: undefined }),
  );
  assert.equal(missWithOutcome, false);
  assert.equal(missWithTiming, false);
  assert.equal(store.load().variants.touch.acquisitions.length, 0);

  const validMiss = store.append(
    "touch",
    acquisition({ result: "miss", outcome: null, timeToAcquireMs: null, operation: undefined }),
  );
  assert.equal(validMiss, true);
  assert.equal(store.load().variants.touch.acquisitions.length, 1);
});

test("semantic combination rules: hits require an operation", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  const ok = store.append("touch", acquisition({ operation: undefined }));
  assert.equal(ok, false);
});

test("semantic combination rules: camera may resolve only released or cancelled", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  assert.equal(store.append("touch", acquisition({ operation: "camera", outcome: "committed" })), false);
  assert.equal(store.append("touch", acquisition({ operation: "camera", outcome: "declined" })), false);
  assert.equal(store.append("touch", acquisition({ operation: "camera", outcome: "released" })), true);
  assert.equal(
    store.append("touch", acquisition({ operation: "camera", outcome: "cancelled", cancelReason: "pointer-cancel" })),
    true,
  );
});

test("semantic combination rules: graph edits (aim/bend/base/prune) may resolve only committed or cancelled", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  for (const operation of ["aim", "bend", "base", "prune"] as const) {
    assert.equal(store.append("touch", acquisition({ operation, outcome: "declined" })), false, operation);
    assert.equal(store.append("touch", acquisition({ operation, outcome: "released" })), false, operation);
    assert.equal(store.append("touch", acquisition({ operation, outcome: "committed" })), true, operation);
  }
});

test("semantic combination rules: only invalid insertion may be declined", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  assert.equal(
    store.append("touch", acquisition({ operation: "insert", outcome: "declined", materialId: "flowering-branch", inputMethod: "pointer" })),
    true,
  );
  assert.equal(store.append("touch", acquisition({ operation: "bend", outcome: "declined" })), false);
  assert.equal(store.append("touch", acquisition({ operation: "camera", outcome: "declined" })), false);
});

test("semantic combination rules: insert requires materialId and inputMethod; non-insert forbids them", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  assert.equal(
    store.append("touch", acquisition({ operation: "insert", outcome: "committed", materialId: undefined, inputMethod: "pointer" })),
    false,
    "insert without materialId must be rejected",
  );
  assert.equal(
    store.append("touch", acquisition({ operation: "insert", outcome: "committed", materialId: "flowering-branch", inputMethod: undefined })),
    false,
    "insert without inputMethod must be rejected",
  );
  assert.equal(
    store.append("touch", acquisition({ operation: "insert", outcome: "committed", materialId: "flowering-branch", inputMethod: "pointer" })),
    true,
  );
  assert.equal(
    store.append("touch", acquisition({ operation: "bend", outcome: "committed", materialId: "flowering-branch" })),
    false,
    "a non-insert operation must never carry materialId",
  );
  assert.equal(
    store.append("touch", acquisition({ operation: "camera", outcome: "released", inputMethod: "pointer" })),
    false,
    "a non-insert operation must never carry inputMethod",
  );
});

test("semantic combination rules: a cancelled outcome always requires a reason", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  assert.equal(
    store.append("touch", acquisition({ operation: "bend", outcome: "cancelled", cancelReason: undefined })),
    false,
  );
  assert.equal(
    store.append("touch", acquisition({ operation: "bend", outcome: "cancelled", cancelReason: "" })),
    false,
  );
  assert.equal(
    store.append("touch", acquisition({ operation: "bend", outcome: "cancelled", cancelReason: "pointer-cancel" })),
    true,
  );
});

test("semantic combination rules: all timing values must be finite and nonnegative", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  assert.equal(store.append("touch", acquisition({ timeToAcquireMs: -1 })), false);
  assert.equal(store.append("touch", acquisition({ timeToAcquireMs: Number.POSITIVE_INFINITY })), false);
  assert.equal(store.append("touch", acquisition({ at: -5 })), false);
  assert.equal(store.append("touch", acquisition({ wallClockMs: -5 })), false);
  assert.equal(store.append("touch", acquisition({ transactionDurationMs: -1 })), false);
  assert.equal(store.append("touch", acquisition({ timeToAcquireMs: 0, at: 0, wallClockMs: 0 })), true);
});

test("canonicalization: undeclared/extra fields from a tampered payload are never retained", () => {
  const storage = installMemoryStorage();
  const tampered = {
    ...acquisition({ sessionId: "session-good" }),
    __proto__: { polluted: true },
    unexpectedField: "should never survive",
    extraNested: { a: 1 },
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(rawStoredPayload({ touch: [tampered] })));

  const store = new TelemetryStore();
  const [record] = store.load().variants.touch.acquisitions;
  assert.equal(record.sessionId, "session-good");
  assert.equal((record as Record<string, unknown>).unexpectedField, undefined);
  assert.equal((record as Record<string, unknown>).extraNested, undefined);
  assert.deepEqual(Object.keys(record).sort(), [
    "at",
    "bendVariant",
    "missesBeforeHit",
    "operation",
    "outcome",
    "posture",
    "region",
    "result",
    "sessionId",
    "timeToAcquireMs",
    "tool",
    "wallClockMs",
  ]);
});

test("canonicalization also applies to append(): a record object with extra properties is reconstructed, not passed through", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  const withExtra = { ...acquisition(), extraJunk: "nope" } as unknown as ReturnType<typeof acquisition>;
  store.append("touch", withExtra);
  const [record] = store.load().variants.touch.acquisitions;
  assert.equal((record as Record<string, unknown>).extraJunk, undefined);
});

test("hydration drops a malformed record but keeps the rest, never partial-hydrating garbage", () => {
  const storage = installMemoryStorage();
  const good = acquisition({ sessionId: "session-good" });
  const badBucketMismatch = acquisition({ sessionId: "session-bad", bendVariant: "bead" });
  const badPendingHit = { ...acquisition({ sessionId: "session-bad-2" }), outcome: null };
  storage.setItem(STORAGE_KEY, JSON.stringify(rawStoredPayload({ touch: [good, badBucketMismatch, badPendingHit] })));

  const store = new TelemetryStore();
  const loaded = store.load();
  assert.equal(loaded.variants.touch.acquisitions.length, 1);
  assert.equal(loaded.variants.touch.acquisitions[0].sessionId, "session-good");
});

test("a fully corrupt top-level payload fails closed to an empty session, never a partial one", () => {
  const storage = installMemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({ garbage: true }));
  const store = new TelemetryStore();
  const loaded = store.load();
  assert.deepEqual(loaded.variants.bead.acquisitions, []);
  assert.deepEqual(loaded.variants.touch.acquisitions, []);
});

test("instrumentVersion is persisted with the dataset, and a mismatched version fails closed instead of mixing schemas", () => {
  const storage = installMemoryStorage();
  const store = new TelemetryStore();
  store.append("touch", acquisition());
  store.flush();

  const stored = JSON.parse(storage.getItem(STORAGE_KEY)!);
  assert.equal(stored.instrumentVersion, TELEMETRY_INSTRUMENT_VERSION);

  // Simulate a payload written by a different (older/incompatible) instrument.
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify(rawStoredPayload({ touch: [acquisition({ sessionId: "old-instrument" })] })).replace(
      JSON.stringify(TELEMETRY_INSTRUMENT_VERSION),
      JSON.stringify("0-incompatible"),
    ),
  );
  const freshStore = new TelemetryStore();
  const loaded = freshStore.load();
  assert.deepEqual(loaded.variants.touch.acquisitions, [], "an incompatible instrument version must never be mixed in");
  assert.equal(loaded.instrumentVersion, TELEMETRY_INSTRUMENT_VERSION, "a freshly-failed-closed payload still tags the current version");
});

test("a quota-full/throwing storage fails closed (append still buffers; flush() returns false) and never throws past this layer", () => {
  const throwingStorage = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    },
    removeItem: () => {},
  };
  (globalThis as { localStorage?: unknown }).localStorage = throwingStorage;

  const store = new TelemetryStore();
  assert.doesNotThrow(() => {
    const ok = store.append("touch", acquisition());
    assert.equal(ok, true, "append() only reports validation, not the deferred write outcome");
    const flushed = store.flush();
    assert.equal(flushed, false, "flush() reports the actual (failed) write outcome");
  });
});
