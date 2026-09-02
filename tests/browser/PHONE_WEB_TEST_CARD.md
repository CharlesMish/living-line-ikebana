# Phone web alpha test card

This card tests the hosted Three.js build as a **mobile-web field instrument**. It can validate the botanical graph, direct manipulation, acquisition policy, camera ownership, and Safari cancellation behavior. It cannot prove native haptics or whether RealityKit targeting will feel better.

The authority order remains:

1. `docs/BEHAVIORAL_CONTRACT.md`;
2. the golden fixture and numeric baseline;
3. this browser card;
4. the old browser engine, which is feel evidence only and contains known defects.

An iOS edge swipe, tab switch, browser-toolbar change, or WebGL context loss may take the interaction away from the page. That is not automatically a failure. **Any preview that survives such an interruption as committed botanical state is a failure.**

## Build and device record

Run the card on a physical iPhone in Safari, in portrait, from the real hosted origin. Browser emulation is useful only as a smoke test.

Record:

- build identifier / commit:
- URL and bend variant (touch default with no parameter, `?bend=touch`, or `?bend=fixed`):
- iPhone model, iOS version, and Safari version:
- viewport size before and after browser chrome moves:
- fresh session or restored local specimen:
- tester and whether they helped design the controls:

For a clean run, clear this origin's site data or use the test-only reset hook. Do not clear storage between the persistence steps.

## Required web-shell preflight

Inspect the built page once before physical play. All items are required.

- The viewport meta includes `width=device-width`, `initial-scale=1`, and `viewport-fit=cover`.
- Do not depend on `user-scalable=no` or `maximum-scale=1` as the only way to retain gestures. Preserve accessibility zoom outside the interaction surface.
- The scene interaction surface has `touch-action: none`.
- The fixed application shell cannot scroll; `html`, `body`, and the application root fill the dynamic viewport and hide overflow.
- The shell suppresses in-app rubber-band chaining with `overscroll-behavior: none` where WebKit supports it.
- Safe-area insets do not put tray or state-changing chrome under the home indicator or notch.
- Arrange chrome is top-mounted and contextual: Arrange | Step Back, then Shape | Prune. Front / 3/4 / Above appear only in Step Back. No interactive chrome sits between the tray and the usable kenzan on portrait phones. Hidden contextual controls are not focusable and do not intercept pointers. Empty space inside the contextual row, outside the visible pills, must reach the studio/canvas. The tray is present in Arrange and hidden in Step Back.
- A drag or pinch that begins on the scene never scrolls the document, selects text, or zooms the page.
- The app listens for `pointercancel`, premature `lostpointercapture`, `visibilitychange`, `pagehide`, relevant viewport/orientation resize, and WebGL context loss.

`lostpointercapture` needs one nuance: after an ordinary `pointerup`, commit and finish happen first, so the later implicit capture loss is a no-op. Capture lost while a transaction is still active is cancellation.

## Ten-minute craft path

Give the tester at most the labels present in the build. Do not explain hit regions, the model graph, or the bend algorithm.

1. Start from the empty vessel.
   - Expected: Front + Arrange + Shape, no selection, no transaction.
2. Drag the material from the tray, move it over the kenzan, then release outside the usable field.
   - Expected: the pending graph disappears, nothing seats, no save occurs, and ordinal 1 remains available.
3. Drag it again and seat it.
   - Expected: the pending graph is `plant-1`, seed `8278`, and a valid release seats that same full graph at the previewed point.
4. Aim the trunk once and a lateral continuation twice.
5. Bend one eligible trunk/lateral/twig into a broad curve.
6. Move the insertion to a different part of the usable pin field.
7. Enter Prune, preview a distal cut, slide its station, and release.
8. Prune through one pedicel so its bloom leaves with the stalk.
9. Step Back, orbit, pinch, use Above, return to Front, and then return to Arrange.
10. Revisit an earlier continuation and shape it again.
11. Add a second plant. Confirm that the first plant remains unchanged, selectable, and editable.

During this path, record ten deliberate acquisitions after two minutes of familiarization. Before each touch, say or note the intended operation and target. A first-try success means the first acquired operation and stable ID match that intention; lifting and trying again is a miss.

