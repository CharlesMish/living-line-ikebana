# Quiet photographic scenery

Lane baseline: `c707845de8e11904e991ff76bec0a3b8b8310c28`.

## What changed

Two additive Photograph backdrop IDs:

- `hills`, **Mist hills**: three low-contrast, uneven ridgelines fading into a pale valley. Cool blue-green distances and a subdued sage foreground.
- `garden`, **Garden shade**: soft foliage masses around a light central opening. Muted green shadow and warm, diffuse highlights.

These are painted photographic backgrounds, not outdoor simulations. They stay flat behind the composition as the arrangement is viewed from different angles. The existing floor and its real shadows still ground the vessel/perch. There are no animated petals, imported photos, external URLs, extra props, or botanical changes.

The scene uses an aspect-preserving centre crop, not stretched scenery. Preview, PNG, Garden cover, and restored scenes all use the same renderer path. Camera changes do not resample or regenerate the authored image; only the texture's UV matrix changes. Looking down can naturally hide the background behind the existing floor.

All prior backdrop colours and the default paper setting are untouched. Selecting a new ID persists through the existing strict registry; older readers that do not recognize it refuse the scene rather than substitute a wall. No schema extension was needed.

## Ownership and cost

`atmosphericBackdrops.ts` produces a deterministic 256 × 256 RGBA texture (256 KiB per active scenic renderer, no mipmaps). The deliberately soft image is generated only when a renderer first switches to that scenic ID. It uses no DOM/canvas, network or global random state. It does not use plant identity/seeds.

Each renderer owns its texture. Changing a perch while retaining the backdrop reuses that texture; switching backgrounds, choosing Transparent, or disposing the renderer releases it. Transparent also removes the backdrop along with the existing floor/perch omission. Independent Garden comparison panes cannot change one another's crop or texture bytes.

There is one standard Three.js background pass (two triangles) in place of the previous solid-colour clear. There is no added world geometry, environment-map lighting or per-frame texture generation. Existing real floor/perch lighting remains in effect; the painted backdrop itself is unlit.

## Evidence and limits

- `npm ci` completed; `npm run verify` passed typecheck, **539/539 tests**, build and distribution validation on this lane.
- The focused backdrop/photo/persistence group passed **24/24 tests**.
- Focused automated tests cover deterministic bytes, bounded colour/size, correct sky orientation, unique texture ownership, aspect-preserving framing, production render crop timing, stage replacement, Transparent, repeat disposal, and independence between studios.
- Existing registry-driven persistence tests cover both new IDs through working-save and Garden export/import without changing botanical records.
- A contact sheet of the actual CPU texture bytes was visually inspected. This is **not** a rendered game screenshot, browser playtest, or phone result.
- No GPU/browser or physical-phone QA was available. Phone acceptance should check floor/background transition, low-angle and Above views, portrait crop, the darkest foliage against green leaves, and PNG/Keep matching the preview. A deliberately quiet background may still need owner taste adjustment.

No extra perch was added in this lane: the existing stone, crafted timber bench and plaster plinth already provide contrasting structure; two scenery options were the useful bounded addition.
