import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import {
  CLOSED_INVITATION,
  INVITATION_ACTIONS,
  INVITATION_HEADING,
  MATERIAL_INVITATIONS,
  OCCASION_INVITATIONS,
  invitationStartIndex,
  invitationsFor,
  readInviteMode,
  reduceInvitation,
  type InvitationSession,
} from "../../src/app/invitations.ts";
import { DEFAULT_SCENE } from "../../src/app/scene.ts";
import { SceneCommittedStore, SceneGardenStore, parseSceneGarden, parseSceneStudio, sceneStorageKeys } from "../../src/app/scenePersistence.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { fromCanonicalPlantGraph, getMaterialDefinition } from "../../src/core/index.ts";

const MATERIAL_TEXT = [
  "One straight reed. What would you leave around it?",
  "A bare branch, late in the year. Which way does it lean?",
  "Something that falls instead of rises. Where does it land?",
  "A fern frond in early spring. How much of it will you show?",
  "A twig of berries. Is it the accent, or the whole story?",
  "A branch in bloom. What does it need beside it?",
] as const;

const OCCASION_TEXT = [
  "For someone coming home late: something to see from the doorway.",
  "For a narrow kitchen windowsill.",
  "For a quiet corner where someone reads.",
  "For a friend who is starting something new.",
  "For a rainy afternoon, seen from a chair.",
  "For the first morning after a long trip.",
] as const;

const MATERIAL_IDS = ["reed", "bare-branch", "arching-trailer", "fern-frond", "berry-twig", "flowering-branch"] as const;

test("invitation lists are the six fixed sentences and existing material ids", () => {
  assert.deepEqual(MATERIAL_INVITATIONS.map((entry) => entry.text), [...MATERIAL_TEXT]);
  assert.deepEqual(OCCASION_INVITATIONS.map((entry) => entry.text), [...OCCASION_TEXT]);
  assert.deepEqual(MATERIAL_INVITATIONS.map((entry) => entry.materialId), [...MATERIAL_IDS]);
  assert.deepEqual(MATERIAL_INVITATIONS.map((entry) => entry.id), [...MATERIAL_IDS]);
  assert.deepEqual(OCCASION_INVITATIONS.map((entry) => entry.materialId), [null, null, null, null, null, null]);
  const ids = [...MATERIAL_INVITATIONS, ...OCCASION_INVITATIONS].map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  const texts = [...MATERIAL_TEXT, ...OCCASION_TEXT];
  assert.equal(new Set(texts).size, texts.length);
  for (const id of MATERIAL_IDS) assert.ok(getMaterialDefinition(id), id);
  for (const text of texts) {
    assert.notEqual(text, "Make a lower arrangement for a table where people will talk across it.");
  }
  assert.equal(INVITATION_HEADING, "An invitation");
  assert.deepEqual([...INVITATION_ACTIONS], ["Begin", "Another", "Not now"]);
  assert.equal(invitationsFor("material"), MATERIAL_INVITATIONS);
  assert.equal(invitationsFor("occasion"), OCCASION_INVITATIONS);
});

test("rotation starts at the garden entry count and Another cycles without storage", () => {
  assert.equal(invitationStartIndex(0, 6), 0);
  assert.equal(invitationStartIndex(5, 6), 5);
  assert.equal(invitationStartIndex(6, 6), 0);
  assert.equal(invitationStartIndex(7, 6), 1);
  assert.equal(invitationStartIndex(24, 6), 0);
  assert.equal(invitationStartIndex(-1, 6), 0);
  assert.equal(invitationStartIndex(Number.NaN, 6), 0);
  for (const mode of ["material", "occasion"] as const) {
    const first = reduceInvitation(CLOSED_INVITATION, { type: "show-empty-bowl", gardenEntryCount: 4 }, mode);
    assert.equal(first.session.card?.index, 4);
    assert.deepEqual(first.effects, []);
    let session = first.session;
    for (let step = 0; step < 6; step += 1) {
      const next = reduceInvitation(session, { type: "another" }, mode);
      assert.equal(next.session.card?.index, (4 + step + 1) % 6);
      assert.equal(next.session.card?.moment, "empty-bowl");
      assert.deepEqual(next.effects, []);
      session = next.session;
    }
    const again = reduceInvitation(session, { type: "show-after-keep", gardenEntryCount: 2 }, mode);
    assert.equal(again.session.card?.index, 2);
    assert.equal(again.session.card?.moment, "garden-after-keep");
  }
});

