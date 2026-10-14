import assert from "node:assert/strict";

export async function checkPrintWall({ page, activate, capture, readState }) {
  const before = await readState(page);
  const openStudio = async id => { await activate(page.getByTestId("more-toggle")); await activate(page.locator(`#${id}`)); };
  // Create real kept photographs through the production UI, including formats
  // which the former 4:3 cover would have padded. No graph/storage injection.
  await openStudio("photo-open");
  for (const [format, title, backdrop] of [["portrait", "A line of light", "sage"], ["square", "Evening in the bowl", "dusk"]]) {
    await activate(page.locator("#photo-tab-scene"));
    await page.locator("#photo-backdrop").selectOption(backdrop);
    await activate(page.locator("#photo-tab-frame"));
    await page.locator("#photo-format").selectOption(format);
    await activate(page.locator("#photo-tab-save"));
    await page.locator("#photo-name").fill(title);
    await activate(page.locator("#photo-keep"));
    await page.waitForFunction(() => document.querySelector("#photo-message").textContent.includes("Photo kept in Garden"));
  }
  await activate(page.locator("#photo-close"));
  await openStudio("garden-open");
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  await activate(page.locator("#garden-wall-open"));
  assert.equal(await page.locator(".wall-print").count(), 3);
  await page.waitForFunction(() => [...document.querySelectorAll(".wall-print img")].every(image => image.complete && image.naturalWidth > 0));
  const sizes = await page.locator(".wall-print img").evaluateAll(images => images.map(image => [image.naturalWidth, image.naturalHeight]));
  assert.deepEqual(sizes.slice(0, 2), [[640, 640], [480, 640]]);
  assert.equal(await page.locator("#garden-wall").evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
  await capture("garden-oak-wall");
  await activate(page.locator("#wall-paper"));
  assert.equal(await page.locator("#wall-paper").getAttribute("aria-pressed"), "true");
  await capture("garden-paper-wall");
  await activate(page.locator(".wall-print").first());
  assert.equal(await page.locator("#wall-detail").isVisible(), true);
  await capture("garden-print-detail");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#garden-wall").evaluate(el => el.open), true);
  assert.equal(await page.locator("#wall-collection").isVisible(), true);
  assert.equal(await page.locator(".wall-print").first().evaluate(el => el === document.activeElement), true);
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), saved);
  await activate(page.locator(".wall-print").first());
  await activate(page.locator("#wall-view"));
  assert.equal(await page.locator("#garden-wall").evaluate(el => el.open), false);
  assert.equal(await page.locator("#garden-dialog").evaluate(el => el.open), false);
  await activate(page.locator("#garden-return"));
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), saved);
  const after = await readState(page);
  assert.deepEqual(after.canonical, before.canonical);
  assert.equal(after.state.cameraHash, before.state.cameraHash);
  assert.deepEqual(after.audit, before.audit);
  return { status: "PASS", covers: sizes, views: 3, storageUnchangedByWall: true };
}
