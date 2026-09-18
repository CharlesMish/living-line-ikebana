# First external material candidates

These are bounded prototypes for comparison, not a commitment to ship both or a
request to expand the whole palette. Their purpose is to test whether external
agents can deliver distinct compositional choices within the shared craft model.
Start both from the same agreed commit. Each candidate lives on its own branch.

## Shared extension contract

Read AGENTS.md, ARCHITECTURE.md, docs/BEHAVIORAL_CONTRACT.md,
docs/MATERIAL_REFERENCES.md, and WORKBENCH.md. Inspect both reference generators,
not only their screenshots. Preserve the existing flowering golden fixture.

| Responsibility | Extension point | Constraint |
| --- | --- | --- |
| Structure | New `src/core/<candidate>.ts`; `generatorSupport.ts` helpers | `(id, seed, base)` → valid persistent graph; no DOM/Three/camera |
| Bend response | Add authored values in `materialResponse.ts` | Copy at generation; use shared solver; no per-frame response overrides |
| Registration | `materialCatalog.ts` | Add a durable version and material ID; keep old versions loadable |
| Look | `materialAppearance.ts`; narrowly scoped `botanicalGeometry.ts` additions if necessary | Stable seeded surfaces; no generator-specific interaction paths |
| Tray | One labeled card in `index.html` | Existing pointer/keyboard bindings; icons/text supplement color |
| Evidence | New focused tests and a fixture/report | Verify cut, bend, cancel, reload and unchanged references |

Keep material surface settings out of the graph generator. Keep botanical
attachments out of mesh-building shortcuts. A generic `trunk` can be green.
Use existing branch/organ kinds unless a written extension proposal demonstrates
why they cannot represent the candidate. If it needs a new organ renderer, isolate
that function; do not scatter version conditionals throughout ThreeStudio.

Do not touch transaction ownership, cancellation, camera/pan/orbit, insertion
ordinals, working/Garden schemas, persistence, hit-priority rules, `one-branch-v1`,
or the existing fixtures. No new verbs, scoring, unlocks, pruning undo or physics
simulation. If a shared change is necessary, stop that portion and explain it to
the coordinator; continue the independent work that is still valid.

## Candidate A — bare woody line

Suggested ID `bare-branch`, generator `bare-branch-v1`.

A sparse, asymmetrical woody branch with a readable primary line and a few useful
forks. It should offer choices between retaining an answering branch and revealing
empty space. It must not merely be the existing flowering graph with organs hidden.
Author different branching rhythm and stock taper, with sufficient segmentation
for broad bending and enough accessible basal stem to seat/slide it.

Aim for one main line, two or three subordinate forks, and restrained distal
branching. This is an art direction, not a rigid graph-count target. Begin with no
leaves or flowers. Avoid noisy microtwigs, procedural tangles, or adding fake
breakage to imply woody stiffness. Explain what bending feels different from the
flowering reference and what one useful cut reveals.

## Candidate B — one clear flower face

Suggested ID `single-flower`, generator `single-flower-v1`.

One legible terminal bloom on a distinct slender supporting stem, with a restrained
number of leaves/buds only if they improve the decisions. The flower should offer
a direction for the player to face toward or away from the principal line. It
should remain interesting beside the leafy reference rather than disappear into
the existing flowering branch's texture.

The bloom follows its real supporting material frame. It is never a billboard
facing the camera. A cut below it removes it through the normal distal graph plan.
Use the current aim/bend grammar; no separate rotate-flower tool. If the existing
surface vocabulary cannot make the face legible, propose one contained appearance
extension. Do not simulate a deformable broad leaf with a rigid card.

Choose an original generic flower design first. Do not imply a botanically exact
species simulation without reference evidence. Species likeness is optional;
readability, coherent attachment and distinct composition are required.

## Acceptance evidence for each candidate

1. `npm ci` and `npm run verify` pass; existing fixtures are unchanged.
2. Seeds 8278, 9255, 10232 produce stable valid graphs. Seed variation changes
   authored details coherently rather than independently rerolling during edits.
3. Use the workbench for count 1 and a mixed 6-cutting scene; inspect a 12-cutting
   stress case. Include reports, browser/device and viewport, and compare resource
   counts against the baseline under the same conditions.
4. Show insert → aim → bend → prune preview → cancel → committed prune → reload.
   Retain inactive cut history. Cancelled insertion consumes no ordinal.
5. Show Front, ¾, Above and at least one narrow-screen/short-window view. Include a
   clip if the environment supports it; otherwise record the missing evidence.
6. Make one arrangement with both references and the candidate. Keep it in Garden,
   open it, make a copy, change the copy, and verify the original remains unchanged.
7. Fill REVIEW_TEMPLATE.md. Call out a weak point and any requested shared extension.

Deliver a branch/draft PR, exact base/head SHAs, tests, reports and visuals. The
integration reviewer decides what to keep. A candidate that exposes a useful
limitation is still useful evidence; do not hide it with unrelated rewrites.
