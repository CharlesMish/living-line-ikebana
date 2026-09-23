# Lane C — materials picker, small-screen clarity

Draft only. No merge. No deploy. Behavioral contract: preserved. This pass changes picker presentation only. It does not change generators, graph laws, insertion, Arrange / Step Back ownership, or persistence.

## Tip

| | |
| --- | --- |
| Start SHA | `2aef05424d751cda2137f3749b2d71e7fdf0c6d1` |
| Confirmed with | `git rev-parse HEAD` before the branch |
| Branch | `cursor/polish-lane-c-picker-b3bd` |
| Baseline note | PR #46, `cursor/polish-baseline-evidence-8602` |

`2aef054` is the merge of PR #45 and was `main` at the start of this lane.

## Model

This run is https://cursor.com/agents/bc-d0e499f0-ee0b-51f5-8fe1-b7c0386bb3bd.

`cursor-cloud` run-info `originalModelName` is `grok-4.7`. The payload has no `thinking-budget` field and no `reasoning_effort` field. The launch text requested Grok 4.7 with reasoning effort high. This agent is Grok 4.7. No other model was substituted. That budget cannot be confirmed from the session record.

## What was wrong

PR #46, at CSS viewport 1280×800, device pixel ratio 1: Materials panel `clientHeight` 286, `scrollHeight` 539. At `scrollTop` 0 the fully visible rows are flowering branch, leafy shoot, bare branch, single flower, reed, and flower volume. Arching trailer is partly in view. Foliage fan, blossom spray, nodding flower, berry twig, and fern frond are entirely below the fold.

This lane reproduced that on the same tip before editing:

| CSS viewport | `clientHeight` | `scrollHeight` | Fully visible at `scrollTop` 0 | Entirely below the fold | Scrollbar gutter |
| --- | --- | --- | --- | --- | --- |
| 1280×800 | 286 | 539 | first six; arching trailer visible ratio 0.373 | foliage fan through fern frond | 17px |
| 390×844 portrait | 286 | 539 | same six; arching trailer 0.373 | same five | 2px |
| 844×360 short landscape | 190 | 539 | flowering branch through single flower; reed 0.191 | flower volume through fern frond | 17px |

Headless Chrome 148.0.7778.96 (`HeadlessChrome/148.0.0.0`), Linux, ANGLE SwiftShader, WebGL2, `devicePixelRatio` 1, `window.innerWidth/innerHeight` equal to the CSS viewport. Page `http://127.0.0.1:5173/?fresh=1&test=1`. Not a physical phone.

The desktop gutter is a real 17px scrollbar. Its thumb is a low-contrast gray on the paper edge, and the clipped arching-trailer row still reads as the end of the list. On the emulated portrait the gutter is 2px. The list was already scrollable. The failure is that continuation is easy to miss.

Reopening the list after choosing fern frond left `scrollTop` at 0, so the pressed row was entirely below the fold while the visible rows all read as unselected. The source card did show Fern frond.

## Accepted approach

Keep the top-rail list, its max-height, and its native scrollbar. Add a non-interactive edge cue, and bring the pressed row into view when the list opens.

- A paper fade and a moss chevron sit on the bottom edge while `scrollHeight - clientHeight - scrollTop > 1`.
- A matching fade and an upward chevron sit on the top edge while `scrollTop > 1`.
- Both cues use `pointer-events: none` and `aria-hidden="true"`. They are not buttons and carry no `data-material-id`.
- `scroll-padding` keeps keyboard focus off the faded edge. Focusing a row still scrolls it fully into the panel.
- Opening the list scrolls the pressed choice clear of the fade. The last choice scrolls to the end, so the bottom cue does not imply another row once fern frond is in view.
- The pressed row keeps its white ground and gains a 3px moss inset so the selection stays readable beside the fade.
- Choice focus rings use `outline-offset: -2px` so the ring stays inside the row.

