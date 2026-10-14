# Compact flower study

The owner's concern was the stacked appearance of Flower volume's packed
five-organ head. `compact-flower-v1` is an additive alternative: one rounded
tuft on a shorter green stem, with two small lower leaves. It is generic flower
stock rather than an assertion about a particular species.

## What changes

- New tray/catalog ID: `compact-flower`, labelled **Compact flower**.
- Stem stock length: 3.25–3.42 units; radius 0.031; copied bend response 0.46.
- One terminal pedicel, 0.40–0.435 units long, supplies a separate Aim pivot.
  It starts at the stem tip, so no unused stem end protrudes above the attachment.
- Exactly one bloom organ, scale 0.97–1.025, plus two independently removable
  leaf organs on petioles. The head uses the existing eight-petal instanced tuft
  geometry, with modest seeded variation in azimuth, scale and tilt.
- Default petals are muted rose (`#b8667a`) with matte green stock. The bloom's
  existing 0.56-unit acquisition envelope is preserved before organ scaling.

This is a single compact cup, not several stacked cups. It does **not** offer
independent petal editing. Aim turns the supporting pedicel through the ordinary
material-frame operation; it does not add axial roll or camera-facing petals.

## Compatibility and behavior

The gesture, pruning, cancellation and persistence contracts are unchanged.
The head can be removed by cutting its stalk; pruning retains inactive history.
Stem bending transports the leaves and head without rerolling their seeded
detail. No extra persistent graph field or solver behavior was added.

`flower-volume-v1` and its exact existing fixture are unchanged. None of the
historical named profiles changes membership or generator versions. The live
catalog and Workbench's dynamic single-material choices gain the new entry.
Older builds without this generator reject its saved graphs as unsupported;
they must not be used to reopen a new compact-flower arrangement.

## Evidence

Lane validation: **495 tests passed, zero failed or skipped**; TypeScript and
standalone distribution validation passed through `npm run verify`.

Seven new tests cover the new fixture and three-seed determinism, exact
preservation of the old Flower volume fixture and frozen Round 3 profile,
independent head Aim, unchanged stock during bending, prune history and reload,
and transaction cancellation without saves or identity consumption.

The presentation test uses the production Three.js geometry and raycaster,
with GPU drawing omitted. For seeds 8278, 9255 and 10232, at a 390×844 projection,
real petal-surface hits from Front and three-quarter views select the bloom's
own pedicel. It checks the single eight-instance tuft, every petal vertex inside
the shared hit envelope, and prune/rollback visibility of the same mesh record.
These are source/geometry tests, not phone play or visual acceptance.

Browser rendering and physical-phone checks were **not run**. The remaining
owner check is whether the single cup reads as a useful small flower beside
Blossom spray and whether turning the head feels sufficiently clear. Keep the
study separate from a claim that the original Flower volume is unnecessary.
