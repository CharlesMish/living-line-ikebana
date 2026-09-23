import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const html = readFileSync(join(process.cwd(), "index.html"), "utf8");

test("insertion bindings stay on one source card; palette choices cannot insert", () => {
  const sourceMatches = [...html.matchAll(/data-material-id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(sourceMatches, ["flowering-branch"], "only the selected source may carry data-material-id");
  assert.match(html, /id="selected-cutting"[^>]*data-testid="material-source"/);
  assert.match(html, /data-testid="materials-toggle"/);

  const choiceIds = [...html.matchAll(/data-material-choice="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(choiceIds, [
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower",
    "reed", "flower-volume", "arching-trailer", "foliage-fan", "blossom-spray",
  ]);

  const optionsBlock = html.slice(html.indexOf('id="material-options"'), html.indexOf("</nav>", html.indexOf('id="material-options"')));
  assert.doesNotMatch(optionsBlock, /data-material-id/);
  assert.match(optionsBlock, /Flowering branch/);
  assert.match(optionsBlock, /Leafy shoot/);
  assert.match(optionsBlock, /Bare branch/);
  assert.match(optionsBlock, /Single flower/);
  assert.match(optionsBlock, /Reed/);
  assert.match(optionsBlock, /Flower volume/);
  assert.match(optionsBlock, /Arching trailer/);
  assert.match(optionsBlock, /Foliage fan/);
  assert.match(optionsBlock, /Blossom spray/);
});
