# Photograph: return to arranging without losing the setup

Base: `c707845de8e11904e991ff76bec0a3b8b8310c28`.

The owner can now close Photograph, adjust a cutting, and reopen with the photo setup intact. **Return to arranging** makes that path explicit. **Reset photo setup** is a separate action. The dialog explains that this is page-session memory, not a saved photograph.

## Ownership and boundaries

`PhotoDraftMemory` holds one small record keyed by the app's working-bowl generation. The record contains photo backdrop, perch, frame format, fibers, base camera and all six framing controls, lighting preset, finish and comparison state, grid and title. It never contains plants, insertion ordinals, vessel appearance or botanical tones. Every open pauses the app and reacquires its latest committed snapshot before constructing the disposable studio; only then are photo choices restored.

Ordinary edits, undo and Garden View/Return keep the generation. Successful fresh/copy replacement advances it after persistence succeeds. Failed replacement does not. The reset test bridge also starts a new generation. Photographing a kept Garden entry uses a null context and cannot borrow or overwrite the working draft. Removing every cutting through ordinary edits keeps the same bowl identity; explicit Fresh is what clears it.

No working autosave or Garden Keep is introduced. Prepared image URLs and pending encodes retain their existing per-dialog lifetime and stale-result guards. A graphics loss still requires closing and reopening, but the user's setup survives that rebuild. Reloading the page clears this memory by design.

## Evidence

- `tests/app/photographUI.test.ts`: production Photograph event paths through a DOM adapter; return/reopen, updated plants/vessel/tones, read-only Garden isolation, explicit reset, replacement context, context-loss recovery, stale PNG/share guards and explicit Keep.
- `tests/app/gardenTransitions.test.ts`: real app replacement and coordinator paths; the photo generation survives edits/cancel/View/Return, does not advance on failed save, and advances on successful fresh/copy.
- Initial targeted run: **23 passed / 0 failed** across those two files.
- Physical phone, DOM layout and GPU drawing were **not run**. The adapter does not paint or implement layout. Follow-up phone steps are in `tests/browser/PHONE_WEB_TEST_CARD.md`.

Intentional contract revision: closing Photograph retains a bounded local setup instead of resetting all photo controls. It still leaves the authoritative working bowl unchanged.

## Integrated Photograph controls

The framing/light lane's helpers are wired into the production dialog. Closer, Across and Height remain immediately visible; **Turn and tilt** expands Turn, Elevation and Tilt. All offsets re-evaluate the fixed reference camera, including after draft restoration. The saved final camera already carries roll through `up`; opening a Garden working copy starts at zero offsets to avoid applying that rotation twice. Reset framing clears all six offsets without changing lighting or finish.

Scene now offers **Studio**, **Soft window**, and **Evening** lighting, with a plain-language description. A lighting change invalidates pending PNG encoding; explicit Keep records `photoLighting` alongside the visible finish and final camera. Reset photo setup restores the current bowl's settings, whereas Reset framing only resets its six sliders.

Final targeted integration check: typecheck clean, **36 / 36 pass** across Photograph UI, Garden transitions and scene persistence. Two new production UI tests cover stale encoding after a light change, resumed angle/light values, camera roll retained once in Garden, and independent reset scopes. The earlier resume-only full verify passed **539 / 539**, build and standalone validation. Integrated lane verify (with camera/light helpers and root scene integration) passed **542 / 542**, build and standalone validation. The final combined candidate adds other lanes and reports its own total.
