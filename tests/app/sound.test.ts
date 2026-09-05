import assert from "node:assert/strict";
import test from "node:test";
import { CraftSound } from "../../src/app/sound.ts";

test("unavailable or rejected audio devices never throw into craft operations", async (t) => {
  t.mock.method(globalThis, "setTimeout", ((callback: () => void) => { callback(); return 0; }) as typeof setTimeout);
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const priorAudio = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: globalThis.setTimeout } });
  try {
    for (const Audio of [
      class { constructor() { throw new Error("No device"); } },
      class { state = "suspended"; resume() { return Promise.reject(new Error("Device unavailable")); } },
      class { state = "running"; createOscillator() { throw new Error("Device lost"); } },
    ]) {
      Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: Audio });
      const sound = new CraftSound();
      assert.doesNotThrow(() => { sound.unlock(); sound.seat(); sound.cut(); });
      await Promise.resolve();
      assert.doesNotThrow(() => { sound.unlock(); sound.cut(); });
    }
  } finally {
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (priorAudio) Object.defineProperty(globalThis, "AudioContext", priorAudio);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});
