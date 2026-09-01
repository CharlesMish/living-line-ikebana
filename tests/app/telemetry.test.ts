import assert from "node:assert/strict";
import test from "node:test";

// Bug: SessionMetrics is memory-only and IkebanaApp calls reset() on every
// load, so a phone session's acquisition data never survives a reload and
// can never be compared across the "bead" vs "touch" arms. There is no
// persistence module for telemetry on main; this import is expected to fail
// to resolve until one is added.
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

test("clear() yields a clean session, matching ?fresh=1 behavior", () => {
  installMemoryStorage();
  const store = new TelemetryStore();
  store.append("touch", acquisition());
  assert.equal(store.load().variants.touch.acquisitions.length, 1);

  store.clear();
  const reloaded = store.load();
  assert.deepEqual(reloaded.variants.bead.acquisitions, []);
  assert.deepEqual(reloaded.variants.touch.acquisitions, []);
});
