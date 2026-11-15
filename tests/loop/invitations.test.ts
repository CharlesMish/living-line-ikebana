import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prepareMaterialInsertion } from "../../src/core/materialCatalog.ts";
import { pruneBranch } from "../../src/core/prune.ts";
import type { PlantGraph } from "../../src/core/types.ts";
import { VESSEL_PROFILES } from "../../src/study/vesselProfiles.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { guestArrangements } from "../../src/app/guestArrangements.ts";
import { parseSceneGarden } from "../../src/app/scenePersistence.ts";
import { fromCanonicalPlantGraph } from "../../src/core/serialization.ts";
import {
  getInvitation,
  getInvitations,
  hasBeenCut,
  isInvitationOpen,
  kitItemLabel,
  kitRemaining,
  materialIdForGraph,
  newlySpent,
  parseInvitations,
  respond,
} from "../../src/loop/invitations.ts";
import { observeArrangement, viewAxes } from "../../src/loop/observe.ts";
import { InvitationProgressStore, parseProgress } from "../../src/loop/progress.ts";

const authored = JSON.parse(readFileSync(join(process.cwd(), "src/loop/invitations.json"), "utf8"));

function seat(materialId: string, ordinal: number, base = { x: 0, y: 0.55, z: 0 }): PlantGraph {
  const prepared = prepareMaterialInsertion(materialId, ordinal, base);
  assert.ok(prepared.ok, materialId);
  return prepared.graph;
}

test("authored invitations name real materials, vessel layouts and a reachable order", () => {
  const layouts = new Set(VESSEL_PROFILES.map((profile) => profile.id));
  const invitations = parseInvitations(authored, layouts);
  assert.ok(invitations.length >= 3);
  assert.equal(invitations[0].opensAfter, undefined, "the first invitation is open from the start");
  const delivered = new Set<string>();
  for (const invitation of invitations) {
    assert.ok(isInvitationOpen(invitation, delivered), `${invitation.id} opens after an earlier invitation`);
    delivered.add(invitation.id);
  }
  assert.deepEqual(getInvitations().map((item) => item.id), invitations.map((item) => item.id));
});

test("invitation data fails closed on unknown materials, layouts and unordered notes", () => {
  const clone = () => structuredClone(authored);
  const unknownMaterial = clone(); unknownMaterial.invitations[0].kit[0].materialId = "plastic-rose";
  assert.throws(() => parseInvitations(unknownMaterial), /unknown or repeated kit material/);
  const repeated = clone(); repeated.invitations[0].kit.push({ ...repeated.invitations[0].kit[0] });
  assert.throws(() => parseInvitations(repeated), /unknown or repeated kit material/);
  assert.throws(() => parseInvitations(authored, new Set(["original"])), /unknown vessel layout/);
  const unordered = clone(); unordered.invitations[0].reading.bands[1].upTo = 1;
  assert.throws(() => parseInvitations(unordered), /must increase/);
  const closedLast = clone(); closedLast.invitations[0].reading.bands.at(-1).upTo = 99;
  assert.throws(() => parseInvitations(closedLast), /only the last note/);
  const dangling = clone(); dangling.invitations[1].opensAfter = "nowhere";
  assert.throws(() => parseInvitations(dangling), /unknown invitation/);
  const tooMany = clone(); tooMany.invitations[0].kit[0].count = 7;
  assert.throws(() => parseInvitations(tooMany), /1 to 6/);
});

test("the kit counts cuttings in the bowl and cuttings that were cut and removed", () => {
  const invitation = getInvitation("across-the-table")!;
  const reedA = seat("reed", 1);
  const reedB = seat("reed", 2);
  assert.equal(materialIdForGraph(reedA), "reed");
  assert.equal(kitRemaining(invitation, [], []).get("reed"), 2);
  assert.equal(kitRemaining(invitation, [reedA], []).get("reed"), 1);
  assert.equal(kitRemaining(invitation, [reedA, reedB], []).get("reed"), 0);

  // An uncut cutting that leaves the bowl goes back in the kit.
  const before = new Map([[reedA.id, reedA], [reedB.id, reedB]]);
  const afterUncutRemoval = new Map([[reedA.id, reedA]]);
  assert.deepEqual(newlySpent(before, afterUncutRemoval, []), []);

  // A cut cutting that leaves the bowl stays used.
  const cutB = pruneBranch(reedB, reedB.rootBranchId, reedB.branches.get(reedB.rootBranchId)!.activeLength * 0.6);
  assert.equal(hasBeenCut(reedB), false);
  assert.equal(hasBeenCut(cutB), true, "a shortened stem counts as cut even when no organ was removed");
  const spent = newlySpent(new Map([[reedA.id, reedA], [cutB.id, cutB]]), afterUncutRemoval, []);
  assert.deepEqual(spent, [{ plantId: cutB.id, materialId: "reed" }]);
  assert.equal(kitRemaining(invitation, [reedA], spent).get("reed"), 0);

  // Undo can bring it back; it is then counted once, where it is.
  assert.equal(kitRemaining(invitation, [reedA, cutB], spent).get("reed"), 0);
  assert.equal(kitRemaining(invitation, [cutB], spent).get("reed"), 1);
  assert.deepEqual(newlySpent(new Map([[cutB.id, cutB]]), new Map(), spent), [], "a spent cutting is recorded once");

  // Cuttings outside the kit never change kit counts.
  const fern = seat("fern-frond", 3);
  assert.deepEqual([...kitRemaining(invitation, [fern], []).values()], invitation.kit.map((item) => item.count));
});

