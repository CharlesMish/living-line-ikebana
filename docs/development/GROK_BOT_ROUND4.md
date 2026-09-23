# Grok Bot — Round 4: toward ten materials, plus a shaping study

This is a ready-to-run coordinator brief. It supersedes the old two-candidate
dispatch in `GROK_BOT_HANDOFF.md`; the behavioral contract remains authoritative.
This document commissions prototypes for review, not production promotion.

Repository: `CharlesMish/living-line-ikebana`

**Pinned runtime baseline: `59e42e6554b05ff2fc415514370430716e9e8515`.**
This includes merged PR #33: short-stalk Aim correction, complete leaf/petal
acquisition coverage, visible-surface arbitration and conservative flower polish.
Baseline verification: 182 tests, zero failures. GitHub Pages deployment passed.
The owner reports that the former flower freeze no longer reproduces in a phone
browser. This is useful owner evidence, not a completed device test matrix.

This brief may be read from a later documentation-only commit. Start code lanes
from the pinned runtime baseline; record any proposed baseline change explicitly.
Do not return to a pre-#33 integration head.

## Goal and constraints

The seven existing materials are flowering branch, leafy shoot, bare branch,
single flower, reed, flower volume and arching trailer. Build three candidates
that widen the choices available for restrained arrangements. The eventual
collection may contain 12–14 materials; this round aims toward ten, without a
quota that requires weak candidates to ship.

Separately, test a small extension to shaping: choosing where the single bend
bead acts. Keep that experiment out of the combined materials candidate.

Use Grok 4.7 if it is available in Charlie's configured Cursor pool. Confirm and
record the actual model shown by the agent service. Use high thinking where the
setting is exposed; otherwise report that it is not exposed. Do not silently
substitute Luna, another provider, or another billing pool. If the requested
model is unavailable, stop dispatch and report that narrow problem.

Read `AGENTS.md`, `ARCHITECTURE.md`, `docs/BEHAVIORAL_CONTRACT.md`,
`docs/MATERIAL_REFERENCES.md`, `docs/GARDEN.md`, `WORKBENCH.md`,
`WORKBENCH_FIXTURE_PROFILES.md`, `FLOWER_AIM_POLISH.md`, and the relevant tests.
Older round dispatches and inventory statements are historical context, not
instructions to repeat those rounds. Run `npm ci` and `npm run verify` at baseline.

Use one isolated worktree and branch per lane. Run A/B/C/D independently; one
coordinator owns integration, and a reviewer who did not author the changes
reviews the final tips. Do not start additional speculative material lanes.

## Lane A — foliage fan

Suggested material ID `foliage-fan`, generator `foliage-fan-v1`.

A branching green spray whose several small leaves collectively make a broad
spread. Start around one main stem, two or three editable lateral arms and six
to nine curved leaves. This is different from the current single-axis leafy
shoot: the player can open one side, keep an answering arm, or lower the whole
spread beside a taller line. Preserve a usable basal span for insertion.

Use existing leaf surfaces first. This is a group of leaves, not a substitute
for a deformable broad blade. Do not call it a specific botanical species.

Required composition: compare with the leafy shoot in the same arrangement.
Show a cut that removes one lateral arm and opens a deliberate gap, retaining
the identities and detail of the other arms.

## Lane B — airy blossom spray

Suggested material ID `blossom-spray`, generator `blossom-spray-v1`.

Thin, branching green stock with four to six separated small flowers across
two or three lateral groups. Leave real space between the flowers; the main
choice is a distributed light rhythm, distinct from a woody flowering branch
and from the dense terminal flower-volume head. Begin with modest existing
bloom surfaces. Avoid dozens of florets or an enlarged cloud of tiny meshes.

Each flower has an honest supporting stalk and persistent organ identity.
Cuts on a lateral remove its descendants through the ordinary graph plan.
Explain the difference between cutting one flower stalk and removing its group.

