# Camera A/B: composition and detail

Isolated opt-in prototype based on published main `33272ac92ff968b8f72491ab45eec5eadb339ab3`. Nothing is merged or deployed by this study. Start Vite with `npm run dev -- --port 4192`, then open `http://localhost:4192/?cameraViews=1`. Ordinary URLs are the unchanged comparison. Use synthetic arrangements in a disposable context.

## Choice

Two slots sit inside Angles, after the presets and before stem checks. Each has a Camera A/B recall button and a separate Store/Replace button. Empty recall is disabled; the matching stored pose is indicated with `aria-pressed`. Labels disclose that storage lasts only until reload. All actions have ordinary keyboard focus and 44px minimum targets; closing a camera command returns focus to Angles.

Session-only slots are sufficient to assess the working rhythm: store composition A, orbit/pan/zoom to detail B, edit, then alternate between them. Garden already saves an intentional viewing/photo camera. Adding another persistent recipe before proving A/B useful would introduce restore, migration and Garden ownership choices. This prototype deliberately leaves that decision open. The current recalled camera still uses normal v2 autosave, so a reload retains the last view but empties A/B.

A slot captures position, target and up. It preserves angle, focus and distance, not a selection attachment, surface size or output pixels. It does not follow a stem as it bends. Replace the close-up explicitly when the area of work changes. The responsive stage lens may change the on-screen crop on a different viewport; it does not change the saved pose.

## Boundaries

- Store cancels first and copies only committed camera state; it writes no document. Recall cancels first and follows the existing camera-command save path. It leaves Arrange/Step Back, Shape/Prune, selection and botanical Undo alone.
- A/B survive vessel changes and Garden visits. In a kept Garden view both actions are disabled; Return restores the working camera and its slots. A successful fresh bowl or working copy clears the slots; a failed replacement retains them.
- Photograph receives the current committed camera, as before. Its view/zoom/frame controls and kept Garden camera are independent. Neither storing nor recalling overwrites a photo recipe.
- `cameraViews=1` routes studio, Garden and local telemetry to separate study keys without legacy fallbacks. No new saved field/schema, generator, renderer geometry, collision rule or production migration. Personal saves remain unread and untouched on this route.
- Pins and lighting are unchanged. Owner feedback establishes low contrast/shadow as a real concern. A closer view can increase their apparent size, but A/B is not a contrast fix and does not remove occlusion between stems.

## Validation

All 42 focused camera, gesture, Garden transition and persistence tests pass. New cases cover unset slots; clone isolation; overwrite; exact pan/orbit/zoom pose; cancel before Store/Recall; inert late release; botanical Undo; mode preservation; Garden ownership; successful/failed replacement; and separate storage routing.

Local `npm ci` and `npm run verify` were run. Typecheck passes. The Mac suite has the previously reproduced frozen phase-2 Garden fixture difference near 1e-16 (441/442 tests pass); build and six-file distribution validation pass separately. Linux PR CI is the independent full-suite check. No frozen fixture was edited to hide this difference.

`tests/browser/camera-views.mjs` drives the actual interface in fresh Chromium contexts. It records baseline/full/detail/returned views, exact camera and graph snapshots, photo files, Garden return and narrow layout evidence. Set `PLAYWRIGHT_MODULE` to a locally installed Playwright module, and `IKEBANA_EVIDENCE_DIR` to an evidence directory; start Vite on4192 or supply `IKEBANA_URL`.

Browser checks pass for three repeated A/B cycles; a real Aim edit followed by Prune selection, recall and Undo; a held camera interrupted before Replace; and session reload/copy. Mobile emulation covers 320×568, 390×844, 568×320 and 390×844 with doubled root text, including actual touch taps and scroll reachability. A/B recall restores exact poses and canonical graphs; the untouched baseline/prototype images are pixel-identical and the returned A scene region matches exactly. Opaque current-view exports are 1600×1200; reopening A from Garden produces the same PNG bytes.

Build the downloadable synthetic trial with `npm run build && node tools/build-camera-study.mjs`, then open `dist/camera-ab-study.html` in a browser. It enables only the study route and seeds the four-plant fixture only when that study save is empty. `tests/browser/camera-views-standalone.mjs` validates the delivered file, offline operation and repeated transparent portrait export.

Physical-phone precision, Safari interactions and subjective comfort require owner play; emulation does not establish them. No user creations were used or uploaded.

## Five-minute owner trial

1. Open the isolated route or supplied standalone playable. In Arrange, open Angles and Store A for the whole composition.
2. Step Back, then orbit, pan and zoom onto the portion to edit. Open Angles and Store B. Return to Arrange and make one small change.
3. Open Angles → Camera A to judge the result, then Camera B to continue. Do this twice. Neither switch should change the stems, selected tool or editing posture. Replace B if another area becomes the focus.
4. Try one vessel change. Keep a Photograph in Garden; view it, Return, and try A/B again. The working slots should still be there. Garden viewing itself disables them.
5. Decide whether the two-tap recall is easier than reframing manually. Notice whether the taller Angles menu, A/B names or session-only lifetime cause hesitation. Reload once to check the stated limit: active view remains, both slots become empty.

Recommendation: worth a short owner trial, because A/B restores an intentional full/detail pair accurately while preserving editing and recovery. The main cost is a taller Angles menu and two taps per switch. Keep session-only storage for this trial; consider per-working-bowl persistence only if the owner repeatedly wants the same pair after reload. Do not infer that close-up framing fixes pin contrast or flower occlusion. No pin, lighting, vessel or collision redesign is included.
