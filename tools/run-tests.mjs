import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolsDirectory, "..");
const testsDirectory = path.join(projectDirectory, "tests");
const testFilePattern = /(?:\.test|\.spec)\.(?:ts|tsx|mts|cts)$/i;

function parseArguments(arguments_) {
  if (arguments_.some((argument) => argument === "--experimental-test-coverage")) {
    throw new Error(
      "Coverage is not supported by the bundled test harness; use source-aware coverage tooling.",
    );
  }

  const selectors = [];
  const forwarded = [];
  for (const argument of arguments_) {
    if (!argument.startsWith("-") && testFilePattern.test(argument)) {
      selectors.push(path.resolve(projectDirectory, argument));
    } else {
      forwarded.push(argument);
    }
  }
  return { selectors, forwarded };
}

async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTestFiles(entryPath)));
    } else if (entry.isFile() && testFilePattern.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function runNodeTests(compiledTests, forwardedArguments) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--test", ...forwardedArguments, ...compiledTests],
      {
        cwd: projectDirectory,
        env: process.env,
        stdio: "inherit",
      },
    );

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Node test runner was terminated by ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

let temporaryDirectory;

try {
  const allTestFiles = await collectTestFiles(testsDirectory).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  const { selectors, forwarded } = parseArguments(process.argv.slice(2));
  const testFiles = selectors.length
    ? allTestFiles.filter((testFile) => selectors.includes(path.resolve(testFile)))
    : allTestFiles;

  const missingSelectors = selectors.filter(
    (selector) => !allTestFiles.some((testFile) => path.resolve(testFile) === selector),
  );
  if (missingSelectors.length > 0) {
    throw new Error(
      `Selected test file(s) were not found: ${missingSelectors
        .map((selector) => path.relative(projectDirectory, selector))
        .join(", ")}`,
    );
  }

  if (testFiles.length === 0) {
    throw new Error(
      "No TypeScript tests found. Expected tests/**/*.test.ts or tests/**/*.spec.ts.",
    );
  }

  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "ikebana-web-alpha-tests-"));
  await cp(testsDirectory, path.join(temporaryDirectory, "tests"), { recursive: true });
  await cp(
    path.join(projectDirectory, "fixtures"),
    path.join(temporaryDirectory, "fixtures"),
    { recursive: true },
  ).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });

  const compiledTests = await Promise.all(
    testFiles.map(async (testFile) => {
      const relativeTestPath = path.relative(testsDirectory, testFile);
      const commonJs = path.extname(testFile).toLowerCase() === ".cts";
      const outputFile = path.join(
        temporaryDirectory,
        "tests",
        `${relativeTestPath}.${commonJs ? "cjs" : "mjs"}`,
      );
      await mkdir(path.dirname(outputFile), { recursive: true });

      await build({
        absWorkingDir: projectDirectory,
        entryPoints: [testFile],
        outfile: outputFile,
        bundle: true,
        format: commonJs ? "cjs" : "esm",
        platform: "node",
        target: "node20",
        sourcemap: "inline",
        legalComments: "none",
        logLevel: "silent",
      });

      return outputFile;
    }),
  );

  console.log(`Running ${compiledTests.length} bundled TypeScript test file(s).`);
  process.exitCode = await runNodeTests(compiledTests, forwarded);
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
} finally {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
