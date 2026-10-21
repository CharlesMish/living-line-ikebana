import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { materialListOverflow } from "../../src/app/ui.ts";

const html = readFileSync(join(process.cwd(), "index.html"), "utf8");

test("insertion bindings stay on one source card; palette choices cannot insert", () => {
  const sourceMatches = [...html.matchAll(/data-material-id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(sourceMatches, ["flowering-branch"], "only the selected source may carry data-material-id");
  assert.match(html, /id="selected-cutting"[^>]*data-testid="material-source"/);
  assert.match(html, /data-testid="materials-toggle"/);

  const choiceIds = [...html.matchAll(/data-material-choice="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(choiceIds, [
    "flowering-branch", "bare-branch", "leafy-shoot", "reed", "arching-trailer", "foliage-fan",
    "blossom-spray", "flower-volume", "nodding-flower", "berry-twig", "fern-frond",
    "lobed-leaf", "broad-blade", "violet-sprig", "indigo-spire", "starry-pincushion", "silver-seed",
    "compact-flower", "single-flower",
  ]);

  const optionsBlock = html.slice(html.indexOf('id="material-options"'), html.indexOf("</nav>", html.indexOf('id="material-options"')));
  assert.doesNotMatch(optionsBlock, /data-material-id/);
  assert.match(html, /class="material-options-frame"/);
  assert.match(html, /data-testid="materials-more-below"[^>]*aria-hidden="true"/);
  assert.match(html, /data-testid="materials-more-above"[^>]*aria-hidden="true"/);
  const cueStart = html.indexOf('data-testid="materials-more-above"');
  const cueEnd = html.indexOf('id="material-templates"');
  const cueBlock = html.slice(cueStart, cueEnd);
  assert.doesNotMatch(cueBlock, /data-material-id/);
  assert.doesNotMatch(cueBlock, /<button/);
  assert.match(optionsBlock, /Flowering branch/);
  assert.match(optionsBlock, /Leafy shoot/);
  assert.match(optionsBlock, /Bare branch/);
  assert.match(optionsBlock, /Single flower/);
  assert.match(optionsBlock, /Reed/);
  assert.match(optionsBlock, /Flower volume/);
  assert.match(optionsBlock, /Arching trailer/);
  assert.match(optionsBlock, /Foliage fan/);
  assert.match(optionsBlock, /Blossom spray/);
  assert.match(optionsBlock, /Nodding flower/);
  assert.match(optionsBlock, /Berry twig/);
  assert.match(optionsBlock, /Fern frond/);
});

test("material list overflow follows the scrollport edges", () => {
  assert.deepEqual(materialListOverflow(0, 286, 539), { above: false, below: true });
  assert.deepEqual(materialListOverflow(253, 286, 539), { above: true, below: false });
  assert.deepEqual(materialListOverflow(120, 286, 539), { above: true, below: true });
  assert.deepEqual(materialListOverflow(0, 539, 539), { above: false, below: false });
  assert.deepEqual(materialListOverflow(0.4, 190, 190.8), { above: false, below: false });
  assert.deepEqual(materialListOverflow(Number.NaN, 286, 539), { above: false, below: false });
});


test("Compact and Single flower stay available under More cuttings; promoted cuttings sit in the main tray", () => {
  const start = html.indexOf('<details id="material-more"');
  const more = html.slice(start, html.indexOf("</details>", start));
  assert.match(more, /data-material-choice="single-flower"/);
  assert.match(more, /data-material-choice="compact-flower"/);
  assert.match(html, /id="material-template-single-flower"/);
  assert.match(html, /id="material-template-compact-flower"/);
  for (const id of ["bare-branch", "leafy-shoot", "flower-volume", "reed"]) {
    assert.ok(html.indexOf(`data-material-choice="${id}"`) < start, `${id} is in the main tray`);
  }
  for (const id of ["violet-sprig", "indigo-spire", "starry-pincushion"]) {
    assert.ok(html.indexOf(`data-material-choice="${id}"`) < start);
    const templateStart = html.indexOf(`id="material-template-${id}"`);
    const template = html.slice(templateStart, html.indexOf("</template>", templateStart));
    assert.match(template, /class="material-name"/);
    assert.match(template, /class="material-verb"/);
  }
});
