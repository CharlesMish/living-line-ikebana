# Harvest from closed pull requests — October 2026

Twelve pull requests were closed without merging on October 21, 2026. Most were
superseded by work already on `main`. This page keeps what is still worth knowing
from them, so the PRs do not have to stay open to hold it. Every branch is
retained on GitHub; any PR can be reopened.

Still open and not covered here: #14 and #18 (moribana lesson source ledger),
#69 (two stored camera views), and #70, #71, #88, #89 (small phone and Garden copy
fixes to re-check against `main`).

## Ideas to carry forward

### Opening lines and occasions (#86, and #84 before it)

Campaigns 02 and 03 tested two ways to begin a bowl, behind flags, and adopted
neither as an opening screen. The copy is good seed material for requests. It
is collected here verbatim.

**Fixed opening lines** (#86, `src/app/beginLines.ts`). Each one seats plant-1
at seed 8278 with a fixed base, aim and bend:

| Id | Text | Material |
| --- | --- | --- |
| `lean-left` | A tall branch leaning left, with open space to the right. | Flowering branch |
| `reed-forward` | A low reed reaching forward. | Reed |
| `flower-back` | A single flower standing off to the back. | Single flower |
| `bare-arc` | A bare branch bent over the rim. | Bare branch |

**Occasions** (#86, `BEGIN_INVITATIONS`). Each can suggest a backdrop or perch:

| Id | Text | Suggested scene |
| --- | --- | --- |
| `windowsill` | A small arrangement for a narrow kitchen windowsill: low enough not to block the light. | Sage backdrop |
| `table` | For a table where two people will talk across it. ("Two at a table") | none |
| `autumn` | Late autumn: something that feels like the year thinning out. | Dusk backdrop |
| `entryway` | For an entryway: something to notice on the way out. | Stone perch |

**Material invitations** (#84, `src/app/invitations.ts`):

- Reed: "One straight reed. What would you leave around it?"
- Bare branch: "A bare branch, late in the year. Which way does it lean?"
- Arching trailer: "Something that falls instead of rises. Where does it land?"
- Fern frond: "A fern frond in early spring. How much of it will you show?"
- Berry twig: "A twig of berries. Is it the accent, or the whole story?"
- Flowering branch: "A branch in bloom. What does it need beside it?"

**Person and place invitations** (#84):

- For someone coming home late: something to see from the doorway.
- For a narrow kitchen windowsill.
- For a quiet corner where someone reads.
- For a friend who is starting something new.
- For a rainy afternoon, seen from a chair.
- For the first morning after a long trip.

Design lessons from those branches, worth keeping in a request system:

- A bowl that already has cuttings must offer Keep first / Replace / Cancel,
  never silently replace. #86 worked through every path, including Undo after
  a seeded start.
- After Keep, stopping should be the main choice and a further offer secondary.
- Which invitation a kept bowl answered needs a `gardenVersion` bump to
  remember. #84 flagged this and did not build it.
- A seeded opening line goes through the ordinary insert commit, so Undo and
  Remove work on it. Reuse `realizeBeginLine` on the #86 branch rather than
  writing a new path.

### Sparse cane and paired leaf (#62)

An independent candidate study added two generators outside the catalog:
`study-sol61-sparse-cane-v1`, a tall olive line with two short branchlets and five
narrow leaves, and `study-sol61-paired-leaf-v1`, a compact stem with four
opposite pairs of diminishing leaves. Campaign 01 (#81, #83) tried porting the
paired leaf and did not adopt it.

The study's own weaknesses still stand: the cane's long bare tip reads blunt, and
opposite pairs look diagrammatic from Front. If a jointed line is wanted later
(horsetail, bamboo), the cane generator on branch
`experiment/sol61-candidate-stems` is a reasonable start.

### Rolling a bloom's face (#27, #29)

#27 measured that Aim alone cannot face one bloom toward two cameras at once. Its
best sample was 18° and 26° from Front and Three-quarter. #29 added an opt-in
roll of the bloom's saved `spin` about its stalk, with no schema change.

Since then, #91 improved direct face tilt on Single flower and #92 added turning a
whole cutting. Neither is the same as rolling one bloom. If players complain that a
flower faces away, the #29 branch (`cursor/experiment-organ-roll-9e95`) is a small,
tested way to add that.

### Bend stations (#36, #48)

Lower / Middle / Upper bend positions landed on `main` as an opt-in in #53. The
lane D review (#48) found the arching trailer stays one sign: it can deepen its
arch but cannot reverse curve. That is one reason the trailer reads as a wire.

## Closed as superseded, nothing further to harvest

| PR | What it was | Superseded by |
| --- | --- | --- |
| #15 | Candidate A, bare branch v1 | Integrated in #19 |
| #16 | Candidate B, single flower v1 | Integrated in #19 |
| #17 | Round 1 review of #15 and #16 | #19 and #21 |
| #20 | Named workbench fixture profiles | Integrated in #19; see [fixture profiles](WORKBENCH_FIXTURE_PROFILES.md) |
| #21 | Round 2 review of the integration | #19 merged |
| #46 | Polish baseline stills and draw counts | #51 merged; numbers are out of date after #104 |
| #27 | Single-flower facing diagnosis | Notes above |
| #29 | Roll a bloom's face | Notes above |
| #36 | Bend stations, first version | #53 |
| #48 | Bend stations on the twelve-material tip | #53 |
| #62 | Sparse cane and paired leaf study | Notes above |
| #86 | Begin from a line, or for an occasion | Notes above |
