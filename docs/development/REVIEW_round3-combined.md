# Round 3 combined candidate — materials + Garden compare

Draft only. This branch does not merge to main.

## SHAs

| Role | SHA |
| --- | --- |
| Baseline main | `cf1cf73c267ca9cd7d3b93961f7061708e5a2b37` |
| Materials parent, PR #28 tip | `c1cd491c011dd1944dfabf8e7b2f12f9b6c0b991` |
| Garden compare parent, PR #24 tip | `4d7179cc1a2d2d9b47ab92020cb5e75982727c64` |
| Combined integration merge | `a2d34c6626aa1cff7b4273053a6704437a68fa86` |

The integration merge is a merge commit. Its first parent is the materials tip and its second parent is the Garden compare tip, so both parent tips stay reachable. This note is the child of that merge. The draft PR records the branch tip (`git rev-parse HEAD`), which is the commit that adds this file.

## Model

Requested model: Grok 4.7 high thinking. Exposed session identity: Grok 4.7 (`originalModelName`: `grok-4.7`). No thinking-budget field was exposed.

## In

- Round 3 materials from #28: `reed-v1`, `flower-volume-v1`, `arching-trailer-v1`, workbench profiles, finish demos, and their tests and evidence.
- Garden compare from #24: one pointer owner for a comparison drag, interruption rollback, equal canvas width and height, and the shorter player copy, plus `tests/app/gardenCompare.test.ts` and `docs/development/GARDEN_COMPARE_FINISH.md`.

Catalog order stays the established four, then reed, flower volume, and arching trailer:

`flowering-branch`, `leafy-shoot`, `bare-branch`, `single-flower`, `reed`, `flower-volume`, `arching-trailer`.

`reference-pair` is still flowering → leafy. `all-four` is still flowering → leafy → bare → single-flower. `mixed` is still the alias of `reference-pair`. Neither profile reads the live catalog.

Garden comparison stays transient. `schemaVersion` stays 1. `gardenVersion` stays 1. Comparison writes no Garden entry, no working save, and no stored camera.

Contract: preserved. Section 1 names the seven generator versions. The comparison paragraph from #24 is included beside the existing Garden rules.

## Out

- Organ roll, `?experiment=organ-roll`, and PR #29
- Facing diagnosis PR #27
- Any new material or palette expansion
- Merge to main or deploy

`docs/development/REVIEW_round3-integration.md` still describes the materials branch before this combine, including its note that Garden compare was absent there.

## Preview

```sh
npm ci && npm run build
```

Open `dist/ikebana-web-alpha-standalone.html`.

Materials: `?workbench=1`. The Materials menu lists the seven choices above. Profiles include `reference-pair`, `all-four`, `references-plus-reed`, `references-plus-flower-volume`, `references-plus-arching-trailer`, `round3-three`, and `round3-palette`.

Garden compare: keep two arrangements, open Garden, choose Compare on two cards, then Look at both. Both panes share one view. Leave comparison discards that view and does not change either kept arrangement or the working bowl.

Phone: not run for this combine. Parent phone gaps still apply.
