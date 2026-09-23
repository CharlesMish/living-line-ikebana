# Bend stations review

- Candidate / role: Round 4 Lane D, optional bend-position experiment (`bend-stations`)
- Baseline SHA: `59e42e6554b05ff2fc415514370430716e9e8515` (merged PR #33)
- Experiment commit: `e7dea13c4037c022b45ffdcf67d6cdea778a4877`
- Branch: `cursor/bend-stations-220e`
- Contract: preserved. The default bead remains `0.54` of active rest arc. This flag does not revise the solver, gain, caps, stiffness, rest lengths, frame transport, transactions, persistence, or `?bend=touch`.

## Model

- Requested: Grok 4.7 with high thinking (`reasoning_effort: high`). Do not substitute Luna.
- Exposed run identity: `originalModelName` `grok-4.7` on cloud run `bc-a659a273-c184-5b01-822f-6d2d394a220e`.
- The session instructions identify the model as Grok 4.7. No thinking-budget or `reasoning_effort` field is exposed on the run record or as a controllable parameter. Luna was not substituted.

## What the flag does

`?experiment=bend-stations` is off unless that exact parameter is present.

While it is on, the selected eligible branch shows one pale bead and a Lower / Middle / Upper control. The experimental fractions are `0.32`, `0.54`, and `0.76`. Each fraction goes through the existing `bendStationAtFraction` / `legalBendStation` clamp. The chosen distance is frozen in the acquisition snapshot and is the same distance the idle bead renders.

Ordinary branch and organ grabs stay Aim. There is one bead, not three handles, and the station does not slide during a bend.

The choice is temporary UI state. It resets to Middle when the selected branch changes. It is not written into the save.

Changing station during a live edit cancels through the existing interrupt before the bead moves. Repeating the current effective station does not cancel.

On short or heavily clamped stock, fractions that land on the same rest-arc distance collapse into one control. If fewer than two distinct stations remain, the selector hides and the single legal bead stays. Petioles, pedicels, and other ineligible records still produce no bead.

## Touch exclusion

`?bend=touch` is unchanged. If the experiment flag and touch are both requested, bend stations stay off. The page reports: "Bend stations stay off while touch bend is active."

The same exclusion applies when Testing tools switch to Where touched, and when `resetForTest` sets `bendVariant: "touch"`. The switch cancels first, hides the station controls, then enters the existing touch path. Returning to the fixed bead can show the stations again, because the request is remembered only in the session and the URL, not in the graph.

## Study recording

Bend-stations acquisitions are not appended to the fixed-versus-touch study and are not labeled as ordinary fixed-bead observations. Existing study data is left in place. `instrumentVersion` is not bumped. Transaction completion, cancellation, and committed graph saves still run. A session where the flag was requested but touch excluded it keeps recording on the touch arm.

## Comparison, seed 8278

A modest lower bend (`+0.45` across the station) followed by a modest opposite upper bend (`-0.45`) was compared with a stronger single midpoint bend (`+0.9`). Local signed turning, not tip deflection, is the measure. On leafy, reed, and the bare woody trunk, the pair changes curvature in opposite directions along the stem, while the stronger midpoint bend stays one sign and has a larger peak turn. The pair is not "more bend." Stiffness still caps each gesture. Repeated edits can accumulate. This is not fracture or springback.

The arching trailer was run separately with the same offsets. Stock length and attachments held, and the curve did move, but seed 8278 did not show that opposite-sign split. The trailer already carries an authored arch. This pass does not claim every material produces the same added curve.

Browser commits, headless Chrome 148, SwiftShader, 1400×900, `?experiment=bend-stations&fresh=1&test=1`:

| Material | Lower distance | Upper distance | Ordinal after both bends |
| --- | --- | --- | --- |
| Leafy shoot | 1.499 | 3.561 | 1 |
| Reed | 1.495 | 3.550 | 1 |
| Bare branch | 1.775 | 4.216 | 1 |
| Arching trailer | 0.965 | 2.292 | 1 |

Each bend changed the canonical hash and wrote a committed save. The study buckets did not grow during these sessions (bead stayed at 1 from an earlier non-experiment insert in that browser profile; touch stayed at 0).

Visually, the reed and bare branch showed a readable change of direction after the opposite upper bend. The leafy result was a gentler redistribution of the same kind. The trailer deepened its existing arch instead of turning back on itself.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| `npm ci` + `npm run verify` | pass | Run on the tree committed as `e7dea13`. 193 tests, typecheck, production build, dist validation |
| Baseline test count | ~182 at `59e42e6` | This branch adds 11 focused tests |
| Default interaction without the flag | pass | Seated leafy shoot keeps the selector hidden. Bead path remains the 54% station |
| Lower / Middle / Upper | pass | Browser: hidden before a branch is selected; Middle after seating; Lower and Upper move the one bead; canonical hash unchanged until a bend is released |
| Touch exclusion | pass | `?experiment=bend-stations&bend=touch` shows the exclusion note, hides the selector, and reports touch bend |
| Immutable preview, cancel, no ordinal advance | pass | Coordinator tests: preview diverges, document stays, interrupt writes no save, ordinal stays |
| No jump when a later bend starts at another station | pass | Target at the new station point leaves the committed points in place |
| Prune, then station interrupt | pass | Leafy prune keeps branch and organ records, shortens stock, then a live bend cancels back to the pruned graph with no second save |
| Study exclusion | pass | `recordsFixedTouchStudy("on")` is false. Browser bends did not append |
| Golden fixtures / solver | pass | Existing fixture and shaping tests unchanged and passing. Solver files were not edited |
| Garden Keep / View / Copy / Compare | pass in `npm test` | Existing garden tests. This branch only clears the temporary station when selection is cleared. No separate browser Garden walkthrough |
| Physical phone, clarity versus stem crowding | not run | No device. The selector sits in the craft row so it does not add handles on the stem. That is not a phone observation |

## Phone

Not run. Desktop headless Chrome cannot stand in for acquisition feel, Safari cancellation, or whether Lower / Middle / Upper crowds the stem.

## Recommendation

Keep this as an opt-in experiment. Do not merge it into the materials integration, and do not treat its sessions as fixed-bead study data. The smallest next pass, if any, is a physical-phone check of whether the craft-row selector is clearer than it is busy, on leafy and reed, with touch bend left off.