## Full pending-graph identity check

Perform this once with the test bridge or state inspector open.

At tray acquisition:

- reserve `plant-1`, seed `8278`, without advancing the successful-seat ordinal;
- construct the complete graph, including active trunk/lateral/twig branches, petioles, pedicels, leaves, buds, and blooms;
- render every active graph record in the translucent pending presentation.

After valid seating, compare pending and committed graph state. The following must be identical:

- plant, branch, and organ IDs;
- seed, schema version, and generator version;
- topology, active flags, rest lengths, radii, stiffness values, attachment distances, spins, scales, and reference normals;
- curvature and all relative point positions.

Every active point may differ only by the **same root translation shown by the valid preview**. The preview may follow the finger outside the usable field, but that state cannot be seated. No organ or stalk may appear only after release. JavaScript object-reference equality is not required; botanical identity and data equality are.

After invalid release or cancellation, no graph is committed, no save is written, and the next tray acquisition again reserves `plant-1` / `8278`.

Hard fail: any line-only ghost, seed/ID regeneration, silhouette pop, organ pop, or curvature change at seating.

## Transaction interruption matrix

For each row, first make a clearly visible live preview. Hash or snapshot the committed graph immediately before acquisition. On interruption, the graph must equal that snapshot, the preview must disappear, ownership must clear, and autosave must not write.

Cover at least one Shape transaction and one Prune transaction across the matrix.

| Interruption | How to provoke on iPhone / harness | Required result |
| --- | --- | --- |
| `pointercancel` | Test hook or begin near an OS-owned edge gesture | Roll back; no commit; no save |
| Premature `lostpointercapture` | Test hook / force release before `pointerup` | Roll back; no commit; no save |
| Tab/app hidden | Begin preview, switch apps, return | `visibilitychange` cancels before resume |
| `pagehide` / navigation | Begin preview, navigate away/back where practical | Last committed specimen restores; preview never does |
| `window.resize` | Resize through device rotation or harness | Cancel first, then reframe |
| `visualViewport.resize` | Move Safari chrome while previewing | Cancel first, then reproject |
| Orientation change | Rotate during preview | Cancel first; no stale edit plane |
| Canonical view command | In Step Back, second finger taps Front/Above/3/4 during a camera gesture | Cancel camera ownership, then change view. Views are contextual to Step Back; they are not visible during an Arrange edit. |
| Tool command | During an Arrange edit, second finger changes Shape/Prune | Cancel, then change tool |
| Posture command | Second finger changes Arrange/Step Back | Cancel, then change posture |
| Second scene pointer | Add a second finger to the canvas during an edit | Ignore it; do not pinch, orbit, or retarget |
| WebGL context loss | Harness extension or background/resume | Cancel preview; retain committed graph; rebuild presentation |

Ordinary `pointerup` is the only plant-edit commit route. Dispatching a later `lostpointercapture` after a completed `pointerup` must not create a second finish or turn the commit into a rollback.

## Deterministic acquisition and ownership

Run the same overlapped-target probes at least twenty times. The winner may not depend on Three.js intersection-array order.

Priority is:

1. visible handle on the selected plant;
2. enlarged material target on the selected plant;
3. enlarged material target on another plant;
4. no target.

Within a tier, resolve by:

1. smallest CSS-pixel distance to projected material;
2. smallest ray depth emitted by the forward-facing raycaster;
3. lexicographically smallest stable ID.

Once acquired, operation, plant ID, branch ID, material station, pointer ID, snapshot, and edit plane are frozen. Crossing another branch, handle, or empty space cannot hand ownership to it or to the camera.

Hard ownership checks:

- Arrange + empty-space drag: graph and camera both remain unchanged.
- Arrange + acquired plant drag: camera remains unchanged until finish.
- Step Back + any plant touch: canonical graph remains unchanged.
- Step Back + empty-space drag/pinch: camera changes within constraints.
- A second scene pointer during a plant transaction is ignored.
- Explicit persistent chrome remains hittable by another pointer and acts as cancel-then-command. Hidden contextual rows (views during Arrange, tools and tray during Step Back) must not be focusable or pointer-active. Empty space in the contextual row, outside the visible pills, belongs to the studio.
- An insertion acquired from the tray owns its pointer until commit or cancellation. Passing over any button region, including the former mid-screen control strip, must not activate that button or transfer ownership.