Required composition: compare against the flowering branch and flower volume.
Show a lateral cut that changes the distribution of accents while keeping a
readable line. Petals must remain discoverable and acquirable at phone scale.

## Lane C — nodding flower

Suggested material ID `nodding-flower`, generator `nodding-flower-v1`.

One downward/outward flower with a legible curved neck and a substantial cup or
bell-shaped volume. Use restrained foliage and an accessible supporting stem.
The hanging silhouette and view into/under the flower should create a useful
choice beside upright material. This is authored rest geometry, not simulated
gravity or drooping physics.

A contained new bloom surface is allowed if the existing cupped surface cannot
express the shape. Its mouth, back and sides must form a coherent volume from
Front, three-quarter and Above, following the supporting material frame. Never
turn it into a camera-facing sprite. Retain existing branch and organ kinds.

If the new surface needs organ-renderer wiring, propose the contained addition
to the integration owner. They may authorize that narrow support while retaining
all existing forms and picking behavior. This is not permission for a shared
renderer rewrite.

Required substitution test: try making the same composition by aiming/bending
the existing single flower. If that gives essentially the same result, return
this candidate as a useful experiment rather than forcing a tenth catalog entry.
Do not start a replacement species hunt during this round.

## Material lane permissions and integration

A/B/C own their new generator, fixture, focused tests, report and any isolated
surface function. Small additive entries in response, appearance, catalog,
exports and the Materials picker are allowed to make each branch playable.
The integration owner reconciles those shared entries once, after candidate
heads are frozen. Do not merge all PRs blindly or redesign the tray in a lane.

Preserve every existing generator and golden, including all seven current
materials. Response values are copied once into the generated graph; never
reapply a profile on load. Structure, appearance and bend response stay separate.
No changes to Aim, hit ranking, cameras, ownership, cancellation, insertion
ordinals, Garden semantics, storage schemas or shared bend laws in A/B/C.

Keep `reference-pair`, `mixed`, `all-four`, `round3-three` and `round3-palette`
meanings and order unchanged. Add explicit `references-plus-<candidate>` profiles
and, for accepted candidates, `round4-candidates` and `round4-palette` profiles.
Only the already-labeled dynamic profile may follow catalog registration.
An absent/deferred candidate must not leave a broken profile or phantom option.
Decide deferrals before publishing the Round 4 stable profiles, then record and
freeze their exact ordered material IDs with the final candidate.

Check actual visible geometry against actual faceted pick proxies, including
per-instance transforms. Preserve the PR #33 acquisition and short-stalk tests.
Retain forgiving near misses and one canonical supporting-branch target per
acquired organ. A pruning unit does not require its own draw call; use batching
where straightforward without detaching identity from the graph.

## Lane D — optional bend-position experiment, separate candidate

Branch suggestion: `experiment/bend-stations`. Proposed opt-in flag:
`?experiment=bend-stations`. Default production interaction remains unchanged.
If the coordinator must reduce parallelism, A and B have priority over C and D.

The solver already accepts a legal rest-arc station. Prototype one visible bend
bead with an accessible **Lower / Middle / Upper** selector on the selected
branch. Start with fractions `.32 / .54 / .76` as experimental values. This is
not three simultaneous handles and not a continuously sliding point during a
bend. Keep ordinary branch and organ grabs as Aim.

Use existing legal-station clamping. On short or heavily pruned stock, collapse
duplicate or ineffective choices instead of showing misleading controls. Keep
the selected station consistent between the rendered bead and the acquisition
snapshot. Reset to Middle on branch selection changes initially; the choice is
temporary UI state and must not require a save-field migration.

Changing station during a live edit is an interrupt: cancel the edit through
the existing path before moving the bead. Freeze the chosen material distance
for every acquired gesture. Handle prune, reset, Garden transitions and selection
changes without leaving a stale bead. Committed graph geometry already stores
the resulting curve.

