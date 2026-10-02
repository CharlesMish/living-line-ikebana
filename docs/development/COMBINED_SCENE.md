# Combined scene release

Combines photo PR64 head c915fd7 and vessel PR65 frozen head3324076709f403454dab03218236fdd2f6238bde, based on main09db578. The two study branches remain intact. Owner approval authorized the scene save update and normal merge/Pages deployment after validation. No personal saves were used in tests.

## Result

More → Vessel selects seven layouts, Sand/Celadon/Charcoal and Glaze/Stoneware. More → Photograph uses the same layout/appearance in an independently disposable renderer. Perches consume every vessel's outer support descriptor, support both pots without moving them, and meet the existing ceramic bottom at y0.04. Lighting/exposure stay fixed.

Photograph offers Paper/Sage/Dusk/Transparent, Ground/Stone/Bench, view and framing controls, and exact PNG dimensions1600×1200,1200×1600,1600×1600. Keep creates a Garden moment containing the committed graph copy, scene recipe and photo camera. Its360×270 JPEG cover is bounded; transparent covers receive a paper matte. The main viewer uses its current viewport aspect; reopening Photograph restores the saved export aspect.

Optional fibers remain default-off and shading-only. They follow existing material frames/rest arc and do not alter silhouettes, picking, positions, normals, indices, graph radii or pruning history. No generator/material changes or unrelated candidate stems are included.

## Minimal envelope and compatibility

Botanical canonical schema is unchanged. Studio storageVersion2 adds committed camera + scene. Garden gardenVersion2 adds scene to each existing arrangement snapshot. sceneVersion1 contains stable layoutId,colorId,finishId,backdropId,perchId,photoFormat,stemFibers. Current bowls share one color/finish; per-part controls are deferred.

Writes use studio-v2 and garden-v2, separately from existing v1 keys. With no v2 document, v1 is read/validated but never rewritten on load. Legacy missing settings resolve to Original/Sand/Glaze/Paper/Ground, and v1 working camera defaults Front because it never contained one. Explicit edits/camera commands/save operations create v2. Legacy bytes remain available indefinitely. v1 backups import; new v2 backups reject in old readers rather than silently lose scene identity.

Unknown scene/version/IDs, invalid graphs and duplicate identities fail closed. Both current and fallback bytes guard stale writes. Quota failures preserve disk/cache and block explicit copy before memory replacement. No live preview is saved. Working documents retain the old count/size allowance; Garden still has24 entries,64 plants per entry and1,800,000 characters. Larger working documents can be presented and captured but cannot be kept in Garden beyond its existing bound.

Older clients have their own preserved legacy document, so simultaneous editing of old and new versions is unsupported; changes detected in legacy bytes block new saves until reload. No automatic reconciliation of old-client edits is attempted. Isolated old vessel-study backups lack identity and require manual layout/appearance selection; do not infer it from roots or covers.

## Integration boundary

Vessel profiles own ceramic/water geometry and planting laws. resolveVesselPresentation supplies stable layout + per-part appearance, contact height and outer bounds. Staging owns background/perch/frame; it never uses support bounds as planting bounds. Each renderer owns disposable materials/textures. Layout commands cancel first, update a profile callback, rebuild derived rendering and retain the working coordinator, Undo and protection instance. Garden View/Return and Compare restore the appropriate scene without writing the working bowl.

## Evidence

- Synthetic v1/v2 read, explicit write, backup export/import, independent-context restore, camera/frame, inactive history,65-cutting legacy support, invalid/future versions, failed quota and stale old/new tabs are covered.
- Seven-layout browser test covers ordinary planting, appearance, photo capture, repeat close and320px controls. Separate real pointer test covers protected Aim/Base/Bend/Prune/Undo, invalid/cancelled seats, existing overlap UI and Garden View/Return/Compare for all seven.
- All seven transparent exports are1200×1600 with alpha0..255; opaque sage exports are1600×1200 with alpha255. Reopened and freshly imported dusk/bench photographs are pixel-identical1600×1600 to the initial capture.
- Insertion→Photograph interruption, inert late release, failed encoder/retry and close during delayed encoding pass. No stale download is delivered.
- Independent review found and resolved comparison stage restoration, camera telemetry resolution and inherited Garden size limits leaking into working saves.
- Local Mac Node22 suite retains one inherited frozen phase2 fixture difference at1e-16, reproduced on base before this work. Linux PR CI is the required full-pass release gate.

Physical-phone feel, Safari Files/share behavior, touch precision, thermals and battery remain untested. Automated geometry/render/storage evidence does not establish those qualities. No external creation uploads or new analytics were added.

## Owner trial

Use a private/disposable browser or ?combinedPreview=1 for a synthetic trial; this preview namespace never reads player/workbench legacy keys. Choose a layout, arrange ordinary stock, enable View overlap/protection if desired, and use Arrange/Step Back. In Photograph choose Sage/Stone or Dusk/Bench, frame, download and Keep. Close, open the Garden moment, reopen Photograph and capture again. Download its Garden backup and import into another disposable context with a different starting layout; verify scene/camera, Make a working copy, reload, and Return.

On an actual phone check reachability/scrolling, acquisition precision, cancel during a hold, repeated capture and Files behavior. Record device/browser and observations separately from automated passes. Avoid clearing storage; download a Garden backup before a personal trial.
