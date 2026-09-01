import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { TelemetryStore, TELEMETRY_INSTRUMENT_VERSION } from "../../src/app/telemetry.ts";

const STORAGE_KEY = "ikebana-web-alpha:telemetry-v1";

// TelemetryStore now schedules its deferred flush with a real task-boundary
// timer (setTimeout), not a microtask. A test that appends and never
// flushes/clears/awaits that timer would otherwise leave it dangling in
// the real Node event loop, where it can fire during a *later* test and
// write into whatever `localStorage` mock that later test just installed.
// Track every store created via `createStore()` and force-flush (which
// also cancels any pending real timer) after every test, regardless of
// whether the test itself remembered to.
const activeStores: TelemetryStore[] = [];

function createStore(key?: string): TelemetryStore {
  const store = key === undefined ? new TelemetryStore() : new TelemetryStore(key);
  activeStores.push(store);
  return store;
}

afterEach(() => {
  for (const store of activeStores) {
    try {
      store.flush();
    } catch {
      // Best-effort cleanup only; a test's own assertions already ran.
    }
  }
  activeStores.length = 0;
});

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
  const store = createStore();
  const loaded = store.load();
  assert.deepEqual(loaded.variants.bead.acquisitions, []);
  assert.deepEqual(loaded.variants.touch.acquisitions, []);
});

test("a cancelled transaction is distinguishable from a committed one in persisted data", () => {
  installMemoryStorage();
  const store = createStore();

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
  const store = createStore();
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
  const firstLoadSession = createStore();
  firstLoadSession.append("bead", acquisition({ bendVariant: "bead" }));
  // append() only buffers in memory and schedules a deferred flush; force it
  // now so a brand-new store instance (simulating a reload) can see it.
  firstLoadSession.flush();

  const secondLoadSession = createStore();
  const reloaded = secondLoadSession.load();
  assert.equal(reloaded.variants.bead.acquisitions.length, 1);
  assert.ok(storage.getItem(STORAGE_KEY));
});

