import assert from "node:assert/strict";
import test from "node:test";
import { PhotoExport, photoShareData, sharePhoto, type PreparedPhoto } from "../../src/app/photoExport.ts";

const png = new Blob(["a PNG in the browser"], { type: "image/png" });
function harness() {
  const created: string[] = [], revoked: string[] = [];
  const store = new PhotoExport({
    createObjectURL: () => { const url = `blob:photo-${created.length}`; created.push(url); return url; },
    revokeObjectURL: (url) => revoked.push(url),
  });
  const pending: BlobCallback[] = [];
  const canvas = { width: 1600, height: 1200, toBlob: (callback: BlobCallback) => { pending.push(callback); } };
  return { store, canvas, pending, created, revoked };
}

test("a prepared PNG stays available without auto-download and is released only on replacement or close", async () => {
  const h = harness(); const first = h.store.prepare(h.canvas); h.pending.shift()!(png);
  const photo = await first; assert.equal(h.store.current, photo);
  assert.equal(photo?.name, "living-line-1600x1200.png"); assert.deepEqual(h.revoked, []);
  const next = h.store.prepare(h.canvas); assert.equal(h.store.current, photo);
  h.pending.shift()!(png); await next;
  assert.deepEqual(h.revoked, [photo!.url]);
  h.store.clear(); assert.equal(h.store.current, null); assert.deepEqual(h.revoked, ["blob:photo-0", "blob:photo-1"]);
});

test("changing frame/context invalidates pending PNG delivery and preserves the existing image", async () => {
  const h = harness(); const first = h.store.prepare(h.canvas); h.pending.shift()!(png); const photo = await first;
  const old = h.store.prepare(h.canvas); h.store.invalidate(); h.pending.shift()!(png);
  assert.equal(await old, null); assert.equal(h.store.current, photo);
  assert.deepEqual(h.created, ["blob:photo-0"]); assert.deepEqual(h.revoked, []);
});

test("close and reopen reject the old encoder even if it finishes after the new session", async () => {
  const h = harness(); const old = h.store.prepare(h.canvas); h.store.clear();
  const next = h.store.prepare(h.canvas); h.pending[1](png); const accepted = await next;
  h.pending[0](png); assert.equal(await old, null); assert.equal(h.store.current, accepted);
  assert.deepEqual(h.created, ["blob:photo-0"]);
});

test("failed encoding leaves the previous PNG available and a subsequent attempt succeeds", async () => {
  const h = harness(); const first = h.store.prepare(h.canvas); h.pending.shift()!(png); const photo = await first;
  const failure = h.store.prepare(h.canvas); h.pending.shift()!(null);
  await assert.rejects(failure, /could not create the PNG/); assert.equal(h.store.current, photo);
  const retry = h.store.prepare(h.canvas); h.pending.shift()!(png); assert.ok(await retry);
});

test("only explicitly opened image URLs survive dialog cleanup so the separate image tab stays usable", async () => {
  const h = harness(); const first = h.store.prepare(h.canvas); h.pending.shift()!(png); await first;
  h.store.preserveOpenedImage(); h.store.clear(); assert.deepEqual(h.revoked, []);
  const next = h.store.prepare(h.canvas); h.pending.shift()!(png); await next;
  h.store.clear(); assert.deepEqual(h.revoked, ["blob:photo-1"]);
});

test("file Share is offered only when the actual prepared file can be shared", () => {
  const photo: PreparedPhoto = { blob: png, url: "blob:image", name: "photo.png", width: 1600, height: 1200 };
  const file = { name: "photo.png", type: "image/png" } as File;
  const sharing = { share: async (_data: ShareData) => {}, canShare: (data: ShareData) => data.files?.[0] === file };
  assert.deepEqual(photoShareData(photo, sharing, () => file), { files: [file] });
  assert.equal(photoShareData(photo, { share: sharing.share }, () => file), null);
  assert.equal(photoShareData(photo, { ...sharing, canShare: () => false }, () => file), null);
  assert.equal(photoShareData(photo, { ...sharing, canShare: () => { throw new Error("policy"); } }, () => file), null);
});

test("Share calls the browser synchronously within the click and treats dismissal as cancellation", async () => {
  const events: string[] = []; let complete!: () => void;
  const result = sharePhoto({ files: [] }, { share: () => { events.push("share"); return new Promise<void>((resolve) => { complete = resolve; }); } });
  events.push("returned"); assert.deepEqual(events, ["share", "returned"]); complete(); assert.equal(await result, "shared");
  const aborted = { name: "AbortError" };
  assert.equal(await sharePhoto({}, { share: () => Promise.reject(aborted) }), "cancelled");
  assert.equal(await sharePhoto({}, { share: () => { throw aborted; } }), "cancelled");
  await assert.rejects(sharePhoto({}, { share: () => Promise.reject(new Error("blocked")) }), /blocked/);
  await assert.rejects(sharePhoto({}, {}), /unavailable/);
});
