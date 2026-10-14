# Silver seed spray — dried partition study

Candidate based on the photos-and-violets integration `00f285f`, October 14 2026.
Adds `silver-seed-v1` with six dry seed discs on three sparse arms. Material ID
`silver-seed`; tones Natural (cool silver), Warm ivory, Pale straw. No feature
flag, generator replacement, migration or edit-law changes. Existing historical
profiles are frozen. This is authored Lunaria-inspired dried stock, not a
cultivar, optical membrane simulation or a named ikebana-school practice.

## Form and craft

The stem is 2.92–3.07 units, with six discs around 0.5 wide and 0.64 high before
individual scales. Three shallow fan arms create negative space and offer
useful lower material after an upper cut. Every disc has its own 0.26–0.33-unit
pedicel; cutting it removes one seed disc, not a leaf or flower. Surface presses
Aim the supporting pedicel. No per-disc deformation or independently moving seeds.

The semantic `seedpod` kind is explicitly registered in validation, decode and
craft cues; this is an allowed value in existing schema 1, not a new field.
Old builds reject unsupported generator versions before graph hydration. Unknown
future kind values still fail; failed Garden imports leave entries unchanged.

## Rendering and costs

Two meshes per organ: a closed subtly billowed membrane plus fibrous oval rim
and both-face vein ribbons. No texture fetches, alpha blending in committed state,
new lights or shadow maps. Both faces have tint/relief; a thin edge stays physical.
Ribbons sample the actual triangulated membrane rather than a smooth surrogate.
An independent critic caught inward rim winding and between-vertex vein crossings;
both were corrected and added to numeric regression checks.

The seed 8278 stock has 10 branches and 6 organs, 22 visible material draws,
12,036 visible triangles, excluding selection/hit proxies and scene infrastructure.
The exact proxy is an independently owned copy of both visible meshes, so it
adds CPU geometry and raycast cost but no visible draw. This is a static geometry
count, not phone frame timing.

## Automated and pending evidence

`npm ci` and `npm run verify`: **617 passed, 0 failed or skipped**; typecheck,
build and standalone distribution validation passed.

- Three-seed deterministic generation, valid attachments and roundtrip identity.
- Frozen old profiles and existing golden tests retained.
- Upper cut keeps four lower discs; individual cut removes one; Aim leaves
  siblings untouched; Bend preserves rest lengths.
- Coordinator insert/Aim/Bend/prune cancellation saves nothing and leaves the
  insertion ordinal alone; ordinary prune release commits once.
- Working save, Garden Keep/export/import and working-copy paths retain cut
  history, seedpod semantics and tones. Unknown-kind import refused atomically.
- Closed-manifold membrane, finite geometry, outward front/reverse/rim normals.
- Every vein triangle sampled on an 8-step barycentric lattice at three seeds;
  all samples stay on their own face. This is a finite regression, not a proof
  for every possible seed. The generous geometry gap is independent of lighting.
- Both-side exact-surface hits route to the matching disc's stalk at 390×844
  projection. No real touch input was exercised by these CPU tests.
- Prune preview/reset/commit/restore and tone changes retain geometry; opaque
  material returns after preview cancellation.

Rendered remote-CI review and physical-phone inspection are the integration
owner's next gate. No local browser/GPU/phone run was performed by this lane.

Primary reference: [Clemson Cooperative Extension — Money Plant](https://hgic.clemson.edu/factsheet/money-plant/).
The dry silver middle partition is the reference, after removal of outer valves
and loose seeds; no seed-shaped berries or recolored flower heads are substituted.