test("open play has no invite mode and save keys and shapes stay studio-v2 and garden-v2", () => {
  assert.equal(readInviteMode(""), null);
  assert.equal(readInviteMode("?"), null);
  assert.equal(readInviteMode("?debug=1"), null);
  assert.equal(readInviteMode("?invite="), null);
  assert.equal(readInviteMode("?invite=Material"), null);
  assert.equal(readInviteMode("?invite=materials"), null);
  assert.equal(readInviteMode("?invite=material"), "material");
  assert.equal(readInviteMode("?foo=1&invite=occasion"), "occasion");
  const plain = sceneStorageKeys(new URL("https://example.test/"), false);
  const material = sceneStorageKeys(new URL("https://example.test/?invite=material"), false);
  const occasion = sceneStorageKeys(new URL("https://example.test/?invite=occasion"), false);
  assert.deepEqual(material, plain);
  assert.deepEqual(occasion, plain);
  assert.equal(plain.studio, "ikebana-web-alpha:studio-v2");
  assert.equal(plain.garden, "ikebana-web-alpha:garden-v2");
  assert.equal(plain.telemetry, "ikebana-web-alpha:telemetry-v1");
  assert.equal(plain.legacyStudio, "ikebana-web-alpha:studio-v1");
  assert.equal(plain.legacyGarden, "ikebana-web-alpha:garden-v1");

  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
  };
  const studio = new SceneCommittedStore(plain.studio, plain.legacyStudio, () => ({
    scene: DEFAULT_SCENE,
    camera: canonicalCameraPose("front"),
  }), storage);
  studio.load();
  assert.equal(studio.save(1, []), true);
  const saved = JSON.parse(items.get(plain.studio)!) as Record<string, unknown>;
  assert.deepEqual(Object.keys(saved).sort(), ["camera", "nextSuccessfulOrdinal", "plants", "savedAt", "scene", "storageVersion"]);
  assert.equal(saved.storageVersion, 2);
  assert.equal(JSON.stringify(saved).includes("invite"), false);
  const restored = parseSceneStudio(items.get(plain.studio)!);
  assert.equal(restored.storageVersion, 2);
  assert.equal(restored.plants.length, 0);

  const garden = new SceneGardenStore(plain.garden, plain.legacyGarden, storage);
  garden.load();
  const fixture = createWorkbenchFixture("reed", 8278, 1);
  garden.keep({
    id: "kept-bowl",
    title: "",
    keptAt: "2026-10-09T00:00:00.000Z",
    thumbnail: null,
    arrangement: fixture,
  });
  const gardenSaved = JSON.parse(items.get(plain.garden)!) as Record<string, unknown>;
  assert.deepEqual(Object.keys(gardenSaved).sort(), ["entries", "gardenVersion"]);
  assert.equal(gardenSaved.gardenVersion, 2);
  assert.equal(JSON.stringify(gardenSaved).includes("invite"), false);
  assert.equal(parseSceneGarden(items.get(plain.garden)!).entries.length, 1);
  assert.deepEqual([...items.keys()].sort(), [plain.garden, plain.studio]);
});

