# Independent candidate-stem study

Requested model lane: **Sol6.1**. The task runtime identifies the agent as Codex/GPT-6 but does not expose an exact backend model identifier. This report does not independently certify that routing. No other candidate worker's output was read. This is diagnostic creative work, not a controlled capability benchmark.

Source: current main at clone time, **07ea79b299eb106a080472fadc4688cb86c059ae**. Branch: `experiment/sol61-candidate-stems`. Existing twelve tray entries, default generator choices, historical fixture profiles and saves remain intact. Two durable generator versions were added for validation/serialization only; they are absent from the normal material catalog. No production toolbar, overlap UI, CSS or gesture solver changes.

## Candidate comparison

| Candidate | Intent and practical use | Comparison | Weakness |
| --- | --- | --- | --- |
| Sparse cane (`study-sol61-sparse-cane-v1`) | Tall quiet olive line with two short ascending branchlets and five narrow leaves; 8 branch records. Shape a branchlet independently or cut its leaf-bearing span to leave a deliberate interval. Clear basal half keeps seating and water legible. Cane stiffness 0.64; branchlets 0.40. | More articulated and selectively prunable than reed; much less busy than flowering/bare wood; higher, sparser leaf accents than leafy shoot. | Long exposed terminal cane can feel blunt; it has no bamboo node/sheath surface detail. Some small leaves turn edge-on in Angle. The upper line repeats across seeds because variation deliberately stays modest. |
| Paired leaf (`study-sol61-paired-leaf-v1`) | Compact sage cutting with four opposite pairs of diminishing elliptic leaves; 9 branch records. A measured lower counterweight beside tall lines. Cut one petiole to introduce asymmetry, or shorten the stem to remove distal pairs. Stem stiffness 0.44. | Lower and calmer than the longer alternating lanceolate leafy shoot; no fern divisions or foliage-fan arms. A repeating pair rhythm instead of a flower mass. | Opposite pairing reads almost diagrammatic from Front; rotated upper pairs partially disappear in Angle. Uses the existing elliptic leaf surface rather than a distinct round-leaf botanical surface. |

The same renderer uses identity-seeded folded/creased leaf surfaces and transported material frames. No organ-facing shortcut, topology-dependent appearance inference, or regenerated detail during edits. Each leaf is one organ on its own short petiole. Both cuttings have one coherent rooted graph and ordinary stock-length-preserving chains. These are generic botanical silhouettes, not named-species simulations.

## Visual inspection

Actual Chromium screenshots are in `artifacts/candidate-sol61/`. Pair seed inputs are 8278, 9255, 10232; the second cutting uses input + 977. Front and Back preserve the broad pair rhythm and sparse branchlet intervals. Angle reveals the upper paired leaves turning edge-on. Back is the Front camera reflected through Z, with the same target, distance and world scale. No material-specific camera fitting.

The mixed bowl includes the unchanged flowering generator at input + 1954, aimed once through the existing core operation. It deliberately shows a weakness: thick flowering wood can dominate and hide cane intervals. The candidates are secondary accents there, not a claimed finished composition. `bent-pair-*` and `opened-pair-*` document a bend and a three-leaf branchlet removal. The opened cane leaves a short branch stub; that retained material is intentional prune history, not an attachment gap.

Single-material screenshots include reed, leafy shoot and flowering branch at seed 8278. The independent demo also allows insertion of both original references, so a human can revise the comparison rather than judge thumbnails alone.

## Run and inspect

1. Use Node >=20.19 and run `npm ci` in this checkout, then `npm run dev -- --host 127.0.0.1 --port 5193`.
2. Open `http://127.0.0.1:5193/candidate-study.html`. This separate page has **no persistence or storage writes** and does not load the normal studio document. It is an in-memory diagnostic adapter, not production app integration.
3. Choose a cutting and seed, then Insert. Placement follows a small deterministic cycle inside the pin field; it is a diagnostic insertion button, not production tray-drag acceptance. Candidate pair/Mixed bowl are explicit fixture commands.
4. Aim by dragging a stem/leaf. Select the cane branchlet in the branch menu, use Bend and drag it. Bend uses the shared middle station; petioles remain ineligible. Escape, pointer cancellation, lost capture, resize, hidden page and context loss discard live previews. Ordinary owner release commits.
5. Select a leaf stalk, use the Cut preview slider, then Cancel or Apply cut. Or use Prune and drag material for a pointer preview. Undo restores the preceding bowl. Look hides edit decorations; inspect Front, Angle and Back before revising.
6. For an offline demo, run `node tools/build-candidate-study.mjs`, then open the generated standalone HTML in a WebGL-capable browser. No server or external assets are required.

Automated screenshot/interaction capture: with an available Playwright installation, run `node tools/candidate-study-qa.mjs`. Optionally set `PLAYWRIGHT_MODULE=/absolute/path/to/playwright` to reuse one. It launches a new browser/context and never attaches to existing browser tabs. It is optional tooling; no new dependency is added.

## Evidence and limits

- `npm ci` completed using an existing portable Node 22.23.3 runtime after system Node failed to start. No system/security changes.
- Typecheck passed. Five focused core tests passed: 64 seeds per candidate, determinism, graph validation, serialization, clear basal interval, six bend/aim seeds at eligible branches with moderate/extreme targets, joint-angle bound, immutable input, exact distal loss, unrelated detail and retained inactive history.
- Browser QA passed in Chromium, 1400×1000: three seeds × Front/Angle/Back, mixed and single reference scenes, owner-release bend/aim, Escape rollback, exact Undo, prune preview/cancel, a branchlet cut removing exactly three leaves while retaining the neighboring cutting, pointer-prune cancellation, complete render inventory, zero page errors and zero localStorage writes. Raw evidence: `artifacts/candidate-sol61/browser-qa.json`.
- The self-contained HTML was opened through `file://` in a new Chromium context; initial rendering, Back and Mixed bowl worked with zero page errors.
- Full `npm run verify`: typecheck passed; **352/353 tests passed**. The single failure is `the phase 2 garden backup is the two frozen bowls`, tiny IEEE-754 differences in an unrelated frozen fixture (for example 1.4573523094551641 vs 1.457352309455164). Reproduced on untouched source SHA with the same Node/runtime. No fixture was rewritten to make it pass. Production build and distribution validation were then run separately and passed.
- Physical-phone/Safari feel, accessibility audit, leaf collision/self-intersection under repeated extreme edits, dense multi-cutting compositions, cross-browser numerical identity, production tray transactions, persisted Garden workflows and adoption preference remain untested. The demo is intentionally memory-only; no integration/migration acceptance is claimed.

AGENTS.md, behavioral contract, architecture, material references, nearby generator/shaping/prune tests and the browser phone card were consulted. The repository contains no `.agents/skills` directory. Existing generator helpers, response profiles, prune history and folding/frame conventions were followed. The Library skill owns deliverable preservation.