test("removing a leaf or a side branch counts as a cut", () => {
  const flower = seat("nodding-flower", 1);
  const root = flower.branches.get(flower.rootBranchId)!;
  const cut = pruneBranch(flower, root.id, root.activeLength * 0.5);
  assert.equal(hasBeenCut(cut), true);
});

test("observations measure height, sideways position and depth along the delivered view", () => {
  const front = canonicalCameraPose("front");
  const left = seat("reed", 1, { x: -0.6, y: 0.55, z: 0 });
  const right = seat("reed", 2, { x: 0.6, y: 0.55, z: 0 });
  const upright = observeArrangement([left], front);
  assert.ok(upright.height > 4, "an uncut reed stands well above the bowl");
  assert.ok(upright.lean < -0.3, "seated left of centre reads as left in the front view");
  assert.ok(observeArrangement([right], front).lean > 0.3);
  assert.ok(Math.abs(observeArrangement([left, right], front).lean) < 0.25, "a balanced pair reads as upright");

  const back = { position: { x: 0, y: 3.7, z: -15 }, target: { x: 0, y: 2.55, z: 0 }, up: { x: 0, y: 1, z: 0 } };
  assert.ok(observeArrangement([left], back).lean > 0.3, "the same bowl seen from behind leans the other way");
  const reed = left.branches.get(left.rootBranchId)!;
  const short = pruneBranch(left, reed.id, 1.2);
  assert.ok(observeArrangement([short], front).height < 2.2);

  const trailer = seat("arching-trailer", 3);
  const facing = observeArrangement([trailer], front);
  const turned = observeArrangement([trailer], { ...front, position: { x: 15, y: 3.7, z: 0 } });
  assert.ok(Number.isFinite(facing.depth) && Number.isFinite(turned.depth));
  assert.notEqual(facing.depth.toFixed(3), turned.depth.toFixed(3), "depth follows the view, not the world axis");
  assert.equal(observeArrangement([], front).cuttings, 0);
  assert.equal(observeArrangement([], front).lean, 0);
});

test("the Above view uses screen-up as its forward direction", () => {
  const axes = viewAxes(canonicalCameraPose("above"));
  assert.ok(Math.abs(axes.forward.z + 1) < 1e-9, "screen-up is away from the front viewer");
  assert.ok(Math.abs(axes.right.x - 1) < 1e-9);
  const frontAxes = viewAxes(canonicalCameraPose("front"));
  assert.ok(Math.abs(frontAxes.right.x - 1) < 1e-9);
});

test("every reading band is a note, chosen by the measured value", () => {
  const table = getInvitation("across-the-table")!;
  const base = { cuttings: 3, depth: 1, lean: 0 };
  assert.equal(respond(table, { ...base, height: 2 }).id, "low");
  assert.equal(respond(table, { ...base, height: 3 }).id, "middle");
  assert.equal(respond(table, { ...base, height: 9 }).id, "tall");
  const hall = getInvitation("coming-home")!;
  assert.equal(respond(hall, { ...base, height: 3, lean: -1 }).id, "toward-door");
  assert.equal(respond(hall, { ...base, height: 3, lean: 1 }).id, "toward-window");
  for (const invitation of getInvitations()) {
    for (const band of invitation.reading.bands) assert.doesNotMatch(band.note, /\b(score|points?|fail(ed)?|wrong|correct|grade)\b/i, `${invitation.id}/${band.id} stays a note, not a verdict`);
  }
});

test("kit labels read naturally", () => {
  assert.equal(kitItemLabel("reed", 2), "2 reeds");
  assert.equal(kitItemLabel("parasol leaf", 1), "1 parasol leaf");
  assert.equal(kitItemLabel("lantern spray", 2), "2 lantern sprays");
  assert.equal(kitItemLabel("berry twig", 3), "3 berry twigs");
  assert.equal(kitItemLabel("parasol leaf", 2), "2 parasol leaves");
  assert.equal(kitItemLabel("bare branch", 2), "2 bare branches");
  assert.equal(kitItemLabel("parasol leaf", 0), "no parasol leaves");
});

