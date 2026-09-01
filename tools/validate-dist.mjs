import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolsDirectory, "..");
const distributionDirectory = path.join(projectDirectory, "dist");
const indexPath = path.join(distributionDirectory, "index.html");
const standalonePath = path.join(
  distributionDirectory,
  "ikebana-web-alpha-standalone.html",
);

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function getAttribute(tag, attribute) {
  const match = tag.match(
    new RegExp(
      `\\s${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i",
    ),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function isInlineReference(reference) {
  return /^(?:data:|blob:|#)/i.test(reference);
}

function isRemoteReference(reference) {
  return /^(?:https?:)?\/\//i.test(reference);
}

function localResourcePath(reference, htmlPath) {
  const cleanReference = reference.split(/[?#]/, 1)[0];
  const resolved = cleanReference.startsWith("/")
    ? path.resolve(distributionDirectory, `.${cleanReference}`)
    : path.resolve(path.dirname(htmlPath), cleanReference);
  const relative = path.relative(distributionDirectory, resolved);
  return relative.startsWith("..") || path.isAbsolute(relative) ? undefined : resolved;
}

function resourceReferences(html) {
  const references = [];
  const tags = html.match(/<(?:script|link|img|audio|source|video|iframe|embed|object)\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const tagName = tag.match(/^<([a-z0-9-]+)/i)?.[1].toLowerCase();
    if (!tagName) continue;

    if (tagName === "script") {
      const value = getAttribute(tag, "src");
      if (value) references.push({ tagName, attribute: "src", value, tag });
    } else if (tagName === "link") {
      const rel = getAttribute(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
      if (
        rel.some((value) =>
          ["stylesheet", "modulepreload", "preload", "icon", "apple-touch-icon", "manifest"].includes(
            value,
          ),
        )
      ) {
        const value = getAttribute(tag, "href");
        if (value) references.push({ tagName, attribute: "href", value, tag, rel });
      }
    } else if (tagName === "object") {
      const value = getAttribute(tag, "data");
      if (value) references.push({ tagName, attribute: "data", value, tag });
    } else {
      const value = getAttribute(tag, "src");
      if (value) references.push({ tagName, attribute: "src", value, tag });
      if (tagName === "video") {
        const poster = getAttribute(tag, "poster");
        if (poster) references.push({ tagName, attribute: "poster", value: poster, tag });
      }
    }

    const srcset = getAttribute(tag, "srcset");
    if (srcset) references.push({ tagName, attribute: "srcset", value: srcset, tag });
  }

  return references;
}

try {
  check(await exists(indexPath), "Missing dist/index.html (the Vite build output).");
  check(
    await exists(standalonePath),
    "Missing dist/ikebana-web-alpha-standalone.html.",
  );

  const distributionFiles = (await exists(distributionDirectory))
    ? await collectFiles(distributionDirectory)
    : [];

  if (await exists(indexPath)) {
    const indexHtml = await readFile(indexPath, "utf8");
    const indexReferences = resourceReferences(indexHtml);
    const indexScripts = indexReferences.filter(
      (reference) => reference.tagName === "script" && reference.attribute === "src",
    );

    check(indexHtml.trim().length > 100, "dist/index.html is empty or unexpectedly small.");
    check(indexScripts.length > 0, "dist/index.html does not reference a built JavaScript entry.");

    for (const reference of indexReferences) {
      if (reference.attribute === "srcset") {
        check(false, "dist/index.html uses srcset, which this validator cannot prove local.");
        continue;
      }
      check(
        !isRemoteReference(reference.value),
        `dist/index.html has a remote ${reference.tagName} dependency: ${reference.value}`,
      );
      if (isRemoteReference(reference.value) || isInlineReference(reference.value)) continue;

      const resourcePath = localResourcePath(reference.value, indexPath);
      check(
        resourcePath !== undefined,
        `dist/index.html resource escapes dist/: ${reference.value}`,
      );
      if (resourcePath) {
        check(
          await exists(resourcePath),
          `dist/index.html references a missing file: ${reference.value}`,
        );
      }
    }
  }

  if (await exists(standalonePath)) {
    const html = await readFile(standalonePath, "utf8");
    const fileStats = await stat(standalonePath);
    const inlineStyles = [...html.matchAll(/<style\b[^>]*>([^]*?)<\/style>/gi)]
      .map((match) => match[1])
      .join("\n");
    const inlineScripts = [...html.matchAll(/<script\b[^>]*>([^]*?)<\/script>/gi)]
      .map((match) => match[1])
      .join("\n");
    const inlinedSourceNames = new Set(
      [...html.matchAll(/<(?:script|style)\b[^>]*>/gi)]
        .map((match) => getAttribute(match[0], "data-inline-source"))
        .filter(Boolean),
    );
    const cssUrls = [
      ...inlineStyles.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi),
    ].map((match) => match[2].trim());
    const standaloneReferences = resourceReferences(html);

    check(fileStats.size > 1_000, "Standalone HTML is unexpectedly small.");
    check(/<style\b[^>]*>/i.test(html), "Standalone HTML has no inline style block.");
    check(/<script\b[^>]*>[^]*?<\/script>/i.test(html), "Standalone HTML has no inline script.");
    for (const reference of standaloneReferences) {
      if (reference.attribute === "srcset") {
        check(false, "Standalone HTML contains srcset; inline it as one explicit resource.");
        continue;
      }
      const rel = reference.rel ?? [];
      const mustBeInlineElement =
        reference.tagName === "script" ||
        (reference.tagName === "link" &&
          rel.some((value) => ["stylesheet", "modulepreload", "preload"].includes(value)));
      check(
        !mustBeInlineElement && isInlineReference(reference.value),
        `Standalone HTML has a non-inline ${reference.tagName} ${reference.attribute}: ${reference.value}`,
      );
    }
    check(!/<base\b[^>]*\bhref\s*=/i.test(html), "Standalone HTML contains a base URL.");
    check(
      !/@import\s+(?:url\()?\s*["']/i.test(inlineStyles),
      "Inline CSS still contains @import.",
    );
    check(
      cssUrls.every((reference) => /^(?:data:|blob:|#)/i.test(reference)),
      "Inline CSS still contains a non-inline url().",
    );
    check(
      !/\bimport\s+(?:[^;"']+?\s+from\s*)?["'][^"']+["']/m.test(inlineScripts),
      "Inline JavaScript still contains a static module import.",
    );
    check(
      !/\bexport\s+[^;"']*?\sfrom\s*["'][^"']+["']/m.test(inlineScripts),
      "Inline JavaScript still contains a re-export dependency.",
    );
    check(
      !/\bimport\s*\(/m.test(inlineScripts),
      "Inline JavaScript still contains a dynamic module import.",
    );
    check(
      !/(?:^|["'`(])(?:\.\.?\/|\/)?assets\//m.test(inlineScripts),
      "Inline JavaScript still contains a runtime dist/assets reference.",
    );
    for (const assetPath of distributionFiles.filter((file) =>
      /[\\/]assets[\\/]/.test(file),
    )) {
      if (path.extname(assetPath).toLowerCase() === ".map") continue;
      if (inlinedSourceNames.has(path.basename(assetPath))) continue;
      check(
        !inlineScripts.includes(path.basename(assetPath)),
        `Inline JavaScript still names emitted asset ${path.basename(assetPath)}.`,
      );
    }
  }

  if (failures.length > 0) {
    console.error("Distribution validation failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Distribution valid (${distributionFiles.length} files; standalone is self-contained).`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
}
