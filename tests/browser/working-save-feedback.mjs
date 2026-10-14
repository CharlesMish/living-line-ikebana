/** Isolated storage-fault diagnostic, not a player session. Ordinary UI edits
 * and Retry are used; only localStorage availability is fault-injected. */
import assert from "node:assert/strict";

export async function checkWorkingSaveFeedback({ page, activate, config, capture, readState }) {
  const key = "ikebana-web-alpha:studio-v2";
  const diskBefore = await page.evaluate(key => localStorage.getItem(key), key);
  const before = await readState(page);
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    window.__LL_RESTORE_SAVE_TEST__ = () => { Storage.prototype.setItem = original; delete window.__LL_RESTORE_SAVE_TEST__; };
    Storage.prototype.setItem = function(name, value) {
      if (this === localStorage && name === key) throw new DOMException("Isolated review regression quota fault", "QuotaExceededError");
      return original.call(this, name, value);
    };
  }, key);
  try {
    await page.getByTestId("material-source").focus(); await page.keyboard.press("Enter");
    await page.locator("#working-save-warning:not([hidden])").waitFor();
    const unsaved = await readState(page);
    assert.equal(unsaved.canonical.plants.length, before.canonical.plants.length + 1, "Failed autosave retains the committed edit in memory");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), diskBefore, "Failed save does not overwrite disk");
    await activate(page.getByTestId("tool-prune"));
    assert.match(await page.getByTestId("status").textContent(), /Choose where to cut/);
    assert.equal(await page.locator("#working-save-warning").isVisible(), true, "Ordinary hints cannot hide unsaved feedback");
    await activate(page.locator("#retry-working-save"));
    assert.deepEqual((await readState(page)).canonical, unsaved.canonical, "A failed Retry does not edit plants or identity");
    assert.equal(await page.locator("#working-save-warning").isVisible(), true);
    const layout = await page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
      return { warning:rect("#working-save-warning"), retry:rect("#retry-working-save"), status:rect("#status") };
    });
    for (const [name, box] of Object.entries(layout)) {
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= config.width + 1 && box.y + box.height <= config.height + 1, `${name} fits viewport: ${JSON.stringify(box)}`);
    }
    assert.ok(layout.retry.height >= 44, "Retry is a usable touch target");
    assert.ok(layout.status.y + layout.status.height <= layout.warning.y + 1, "Warning does not cover craft/status feedback");
    await capture("unsaved-working-bowl");
    await page.evaluate(() => window.__LL_RESTORE_SAVE_TEST__());
    await activate(page.locator("#retry-working-save"));
    assert.equal(await page.locator("#working-save-warning").isHidden(), true);
    const saved = await readState(page);
    assert.deepEqual(saved.canonical, unsaved.canonical, "Successful Retry saves without another edit");
    assert.equal(saved.state.successfulSeatOrdinal, unsaved.state.successfulSeatOrdinal);
    assert.equal(saved.state.cameraHash, unsaved.state.cameraHash);
    const disk = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    assert.deepEqual(disk.plants, saved.canonical.plants);
    // Retry must not replace the insertion's useful Undo checkpoint.
    await activate(page.getByTestId("edit-toggle"));
    await activate(page.getByTestId("undo-edit"));
    assert.deepEqual((await readState(page)).canonical.plants, before.canonical.plants);
    return { status: "PASS", input: "Ordinary keyboard insertion and UI Retry/Undo with explicitly injected localStorage quota failure", layout };
  } finally {
    await page.evaluate(() => window.__LL_RESTORE_SAVE_TEST__?.());
  }
}
