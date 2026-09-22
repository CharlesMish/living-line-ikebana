# Living Line Manual Browser Testing Results

## Date
September 21, 2026

## Source
PR #19 merged into main at `5b6536704f89e105181158891e4ad27537bf1a22`

## Overview
Created two original floral arrangements using the Living Line web application running at http://localhost:5173/. All arrangements were created using the normal UI controls without any test hooks, console injection, or hand-authored graph data.

## Arrangement 1: Bare-Branch-Led
**Title:** "Bare Branch Lines with Leafy Accent"
**Cuttings:** 3 total
- 2× Bare branch (tall, angular lines)
- 1× Leafy shoot (lower accent)

**Design approach:** Sparse and asymmetrical composition exploring line and open space, with bare branches as the visual lead.

**Files created:**
- `bare-branch-led-front.png` - Front view screenshot (PNG, 1280×800)
- `bare-branch-led-three-quarter.png` - Three-quarter view screenshot (PNG, 1280×800)
- `bare-branch-led-garden.json` - Garden backup (26K)

## Arrangement 2: Single-Flower-Led
**Title:** "Single Flower with Leafy Rhythm"
**Cuttings:** 3 total
- 1× Single flower (cream-colored bloom as focal point)
- 2× Leafy shoot (supporting rhythm)

**Design approach:** Single flower as clear visual lead, with its open face
turned toward canonical Front by one ordinary player Aim operation; leafy shoots
create rhythm and support the flower. Existing Aim could not keep the open
center clear in both Front and Three-quarter, so this two-view facing goal
remains unresolved.

**Files created:**
- `single-flower-led-front.png` - Front view screenshot (PNG, 1280×800)
- `single-flower-led-three-quarter.png` - Three-quarter view screenshot (PNG, 1280×800)
- `single-flower-led-garden.json` - Garden backup (26K)
- `single-flower-led-aim-attempt-front.png` - Aim limitation evidence
- `single-flower-led-aim-attempt-three-quarter.png` - Aim limitation evidence

## Verification
Both Garden backups were verified functional:
- Reloaded fresh app instance with ?fresh=1
- Opened Garden dialog showing both saved arrangements
- Clicked on arrangement card to load it
- Confirmed arrangement rendered correctly with all cuttings in proper positions
- Imported the Aim-adjusted single-flower backup separately; Front shows the
  open center, while Three-quarter remains edge-on after the permitted Aim attempts

## Technical Notes
- No source code modifications made
- No test fixtures or hooks used
- All arrangements created through normal UI gestures (drag, aim, bend)
- Git status shows only new artifacts/ directory (untracked)
- Screenshot files are actual PNG format (converted from WebP using ffmpeg)
- JSON backups contain full arrangement data including positions, orientations, and thumbnails

## Round 3 — individual reed

Headless Chrome on this branch, not a physical phone. Five separate `reed-v1` cuttings. Garden backup `reed-lines-garden.json` (“Reed lines and the spaces between”). Heights differ by seeded stock and two prunes; leans are aim; one culm is bent.

- `reed-lines-front.png` — Front, 1280×800
- `reed-lines-three-quarter.png` — Three-quarter, 1280×800
- `reed-lines-above.png` — Above, 1280×800
- `reed-count1-front.png` — one reed, Front
- `reed-narrow-320.png` / `reed-narrow-390.png` — Materials menu open after a centerline pick. See `docs/development/REVIEW_reed-v1.md`.
