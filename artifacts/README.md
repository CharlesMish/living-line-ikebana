# Living Line Manual Browser Testing Results

## Date
September 21, 2026

## Commit
6c6abd61919754976d64f1a11d590c059056717e

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

**Design approach:** Single flower as clear visual lead facing forward, with leafy shoots creating rhythm and supporting the flower.

**Files created:**
- `single-flower-led-front.png` - Front view screenshot (PNG, 1280×800)
- `single-flower-led-three-quarter.png` - Three-quarter view screenshot (PNG, 1280×800)
- `single-flower-led-garden.json` - Garden backup (26K)

## Verification
Both Garden backups were verified functional:
- Reloaded fresh app instance with ?fresh=1
- Opened Garden dialog showing both saved arrangements
- Clicked on arrangement card to load it
- Confirmed arrangement rendered correctly with all cuttings in proper positions

## Technical Notes
- No source code modifications made
- No test fixtures or hooks used
- All arrangements created through normal UI gestures (drag, aim, bend)
- Git status shows only new artifacts/ directory (untracked)
- Screenshot files are actual PNG format (converted from WebP using ffmpeg)
- JSON backups contain full arrangement data including positions, orientations, and thumbnails
