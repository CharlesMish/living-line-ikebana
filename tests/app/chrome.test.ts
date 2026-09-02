import assert from "node:assert/strict";
import test from "node:test";

import {
  contextualChromeVisibility,
  dragCorridorRect,
  pointHitsOccupiedChrome,
  pointInChromeRect,
  rectsIntersect,
} from "../../src/app/chrome.ts";

/**
 * CSS used-height of `.top-chrome` + `.chrome-stack` for a given `--safe-top`.
 * Live production framing measures getBoundingClientRect; this only supplies
 * representative occupied bottoms for layout-free node tests.
 */
function representativeOccupiedTopBottom(safeTopPx: number, remPx = 16): number {
  const paddingTop = safeTopPx + 0.45 * remPx;
  const segmentedHeight = (0.22 * 2 + 2.5) * remPx;
  const stackGap = 0.28 * remPx;
  const contextualMinHeight = 2.94 * remPx;
  return paddingTop + segmentedHeight + stackGap + contextualMinHeight;
}

test("Arrange shows Shape/Prune and the tray; Step Back shows only Front/3/4/Above", () => {
  assert.deepEqual(contextualChromeVisibility("arrange"), {
    tools: true,
    views: false,
    tray: true,
  });
  assert.deepEqual(contextualChromeVisibility("step-back"), {
    tools: false,
    views: true,
    tray: false,
  });
});

test("an empty point inside the contextual row but outside its visible pills is not occupied chrome", () => {
  const row = { left: 0, top: 86, right: 390, bottom: 134 };
  const pill = { left: 72, top: 88, right: 318, bottom: 132 };
  const empty = { x: 18, y: 110 };
  const onPill = { x: 195, y: 110 };

  assert.equal(pointInChromeRect(empty, row), true, "probe sits inside the full-width wrapper");
  assert.equal(pointInChromeRect(empty, pill), false, "probe sits outside the visible pill");
  assert.equal(
    pointHitsOccupiedChrome(empty, [pill]),
    false,
    "empty wrapper space must not count as occupied chrome",
  );
  assert.equal(pointHitsOccupiedChrome(onPill, [pill]), true);
});

test("portrait tray-to-kenzan corridor stays below the occupied top chrome rectangle", () => {
  const cases = [
    { width: 390, height: 844, safeTop: 47 },
    { width: 390, height: 844, safeTop: 59 },
    { width: 430, height: 932, safeTop: 47 },
    { width: 430, height: 932, safeTop: 59 },
  ];

  for (const viewport of cases) {
    const occupiedBottom = representativeOccupiedTopBottom(viewport.safeTop);
    const topChrome = { left: 0, top: 0, right: viewport.width, bottom: occupiedBottom };
    const tray = {
      left: 24,
      top: viewport.height - 148,
      right: viewport.width - 24,
      bottom: viewport.height - 12,
    };
    const trayCenter = {
      x: (tray.left + tray.right) / 2,
      y: (tray.top + tray.bottom) / 2,
    };
    const kenzan = { x: viewport.width / 2, y: viewport.height * 0.52 };
    const corridor = dragCorridorRect(trayCenter, kenzan, 56);
    const pinField = {
      left: kenzan.x - 72,
      top: kenzan.y - 72,
      right: kenzan.x + 72,
      bottom: kenzan.y + 72,
    };

    assert.equal(
      rectsIntersect(topChrome, corridor),
      false,
      `${viewport.width}×${viewport.height} safe-top ${viewport.safeTop}: occupied chrome intersects the insertion corridor`,
    );
    assert.equal(
      rectsIntersect(topChrome, pinField),
      false,
      `${viewport.width}×${viewport.height} safe-top ${viewport.safeTop}: occupied chrome covers the usable pin field`,
    );
    assert.ok(tray.top > corridor.top, "tray remains the corridor origin, not a mid-screen blocker");
  }
});