test("invitation transitions never touch localStorage", () => {
  const source = [
    readFileSync("src/app/invitations.ts", "utf8"),
    readFileSync("src/app/invitationCard.ts", "utf8"),
  ].join("\n");
  assert.equal(/\blocalStorage\b|\bsessionStorage\b|\.setItem\s*\(/.test(source), false);
  let hits = 0;
  const prior = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      hits += 1;
      return {
        getItem() { hits += 1; return null; },
        setItem() { hits += 1; throw new Error("invitation wrote storage"); },
      };
    },
  });
  try {
    for (const mode of ["material", "occasion"] as const) {
      let session: InvitationSession = CLOSED_INVITATION;
      const commands = [
        { type: "show-empty-bowl", gardenEntryCount: 3 },
        { type: "another" },
        { type: "begin" },
        { type: "show-after-keep", gardenEntryCount: 8 },
        { type: "begin" },
        { type: "replacement-declined" },
        { type: "fresh-bowl-created" },
        { type: "bowl-gained-material" },
        { type: "not-now" },
        { type: "garden-closed" },
      ] as const;
      for (const command of commands) {
        session = reduceInvitation(session, command, mode).session;
      }
      assert.equal(JSON.stringify(session).includes("localStorage"), false);
    }
    assert.equal(hits, 0);
  } finally {
    if (prior) Object.defineProperty(globalThis, "localStorage", prior);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("empty-bowl Begin selects only for a material invitation and never places it", () => {
  const material = reduceInvitation(CLOSED_INVITATION, { type: "show-empty-bowl", gardenEntryCount: 0 }, "material");
  const began = reduceInvitation(material.session, { type: "begin" }, "material");
  assert.deepEqual(began.effects, [{ type: "select-material", materialId: "reed" }]);
  assert.equal(began.session.card, null);
  assert.equal(began.session.pendingMaterialId, null);
  const occasion = reduceInvitation(CLOSED_INVITATION, { type: "show-empty-bowl", gardenEntryCount: 0 }, "occasion");
  const dismissed = reduceInvitation(occasion.session, { type: "begin" }, "occasion");
  assert.deepEqual(dismissed.effects, []);
  assert.equal(dismissed.session.card, null);
  const notNow = reduceInvitation(material.session, { type: "not-now" }, "material");
  assert.equal(notNow.session.card, null);
  assert.deepEqual(notNow.effects, []);
});

test("Garden Begin uses a fresh-bowl request and declining selects nothing", () => {
  for (const mode of ["material", "occasion"] as const) {
    const shown = reduceInvitation(CLOSED_INVITATION, { type: "show-after-keep", gardenEntryCount: 1 }, mode);
    assert.equal(shown.session.card?.moment, "garden-after-keep");
    assert.equal(shown.session.card?.index, 1);
    const began = reduceInvitation(shown.session, { type: "begin" }, mode);
    assert.deepEqual(began.effects, [{ type: "request-fresh-bowl" }]);
    assert.equal(began.session.card, null);
    assert.equal(began.session.pendingMaterialId, mode === "material" ? "bare-branch" : null);
    const declined = reduceInvitation(began.session, { type: "replacement-declined" }, mode);
    assert.equal(declined.session.pendingMaterialId, null);
    assert.deepEqual(declined.effects, []);
    const created = reduceInvitation(began.session, { type: "fresh-bowl-created" }, mode);
    assert.deepEqual(
      created.effects,
      mode === "material" ? [{ type: "select-material", materialId: "bare-branch" }] : [],
    );
    assert.equal(created.session.pendingMaterialId, null);
  }
  const empty = reduceInvitation(CLOSED_INVITATION, { type: "show-empty-bowl", gardenEntryCount: 0 }, "material");
  const closed = reduceInvitation(empty.session, { type: "garden-closed" }, "material");
  assert.equal(closed.session.card?.moment, "empty-bowl");
  const kept = reduceInvitation(CLOSED_INVITATION, { type: "show-after-keep", gardenEntryCount: 0 }, "occasion");
  const left = reduceInvitation(kept.session, { type: "garden-closed" }, "occasion");
  assert.equal(left.session.card, null);
  const filled = reduceInvitation(kept.session, { type: "bowl-gained-material" }, "occasion");
  assert.equal(filled.session.card?.moment, "garden-after-keep");
  const hiding = reduceInvitation(empty.session, { type: "bowl-gained-material" }, "material");
  assert.equal(hiding.session.card, null);
});

function harness() {
  const state = { posture: "arrange", tool: "shape", view: "front", cameraMode: "orbit", selectedMaterialId: "flowering-branch" };
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    scene: { ...DEFAULT_SCENE },
    workingSession: null,
    config: { workbench: false },
    bendVariant: "bead",
    selectedBranchId: "plant-1:trunk",
    cameraIsFree: false,
    hovering: false,
    gesture: null,
    autosaveWrites: [],
    root: { querySelector: () => null },
    sound: { unlock() {} },
    telemetryStore: { clear() {} },
    metrics: { resetAttempt() {} },
    resolvePendingAcquisition() {},
    syncPresentation() {},
    ui: { state, setState: (patch: object) => Object.assign(state, patch), setStatus() {} },
    store: { save() { return true; } },
  });
  const snapshot = createWorkbenchFixture("flowering-branch", 8278, 1);
  app.replaceCoordinator(new Map(snapshot.plants.map((graph) => [graph.id, fromCanonicalPlantGraph(graph)])), 1);
  return { app, state, snapshot };
}

test("select-material chooses a cutting and does not place one", () => {
  const { app, state } = harness();
  const before = JSON.stringify(app.arrangementSnapshot());
  app.handleUICommand({ kind: "select-material", materialId: "reed" }, {});
  assert.equal(state.selectedMaterialId, "reed");
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(app.coordinator.getDocumentSnapshot().plants.size, 1);
});