This is the sole bounded exception to the shared-UI freeze: Lane D may add the
flag, station selection state, controls and presentation/acquisition wiring,
with focused tests. Do not change the bend solver, gain, caps, branch stiffness,
rest lengths, material-frame transport laws, transaction laws or persistence.
Do not alter `?bend=touch` semantics. If that variant is requested, leave
bend-stations off and report the exclusion; do not silently combine experiments.
Apply this exclusion to URL startup, debug controls and test-bridge resets.
Switching to touch cancels first and hides/disables the station controls before
entering the existing touch behavior. Do not mix new experiment measurements
into the existing fixed-versus-touch study as ordinary
fixed-bead observations; exclude that recording explicitly and document it.
Suppress new experiment recordings without clearing old study data or skipping
transaction completion, cancellation or committed saves.

Compare the current midpoint with a lower bend followed by a modest opposite
upper bend on leafy and reed material, then a woody reference. Demonstrate one
additional readable curvature change, not merely more total deflection. Test
the trailer separately without promising that every material produces the same
curve. Keep physical claims modest: stiffness currently bounds each gesture,
and repeated edits can accumulate. This is not a fracture or springback model.

Acceptance: immutable-snapshot previews; exact cancellation with no save or
ordinal advance; preserved segment lengths, attachments, frame-transport laws,
inactive history and old fixtures; ordinary release/reload; Garden Keep/View/Copy/Compare;
and no abrupt change when beginning another bend at a different station.
Test interruption before a station switch and after a prune.

Return this as its own draft PR and playable build. Do not cherry-pick it into
the materials integration. A phone comparison must establish that choosing the
bend position is clear and that the controls do not crowd stem acquisition
before we consider making it the default.

## Evidence for A/B/C and final material integration

1. `npm ci` and `npm run verify`; unchanged baseline goldens and all old tests.
2. Fixed seeds `8278 / 9255 / 10232`; count 1, mixed 6, and count 12 stress cases.
   Identify the profile, seed, count, viewport, browser and exact head for each.
3. Front / three-quarter / Above, plus a narrow portrait and short landscape
   Materials-picker view. Report any inability to render rather than reusing
   screenshots from another head or claiming a phone test from emulation.
4. Insert, Aim, Bend, prune-preview cancel, committed prune and reload. Check
   small visible leaf/petal tips and exposed flower groups, not just stem bases.
5. Keep an arrangement in Garden; View, Copy, Change and Reload. The kept
   original must remain unchanged. Comparison stays transient.
6. One useful cut and one same-bowl substitution comparison per candidate.
   Include canonical snapshots/backups so the composition can be reproduced.
7. Renderer calls, triangles and resource counts against the same baseline and
   viewport. Report interaction/frame timing where available with the device
   identified. Treat counts as evidence, not a phone-performance verdict.
   No candidate gets a free pass because flower-volume is already expensive.

One independent reviewer checks the actual final integration head and the
separate D head if present. If fixes advance a head, review the changed diff and
name the new tip; a review of an earlier tip is not a review of the final one.
Use one bounded correction pass for concrete failures, then package the result.
Do not expand scope to spend remaining model usage.

## Return and stop

Return a short table: lane, actual model, base, branch, exact head, PR, status,
automated evidence, browser evidence, physical-phone evidence and verdict.
Use statuses such as running, queued, review-ready, blocked or complete; name
the dependency when waiting. The final summary should describe current state,
not an earlier 'holding for tips' message.

Deliver one combined materials draft, the separate shaping draft if completed,
an independent review, and the reproducible composition examples. Classify
findings as correctness bugs, missing evidence, or taste. Recommend accept,
revise or retain-as-study for each candidate, with one concrete reason.

**Do not merge or deploy. Stop for Charlie/Astra review.** Leave all candidate
branches recoverable. Broad-blade deformation, grass plumes, seed/pod material,
jointed canes, vessels, curriculum and progression remain future choices.
