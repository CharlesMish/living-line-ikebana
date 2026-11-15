# Invitations — a first structured loop

Invitations are the first part of the game with a shape. Someone asks for an
arrangement for a real place. You get a vessel and a small kit. You arrange the
bowl, choose the view they will see, and deliver it. They send a short note
about how it went. The next request then opens. There is no score.

This builds the loop that earlier reviews kept proposing
([Review synthesis](REVIEW_SYNTHESIS.md), [Bend and vessel pass](BEND_VESSEL_PASS.md),
[Direction](development/DIRECTION.md)). The "Across the table" study was already
a rough version of it. Open play is unchanged whenever no invitation is in
progress.

## Play it

1. **Studio → Invitations.** The first request is open. Later ones say which
   request they follow.
2. **Begin.** This starts a fresh bowl in the invitation's vessel. If your
   working bowl has material, the Garden's usual choice appears first: Keep it,
   Replace without keeping, or Cancel.
3. The tray becomes the **Kit**. The menu shows only kit cuttings, each with what
   is left, and the source card shows the count too. Every craft verb works as
   usual.
4. Step Back and choose the view the host will see.
5. **Studio → Invitations → Deliver this bowl.** This keeps the bowl and that
   view in your Garden as an ordinary moment. Then the host's note appears.
   Other answers to the same request, if there are any, are offered after you
   have made your own.
6. **Set aside** ends the invitation without delivering. The bowl stays, and
   every material comes back.

## The kit rule

A kit says how many of each cutting you were given.

- A cutting in the bowl uses one.
- A cutting that has been **cut and then removed** stays used. It went to the
  compost.
- Removing an **uncut** cutting puts it back in the kit.
- Undo can return a removed cutting to the bowl. It is then counted where it
  is, never twice.

"Cut" means anything pruning removed: a branch, a leaf or flower, or the tip of
a stem. Pruning truncates rest lengths, so a shortened stem is detected by
regenerating the same identity's stock (generators are deterministic by id and
seed). The kit is enforced where every insertion is prepared, so pointer drag,
tap-to-place and keyboard activation are all covered. The tray display only
mirrors it.

## Notes, not grades

Each invitation reads **one practical fact** about the delivered bowl. That fact
picks one of several notes. Every note is a valid outcome with its own
consequence, for example "we moved it to the sideboard, and people kept getting
up to look at it". The facts concern the setting, never beauty:

| Measure | Meaning | Used by |
| --- | --- | --- |
| `height` | Highest stem point above the surface the vessel stands on | Across the table |
| `depth` | Farthest reach in front of or behind the vessel's centre, along the delivered view | Above the sink |
| `lean` | Mean sideways position of all stem length in the delivered view. Negative is the viewer's left | Coming home |

Measurements follow committed stem centrelines (`src/loop/observe.ts`). Leaf
and petal surfaces add a little. Units are scene units: the original bowl is
5.28 across and 0.65 tall, and the Compact bowl is about 4.2 across. `depth`
and `lean` depend on the view you deliver from. Looking straight down, screen-up
stands in for "away from the viewer". This makes choosing the view part of the
answer.

Earlier reviews declined meters, percentages and pass/fail targets. Invitations
keep to that. Nothing is shown during arranging. The note names a consequence,
not a number, and tests reject notes that use grading words.

## Authoring invitations

Invitations are data in `src/loop/invitations.json`, so tuning them does not
need code. Each has an `id`, `title`, `from`, `brief`, a vessel `layoutId`, an
optional `opensAfter`, a `kit` of one to eight materials (counts 1–6), and a
`reading` with a `measure` and two or more ordered `bands`. Only the last band
is open-ended. `parseInvitations` fails closed on unknown materials or layouts,
repeated kit items, unordered bounds and dangling `opensAfter`. Tests check the
authored file against the material catalog and the vessel registry.

To calibrate a band, arrange the bowl you have in mind in `?test=1`. Then run
the same `observeArrangement` that delivery uses. The guest-answer test does
exactly this for each guest answer.

## Guest answers

A guest arrangement can name the invitation it answers
(`invitationId` in `src/app/guestArrangements.ts`). The test
`guest answers to an invitation keep to its vessel and kit` checks that the
answer uses the invitation's layout and stays within its kit. The first
answer is Opus 5.5's "Room to Talk" (`artifacts/guest-opus/`).

Briefing another model for a guest answer works better than an open request.
Give it one invitation and ask it to Begin it in the app, stay inside the kit,
deliver from the view it chooses, then Photograph and Keep. That gives a fair
comparison between models: same request, same kit, same vessel.

## Storage

Progress is stored at `<Garden key>:invitations-v1`, next to the Garden but
separate from it. It holds the active invitation, with its spent cuttings, and
the list of deliveries. Each delivery records the Garden entry id, the note
chosen and the measurements. It is validated by an explicit allowlist and
bounded to 96 deliveries. It fails closed: unreadable progress stays
untouched, and the dialog says invitations are unavailable. Garden entries and
backups gain no new fields, so older builds and existing backups are
unaffected. Replacing the working bowl by any other command (a fresh bowl, a
working copy, a guest copy) sets the invitation aside.

## Why the loop comes before more stems

- The loop decides which stems matter. A kit makes each cutting's job visible.
  You will notice which ones you never want in a kit, and which role is missing.
- Stem work is additive (new generator versions), so it can land at any time
  without breaking saves or the loop.
- New models can now be given a concrete brief: answer this invitation with
  this kit. An open "make something" has no shared measure.

## Not built yet

- **Progression beyond the next request.** Delivering opens the next
  invitation. It does not unlock studio materials, vessels or backdrops, because
  locking open play would take away existing content. Seasons of requests that
  each introduce a few materials are the natural next step.
- **A daily kit** chosen from the date, for replay.
- **Delivering through Photograph.** Delivery is a Keep of the current view.
  The Photograph can follow as its own Keep.
- **Threshold calibration on phones,** and whether the kit's refund on Remove
  undercuts pruning.
- The three looking studies in the Guide remain. "Across the table" now exists
  as both a study and an invitation, and one of them should eventually go.

## Evidence

Automated: `tests/loop/invitations.test.ts` covers data validation, the kit
rule (in the bowl, cut and removed, uncut refund, undo, no double count),
measurements and view dependence, note selection, progress round trips,
fail-closed storage and guest-answer kit compliance. The existing UI stub
tests confirm the open palette is untouched without a kit.

Headless Chrome (software WebGL, not a phone): begin, kit display, the kit rule
across reload, delivery, the host's note, the next request opening, and
opening a guest answer, at 1280 × 800 and at 390 × 844 with touch. No
physical-phone observation has been made.
