import { BOTANICAL_FAMILIES, botanicalFamily, resolveBotanicalAppearance, type BotanicalFamilyId } from "../presentation/botanicalTones.ts";
import { getMaterialAppearance } from "../presentation/materialAppearance.ts";

type Part = { label: string; color: string };
export interface BotanicalToneSample { svg: string; parts: Part[] }
export interface BotanicalToneInventory { familyId: BotanicalFamilyId; generatorVersion: string; count: number }

/** Keep the primary chooser about the committed bowl. Unknown/non-tone families
 * (reed and trailer) do not turn into fictional color choices. */
export function botanicalToneInventory(generatorVersions: readonly string[]): BotanicalToneInventory[] {
  const present = new Map<BotanicalFamilyId, BotanicalToneInventory>();
  for (const version of generatorVersions) {
    const family = botanicalFamily(version);
    if (!family) continue;
    const entry = present.get(family.id);
    if (entry) entry.count++;
    else present.set(family.id, { familyId: family.id, generatorVersion: version, count: 1 });
  }
  return BOTANICAL_FAMILIES.flatMap(family => present.has(family.id) ? [present.get(family.id)!] : []);
}

const hex = (value: number) => `#${value.toString(16).padStart(6, "0")}`;
const path = (d: string, color: string, width = 2) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** Deliberately small, unlit form samples, not photographs of the player's exact
 * seed. Every displayed part color comes from the same resolver as ThreeStudio.
 * No generated bitmap, WebGL renderer or screenshot cache is needed in the menu. */
