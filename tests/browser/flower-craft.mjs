/** Rendered study of the owner-reported petal fault and two new stocks.
 * This reuses ordinary UI operations from the existing botanical harness.
 * Matched old/new captures document appearance; CPU triangle checks establish
 * petal separation. No screenshot is treated as an automatic taste verdict. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { checkVioletCuttings } from "./violet-cuttings.mjs";

export async function checkFlowerCraft({ browser, baseURL, output }) {
  const petals = [["compact-flower", "plum"], ["blossom-spray", "mauve"]];
  const result = { status: "RUNNING", baseline: null, candidate: null };
  const baselineDirectory = process.env.IKEBANA_FLOWER_BASELINE_DIR;
  assert.ok(baselineDirectory, "Build the pinned pre-repair flower baseline separately");
  const baselineURL = "http://127.0.0.1:4175/";
  const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--outDir", path.resolve(baselineDirectory, "dist"), "--host", "127.0.0.1", "--port", "4175", "--strictPort"], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "", launchError;
  server.stdout.on("data", data => { log += data; });
  server.stderr.on("data", data => { log += data; });
  server.on("error", error => { launchError = error; });
  try {
    const deadline = Date.now() + 30_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (server.exitCode !== null) throw new Error(`Flower baseline exited ${server.exitCode}: ${log}`);
      try { ready = (await fetch(baselineURL, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Bounded startup check. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(ready, "Pinned flower baseline becomes ready");
    result.baseline = await checkVioletCuttings({ browser, baseURL: baselineURL, output,
      cases: petals, prefix: "flower-before", reportName: "flower-before", extended: true });
    result.candidate = await checkVioletCuttings({ browser, baseURL, output,
      cases: [...petals, ["starry-pincushion", "plum"], ["silver-seed", "straw"]],
      prefix: "flower-after", reportName: "flower-after", extended: true });
    for (let i = 0; i < petals.length; i++) {
      assert.deepEqual(result.candidate.cases[i].fixture, result.baseline.cases[i].fixture,
        "Matched petal captures use the exact same canonical material and seed");
    }
    result.status = "PASS";
  } catch (error) {
    result.status = "FAIL"; result.failure = error.stack ?? String(error);
    throw error;
  } finally {
    if (server.exitCode === null) server.kill("SIGTERM");
    await writeFile(path.join(output, "flower-baseline-server.log"), log);
    await writeFile(path.join(output, "flower-craft.json"), JSON.stringify(result, null, 2));
  }
  return result;
}
