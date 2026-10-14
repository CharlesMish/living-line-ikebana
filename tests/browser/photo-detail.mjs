import assert from "node:assert/strict";

/** Assisted ordinary-input probe. Invoke while Photograph's Frame panel is open
 * at its unchanged reference. This helper never writes a graph or test bridge. */
export async function checkPhotoDetail({ page, config, capture }) {
  const activate = locator => config.mobile ? locator.tap() : locator.click();
  const values = () => page.evaluate(() => Object.fromEntries(["zoom", "horizontal", "vertical", "yaw", "pitch", "roll"].map(id => [id, document.querySelector(`#photo-${id}`).value])));
  const initial = await values();
  assert.equal(initial.zoom, "1", "detail probe begins at the unchanged reference");
  await activate(page.locator("#photo-detail"));
  assert.equal(await page.locator("#photo-detail").getAttribute("aria-pressed"), "true");
  assert.deepEqual(await values(), initial, "arming detail changes no frame");
  const canvas = page.locator("#photo-canvas"), box = await canvas.boundingBox();
  const point = { x: box.width * .56, y: box.height * .36 };
  if (config.mobile) await canvas.tap({ position: point }); else await canvas.click({ position: point });
  const detail = await values();
  assert.equal(detail.zoom, "3.5");
  assert.notEqual(detail.horizontal, "0"); assert.notEqual(detail.vertical, "0");
  assert.equal(await page.locator("#photo-detail").getAttribute("aria-pressed"), "false");
  await capture("photo-close-detail");
  await activate(page.locator("#photo-reset"));
  assert.deepEqual(await values(), initial, "Whole view restores reference offsets");
  await capture("photo-reset-restored");
  return { input: config.mobile ? "emulated touch" : "mouse", initial, detail, restored: await values() };
}
