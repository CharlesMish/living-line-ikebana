# Botanical structure and shaping pass

Base: merged #51, `57336553dcfbdcf71d23f120d3458808f02b8d37`.

The palette stays at twelve. New fern, blossom-spray and nodding-flower insertions
use v2; existing v1 graphs keep their original structure, response and appearance.
All other materials are unchanged. These are generic authored craft materials,
not named species or a claim about real-world elasticity.

## What changed

| Material | Structure | Craft consequence |
| --- | --- | --- |
| Fern frond v2 | Ten staggered pinnae, wider lower/middle feathers, progressively smaller upper feathers, a more curved rachis | A tapering silhouette; each divided pinna remains one independently removable organ on its own petiole |
| Blossom spray v2 | Shorter main line, rising curved lateral arms, less abrupt flower stalks, varied bloom sizes | More flowing separated accents; whole-arm and individual-flower pruning remain distinct |
| Nodding flower v2 | Arching upper stem joins at the lower stem tip, without a projecting stub; a short true pedicel carries the bell | The upper stem can be selected and bent with the existing solver; the short pedicel still only aims/prunes |

The nodding upper stem is a `lateral` continuation in the craft graph, with
copied stiffness 0.62. This is an explicit v2 construction choice, not a blanket
exception that makes old pedicels or petioles bendable. It has a more visible
Front arch and a green attachment blending into the blue corolla. The collar is
vertex color in the existing bell mesh, with no additional draw call.

The bend-position study from #48 (`32bbfea`) is carried as an opt-in feature,
including its cancellation, bead placement and twelve-material tests. It is
**not promoted to the default**. The imported rail markup was reordered so
station choices appear above the normal tool/source row, keeping that row intact.

- `?experiment=bend-stations`: Lower / Middle / Upper, one pale point at a time.
- Changing branch resets Middle. Changing station during a live edit cancels
  first. The choice is transient; committed geometry persists as usual.
- `?bend=touch` excludes the station study. Station acquisitions stay out of
  fixed-versus-touch telemetry. No new persistence field or solver was added.

## Compatibility and preview

Historical stable workbench profiles now pin their generator versions as well
as material order. Round 3/4/5 profiles and `blossom-compare` remain their original
v1 specimens. Single-material fixtures and `all-registered-materials` use the
current catalog. New `botanical-refinements` freezes fern v2 → spray v2 → nodding v2.

```sh
git fetch origin feature/botanical-shaping-refinement
git switch --detach origin/feature/botanical-shaping-refinement
npm ci
npm run verify
npm run dev -- --host 127.0.0.1
```

Open the local address shown by Vite. For an isolated development bowl add
`?workbench=1`; load `botanical-refinements`, seed 8278, count 6. To test extra
shaping use `?workbench=1&experiment=bend-stations`. Normal play without that
experiment has the usual single middle point.

The build also produces `dist/ikebana-web-alpha-standalone.html`. New v2 saves need
this build or a later build that knows those versions; earlier builds cannot
open them. Old saved arrangements load without regeneration or migration.

## Evidence

| Channel | Result |
| --- | --- |
| `npm ci` + `npm run verify` | 262 passed, 0 failed; typecheck/build/dist validation passed |
| Original generators / fixtures | No changes to any v1 generator or golden fixture |
| Core | Five seeds (0, 8278, 9255, 10232, uint32 max); repeated station bends and Aim preserve stock, attachment coincidence, input snapshots and serialization |
| Pruning / transactions | Local cuts retain inactive records; neck cancellation saves nothing, next ordinary release saves once without advancing the ordinal |
| Production organ group | Bent neck's bell follows its actual production group transform; v2 attachment is green and v1 sleeve remains unchanged |
| Visual review | Offline production-mesh contact sheets at three seeds, before/after and station comparisons; all twelve in a common-scale sheet |
| Live browser | Not run: this session's browser rejected local preview with `ERR_BLOCKED_BY_CLIENT` |
| Physical phone / frame time | Not run |

The renders below use the production plant meshes, instanced petals and organ
placement, but a simplified stage and offline orthographic flat shading. They
are silhouette evidence, **not screenshots of the playable app**, its lighting,
its UI, or evidence of pointer acquisition. Water/kenzan here are simplified.

- [Before/after at three seeds](before-after.png): v1 Front/¾, then v2 Front/¾.
- [Twelve-material palette](palette.png): current versions, seed 8278, same scale.
- [Station shaping](shaping.png): Lower/Middle/Upper with the same target offset;
  nodding edits its upper stem, fern and spray edit their main stem.

The offline visible-mesh triangle deltas at seed 8278 (including instantiated
petals) are fern **+872**, spray **+120**, nodding **+60**. This is a geometry
comparison, not a phone performance measurement. Existing protocol reporting
limitations for instanced triangles are not changed in this pass.

## Short physical-phone follow-up

1. In normal play, choose and seat each revised material. Materials selection
   must not seat anything. Scroll to fern in portrait and short landscape.
2. On nodding v2, select the bare upper arch, then drag its pale point. Select the
   bell separately to Aim its short stalk. Check acquisition clarity and continuity.
3. Cut one fern pinna and one spray lateral; cancel once, then commit and reload.
4. Open the station experiment. On one stem and then in the mixed bowl, try Lower
   and Upper. Check that the moving point and selected stem remain unambiguous.
5. Interrupt a bend with a tool change or app switch. No preview may survive as
   committed state. Return without the flag: ordinary shaping is restored.
6. Keep an arrangement, make a working copy, edit it and compare. The kept original
   must remain unchanged. Note iPhone/iOS, URL, viewport and first-try misses.

Remaining taste questions: whether the fern needs fuller individual pinnules,
whether the nodding upper stem needs a slightly different response after touch
play, and whether the dense flower head warrants its own future v2. No changes
to the dense head, organ roll, vessels, lessons or material count are bundled here.

## Reproduce offline evidence

Requires the normal npm dependencies and Python with Pillow. From repo root:

```sh
npx esbuild tools/botanical-contact-sheet.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/botanical-sheet.mjs
node node_modules/.cache/botanical-sheet.mjs /tmp/botanical-mesh.json
python tools/botanical-contact-sheet.py /tmp/botanical-mesh.json /tmp/before-after.png
```

Add `--palette` or `--shape` to the Node command for the other sheets. This tool
does not instantiate a WebGL renderer or control a browser.