## Bend experiment: touch-located default versus fixed-bead fallback

Touch-located is the ordinary default (bare URL and `?bend=touch`). Fixed-bead remains a complete fallback (`?bend=fixed`). Use the same plant fixture, camera view, aim behavior, broad solver, response caps, and task in both runs. Choose the variant before each timed block and do not change it during that block. The visible experiment control may switch variants between blocks; switching cancels any active edit.

### Variant A: `fixed`

- A subordinate bead appears only on the selected active trunk/lateral/twig with at least four points, three rest segments, and a legal interior station.
- Its station is `clamp(0.54 * activeLength, firstRestLength, activeLength - lastRestLength)`.
- It never appears on petioles or pedicels and hides while any transaction is acquired.
- The material distance is frozen at acquisition.

### Variant B: `touch`

- Upper-body/tip acquisition retains the same direct aim verb used in A.
- An eligible middle-span bend acquisition samples the touched projected material, converts it to rest-arc distance, clamps it to the legal interval, and freezes that exact distance for the transaction.
- No permanent bead is shown. A subordinate attached cue may appear only after bend acquisition.
- It uses the same capped smootherstep bend solver as A; it is not free-chain IK.

For both variants:

- ordinary bending preserves every non-cut rest length;
- an extreme drag saturates without folding into a pretzel;
- descendants and organs remain coincident at their material attachments;
- a cancel returns byte-for-byte-equivalent canonical state;
- the selected station never drifts as the line moves under the finger.

Ask each tester to make the same five intended silhouette changes in each variant, counterbalancing which variant comes first. Record:

- first-try operation/target acquisition;
- immediate corrective bends made only to remove a kink or unintended shape;
- time from first touch to intended silhouette;
- whether they describe manipulating the branch/material or manipulating a bead/control;
- any question about what the bead is or why it disappeared.

Touch-located is now the ordinary default after physical-phone preference for the same solver. Keep recording the A/B comparison when both variants are exercised: B remains preferred unless its first-try acquisition rate is more than 5 percentage points worse than A, its median corrective-bend count is higher, or its median completion time is more than 15% slower. Failure of either variant alone does not falsify the whole foundation.

## Reach-region record

Aggregate acquisition numbers can hide a portrait reach problem. Assign every pointer-down to one of six CSS-pixel regions:

- vertical: top `0–33%`, middle `33–67%`, bottom `67–100%`;
- horizontal: left or right half.

For each deliberate attempt, record:

| Field | Value |
| --- | --- |
| variant | fixed / touch |
| region | top-left … bottom-right |
| intended operation | insert / aim / bend / base / prune / camera |
| intended stable ID | ID or none |
| acquired operation and ID | value or none |
| first try | yes / no |
| correction needed | yes / no |
| posture/tool already correct | yes / no |

The in-memory QA metrics may log pointer location and actual acquisition automatically, but only the observer/tester can supply intent. Do not infer intent after the result.

Investigate any region below 80% first-try acquisition separately before increasing every collider.

## Committed-only autosave

Autosave is silent and versioned. It stores the canonical specimen and successful-seat ordinal, not renderer objects, live previews, pending insertions, camera tweens, hit candidates, or pointer ownership.

Required checks:

1. Clear storage and load: empty state; no fabricated plant.
2. Acquire/update aim, bend, base, prune, and insertion previews: storage write count does not change.
3. Cancel each: persisted hash and ordinal do not change.
4. Commit an edit: after any documented debounce, persisted hash equals the committed canonical hash and every recorded write reports no active transaction.
5. Begin another visible preview, background Safari, and reload: restore the previous commit, never the preview.
6. Invalid/cancelled insertion does not advance the stored ordinal.
7. Valid seating advances the ordinal only after commit; the next pending graph reserves the next ID/seed.
8. Corrupt or unknown-version storage fails closed to the empty state with a terse recovery message; it never partially hydrates a graph.

