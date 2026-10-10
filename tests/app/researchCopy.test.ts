import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  preventionToggleLabel,
  researchShellCopy,
  stemProtectionStatus,
} from "../../src/app/researchCopy.ts";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const BRIEF = "Make a lower arrangement for a table where people will talk across it.";

test("a baked research shell renders no study copy and drops the table brief", () => {
  const copy = researchShellCopy(html);
  assert.equal(/study/i.test(copy), false);
  assert.equal(copy.includes(BRIEF), false);
  assert.match(html, /Optional study · Across the table/);
  assert.match(html, /Prevent overlaps \(study\)/);
  assert.match(html, /Choose any study/);
  assert.match(html, /Make a lower arrangement for a table where people will talk across it\./);
  assert.match(preventionToggleLabel(false, false), /\(study\)/);
  assert.equal(/study/i.test(preventionToggleLabel(true, true)), false);
  assert.match(stemProtectionStatus(true, false), /study/i);
  assert.equal(/study/i.test(stemProtectionStatus(true, true)), false);
  assert.equal(/study/i.test(stemProtectionStatus(false, true)), false);
});