class MemoryStorage {
  values = new Map<string, string>();
  failWrites = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrites) throw new Error("quota"); this.values.set(key, value); }
}

test("progress begins, records spent cuttings, delivers and survives a reload", () => {
  const storage = new MemoryStorage();
  const store = new InvitationProgressStore("k", storage);
  assert.equal(store.load().active, null);
  store.begin("across-the-table", "2026-11-15T10:00:00.000Z");
  store.addSpent([{ plantId: "plant-2", materialId: "reed" }]);
  store.addSpent([{ plantId: "plant-2", materialId: "reed" }]);
  assert.equal(store.progress.active?.spent.length, 1, "spent cuttings are recorded once");
  const reloaded = new InvitationProgressStore("k", storage).load();
  assert.equal(reloaded.active?.invitationId, "across-the-table");
  store.deliver({
    invitationId: "across-the-table", gardenEntryId: "moment-1", title: "Low light", deliveredAt: "2026-11-15T10:20:00.000Z",
    noteId: "low", observations: { cuttings: 4, height: 2.4, depth: 1.2, lean: -0.1 },
  });
  assert.equal(store.progress.active, null, "delivering ends the invitation");
  assert.equal(new InvitationProgressStore("k", storage).load().deliveries.length, 1);
  store.begin("windowsill");
  assert.equal(store.setAside().active, null);
});

test("progress fails closed and leaves unreadable data untouched", () => {
  const storage = new MemoryStorage();
  storage.values.set("k", JSON.stringify({ invitationsVersion: 1, active: null, deliveries: [], extra: { injected: true } }));
  assert.doesNotThrow(() => parseProgress(storage.values.get("k")!), "unknown top-level fields are dropped by the allowlist");
  assert.equal("extra" in parseProgress(storage.values.get("k")!), false);
  storage.values.set("k", JSON.stringify({ invitationsVersion: 2, active: null, deliveries: [] }));
  const store = new InvitationProgressStore("k", storage);
  assert.throws(() => store.load());
  assert.throws(() => store.begin("across-the-table"), /could not be read/);
  assert.equal(JSON.parse(storage.values.get("k")!).invitationsVersion, 2, "the stored bytes are unchanged");
  assert.throws(() => parseProgress(JSON.stringify({ invitationsVersion: 1, active: { invitationId: "x", startedAt: "nope", spent: [] }, deliveries: [] })));
  assert.throws(() => parseProgress(JSON.stringify({ invitationsVersion: 1, active: null, deliveries: [{ invitationId: "x", gardenEntryId: "../../", title: "", deliveredAt: "2026-01-01T00:00:00Z", noteId: "a", observations: { cuttings: 1, height: 1, depth: 1, lean: 0 } }] })));
});

test("a failed progress write keeps the previous progress", () => {
  const storage = new MemoryStorage();
  const store = new InvitationProgressStore("k", storage);
  store.load();
  store.begin("across-the-table");
  storage.failWrites = true;
  assert.throws(() => store.setAside(), /could not be saved/);
  assert.equal(store.progress.active?.invitationId, "across-the-table");
});

test("guest answers to an invitation keep to its vessel and kit", () => {
  const answers = guestArrangements.filter((guest) => guest.invitationId);
  assert.ok(answers.length >= 1);
  for (const guest of answers) {
    const invitation = getInvitation(guest.invitationId!);
    assert.ok(invitation, `${guest.artist} answers a known invitation`);
    const [entry] = parseSceneGarden(JSON.stringify(guest.backup)).entries;
    assert.equal(entry.arrangement.scene?.layoutId, invitation.layoutId, `${entry.title} uses the invitation's vessel`);
    const graphs = entry.arrangement.plants.map(fromCanonicalPlantGraph);
    const counts = new Map<string, number>();
    for (const graph of graphs) {
      const materialId = materialIdForGraph(graph);
      assert.ok(materialId && invitation.kit.some((item) => item.materialId === materialId), `${entry.title} uses only kit cuttings`);
      counts.set(materialId!, (counts.get(materialId!) ?? 0) + 1);
    }
    for (const item of invitation.kit) assert.ok((counts.get(item.materialId) ?? 0) <= item.count, `${entry.title} stays within ${item.materialId}`);
    // The note it would receive is reproducible from its saved graphs and view.
    assert.ok(respond(invitation, observeArrangement(graphs, entry.arrangement.camera)));
  }
});
