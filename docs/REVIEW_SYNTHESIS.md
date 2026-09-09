# Review synthesis: studies, stopping, and the Garden

September 8, 2026. Assessed against the two-material source at `9d0bd8b` and the
attached Zealot, Prophet and Oracle responses. The second packet repeats Prophet;
that repetition is not independent corroboration. Recommendations below are
product judgments, not claims that a playtest has proved a loop.

## What this pass implements

Three optional studies in the guide: **Line and water**, **Two voices**, and
**Before one more cut**. The last explicitly permits leaving the material alone.
**Stop and look** closes the guide and enters Step Back without resetting the
player's framing. It rolls back any unfinished gesture; it does not turn a pointer
preview into a finished arrangement. Arrange remains available immediately.

Open play, both materials, all tools, existing autosave and the current graph
schema remain available unchanged. There is no completion score, new specimen,
archive, unlock, undo or Garden yet. This deliberately tests the smallest useful
part of the proposed loop before adding a collection lifecycle.

## Claim-by-claim decisions

| Review advice or claim | Assessment | Decision |
| --- | --- | --- |
| Zealot: make a decision readable, then stop | Strong design hypothesis; current editing has no explicit invitation to stop | Implement the pause and reflective prompts now |
| All: small studies can structure play | Worth trying with existing verbs | Three optional prompts now; no mandatory order |
| Zealot: teach one verb at a time | Useful onboarding direction, not evidence that locked tools help this audience | Keep concise verb help; defer progressive disclosure until phone observations |
| Zealot: first ten Sogetsu lessons reduce to four ideas; line then mass then color | The official summaries do not establish that exact sequence | Do not present it as verified pedagogy; see sources below |
| All: required angle, water visibility, view visits, or pruning checks | Technically possible, but these become completion rules even without stars | Decline for now; ask questions the player can answer rather than hidden pass/fail |
| Oracle: 40% visible kenzan means openness | Pins and water are different visual regions; percentage is an arbitrary aesthetic proxy | Do not implement |
| Prophet: show an inert bend point before unlocking bend | Can teach a control that currently does nothing, undermining reliable handles | Decline |
| Zealot: quiet failure when two tips agree | Parallel directions can be an intentional choice; a silent failure is poor feedback | Decline |
| Zealot: limited undo in one lesson | Changes the established permanent-cut contract and adds another lifecycle | Defer until there is an explicit recovery design; preview/cancel remains available |
| Oracle: Garden of kept arrangements | Strong candidate for a reason to return and a meaningful end to a session | Preferred next loop feature; not implemented in this pass |
| Oracle: unlock by arrangement count, first prune, or three stems | Rewards action counts, including unnecessary cutting; a tall vessel is not just a prize skin | Decline these gates; favor chosen studies and fresh material opportunities |
| All: commit/freeze is pottery's firing moment | Pointer release already means committing one edit, not finishing a work | Keep edit commit, chosen pause and future Keep as distinct actions |
| Zealot: the flowering reference is too finished | Plausible for a beginner study, but the full branch is useful for subtraction | Future simpler cutting should be additive; do not rewrite `one-branch-v1` |
| Zealot: leafy leaves need curved form, midribs and attached facing | Already present: curved/creased meshes, midribs and transported frames; visual legibility may still improve | No corrective rewrite based on an inaccurate implementation diagnosis |
| Prophet: bloom/leaf facing must inherit aim | Already implemented through attachment frames and saved spin | No change |
| Zealot/Prophet: cut faces or retained stubs are missing | Branch surfaces already have end caps; prune retains the proximal branch and inactive history | No change; cap visibility can still be assessed visually |
| Zealot: taper would improve stems | Reasonable visual refinement; taper cannot depend on shortened active length without resizing existing stock | Defer a stable stock-coordinate taper design |
| Prophet: fewer leaves while sharing topology | Removing generated organs changes structure, not only appearance | New generator/version if pursued |
| Oracle: more seeded variation in existing generators | Useful future art direction, but changing existing version output breaks reproducibility | Additive generation version only; do not reroll old identities |
| Prophet: common attachment helper and structure/look/bend split | Already substantially present in `ThreeStudio`, material appearance, generators and response tables | Extend demonstrated seams; no speculative new descriptor |
| Prophet: seat radius, prune floor and bend envelope per material | Possible future policies, not requirements established by the two references; seat area also depends on fixing/vessel | Defer until a specific candidate needs them |
| All: bare twig is a low-friction addition | Fits existing branches, rendering and solver; identity, silhouette and touch still need testing | Preferred first external candidate after this interaction pass |
| Willow is just low stiffness | A flowing reference is feasible, but authored bend range is not elasticity, gravity or fracture | Possible later candidate; no realism claim |
| Single large flower is mainly an appearance problem | Largely correct; existing bloom kind can support another appearance without a new graph kind | Useful second candidate after bare twig |
| Pine, broad blade, reeds or clumps are cheap stem packs | Varying degrees of new geometry, deformation, hit arbitration and fixing; line-count estimates are unreliable | Defer; do not disguise a rigid card as a deforming blade |
| Bamboo should bend at nodes | This is a new material response policy, not a color/shape variant | Defer explicit solver design and tests |
| Tall vase, vines, wiring and living time are new scope | Correct: insertion/fixing or verbs/lifecycle change | Keep outside the current material brief |
| Port after exactly 4–6 stems; native work is line-for-line; web is 10–50× faster | Unsupported thresholds/effort claims; a port needs input, rendering and lifecycle validation | Defer platform choice; existing pure core is already a useful boundary |

