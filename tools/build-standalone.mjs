import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolsDirectory, "..");
const distributionDirectory = path.join(projectDirectory, "dist");
const inputHtmlPath = path.join(distributionDirectory, "index.html");
const outputHtmlPath = path.join(
  distributionDirectory,
  "ikebana-web-alpha-standalone.html",
);

const MIME_TYPES = new Map([
  [".avif", "image/avif"],
  [".css", "text/css"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".json", "application/json"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".ogg", "audio/ogg"],
  [".otf", "font/otf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function isRemoteReference(reference) {
  return /^(?:https?:)?\/\//i.test(reference);
}

function isAlreadyInline(reference) {
  return /^(?:data:|blob:|#)/i.test(reference);
}

function stripQueryAndFragment(reference) {
  return reference.split(/[?#]/, 1)[0];
}

function resolveDistributionAsset(reference, relativeTo = inputHtmlPath) {
  if (isRemoteReference(reference)) {
    throw new Error(`Cannot make remote dependency standalone: ${reference}`);
  }
  if (isAlreadyInline(reference)) return undefined;

  let decodedReference;
  try {
    decodedReference = decodeURIComponent(stripQueryAndFragment(reference));
  } catch {
    decodedReference = stripQueryAndFragment(reference);
  }

  const resolved = decodedReference.startsWith("/")
    ? path.resolve(distributionDirectory, `.${decodedReference}`)
    : path.resolve(path.dirname(relativeTo), decodedReference);
  const relative = path.relative(distributionDirectory, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Asset escapes the distribution directory: ${reference}`);
  }

  return resolved;
}

function mimeTypeFor(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

async function assetAsDataUri(reference, relativeTo) {
  const assetPath = resolveDistributionAsset(reference, relativeTo);
  if (!assetPath) return reference;
  const bytes = await readFile(assetPath);
  return `data:${mimeTypeFor(assetPath)};base64,${bytes.toString("base64")}`;
}

async function replaceAsync(source, pattern, replacer) {
  const matches = [...source.matchAll(pattern)];
  if (matches.length === 0) return source;

  let cursor = 0;
  let result = "";
  for (const match of matches) {
    result += source.slice(cursor, match.index);
    result += await replacer(...match);
    cursor = match.index + match[0].length;
  }
  return result + source.slice(cursor);
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

async function inlineCssAssets(css, cssPath) {
  return replaceAsync(
    css,
    /url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
    async (_match, _quote, reference) => {
      const trimmedReference = reference.trim();
      if (isAlreadyInline(trimmedReference)) return `url(${trimmedReference})`;
      return `url("${await assetAsDataUri(trimmedReference, cssPath)}")`;
    },
  );
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

async function inlineStylesheets(html) {
  return replaceAsync(html, /<link\b[^>]*>/gi, async (tag) => {
    const rel = getAttribute(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
    const href = getAttribute(tag, "href");

    if (rel.includes("stylesheet")) {
      if (!href) throw new Error(`Stylesheet link has no href: ${tag}`);
      const cssPath = resolveDistributionAsset(href);
      if (!cssPath) throw new Error(`Expected a file-backed stylesheet: ${href}`);
      const css = (await inlineCssAssets(await readFile(cssPath, "utf8"), cssPath)).replace(
        /<\/style/gi,
        "<\\/style",
      );
      const preservedAttributes = ["id", "media", "nonce", "title"]
        .map((attribute) => {
          const value = getAttribute(tag, attribute);
          return value === undefined ? "" : ` ${attribute}="${value}"`;
        })
        .join("");
      const disabled = /\sdisabled(?:\s|=|>)/i.test(tag) ? " disabled" : "";
      return `<style data-inline-source="${path.basename(cssPath)}"${preservedAttributes}${disabled}>\n${css}\n</style>`;
    }

    if (rel.includes("modulepreload") || rel.includes("preload")) {
      if (href && isRemoteReference(href)) {
        throw new Error(`Cannot make remote preload standalone: ${href}`);
      }
      return "";
    }

    if (href && (rel.includes("icon") || rel.includes("apple-touch-icon"))) {
      const dataUri = await assetAsDataUri(href, inputHtmlPath);
      return tag.replace(href, dataUri);
    }

    return tag;
  });
}

async function bundleBrowserEntry(entryPath) {
  const result = await build({
    absWorkingDir: projectDirectory,
    entryPoints: [entryPath],
    outfile: path.join(distributionDirectory, ".standalone-entry.js"),
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: ["es2020", "safari15"],
    legalComments: "none",
    logLevel: "silent",
    plugins: [
      {
        name: "resolve-vite-root-assets",
        setup(esbuild) {
          esbuild.onResolve({ filter: /^\/assets\// }, (args) => ({
            path: path.join(distributionDirectory, args.path.slice(1)),
          }));
        },
      },
    ],
  });

  const javascript = result.outputFiles.find((file) => file.path.endsWith(".js"));
  if (!javascript) throw new Error(`esbuild emitted no JavaScript for ${entryPath}`);

  let source = javascript.text;
  const emittedAssets = await collectFiles(path.join(distributionDirectory, "assets"));
  for (const assetPath of emittedAssets) {
    const extension = path.extname(assetPath).toLowerCase();
    if ([".js", ".css", ".map"].includes(extension)) continue;

    const dataUri = await assetAsDataUri(
      `/${path.relative(distributionDirectory, assetPath).split(path.sep).join("/")}`,
      inputHtmlPath,
    );
    const relativeFromEntry = path
      .relative(path.dirname(entryPath), assetPath)
      .split(path.sep)
      .join("/");
    const relativeFromDistribution = path
      .relative(distributionDirectory, assetPath)
      .split(path.sep)
      .join("/");
    const references = new Set([
      path.basename(assetPath),
      relativeFromEntry.startsWith(".") ? relativeFromEntry : `./${relativeFromEntry}`,
      relativeFromDistribution,
      `./${relativeFromDistribution}`,
      `/${relativeFromDistribution}`,
    ]);
    for (const reference of references) source = source.split(reference).join(dataUri);
  }

  for (const assetPath of emittedAssets) {
    if (path.extname(assetPath).toLowerCase() === ".map") continue;
    if (path.resolve(assetPath) === path.resolve(entryPath)) continue;
    const basename = path.basename(assetPath);
    if (source.includes(basename)) {
      throw new Error(
        `Standalone bundle still references emitted asset ${basename}; ` +
          "inline it explicitly or remove the runtime load.",
      );
    }
  }

  return source.replace(/<\/script/gi, "<\\/script");
}

async function inlineScripts(html) {
  return replaceAsync(
    html,
    /<script\b[^>]*>[^]*?<\/script>/gi,
    async (tag) => {
      const reference = getAttribute(tag, "src");
      if (!reference) return tag;
      const scriptType = getAttribute(tag, "type")?.toLowerCase();
      if (scriptType && scriptType !== "module") {
        throw new Error(
          `Only Vite module entry scripts can be bundled safely (found type=${scriptType}).`,
        );
      }
      const scriptPath = resolveDistributionAsset(reference);
      if (!scriptPath) throw new Error(`Expected a file-backed script: ${reference}`);
      const javascript = await bundleBrowserEntry(scriptPath);
      const preservedAttributes = ["id", "nonce"]
        .map((attribute) => {
          const value = getAttribute(tag, attribute);
          return value === undefined ? "" : ` ${attribute}="${value}"`;
        })
        .join("");
      const asyncAttribute = /\sasync(?:\s|=|>)/i.test(tag) ? " async" : "";
      return `<script type="module" data-inline-source="${path.basename(scriptPath)}"${preservedAttributes}${asyncAttribute}>\n${javascript}\n</script>`;
    },
  );
}

async function inlineHtmlMedia(html) {
  const srcsetTag = (html.match(/<(?:img|source)\b[^>]*>/gi) ?? []).find((tag) =>
    getAttribute(tag, "srcset"),
  );
  if (srcsetTag) {
    throw new Error("Standalone generation does not support srcset; use one explicit source.");
  }

  const patterns = [
    { pattern: /<(?:img|audio|source|video)\b[^>]*>/gi, attribute: "src" },
    { pattern: /<video\b[^>]*>/gi, attribute: "poster" },
  ];

  let output = html;
  for (const { pattern, attribute } of patterns) {
    output = await replaceAsync(output, pattern, async (tag) => {
      const reference = getAttribute(tag, attribute);
      if (!reference) return tag;
      if (isAlreadyInline(reference)) return tag;
      const dataUri = await assetAsDataUri(reference, inputHtmlPath);
      return tag.replace(reference, dataUri);
    });
  }
  return output;
}

/**
 * Study packets bake one condition without a URL flag.
 * `1` is the planting boundary; `2` is that boundary plus tap-to-place.
 * The page title and filename do not name the condition.
 */
function withPlaceBake(html, token) {
  if (!token) return html;
  const injection = `<script>globalThis.__LL_PLACE__=${JSON.stringify(token)};</script>\n`;
  return html.replace(/<script\b/i, `${injection}<script`);
}

const PLACE_FILES = {
  baseline: { file: "arrangement-1.html", token: "" },
  cue: { file: "arrangement-2.html", token: "1" },
  tap: { file: "arrangement-3.html", token: "2" },
};

/**
 * Begin study packets. Every file also bakes tap-to-place.
 * Filenames do not name the condition. `open` marks placement-only.
 * `line:N` / `for:N` set the first index. Any of these hides the older Garden and Guide study lines.
 */
function withBeginBake(html, token) {
  if (!token) return html;
  const injection = `<script>globalThis.__LL_BEGIN__=${JSON.stringify(token)};</script>\n`;
  return html.replace(/<script\b/i, `${injection}<script`);
}

const BEGIN_FILES = {
  open: { file: "bowl-1.html", place: "2", begin: "open" },
  "line-a": { file: "bowl-2a.html", place: "2", begin: "line:0" },
  "line-b": { file: "bowl-2b.html", place: "2", begin: "line:1" },
  "for-a": { file: "bowl-3a.html", place: "2", begin: "for:0" },
  "for-b": { file: "bowl-3b.html", place: "2", begin: "for:1" },
};

try {
  let html = await readFile(inputHtmlPath, "utf8");
  html = await inlineStylesheets(html);
  html = await inlineHtmlMedia(html);
  html = await inlineScripts(html);

  if (!/<style\b/i.test(html)) {
    html = html.replace(/<\/head>/i, '<style data-inline-source="none"></style>\n</head>');
  }

  const banner =
    "<!-- Self-contained build: generated by tools/build-standalone.mjs.\n" +
    "     Includes Three.js r181, Copyright Three.js Authors, MIT License.\n" +
    "     See THIRD_PARTY_NOTICES.md in the source distribution. -->\n";
  html = html.replace(/^(?:<!doctype html>\s*)?/i, (doctype) => `${doctype}${banner}`);
  await writeFile(outputHtmlPath, html, "utf8");
  console.log(`Wrote ${path.relative(projectDirectory, outputHtmlPath)}.`);

  const requested = process.env.LIVING_LINE_PLACE ?? "";
  const names = requested === "all" ? Object.keys(PLACE_FILES) : requested ? [requested] : [];
  for (const name of names) {
    const entry = PLACE_FILES[name];
    if (!entry) throw new Error(`LIVING_LINE_PLACE must be baseline, cue, tap, or all (got ${requested}).`);
    const target = path.join(distributionDirectory, entry.file);
    await writeFile(target, withPlaceBake(html, entry.token), "utf8");
    console.log(`Wrote ${path.relative(projectDirectory, target)}.`);
  }

  const beginRequested = process.env.LIVING_LINE_BEGIN ?? "";
  const beginNames = beginRequested === "all" ? Object.keys(BEGIN_FILES) : beginRequested ? [beginRequested] : [];
  for (const name of beginNames) {
    const entry = BEGIN_FILES[name];
    if (!entry) throw new Error(`LIVING_LINE_BEGIN must be open, line-a, line-b, for-a, for-b, or all (got ${beginRequested}).`);
    const target = path.join(distributionDirectory, entry.file);
    await writeFile(target, withBeginBake(withPlaceBake(html, entry.place), entry.begin), "utf8");
    console.log(`Wrote ${path.relative(projectDirectory, target)}.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
}