`materialListOverflow` in `src/app/ui.ts` is the edge test. Choice clicks still emit `select-material` only. Insertion stays on the one source card.

## Approaches set aside

- An inventory, categories, or search field. Twelve named rows are already one list. The miss was the fold, once the continuation is visible.
- A taller panel that fits all twelve rows. The content is 539px tall. On an 800px window that sheet would cover most of the bowl. The top rail would stop being a rail.
- A modest max-height increase. Rows would still end below the fold at 1280×800, and the bowl would lose more of the arrangement.
- Moving the tray to the bottom edge. The phone card and the top-controls contract keep action controls in the top rail so a drag toward the pins is not a fight with chrome.
- Replacing the scrollbar. The native bar stays. The fade is the cue that still reads when the gutter is 2px.

## After, same machine

| CSS viewport | At `scrollTop` 0 | Scrolled to the end |
| --- | --- | --- |
| 1280×800 | `clientHeight` 286, `scrollHeight` 539. Below cue shown, above cue hidden. Same six full rows; arching trailer still the clipped row. | `scrollTop` 253. Below cue hidden, above cue shown. Arching trailer through fern frond fully visible. |
| 390×844 | Same 286 / 539. Below cue shown. Scrollbar gutter stays 2px. | Below cue hidden, above cue shown. Last six fully visible. |
| 844×360 | `clientHeight` 190. Below cue shown. First four full rows. | `scrollTop` 349. Above cue shown. Blossom spray through fern frond fully visible. |

Choosing fern frond: source card becomes Fern frond, `aria-pressed` is true, the menu closes, `successfulSeatOrdinal` stays 0, plant count stays 0, canonical hash stays `41418c67` (empty session). Reopening the menu scrolls to `scrollTop` 253. Fern frond is fully visible and pressed. The above cue is shown. Flowering branch is above the fold and can be scrolled back.

Choosing the clipped arching-trailer row under the fade: same empty hash, ordinal 0, plant count 0, menu closes. `elementFromPoint` on the fade hits `material-choice-arching-trailer`, so the cue does not take the press.

Keyboard focus visits all twelve choices and each is fully inside the scrollport when focused. `scrollTop` can return to 0 and to the max. `window.scrollY` stays 0. Escape closes the menu and returns focus to `#materials-toggle`. A pointer down on the studio closes the menu. Step Back sets posture `step-back`, shows the camera chrome, hides craft chrome from the accessibility tree, and closes the menu with ordinal 0. Arrange returns posture `arrange` with ordinal 0 and plant count 0.

Stills and the machine log: `docs/development/reports/polish-lane-c-picker/`.

## Verify

`npm ci && npm run verify` is recorded after the implementation commit on this branch. Node on the capture machine: v22.14.0. `npm ci` for the capture added 63 packages. The picker tests passed before the full verify: insertion bindings stay on one source card, and `materialListOverflow` matches the 286 / 539 edges.

## Phone card gaps

Physical phone: not run. Headless Chrome is the evidence above. Missing phone is not treated as a pass.

Not observed on an iPhone in Safari:

- Finger scrolling the materials list, including whether the fade reads as another row.
- Large-text wrapping of the twelve labels.
- Safe-area insets around the open list.
- The ten-minute craft path, interruption matrix, and first-try acquisition counts.

Headless checks that touch the card's shell rules: the list stays in the top rail, the document scroll position stays 0, and Step Back / Arrange ownership still switches without seating a plant.

## Unresolved

- Phone feel of the fade and of scrolling the list is unknown.
- Large text was not captured. Rows already use `min-height: 2.75rem`; a larger font will overflow sooner, and the same cue should appear, but that was not screenshotted.
- The clipped row under the fade is still a real choice. Its label is deliberately faded. A press on that row selects it and does not insert it.
- The 3px moss inset is a clarity mark on the pressed row. It can be removed later without changing the scroll cue.
