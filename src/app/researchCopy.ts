/**
 * Research standalones bake `__LL_BEGIN__`. Their rendered copy and aria
 * labels omit the word “study”. Ordinary play does not call this.
 */

export function preventionToggleLabel(on: boolean, researchBake: boolean): string {
  const name = researchBake ? "Prevent overlaps" : "Prevent overlaps (study)";
  return `${name}: ${on ? "on" : "off"}`;
}

export function stemProtectionStatus(enabled: boolean, researchBake: boolean): string {
  if (!enabled) return "Stem protection off. Shape freely.";
  return researchBake
    ? "Stem protection on. Existing overlaps can move freely."
    : "Stem protection study on. Existing overlaps can move freely.";
}

/** Hide the guide’s optional briefs and retitle the remaining research labels. */
export function applyResearchStudyCopy(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>(".looking-study, #guide-study-choice")) {
    element.hidden = true;
  }
  const prevention = root.querySelector("#stem-prevention-toggle");
  if (prevention) prevention.textContent = preventionToggleLabel(false, true);
  const exportButton = root.querySelector("#telemetry-export-trigger");
  if (exportButton) exportButton.textContent = "Export local data";
  const eyebrow = root.querySelector("#telemetry-export-panel .eyebrow");
  if (eyebrow) eyebrow.textContent = "Local data";
  const closeExport = root.querySelector("#telemetry-export-close");
  if (closeExport) closeExport.setAttribute("aria-label", "Close local data");
}

/**
 * The same omissions, on the shell markup, so a test can scan what a baked
 * build renders. Scripts, the meta description, and the noscript fallback
 * are not player-facing copy.
 */
export function researchShellCopy(html: string): string {
  const withoutBriefs = stripLookingStudy(html).replace(
    /<p\b[^>]*\bid="guide-study-choice"[^>]*>[\s\S]*?<\/p>/,
    "",
  );
  const replaced = withoutBriefs
    .replaceAll("Prevent overlaps (study)", "Prevent overlaps")
    .replaceAll("Export local study data", "Export local data")
    .replaceAll("Local study data", "Local data")
    .replaceAll("Close local study data", "Close local data");
  const shell = replaced
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const labels = [...shell.matchAll(/\baria-label="([^"]*)"/gi)].map((match) => match[1]);
  const text = shell.replace(/<[^>]+>/g, " ");
  return `${text}\n${labels.join("\n")}`;
}

function stripLookingStudy(html: string): string {
  let result = "";
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf("<details", cursor);
    if (start < 0) {
      result += html.slice(cursor);
      break;
    }
    result += html.slice(cursor, start);
    const openEnd = html.indexOf(">", start);
    const close = html.indexOf("</details>", openEnd);
    if (openEnd < 0 || close < 0) {
      result += html.slice(start);
      break;
    }
    const open = html.slice(start, openEnd + 1);
    const end = close + "</details>".length;
    if (!/\blooking-study\b/.test(open)) result += html.slice(start, end);
    cursor = end;
  }
  return result;
}