Multiple commits may be safely coalesced, but every payload actually written must correspond to a completed commit. A timer firing during an active preview may write only the last committed snapshot, never current presentation state.

## Acquisition telemetry and export

Telemetry is strictly observational diagnostic instrumentation, not a scored or validated measurement of ease, speed, or preference. It never gates a craft operation, is a separate storage key from the committed-graph autosave above, and the graph always saves first, with telemetry subordinate to it over time (not only within one release) — see check 9.

Required checks:

1. `getPersistedTelemetry()` starts with empty `bead`/`touch` acquisition arrays on a cleared origin (use `resetForTest({ clearAutosave: true, clearTelemetry: true, ... })` or `?clearStudyData=1`).
2. Every acquisition — hit or miss — carries the `bendVariant` active when it happened. Switching the variant mid-session tags later acquisitions with the new variant without rewriting earlier ones, and resets any in-progress miss/attempt state so a miss on one arm never attaches to a hit on the other. The same reset happens on a posture, tool, or canonical-view change, and on any test-block boundary (a full reset).
3. A committed edit's record shows `outcome: "committed"`; an interrupted/cancelled one shows `outcome: "cancelled"` with a reason. The two are never the same value, and a cancelled record is never briefly written as committed before correction — resolution happens once, after the coordinator already knows the outcome, and resolving an already-resolved record is a no-op. A camera release resolves as `outcome: "released"`, never `"committed"` — camera never edits the graph.
4. An insertion's record carries `materialId` (from the material registry, never hardcoded) and `inputMethod` (`"pointer"` for a tray drag, `"keyboard"` for `activate-material`); no other operation carries either field.
5. Reload without any flag: telemetry accumulated so far is still present. Reload with `?fresh=1` (an ordinary specimen reset): telemetry is still present — a fresh specimen must never silently delete study data.
6. `?clearStudyData=1` is one-shot: it returns `getPersistedTelemetry()` to empty `bead`/`touch` arrays once, and the app immediately strips the flag from the address bar. A record collected after that clear, followed by an ordinary reload of the (now flag-free) address, must still be present — the flag must never re-clear on a later reload or a bend-variant switch.
7. Begin a plant drag from the tray (hold), then tap **Export local study data** in the info panel while still holding: the drag's active transaction cancels first (its acquisition resolves as `"cancelled"` with reason `"experiment-command"`), and only then does export proceed. Releasing the now-stale pointer afterward is an idle no-op.
8. Tap **Export local study data**:
   - if the device offers the Web Share API with file support, the native share sheet appears with a `.json` attachment (try Save to Files);
   - dismissing that share sheet without picking a destination reports a distinct "Export cancelled." status and must not produce a file download or open the manual-copy panel;
   - otherwise (Share unavailable) a file download should appear (check Files app / Downloads);
   - otherwise a read-only text panel appears with the same JSON, pre-selected for copy.
9. Malformed or exhausted storage never wins against the graph: with `localStorage` artificially quota-limited (a harness/dev-tools trick, or the automated shared-origin-quota check), pre-occupy storage with telemetry, then commit a plant edit that would fit once telemetry yields. The commit must succeed — telemetry is evicted and the graph save is retried once — never the reverse.
10. The exported JSON's `persisted` field matches `getPersistedTelemetry()` at export time and carries the same `instrumentVersion` as the persisted dataset (not just the export envelope), plus a precise `privacyStatement` (timestamps and a random session ID are present; no direct identifier or arrangement content is). `summary.bead`/`summary.touch` are scoped to `scope: "bend-only-resolved-hits"` — resolved (committed/cancelled only) bend hits. A tally of camera, released/declined, or insert (pointer or keyboard) records must never appear in `summary.*`, though they remain visible in `persisted.*.acquisitions` for debugging.
11. The complete persisted payload stays at or under 256 KiB; sustained use trims the oldest records first rather than growing without bound or silently corrupting.

What this data can answer: for acquisitions the instrument resolved as bend hits (committed or cancelled only), how many of each, and the mean of the raw `rawMeanTimeToAcquireMs`/`rawMeanMissesBeforeHit` counters recorded for them, split by variant. What it cannot answer, and must not be read as answering: which bend variant is faster or easier to use, or whether the resulting silhouette is preferred — a miss has no known intended operation, and feel/intent/correctness judgments remain this phone card's "Bend experiment" section above, observer-recorded, unless a future explicit trial lifecycle records intent directly.

