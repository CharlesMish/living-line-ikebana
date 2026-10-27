import assert from "node:assert/strict";
import test from "node:test";
import { homeFlagFrom } from "../../src/app/config.ts";

test("the home room is opt-in: a URL flag or a baked preview token, nothing else", () => {
  const plain = {} as typeof globalThis;
  assert.equal(homeFlagFrom(new URL("https://example.test/"), plain), false);
  assert.equal(homeFlagFrom(new URL("https://example.test/?home=0"), plain), false);
  assert.equal(homeFlagFrom(new URL("https://example.test/?home=1"), plain), true);
  assert.equal(homeFlagFrom(new URL("https://example.test/"), { __LL_HOME__: "1" } as unknown as typeof globalThis), true);
  assert.equal(homeFlagFrom(new URL("https://example.test/"), { __LL_HOME__: 1 } as unknown as typeof globalThis), false);
});
