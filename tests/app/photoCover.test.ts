import assert from "node:assert/strict";
import test from "node:test";
import { makePhotoCover, photoCoverSize } from "../../src/app/photoCover.ts";

test("photo covers retain portrait, square and landscape crops within a bounded longest edge", () => {
  assert.deepEqual(photoCoverSize(1600, 1200), { width: 640, height: 480 });
  assert.deepEqual(photoCoverSize(1200, 1600), { width: 480, height: 640 });
  assert.deepEqual(photoCoverSize(1200, 1200), { width: 640, height: 640 });
  assert.deepEqual(photoCoverSize(200, 100), { width: 200, height: 100 });
  for (const value of [0, -1, NaN, Infinity]) assert.throws(() => photoCoverSize(value, 1200));
});

test("cover encoding respects Garden's existing byte bound, retries quality and rejects failed encoding", () => {
  const old = Object.getOwnPropertyDescriptor(globalThis, "document");
  const qualities: number[] = [], fills: number[][] = [], draws: unknown[][] = [];
  let alwaysLarge = false;
  const canvas = { width: 0, height: 0,
    getContext: () => ({ fillStyle: "", fillRect: (...args: number[]) => fills.push(args), drawImage: (...args: unknown[]) => draws.push(args) }),
    toDataURL: (_format: string, quality: number) => { qualities.push(quality); return "data:image/jpeg;base64," + "A".repeat(alwaysLarge || quality > .72 ? 81_000 : 50_000); },
  };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => canvas } });
  try {
    const frame = { width: 1200, height: 1600 } as HTMLCanvasElement;
    assert.ok(makePhotoCover(frame).length < 80_000);
    assert.deepEqual(qualities, [.82, .72]);
    assert.deepEqual(fills[0], [0, 0, 480, 640]);
    assert.deepEqual(draws[0], [frame, 0, 0, 480, 640]);
    alwaysLarge = true; assert.throws(() => makePhotoCover(frame), /too large/);
  } finally { if (old) Object.defineProperty(globalThis, "document", old); else Reflect.deleteProperty(globalThis, "document"); }
});
