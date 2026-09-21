# Candidate review

- Candidate / role: Candidate B — one clear flower face / independent reviewer (Agent C)
- Baseline SHA / head SHA / branch: `251a94a1b176fb5f32cdbabfaed009deb92c7f57` / `98e71cb075d2dc5f40e1494a2e0c46e0d73d4605` / `cursor/experiment-material-single-flower-v1-bd04`
- Author / independent reviewer: Agent B implementation; Agent C review
- New compositional choice: One cream open-face bloom on a slender stem, offset on a pedicel, with two modest leaves. From Above the five-petal face is a clear disk that can face toward or away from another line. It does not disappear into the flowering branch’s pink cups.
- Main weakness: Shared tray CSS (`auto-fit`) and a parameterized bloom path in `ThreeStudio.ts` leave the two-reference layout and shared renderer. Physical-phone acquisition of the large face vs thin stem is unknown.

## Implementation

- Generator version / material ID: `single-flower-v1` / `single-flower`
- Topology and attachment decisions: 14-segment slender `trunk` (~5.3, radius 0.034), two petioles + elliptic leaves, one pedicel near 93% with a single terminal bloom. Pedicel/petioles are not bend-handle targets. Cut through the pedicel deactivates the bloom; a stem cut below deactivates the stalk as history.
- Appearance changes: Additive `open-face` bloom form (five shallower petals, local +Z on the supporting frame). Flowering `cupped` seven-petal helper remains. Cream `0xf0d2ae`. Bloom `hitRadius` 0.7 vs flowering 0.46, stored on appearance.
- Response values and rationale: stem 0.46 (between leafy 0.39 and flowering trunk 0.72); stalks 0.18. Shared solver only.
- Shared files changed and why:
  - `materialCatalog.ts` / `materialResponse.ts` / new `singleFlower.ts`: additive
  - `botanicalGeometry.ts`: `BloomForm`, `createOpenFacePetalGeometry`, `createBloomPetalGeometry`, `createCalyxGeometry(seed, form)`
  - `ThreeStudio.ts`: appearance-driven petal count, calyx form, center/anther scale, `hitRadius` from appearance. No `generatorVersion` conditionals.
  - `materialAppearance.ts`: flowering bloom now explicit `{ form: "cupped", hitRadius: 0.46 }`
  - `src/styles.css`: tray `repeat(auto-fit, minmax(8.75rem, 1fr))` instead of `repeat(2, minmax(0, 1fr))`
  - `index.html`: one tray card
- Requested interface extensions (or none): none for craft verbs. Tray CSS should move to an integrator branch. A later phone pass may ask for a bloom hit-center offset; that is a proposal, not a new tool.

Cupped calyx: Candidate B’s default/cupped path uses 7 sepals and the same per-sepal formulas as baseline `createCalyxGeometry`. No `one-branch-v1` fixture or generator edit.

## Evidence

| Check | Result (pass / fail / not run) | Reproduction or artifact |
| --- | --- | --- |
| npm ci + npm run verify | pass (Agent C, worktree at head) | 119 tests, 0 fail; typecheck; build; dist valid |
| Existing golden fixtures unchanged | pass | SHA-256 match baseline flowering and leafy fixtures |
| Seeds 8278 / 9255 / 10232 | pass | `tests/core/singleFlower.test.ts`; `fixtures/plant-1-single-flower-v1.json` |
| Aim / bend preserve stock and attachments | pass (automated) | rest lengths unchanged after bend |
| Exact prune and retained history | pass (automated) | pedicel cut removes bloom; stem cut retains inactive records |
| Cancel / invalid insert preserve ordinal and save | pass (automated) | `tests/app/materialInsertion.test.ts` |
| Reload after a committed edit | not run in browser | automated load exists for mixed materials |
| Garden original survives edited copy | not run in browser with this material | existing Garden tests still pass; no candidate-specific keep/copy test equivalent to A’s |
| Front / ¾ / Above | pass (desktop Chrome, workbench 8278×1) | `reports/agent-c-round-1/B_count1_*.png` |
| Mixed reference scene | pass (desktop) | cream faces remain visible in mixed 6 and 12 |
| Narrow portrait / short landscape / large text | pass with caveats (320px stacks to one column) / not run (large text, short landscape) | `B_tray_320.png` |
| Physical phone | not run | no device |

## Rendering comparison

- Browser/device/OS/viewport/pixel ratio: Google Chrome, Linux; desktop ~1280×800; 320×640 for tray; SwiftShader WebGL
- Graph at seed 8278: count 1 = 4 branches / 3 organs; count 6 = 24 / 18; count 12 = 48 / 36. Mixed 6 cycles flowering, leafy, single-flower.
- Report files: Agent B graph inventory on the candidate branch. Agent C did not download WebGL `renderer.calls` for this head.
- Desktop tray: three equal columns (~216px) plus a 0px auto-fit leftover track. Not a visual hole in screenshots, but the extra track is a CSS quirk.
- Observed stalls: mixed 12 loaded without a crash. No frame-time measurement.
- Missing: matched draw-call reports; phone; live aim/bend pointer path.

## Independent findings

1. **Medium — shared tray CSS changes two-card layout law.**
   - Steps: compare `.material-tray` at 320×640 on this branch vs baseline `repeat(2, minmax(0, 1fr))`.
   - Expected per briefs: if a shared change is necessary, stop and explain to the coordinator; do not land it inside the material prototype.
   - Observed: `auto-fit` stacks three full-width cards (readable). The same rule would stack a two-reference tray once the tray is narrower than ~2×8.75rem. Baseline would have kept two skinny columns.
   - Scope: revert CSS from this PR; handle tray on an integration branch.

2. **Low — bloom assembly lives in `ThreeStudio.createOrganVisual` rather than an isolated bloom builder.**
   - Steps: read the `organ.kind === "bloom"` block. Form switches petal count, calyx, center scale, anther ring, hit radius.
   - Expected: “If it needs a new organ renderer, isolate that function; do not scatter version conditionals throughout ThreeStudio.” This uses `appearance.bloom.form`, not `generatorVersion`.
   - Observed: no version conditionals; flowering cupped numbers are preserved behind the non-open-face branch. Still a shared renderer edit.
   - Scope: optional extraction on integrate. Not a behavioral-contract break on current evidence.

3. **Observation — larger bloom hit proxy (`hitRadius` 0.7).**
   - Tests assert open-face vertices stay inside the proxy. A larger sphere can win more mixed-scene hits. Not reproduced as a mis-acquisition. Phone must decide whether that is help or theft.

4. **Gap — Garden Keep → View → Copy → Change → Reload not browser-run with this material.**
   - Automated Garden suite still passes. Add a keep/copy isolation test like Candidate A, then a browser clip.

5. **Gap — no physical-phone or live pointer craft path.**

## Recommendation

**Revise**, then consider integrate. The face is a real compositional addition: one bloom, a facing direction, readable beside both references, especially from Above. Smallest next pass: move tray CSS out of this branch; add Garden copy isolation coverage; phone clip of insert → aim the stem (face turns) → bend → cut below the bloom → cancel → commit → reload. Keep species-likeness work separate.
