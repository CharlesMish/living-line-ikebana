import assert from "node:assert/strict";
import test from "node:test";

import {
  contextualChromeVisibility,
  dragCorridorRect,
  rectsIntersect,
} from "../../src/app/chrome.ts";

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

test("portrait tray-to-kenzan corridor stays below the reserved top chrome band", () => {
  const viewports = [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ];

  for (const viewport of viewports) {
    const topChrome = { left: 0, top: 0, right: viewport.width, bottom: 100 };
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
      `${viewport.width}×${viewport.height}: top chrome intersects the insertion corridor`,
    );
    assert.equal(
      rectsIntersect(topChrome, pinField),
      false,
      `${viewport.width}×${viewport.height}: top chrome covers the usable pin field`,
    );
    assert.ok(tray.top > corridor.top, "tray remains the corridor origin, not a mid-screen blocker");
  }
});
