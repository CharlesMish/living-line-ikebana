# Grok Bot — directed material expansion

**Historical first dispatch.** For the next round after the seven-material
palette and PR #33, use [GROK_BOT_ROUND4.md](GROK_BOT_ROUND4.md). Do not repeat
the bare-branch/single-flower assignments below.

Copy the prompt below to the orchestrating bot. Supply the exact baseline commit
from the Garden/workbench handoff. If this PR is not merged, use its branch and
commit, not an older `main`. Verify the supplied SHA exists before starting agents.

---

You are coordinating a bounded development round for **Living Line**, repository
`CharlesMish/living-line-ikebana`. Use the baseline SHA supplied with this prompt.
Record it in your final report. Use the user's available Cursor Grok model with
high thinking where supported. Do not depend on an unreleased model or silently
substitute a different provider. Ask only if the configured model is unavailable.

The goal is two useful material candidates, tested against the two existing
references, with evidence Astra and Charlie can review. You own coordination and
scope, not a wholesale redesign. Favor completing a coherent candidate over
spawning large numbers of overlapping variants.

## Before dispatch

1. Fetch the agreed baseline. Read AGENTS.md, ARCHITECTURE.md,
   docs/BEHAVIORAL_CONTRACT.md, docs/GARDEN.md, docs/MATERIAL_REFERENCES.md, and all
   files in docs/development/. Run `npm ci` and `npm run verify` once.
2. Confirm Garden and `?workbench=1` are present. Exercise the Garden smoke path
   in GARDEN.md if a browser is available. Record baseline failures separately.
   Storage loss or broken transaction ownership blocks integration; investigate
   it on a separate fix branch, not inside a material generator.
3. Create one isolated worktree/branch per implementation agent, all from the
   exact baseline. Do not share a writable checkout between agents.

## Dispatch

- **Agent A: bare woody line.** Implement Candidate A in MATERIAL_BRIEFS.md.
- **Agent B: single flower face.** Implement Candidate B in MATERIAL_BRIEFS.md.
- **Agent C: independent review/testing.** First examine the baseline's Garden and
  workbench transitions, then review each candidate's actual diff and evidence.
  Reproduce concrete failures. Keep proposed fixes in a separate branch. Never
  infer phone feel from unit-test success.
- **Optional Agent D: lesson research, documentation only.** Prepare a concise
  source ledger for one introductory form and its possible small exercises. Use
  public primary teaching sources with exact URLs and distinguish direct evidence,
  inference and our own design. Explain which features are required and which are
  variants in the source. Flag access/permission gaps rather than inventing missing
  rules. No copied photographs, diagrams, lesson text or branded curriculum in the
  app. No implementation or grand curriculum this round.

A and B work independently; neither consumes the other's unfinished code. C may
review as candidates become ready. You alone reconcile shared registration and
appearance edits in a separate integration branch after reviewing both. Do not
merge or deploy to main without Charlie's authorization. Keep individual branches
available even if you also provide an integration preview.

## Protected foundation

No edits to shared transaction laws, cameras, cancellation, insertion ordinals,
existing generator output, golden fixtures, persistence fields, Garden semantics,
or interaction priorities. No new craft verbs. No scores, shop, progression gates
or gardening simulation. If a candidate needs one of these, document the blocker
and deliver the independent portion rather than working around the contract.

Candidate-local geometry, topology, art direction, response values, additive
registration and meaningful tests are yours to design within MATERIAL_BRIEFS.md.
Do not merely clone an existing material's silhouette and change its color.

## Evidence and stop conditions

Use WORKBENCH.md, fixed seeds 8278/9255/10232, both references, and counts 1/6/12.
Run `npm run verify` for each delivered branch. Provide current reports, exact
reproduction steps and honest visual/browser/phone coverage. Re-check Keep → View
→ Copy → Change → Reload with the candidate. A downloaded report is not a pass.

If an invariant fails, fix it within candidate scope or return a blocker. Do not
spend the round optimizing speculative future systems. After one complete revision
addressing concrete review findings, deliver what you have with remaining issues
rather than launching an unbounded review loop.

## Return package

- Base SHA and each branch/head SHA; PR/preview links if available.
- One completed REVIEW_TEMPLATE.md per candidate.
- Automated results separate from browser observations and physical-phone results.
- Before/after reports and short clips/screenshots where available.
- Files changed outside the suggested extension points, with justification.
- Independent review findings by severity and reproducible steps.
- Your recommendation: integrate, revise, or retain only as an idea, with the
  concrete compositional choice gained and the main remaining weakness.
- A concise next-turn note for Astra; do not claim the game direction is settled.

Do not include unrelated personal context, private workplace information, account
usage or model-release speculation in repository artifacts.