## WebGL context-loss recovery

Test once while idle and once during a visible edit preview.

1. Capture canonical state hash, selected IDs, camera pose, and active render inventory.
2. Trigger `WEBGL_lose_context` when the extension is available. Otherwise background Safari long enough to encourage eviction.
3. The `webglcontextlost` handler prevents default restoration behavior where required, cancels any active transaction, and does not mutate or save the preview.
4. Restore/recreate the renderer from canonical state.
5. Confirm the canonical hash is unchanged, render inventory again matches every active graph record, hit targets work, and no duplicate GPU presentation remains.

Hard fail: blank unrecoverable canvas, duplicate plant presentation, committed preview leakage, identity/detail pop, or loss of the last committed specimen.

## Page-gesture stress pass

Perform in the hosted Safari page, not only a home-screen install:

- ten one-finger plant drags near each screen edge;
- five empty-space drags in Arrange;
- five orbit drags and five pinches in Step Back;
- one slow drag while Safari's bars expand/collapse;
- one app switch during Shape and one during Prune;
- one second-scene-pointer attempt and one second-finger chrome interrupt.

Expected:

- no page scroll, text selection, or page zoom for gestures begun on the interaction surface;
- an OS-owned navigation gesture may cancel the app, but cannot commit it;
- no camera motion in Arrange and no graph mutation in Step Back;
- no stale pointer ownership after return.

## Pass/fail

### Hard gates: all must pass

- Zero commits from cancellation, interruption, viewport change, context loss, or lost capture.
- Zero preview payloads written to autosave.
- Zero camera theft in Arrange; zero botanical edits in Step Back.
- Full pending graph seats with the same identity at its valid previewed translation.
- Deterministic acquisition order passes all repeated synthetic overlap cases.
- Ordinary aim/bend preserves stock length; unrelated graph records never change.
- Prune removes exactly its previewed IDs; a pedicel cut removes its bloom.
- Context recovery reconstructs the presentation from unchanged canonical state.
- The document does not scroll or page-zoom from gestures begun on the scene.

### Interaction threshold

- At least 8 of 10 deliberate acquisitions succeed first try after two minutes of familiarization.
- At most 1 of 5 broad bends needs an immediate repair solely to remove a kink/pretzel.
- The full craft path is finishable without spoken developer instruction.
- Front and Above each help the tester make at least one composition or insertion judgment.

After two focused gesture-tuning passes, reconsider this direct-manipulation foundation rather than endlessly polishing it if the hard ownership/rollback gates still fail, acquisition remains below 80%, bends repeatedly require repair, or 2 of 3 testers prefer sliders/gizmos because the material cannot be trusted.

## Required DOM automation hooks

Production UI stays quiet. Stable hooks are attributes, not visible QA chrome.

| Element | Required hook / state |
| --- | --- |
| Application shell | `[data-testid="app-root"]`, plus `data-ready`, `data-posture`, `data-tool`, `data-view`, `data-bend-variant`, `data-transaction` |
| Scene | `[data-testid="scene-canvas"]` |
| Tray material | `[data-testid="material-flowering-branch"]` |
| Posture commands | `[data-testid="posture-arrange"]`, `[data-testid="posture-step-back"]` |
| Tool commands | `[data-testid="tool-shape"]`, `[data-testid="tool-prune"]` |
| Canonical views | `[data-testid="view-front"]`, `[data-testid="view-three-quarter"]`, `[data-testid="view-above"]` |
| Experiment variant | root `data-bend-variant="fixed|touch"`; an internal/test selector is optional |
| Status region | `[data-testid="status"]` with an appropriate live-region role |

Buttons expose native `disabled` / `aria-pressed` state where applicable. Do not attach stable botanical IDs to visible prose merely for automation.

## Test bridge contract

When loaded with `?test=1`, the current build exposes `window.__IKEBANA_TEST__`, including in the generated production bundle. A future public host may deliberately strip that bridge, but any build used with this card must expose it. It must inspect or route into the same production coordinator; it must not introduce a second model or alternate mutation law.