## Cultural sources and their limits

Sogetsu's official [Textbook 1–2 description](https://www.sogetsu.or.jp/e/order/textbooks/C1140/)
identifies basic Kakei-ho followed by variation styles, with twenty lessons in
each curriculum. It does not provide the first ten lesson contents. The official
[Textbook 3–4 description](https://www.sogetsu.or.jp/e/order/textbooks/C1230/)
identifies composition through line, color and mass, followed by material and
space, and describes moving beyond Kakei-ho into free arrangement. These are
useful concrete reading anchors; they do not authenticate our three prompts as
Sogetsu lessons or establish a universal school sequence.

Before writing named school lessons, consult the actual selected text and a
qualified practitioner about that school. Record the exact source/section, the
observation being taught, what the game omits, and an original prompt. Keep
school-specific names and proportions scoped to that source. Do not blend
shin/soe/tai and other schools' roles into universal mandatory graph slots.
The game may invite an exploratory attitude while its workbench stays a shallow
bowl with kenzan. It need not claim to teach an entire tradition.

## Loose preferred direction

**Choose an observation → arrange → stop and look → choose to keep → return for
another study or occasion.** The first three now have a modest playable form.
Keep and the return loop are proposals, not delivered features.

I would combine Zealot's attention to decisions with Oracle's Garden. The Garden
should first be a small personal collection, not a second simulated world. Keep
should capture an immutable committed arrangement and chosen view, give it a
thumbnail and optional title, and offer an explicit fresh bowl. Returning to a
kept work should be view-only or explicitly make a working copy, leaving the
original intact. No forced seasonal rearrangement, decay, compulsory sale or
reward for cutting is needed to prove its value.

That requires a separately versioned collection store, graph validation, bounded
storage and quota behavior, and tests covering cancelled gestures, reload,
copy/resume and identity allocation. Existing studio autosave is not an archive.
Those are the reasons to implement Garden as a focused follow-up rather than
silently treating Stop as Keep today.

After that, try a few invitations from people or places: a low arrangement for a
shared table, a line that greets someone from a doorway, a quiet gift. Their
constraints can concern a setting or material budget; the player decides how to
respond. Unlocking new opportunities can create progression without pretending
we can compute artistic correctness. We can test a commission economy later if
the collection alone lacks motivation.

For material expansion, favor a small set with distinct compositional jobs:
branching line, leafy mass, bare structure, and one focal flower. Bare twig is my
next bounded Grok brief. Broad blades, needles, clumps and alternative vessels
should wait for their particular rendering or interaction needs. Provide both
current references, fixed seeds, extension points, and bend/cut/cancel/reload
checks; do not ask an external prototype to redesign cameras or persistence.

## Validation and next observations

Automated gates: `npm ci`, `npm run verify`, and `git diff --check`. Added app
checks cover stopping during a plant edit/insertion and during camera movement,
no stale-release commit, no save/ordinal advance, preservation of released
framing, and returning to Arrange.

No new browser-rendered or physical-phone sign-off is claimed. Check guide
scrolling and focus on a short viewport, and whether the pause feels useful
rather than ceremonial. Ask a player why they stopped and whether the prompts
helped them see something. Those observations will be more useful than counting
cuts or successful view visits.
