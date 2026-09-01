import assert from "node:assert/strict";
import test from "node:test";

import { TelemetryStore } from "../../src/app/telemetry.ts";

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

test("telemetry survives a reload (a fresh store instance reading the same key)", () => {
  const storage = installMemoryStorage();
  const firstLoadSession = new TelemetryStore();
  firstLoadSession.append("bead", acquisition({ bendVariant: "bead" }));

  // Simulate a reload: a brand-new store instance, same underlying storage.
  const secondLoadSession = new TelemetryStore();
  const reloaded = secondLoadSession.load();
  assert.equal(reloaded.variants.bead.acquisitions.length, 1);
  assert.ok(storage.getItem("ikebana-web-alpha:telemetry-v1"));
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

test("hydration drops a malformed record but keeps the rest, never partial-hydrating garbage", () => {
  const storage = installMemoryStorage();
  const good = acquisition({ sessionId: "session-good" });
  const badBucketMismatch = acquisition({ sessionId: "session-bad", bendVariant: "bead" });
  const badPendingHit = { ...acquisition({ sessionId: "session-bad-2" }), outcome: null };
  storage.setItem(
    "ikebana-web-alpha:telemetry-v1",
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      variants: {
        bead: { acquisitions: [] },
        touch: { acquisitions: [good, badBucketMismatch, badPendingHit] },
      },
    }),
  );

  const store = new TelemetryStore();
  const loaded = store.load();
  assert.equal(loaded.variants.touch.acquisitions.length, 1);
  assert.equal(loaded.variants.touch.acquisitions[0].sessionId, "session-good");
});

test("a fully corrupt top-level payload fails closed to an empty session, never a partial one", () => {
  const storage = installMemoryStorage();
  storage.setItem("ikebana-web-alpha:telemetry-v1", JSON.stringify({ garbage: true }));
  const store = new TelemetryStore();
  const loaded = store.load();
  assert.deepEqual(loaded.variants.bead.acquisitions, []);
  assert.deepEqual(loaded.variants.touch.acquisitions, []);
});

test("a quota-full/throwing storage fails closed (returns false) and never throws past this layer", () => {
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
    assert.equal(ok, false);
  });
});