Minimum shape:

```ts
interface IkebanaTestBridgeV1 {
  version: 1;
  ready: Promise<void>;
  getState(): {
    ready: boolean;
    posture: "arrange" | "step-back";
    tool: "shape" | "prune";
    view: "front" | "three-quarter" | "above" | "orbit";
    bendVariant: "fixed" | "touch";
    transaction: null | {
      operation: "insert" | "aim" | "bend" | "base" | "prune" | "camera";
      pointerId: number;
      plantId?: string;
      branchId?: string;
      materialDistance?: number;
      acquisitionHash: string;
    };
    selectedPlantId: string | null;
    selectedBranchId: string | null;
    successfulSeatOrdinal: number;
    cameraHash: string;
    canonicalHash: string;
  };
  getCanonicalSnapshot(): unknown; // deep copy, stable key/array order
  getRenderInventory(): {
    scope: "committed" | "pending";
    plantId: string;
    branchIds: string[];
    organIds: string[];
  }[];
  getScreenTargets(): {
    role: string;
    plantId?: string;
    branchId?: string;
    materialDistance?: number;
    x: number;
    y: number;
    region: string;
  }[];
  projectWorldPointForTest(point: { x: number; y: number; z: number }): {
    x: number;
    y: number;
    visible: boolean;
  };
  resolveHitForTest(candidates: {
    stableId: string;
    tier: "selected-handle" | "selected-plant" | "other-plant";
    screenDistance: number;
    rayDepth: number;
  }[]): { stableId: string } | null;
  getMetrics(): unknown;
  resetMetrics(): void;
  getAutosaveAudit(): {
    writes: {
      commitSequence: number;
      canonicalHash: string;
      transactionActive: boolean;
      reason: string;
    }[];
  };
  getPersistedTelemetry(): {
    storageVersion: 1;
    instrumentVersion: string; // persisted with the dataset, not only the export envelope
    savedAt: string;
    variants: {
      bead: { acquisitions: unknown[] };
      touch: { acquisitions: unknown[] };
    };
  };
  getTelemetryExportPayload(): unknown; // the exact JSON the export button would share/download
  resetForTest(options: {
    clearAutosave: boolean;
    clearTelemetry: boolean; // deliberately separate: a specimen reset never implies wiping study data
    bendVariant?: "fixed" | "touch"; // omit to preserve the currently active variant and telemetry bucket
  }): Promise<void>;
  interruptForTest(reason:
    | "pointercancel"
    | "lostpointercapture"
    | "visibilitychange"
    | "pagehide"
    | "resize"
    | "visual-viewport-resize"
    | "orientationchange"
    | "webgl-context-lost"
  ): void; // exact production cancellation entry point
  loseContextForTest(): Promise<boolean>;
  restoreContextForTest(): Promise<boolean>;
}
```

The bridge's `resolveHitForTest` calls the production candidate sorter. `interruptForTest` calls the production interruption path. Context helpers use the actual renderer/context-loss path. If a browser cannot provide `WEBGL_lose_context`, return `false` and mark that automated probe skipped; keep the physical background/resume test.

Recommended in-memory metric events, enabled only for QA/debug builds:

- `acquire`: pointer type/ID, CSS coordinates, six-way reach region, posture, tool, intended-unknown, acquired operation/tier/stable IDs;
- `finish`: commit/cancel, reason, acquisition hash, final hash, commit sequence;
- `autosave`: commit sequence, saved hash, transaction-active flag;
- `pending`: reserved ID/seed and active render counts;
- `context`: lost/restored and canonical hash.

These hooks diagnose the experiment. They must not become visible developer narration or an analytics dependency in the toy.

Acquisition telemetry (bend variant, material id/input method for insertions, attempt miss count, time-to-acquire, and committed/cancelled/declined/released outcome) is durable rather than in-memory-only — see "Acquisition telemetry and export" above — but the same rule applies: it stays a diagnostic layer, never a visible analytics dashboard, and never a gate on any craft operation. Comparative summaries stay bend-scoped and never claim to measure which variant is faster or easier.
