import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const output = resolve(process.argv[2] ?? "artifacts/candidate-sol61/candidate-study-standalone.html");
const result = await build({ entryPoints: ["src/experiments/candidateStudy.ts"],
  bundle: true, write: false, minify: true, format: "iife", platform: "browser",
  target: "es2020", legalComments: "inline" });
const script = result.outputFiles[0].text.replaceAll("</script", "<\\/script");
const html = (await readFile("candidate-study.html", "utf8"))
  .replace('<script type="module" src="/src/experiments/candidateStudy.ts"></script>', () => `<script>${script}</script>`);
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(output, html);
console.log(`Wrote self-contained candidate demo: ${output}`);