export function botanicalToneSample(familyId: BotanicalFamilyId, toneId: string, generatorVersion?: string): BotanicalToneSample {
  const family = BOTANICAL_FAMILIES.find(item => item.id === familyId)!;
  if (!family.tones.some(item => item.id === toneId)) throw new Error("Unknown botanical tone sample.");
  const version = generatorVersion ?? family.versions.at(-1)!;
  if (botanicalFamily(version)?.id !== familyId) throw new Error("Botanical tone sample belongs to another material.");
  const a = resolveBotanicalAppearance(version, getMaterialAppearance(version), { [familyId]: toneId });
  const stem = hex(a.branchColors.trunk), lateral = hex(a.branchColors.lateral);
  const leaf = hex(a.leaf.color), vein = hex(a.leaf.veinColor), bloom = hex(a.bloom.color);
  const bud = hex(a.budColor), berry = hex(a.berry?.color ?? a.budColor);
  const wood = ["flowering-branch", "bare-branch", "berry-twig", "lobed-leaf", "silver-seed"].includes(familyId);
  const parts: Part[] = [{ label: wood ? "Wood" : "Stem", color: stem }];
  const leafy = !["bare-branch", "berry-twig", "blossom-spray", "silver-seed"].includes(familyId);
  const flowering = ["flowering-branch", "single-flower", "compact-flower", "flower-volume", "blossom-spray", "nodding-flower", "violet-sprig", "indigo-spire"].includes(familyId);
  if (leafy) parts.push({ label: "Leaves", color: leaf });
  if (flowering) parts.push({ label: "Flowers", color: bloom });
  if (familyId === "flowering-branch") parts.push({ label: "Buds", color: bud });
  if (familyId === "berry-twig") parts.push({ label: "Berries", color: berry });
  if (familyId === "silver-seed") {
    parts.push({ label: "Seed discs", color: hex(a.seedpod!.color) });
    parts.push({ label: "Rims", color: hex(a.seedpod!.rimColor) });
  }
  const blade = (x: number, y: number, rotation: number, scale = 1) => `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><path d="M0 0 C-8 -7 -6 -16 0 -22 C7 -14 8 -7 0 0Z" fill="${leaf}"/>${path("M0 -1 Q1 -11 0 -20", vein, .8)}</g>`;
  const flower = (x: number, y: number, size = 1, tuft = false) => {
    const count = tuft ? 8 : 5;
    return `<g transform="translate(${x} ${y}) scale(${size})">${Array.from({ length: count }, (_, i) => `<ellipse cx="0" cy="-5" rx="${tuft ? 4.4 : 3.8}" ry="6" transform="rotate(${i * 360 / count})" fill="${bloom}" stroke="${bloom}" stroke-width=".7"/>`).join("")}<circle r="2" fill="${hex(a.bloom.collarColor ?? a.branchColors.pedicel)}"/></g>`;
  };
  let drawing = "";
  switch (familyId) {
    case "flowering-branch":
    case "bare-branch":
      drawing = path("M37 65 L42 11", stem, 3) + path("M39 43 L21 30 M41 28 L60 17 M41 34 L55 32", lateral, 2);
      if (familyId === "flowering-branch") drawing += blade(34, 39, -48, .55) + flower(21, 27, .7) + flower(61, 16, .6) + `<ellipse cx="55" cy="30" rx="2.6" ry="3.8" fill="${bud}"/>`;
      break;
    case "single-flower":
      drawing = path("M41 66 Q37 42 43 21", stem) + blade(40, 50, -55, .7) + blade(40, 43, 55, .6) + flower(43, 19, 1.25);
      break;
    case "compact-flower":
      drawing = path("M40 66 Q43 41 39 25", stem) + blade(41, 53, -55, .55) + blade(41, 47, 55, .5) + flower(39, 22, .95, true);
      break;
    case "flower-volume":
      drawing = path("M41 66 L41 29", stem) + blade(41, 53, -55, .55) + blade(41, 44, 55, .5) + flower(32, 26, .85, true) + flower(50, 26, .85, true) + flower(41, 15, .85, true);
      break;
    case "blossom-spray":
      drawing = path("M41 66 Q39 42 42 12", stem) + path("M40 50 Q29 46 23 35 M41 37 Q54 34 59 23 M42 24 Q34 23 29 16", lateral, 1.4) + flower(23, 34, .55, true) + flower(60, 22, .55, true) + flower(29, 15, .5, true) + flower(43, 11, .5, true);
      break;
    case "violet-sprig":
      drawing = path("M41 66 Q38 46 42 23", stem, 1.6) + path("M40 49 L24 39 L17 27 M41 37 L58 32 L66 19 M42 27 L34 13", lateral, 1.2) + blade(40, 55, -55, .4) + blade(40, 45, 55, .35)
        + flower(17, 26, .5) + flower(26, 32, .5) + flower(57, 30, .45) + flower(66, 18, .45) + flower(34, 12, .45) + flower(45, 19, .4);
      break;
    case "indigo-spire":
      drawing = path("M41 67 L41 9", stem, 1.7) + blade(41, 54, -60, .5) + blade(41, 54, 60, .5);
      for (let tier = 0; tier < 4; tier++) {
        const y = 39 - tier * 9;
        drawing += path(`M41 ${y} L34 ${y - 2} M41 ${y} L48 ${y - 2}`, lateral, 1);
        drawing += `<path d="M35 ${y-3} Q30 ${y-7} 25 ${y-4} L25 ${y+1} Q32 ${y+3} 35 ${y-1}Z M47 ${y-3} Q52 ${y-7} 57 ${y-4} L57 ${y+1} Q50 ${y+3} 47 ${y-1}Z" fill="${bloom}"/>`;
      }
      break;
    case "nodding-flower":
      drawing = path("M33 66 Q38 46 35 30 Q29 10 40 10 Q51 9 54 23", stem) + blade(34, 51, -55, .55) + `<g transform="translate(54 22) rotate(-24)"><path d="M-3 0 Q-7 8 -12 17 Q0 24 12 17 Q7 8 3 0Z" fill="${bloom}"/><path d="M-12 17 Q0 13 12 17" fill="none" stroke="${hex(a.bloom.collarColor ?? a.branchColors.pedicel)}" stroke-width="1"/></g>`;
      break;
    case "berry-twig":
      drawing = path("M36 66 L43 10", stem, 2.6) + path("M39 47 L60 40 M41 31 L23 22 M42 22 L55 14", lateral, 1.6);
      for (const [x, y, px, py] of [[60, 36, 55, 42], [58, 46, 53, 42], [20, 18, 27, 24], [25, 28, 28, 24], [55, 10, 52, 16]]) drawing += path(`M${px} ${py} L${x} ${y}`, hex(a.branchColors.pedicel), 1) + `<circle cx="${x}" cy="${y}" r="3" fill="${berry}"/>`;
      break;
    case "silver-seed":
      drawing = path("M39 67 Q42 36 43 12", stem, 1.6) + path("M40 50 L24 39 M41 35 L58 25 M42 23 L31 16", lateral, 1);
      for (const [x, y, px, py, tilt] of [[24,29,24,39,-12],[33,35,34,43,20],[58,15,58,25,12],[50,22,50,29,-18],[31,7,31,16,-15],[40,9,40,17,20]]) {
        drawing += path(`M${px} ${py} L${x} ${y+7}`, hex(a.branchColors.pedicel), .8)
          + `<g transform="translate(${x} ${y}) rotate(${tilt})"><ellipse rx="5.4" ry="7.3" fill="${hex(a.seedpod!.color)}" stroke="${hex(a.seedpod!.rimColor)}" stroke-width=".9"/>${path("M0 6 L0 -6 M0 1 L3 -2 M0 -1 L-3 -3", hex(a.seedpod!.rimColor), .45)}</g>`;
      }
      break;
    case "leafy-shoot":
      drawing = path("M42 66 Q40 38 43 10", stem) + blade(42, 56, -55, .8) + blade(41, 43, 55, .75) + blade(42, 29, -45, .7) + blade(43, 17, 20, .6);
      break;
    case "foliage-fan":
      drawing = path("M41 66 Q38 35 38 15", stem, 2.5) + path("M40 50 L16 36 M39 41 L65 25", lateral, 1.8) + blade(17, 37, -24, .65) + blade(28, 43, 10, .65) + blade(37, 30, -25, .7) + blade(38, 18, 25, .6) + blade(52, 34, -12, .65) + blade(63, 27, 35, .7);
      break;
    case "fern-frond":
      drawing = path("M41 66 Q35 38 44 8", stem, 1.6);
      for (let i = 0; i < 5; i++) {
        const y = 49 - i * 8, spread = 17 - i * 2;
        drawing += path(`M40 ${y} L${40 - spread} ${y - 8} M40 ${y} L${40 + spread} ${y - 8}`, lateral, 1);
        for (const side of [-1, 1]) for (let j = 1; j <= 3; j++) drawing += blade(40 + side * spread * j / 3, y - j * 8 / 3, side * 32, .23 + (4 - i) * .015);
      }
      break;
    case "lobed-leaf": {
      const lobe = (x: number, y: number, rotation: number, scale: number) => `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><path d="M0 0 L-12 -3 L-9 -8 L-18 -13 L-9 -15 L-11 -24 L-4 -20 L0 -33 L4 -20 L11 -24 L9 -15 L18 -13 L9 -8 L12 -3Z" fill="${leaf}"/>${path("M0 0 L0 -28 M0 -4 L-13 -13 M0 -4 L13 -13 M0 -8 L-8 -21 M0 -8 L8 -21", vein, 1)}</g>`;
      drawing = path("M41 66 L42 12", stem, 2.4) + path("M41 49 L23 42 M41 49 L60 43 M42 31 L30 24 M42 31 L54 23", hex(a.branchColors.petiole), 1.2) + lobe(23, 42, -35, .6) + lobe(60, 43, 40, .6) + lobe(30, 24, -35, .52) + lobe(54, 23, 35, .52);
      break;
    }
    case "broad-blade":
      drawing = path("M38 67 Q40 56 40 48", stem, 2) + `<path d="M40 54 C24 37 28 17 51 6 C48 29 61 40 40 54Z" fill="${leaf}"/>` + path("M40 54 Q34 29 50 8", vein, 1.1);
      break;
  }
  return { svg: `<svg class="botanical-tone-sample" viewBox="0 0 82 74" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${drawing}</svg>`, parts };
}
