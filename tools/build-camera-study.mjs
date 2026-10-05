/** Run after npm run build. Produces an offline, synthetic, isolated owner trial. */
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("tests/fixtures/polish-baseline-arrangements.plants.json", root), "utf8")).arrangements[0];
const saved = {
  storageVersion: 2, savedAt: "2026-10-05T00:00:00Z", nextSuccessfulOrdinal: fixture.successfulPlantOrdinal + 1,
  plants: fixture.plants,
  camera: { position: { x: 0, y: 3.7, z: 15 }, target: { x: 0, y: 2.55, z: 0 }, up: { x: 0, y: 1, z: 0 } },
  scene: { sceneVersion: 1, layoutId: "original", colorId: "sand", finishId: "glaze", backdropId: "paper", perchId: "ground", photoFormat: "landscape", stemFibers: false },
};
const seed = JSON.stringify(saved).replaceAll("<", "\\u003c");
const setup = `<script>
const studyURL = new URL(location.href);
studyURL.searchParams.set("cameraViews", "1");
history.replaceState(null, "", studyURL);
try {
  const key = "ikebana-camera-views-study:studio-v2";
  if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(${seed}));
} catch { /* The app reports storage unavailability; no personal keys are accessed. */ }
</script>`;
const input = await readFile(new URL("dist/ikebana-web-alpha-standalone.html", root), "utf8");
const output = input.replace("<head>", "<head>" + setup).replace("<title>Living Line</title>", "<title>Living Line — Camera A/B study</title>");
await writeFile(new URL("dist/camera-ab-study.html", root), output);
console.log("Built dist/camera-ab-study.html (isolated synthetic bowl; existing study saves retained).");
