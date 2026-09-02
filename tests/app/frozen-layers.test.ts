import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("src/core and src/input remain identical to origin/main", () => {
  const diff = execFileSync("git", ["diff", "origin/main", "--", "src/core", "src/input"], {
    encoding: "utf8",
  });
  assert.equal(diff, "", "src/core or src/input diverged from origin/main");
});