test("append() buffers in memory without a synchronous storage write; flush() performs the deferred write", () => {
  installMemoryStorage();
  const store = createStore();
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

test("append() has not written after only a microtask; it writes after the scheduled task/render boundary", async () => {
  installMemoryStorage();
  const store = createStore();
  store.append("touch", acquisition());
  assert.equal(localStorage.getItem(STORAGE_KEY), null, "not yet written synchronously");

  // A microtask alone must not be enough: it runs before the browser gets
  // a chance to paint or do other work, so it does not actually relieve
  // the interaction frame the way a task-boundary handoff does.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    localStorage.getItem(STORAGE_KEY),
    null,
    "must still be unwritten after only microtasks",
  );

  // Crossing an actual task boundary must be enough.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const raw = localStorage.getItem(STORAGE_KEY);
  assert.ok(raw, "the scheduled task-boundary flush must eventually write without any explicit flush() call");
  assert.equal(JSON.parse(raw).variants.touch.acquisitions.length, 1);
});

test("after priming, append() performs zero storage reads (no getItem/parse on the interaction path)", () => {
  installMemoryStorage();
  let getItemCalls = 0;
  const originalGetItem = localStorage.getItem.bind(localStorage);
  (localStorage as unknown as { getItem: typeof localStorage.getItem }).getItem = (key: string) => {
    getItemCalls += 1;
    return originalGetItem(key);
  };

  const store = createStore();
  store.prime();
  assert.ok(getItemCalls >= 1, "priming itself is expected to read storage exactly once");
  const readsAfterPrime = getItemCalls;

  store.append("touch", acquisition());
  store.append("bead", acquisition({ bendVariant: "bead" }));
  store.load();
  store.load();

  assert.equal(
    getItemCalls,
    readsAfterPrime,
    "append()/load() after priming must never call localStorage.getItem again",
  );
});

test("clear() cannot be undone by an obsolete scheduled callback (generation token)", () => {
  // Fake setTimeout/clearTimeout: clearTimeout is deliberately a no-op, so
  // the ONLY thing that can stop the captured callback from writing stale
  // data back is the generation-token check inside TelemetryStore itself —
  // this proves that specific mechanism, not merely that clearTimeout works.
  const scheduled: Array<() => void> = [];
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout = ((callback: () => void) => {
    scheduled.push(callback);
    return scheduled.length as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  (globalThis as unknown as { clearTimeout: typeof clearTimeout }).clearTimeout = (() => {
    // no-op: intentionally does not remove anything from `scheduled`.
  }) as typeof clearTimeout;

  try {
    installMemoryStorage();
    const store = createStore();
    store.prime();
    store.append("touch", acquisition());
    const obsoleteCallback = scheduled[scheduled.length - 1];
    assert.ok(obsoleteCallback, "expected append() to have scheduled a flush callback");

    store.clear();
    // Manually fire the callback that would have flushed the pre-clear
    // state, despite clear() having already run and (in a real
    // environment) called clearTimeout — here faked to fail at that.
    obsoleteCallback();

    assert.equal(
      localStorage.getItem(STORAGE_KEY),
      null,
      "an obsolete scheduled callback must never resurrect data after clear(), even if timer cancellation itself is bypassed",
    );
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("clear() explicitly wipes study data (distinct from an ordinary specimen reset)", () => {
  installMemoryStorage();
  const store = createStore();
  store.append("touch", acquisition());
  assert.equal(store.load().variants.touch.acquisitions.length, 1);

  store.clear();
  const reloaded = store.load();
  assert.deepEqual(reloaded.variants.bead.acquisitions, []);
  assert.deepEqual(reloaded.variants.touch.acquisitions, []);
});

test("clear() cancels a pending scheduled (real-timer) flush so stale buffered data can't resurrect after clearing", async () => {
  installMemoryStorage();
  const store = createStore();
  store.append("touch", acquisition());
  store.clear();

  // Wait past a real task boundary — long enough for the original
  // scheduled flush to have fired had it not been cancelled — before
  // asserting it didn't resurrect the cleared data.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  const raw = localStorage.getItem(STORAGE_KEY);
  assert.equal(raw, null, "clear() must remove storage, and no stale flush may write the cleared record back");
});

test("the complete persisted payload stays under the 256 KiB bound by dropping the globally oldest valid records first", () => {
  installMemoryStorage();
  const store = createStore();
  const RECORD_COUNT = 1500;
  // Each record is a few hundred bytes; appending many across both variants
  // must eventually exceed 256 KiB and force a trim at flush time. Every
  // record's own bendVariant must agree with the bucket it is appended to,
  // or canonicalization would silently reject it (a bug this test used to
  // have) and this test would not actually be exercising 1500 real records.
  for (let index = 0; index < RECORD_COUNT; index += 1) {
    const variant = index % 2 === 0 ? "bead" : "touch";
    const ok = store.append(variant, acquisition({
      bendVariant: variant,
      wallClockMs: index, // strictly increasing "age": index 0 is oldest.
      sessionId: `session-${index}`,
      cancelReason: index % 3 === 0 ? "pointer-cancel" : undefined,
      outcome: index % 3 === 0 ? "cancelled" : "committed",
    }));
    assert.equal(ok, true, `expected append() to succeed for record ${index}`);
  }

  const totalBeforeFlush =
    store.load().variants.bead.acquisitions.length + store.load().variants.touch.acquisitions.length;
  assert.equal(totalBeforeFlush, RECORD_COUNT, "every one of the 1500 generated records must actually have been buffered");

  // Confirm the ungoverned in-memory history genuinely exceeds the cap
  // before any trimming — otherwise this test would not prove eviction at
  // all, only that a small payload happens to fit.
  const untrimmedBytes = new TextEncoder().encode(JSON.stringify(store.load())).length;
  assert.ok(
    untrimmedBytes > 256 * 1024,
    `expected the untrimmed history to exceed 256 KiB before trimming, got ${untrimmedBytes} bytes`,
  );

  const flushed = store.flush();
  assert.equal(flushed, true);

  const raw = localStorage.getItem(STORAGE_KEY);
  assert.ok(raw);
  const byteLength = new TextEncoder().encode(raw).length;
  assert.ok(byteLength <= 256 * 1024, `expected <= 256 KiB, got ${byteLength} bytes`);

  const loaded = store.load();
  const remainingBead = loaded.variants.bead.acquisitions;
  const remainingTouch = loaded.variants.touch.acquisitions;
  const remaining = [...remainingBead, ...remainingTouch];
  assert.ok(remaining.length > 0, "trimming must not be forced to remove everything for a realistic history");
  assert.ok(remaining.length < RECORD_COUNT, "the oversized history must actually have been trimmed");
  // Every surviving record must itself still be valid/canonical (bucket
  // agreement holds, since these came from append()'s own canonicalization).
  for (const record of remainingBead) assert.equal(record.bendVariant, "bead");
  for (const record of remainingTouch) assert.equal(record.bendVariant, "touch");

  // Oldest-first eviction, proven precisely: the surviving set must be
  // exactly the highest-wallClockMs tail of the original 1500 (i.e. every
  // dropped record's wallClockMs must be less than every surviving one's).
  const survivingWallClocks = remaining.map((record) => record.wallClockMs).sort((a, b) => a - b);
  const droppedCount = RECORD_COUNT - remaining.length;
  const expectedSurvivingWallClocks = Array.from(
    { length: remaining.length },
    (_, index) => droppedCount + index,
  );
  assert.deepEqual(
    survivingWallClocks,
    expectedSurvivingWallClocks,
    "the surviving records must be exactly the newest tail; eviction must remove the globally oldest first",
  );
});

test("append() rejects bucket/variant disagreement instead of trusting the caller", () => {
  installMemoryStorage();
  const store = createStore();
  // Appending a "bead" record into the "touch" bucket must fail closed.
  const ok = store.append("touch", acquisition({ bendVariant: "bead" }));
  assert.equal(ok, false);
  assert.equal(store.load().variants.touch.acquisitions.length, 0);
});

test("append() refuses an unresolved (pending) hit: hits are only ever persisted with a final outcome", () => {
  installMemoryStorage();
  const store = createStore();
  const ok = store.append("touch", acquisition({ outcome: null }));
  assert.equal(ok, false);
  assert.equal(store.load().variants.touch.acquisitions.length, 0);
});

test("append() enforces miss invariants: a miss never carries an outcome or a timing", () => {
  installMemoryStorage();
  const store = createStore();
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
  const store = createStore();
  const ok = store.append("touch", acquisition({ operation: undefined }));
  assert.equal(ok, false);
});

test("semantic combination rules: camera may resolve only released or cancelled", () => {
  installMemoryStorage();
  const store = createStore();
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
  const store = createStore();
  for (const operation of ["aim", "bend", "base", "prune"] as const) {
    assert.equal(store.append("touch", acquisition({ operation, outcome: "declined" })), false, operation);
    assert.equal(store.append("touch", acquisition({ operation, outcome: "released" })), false, operation);
    assert.equal(store.append("touch", acquisition({ operation, outcome: "committed" })), true, operation);
  }
});

test("semantic combination rules: only insertion may be declined (the storage layer cannot verify 'invalid'; the app alone is responsible for that)", () => {
  installMemoryStorage();
  const store = createStore();
  assert.equal(
    store.append("touch", acquisition({ operation: "insert", outcome: "declined", materialId: "flowering-branch", inputMethod: "pointer" })),
    true,
  );
  assert.equal(store.append("touch", acquisition({ operation: "bend", outcome: "declined" })), false);
  assert.equal(store.append("touch", acquisition({ operation: "camera", outcome: "declined" })), false);
});

test("semantic combination rules: insert requires materialId and inputMethod; non-insert forbids them", () => {
  installMemoryStorage();
  const store = createStore();
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
  const store = createStore();
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
  const store = createStore();
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

  const store = createStore();
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
  const store = createStore();
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

  const store = createStore();
  const loaded = store.load();
  assert.equal(loaded.variants.touch.acquisitions.length, 1);
  assert.equal(loaded.variants.touch.acquisitions[0].sessionId, "session-good");
});

test("a fully corrupt top-level payload fails closed to an empty session, never a partial one", () => {
  const storage = installMemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({ garbage: true }));
  const store = createStore();
  const loaded = store.load();
  assert.deepEqual(loaded.variants.bead.acquisitions, []);
  assert.deepEqual(loaded.variants.touch.acquisitions, []);
});

test("savedAt must be exactly the canonical ISO form we generate, or the payload fails closed", () => {
  const storage = installMemoryStorage();
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify(rawStoredPayload({ touch: [acquisition({ sessionId: "should-not-survive" })] })).replace(
      /"savedAt":"[^"]*"/,
      '"savedAt":"not-a-real-timestamp"',
    ),
  );
  const store = createStore();
  const loaded = store.load();
  assert.deepEqual(loaded.variants.touch.acquisitions, [], "a non-canonical savedAt must fail the whole payload closed");

  const storage2 = installMemoryStorage();
  // A real, parseable date, but not in the exact toISOString() shape (no
  // milliseconds) — still not the canonical form we generate, so it must
  // also fail closed rather than being loosely accepted.
  storage2.setItem(
    STORAGE_KEY,
    JSON.stringify(rawStoredPayload({ touch: [acquisition({ sessionId: "should-not-survive-either" })] })).replace(
      /"savedAt":"[^"]*"/,
      '"savedAt":"2024-01-01T00:00:00Z"',
    ),
  );
  const store2 = createStore();
  assert.deepEqual(store2.load().variants.touch.acquisitions, []);
});

test("an already-oversized raw stored payload is rejected before it is ever parsed", () => {
  const storage = installMemoryStorage();
  // Build a payload whose raw string is deliberately over 256 KiB, using
  // otherwise-well-formed records, so this proves the size check runs
  // before (not instead of) structural validation.
  const acquisitions = Array.from({ length: 3000 }, (_, index) =>
    acquisition({ sessionId: `oversized-${index}`, wallClockMs: index }));
  const oversizedRaw = JSON.stringify(rawStoredPayload({ touch: acquisitions }));
  assert.ok(
    new TextEncoder().encode(oversizedRaw).length > 256 * 1024,
    "expected the constructed fixture to itself exceed 256 KiB",
  );
  storage.setItem(STORAGE_KEY, oversizedRaw);

  let parseCalls = 0;
  const originalParse = JSON.parse;
  (JSON as unknown as { parse: typeof JSON.parse }).parse = ((text: string, reviver?: unknown) => {
    parseCalls += 1;
    return originalParse(text, reviver as never);
  }) as typeof JSON.parse;

  try {
    const store = createStore();
    const loaded = store.load();
    assert.deepEqual(loaded.variants.touch.acquisitions, [], "an oversized raw payload must fail closed to empty");
    assert.equal(parseCalls, 0, "an oversized raw payload must be rejected before JSON.parse ever runs");
  } finally {
    JSON.parse = originalParse;
  }
});

test("a committed, released, or declined record carrying cancelReason is rejected (cancelReason requires outcome === 'cancelled')", () => {
  installMemoryStorage();
  const store = createStore();
  assert.equal(
    store.append("touch", acquisition({ operation: "bend", outcome: "committed", cancelReason: "pointer-cancel" })),
    false,
    "a committed record must never carry a cancelReason",
  );
  assert.equal(
    store.append("touch", acquisition({ operation: "camera", outcome: "released", cancelReason: "pointer-cancel" })),
    false,
    "a released record must never carry a cancelReason",
  );
  assert.equal(
    store.append("touch", acquisition({
      operation: "insert",
      outcome: "declined",
      materialId: "flowering-branch",
      inputMethod: "pointer",
      cancelReason: "pointer-cancel",
    })),
    false,
    "a declined record must never carry a cancelReason",
  );
  assert.equal(
    store.append("touch", acquisition({ result: "miss", operation: undefined, outcome: null, timeToAcquireMs: null, cancelReason: "pointer-cancel" })),
    false,
    "a miss must never carry a cancelReason",
  );
  assert.equal(
    store.append("touch", acquisition({ operation: "bend", outcome: "cancelled", cancelReason: "pointer-cancel" })),
    true,
    "a cancelled record correctly carrying a cancelReason must still be accepted",
  );
});

test("instrumentVersion is persisted with the dataset, and a mismatched version fails closed instead of mixing schemas", () => {
  const storage = installMemoryStorage();
  const store = createStore();
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
  const freshStore = createStore();
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

  const store = createStore();
  assert.doesNotThrow(() => {
    const ok = store.append("touch", acquisition());
    assert.equal(ok, true, "append() only reports validation, not the deferred write outcome");
    const flushed = store.flush();
    assert.equal(flushed, false, "flush() reports the actual (failed) write outcome");
  });
});
