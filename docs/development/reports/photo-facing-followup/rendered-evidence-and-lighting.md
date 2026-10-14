# Rendered evidence and lighting cost

Source baseline: PR #92, `38dea04`. This follow-up adds one isolated CI job and
one script; it changes no product rendering, graph, saved data or lighting.

## Lighting decision

Keep Studio, Soft window and Evening. They are three recipes for the **same
owned light rig**, not three simultaneously active lighting systems.

- `ThreeStudio.buildStudio` constructs one hemisphere and two directional lights.
- Only the key directional light casts shadows, using one 1024×1024 shadow map.
  The fill has no shadow map under the current recipes.
- `applyPhotoLighting` changes existing colors, intensities and positions, then
  marks the existing key shadow dirty. It allocates no additional light, mesh,
  render target, or shading program.
- The focused CPU tests in `photoCameraLight.test.ts` verify stable rig object
  identity and independent scenes; `photoLightDisposal.test.ts` covers owned
  shadow-target disposal. These are resource/lifecycle checks, not GPU timing.

Consequently, deleting two preset options would not remove an active light or
shadow pass. Replacing the accepted rig with one literal light would change the
baseline appearance. The plausible savings would be reduced lighting arithmetic;
the key shadow pass would remain if its shadow stayed enabled. No phone timing
supports that trade-off yet.

Exposure and Warmth already address brightness and warmth after rendering. They
do not reproduce light-direction or shadow changes. Non-neutral Finish currently
uses one framebuffer copy and one fullscreen triangle draw; neutral Finish has
no copy, draw, or retained grading resources (`PhotoGrade`). That is a separate
cost from choosing a lighting recipe. Resolution, pixel ratio, shadow rendering
and botanical complexity are sensible future measurement targets. This report
does not rank their phone cost or claim FPS results.

## CI evidence contract

The separate **Rendered evidence (Chromium, assisted)** job in `verify.yml`:

1. Installs the locked app and builds `dist`.
2. Installs exact Playwright `1.56.1` in the runner's temporary directory and its
   matching Chromium. It does not change `package.json` or the app lockfile.
3. Runs `tests/browser/rendered-evidence.mjs` against the built output with a
   local Vite preview owned and stopped by that script.
4. Uploads screenshots, two actual exported PNGs, a preview log, and `checks.json`
   on success or failure. Artifacts expire after fourteen days.

The job has a ten-minute limit, a read-only GitHub token, no deployment, no
production URL, no account session, and a fresh browser context per case.
Chromium explicitly requests SwiftShader. `checks.json` records the actual
renderer string, browser version, checked-out commit and proposed PR head. On a
pull request the checked-out SHA is usually GitHub's proposed merge commit;
recording both avoids calling those two revisions identical.

Cases: 320×640, 390×844, 844×390, 1280×800, and 390×844 with 150% root text.
The text case measures the baseline root size, applies exactly 1.5 times that
size as an important pixel declaration, waits for the computed size to match,
and records baseline/requested/inline/computed values. For the present 16px
baseline this requires an actual 24px root. This is a CSS text-layout probe,
not complete operating-system/browser accessibility zoom emulation.

Each case uses the real keyboard insertion path to place a flowering branch and
a Single flower. This is a disclosed assisted fixture, **not evidence that drag
placement, touch targeting, or a blind player succeeds**. There is no graph
injection, guessed canvas coordinate, synthetic DOM event dispatch, or test
bridge mutation. All bridge calls inspect state.

The script captures and checks:

- Arrange; the actual selected cutting's explicit Turn command and exact Undo,
  while camera and insertion ordinal stay fixed.
- Botanical tones with two in-bowl cards and an ordinary Soft lilac choice.
- Photograph Frame and Finish, with Warmth and Saturation focused and scrolled
  into the controls region. Both the active slider and live preview must remain
  in the viewport, must not cover each other, and must not overflow horizontally.
- Explicit Prepare PNG followed by Download at 390×844 and desktop, checking PNG
  signature and 1600×1200 dimensions.
- Return, resume, and explicit setup reset, with exact working graph, camera,
  ordinal, and commit-autosave audit preserved throughout Photograph.
- Console/page errors and a failure screenshot whenever capture remains possible.

Screenshots are review artifacts, not aesthetic approval or pixel goldens. This
does not assert that every branch fits in Arrange, certify iPhone Safari, test a
physical finger, validate held-drag interruption, or measure performance.

## Verification when authored

`node --check tests/browser/rendered-evidence.mjs` and `git diff --check` pass.
The exact optional tooling version was confirmed through the npm registry.
No browser, browser installation, preview server, GPU run, or physical phone
test was performed in the authoring environment. The first rendered result must
be read from the GitHub Actions job; until then this remains unexecuted browser
automation rather than browser evidence.

The first remote execution (Verify run 184) passed all four standard-size cases,
including both PNGs and Turn/Undo. The enlarged-text case stopped before any
product actions because its original percentage request still computed to 16px.
That run provides no enlarged-text layout evidence. The revised probe above
keeps the actual-size assertion and uses an explicit measured pixel target;
the root cause of the ineffective percentage request is not established by the
retained log. No product font rule is changed to make this check pass.

Existing optional browser studies remain separate. Some predate explicit Prepare
then Download or current menu/default state. This focused script does not imply
that all older studies run unchanged.

Primary tooling references:
- <https://playwright.dev/docs/ci-intro>
- <https://github.com/actions/upload-artifact>
