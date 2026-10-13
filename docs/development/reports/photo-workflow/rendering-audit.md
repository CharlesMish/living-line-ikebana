# Rendering integration audit

Read-only audit of the combined root through `8bc021b`, followed by one isolated lifecycle repair. No browser/GPU renderer was available.

## Concrete finding and repair

The studio did not explicitly release a directional light's allocated shadow render targets on close. This predates the new light presets. `disposeObject` visits Mesh/Line resources only, and the installed Three.js `WebGLRenderer.dispose()` does not dispose light-shadow render targets. A CPU fixture populated the production rig with actual `WebGLRenderTarget` objects and called production `ThreeStudio.dispose()`: neither target emitted a dispose event, while renderer teardown did run.

The repair releases the rig's owned shadow `map` and `mapPass` before renderer teardown, clears their references, and deduplicates targets. The fill normally allocates none but is included for future presets. A target owns its attachments; the repair does not separately dispose those textures. The production regression now verifies both target events precede renderer teardown and occur once. A second check covers empty rigs, repeated calls, shared target references, and isolation from another studio.

## Other inspected interactions

- **Backdrop crop:** installed Three.js 0.181.2 `WebGLBackground` copies the background texture's matrix to `uvTransform`; its background vertex shader actually multiplies UVs by that matrix. The new cover crop therefore reaches rendering rather than being inert metadata. `renderNow` updates it from the actual camera aspect before preview/export drawing.
- **Colour/fog:** scenic data textures are explicitly sRGB and the Three.js background skips filmic tone mapping for them. Real foreground geometry follows standard lighting and tone mapping. In this Three.js version the fog blend occurs after output-colour conversion and receives the renderer's unlit output colour, as the existing plain backdrops do. The flat scenery is intentionally unlit and no environment-map lighting is added.
- **Lobed reverse:** one double-sided lamina uses a back-face diffuse/roughness override; normal flipping, opacity/alpha, emissive preview tint and output conversion remain standard Three.js. Separate front/reverse veins use opposite culling and all three materials participate in tone and prune-opacity updates. Each leaf has its own live uniform reference. Natural tone reset preserves geometry identity.
- **Single flower:** its new open cup uses closed front/reverse petal shells with standard owned materials, rather than another shader override. Additional CPU probes checked oriented-edge consistency at five seeds (zero winding errors). Existing tests verify bounded surfaces, front/rear acquisition and tone changes without graph mutation.
- **Lighting:** presets reuse one independently owned rig and shadow map. Reset reinstates the original light values. Applying a preset does not alter camera, background alpha, botanical state or another studio.

## Verification and limits

The combined root's backdrop, photo-camera/light, lobed reverse, open-cup and photo-grade focused suite passed **24/24** before this repair. The repair lane's resource/photo/backdrop suite passed **15/15** and typecheck passed. Root will run the final combined gate.

This is source/CPU evidence. Real GPU appearance, translucent single-flower layering, scenic floor/background transitions across low/rolled views, and phone frame time still need owner/browser acceptance. No claim of pixel-identical GPU output is made.
