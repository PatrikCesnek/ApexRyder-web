#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relPath) {
  return readFileSync(path.join(root, relPath), "utf8");
}

const failures = [];
function fail(message) {
  failures.push(message);
}

// 1. Load translations out of script.js
const scriptPath = "script.js";
if (!existsSync(path.join(root, scriptPath))) {
  fail(`${scriptPath}: file does not exist`);
}
let translations = {};
let locales = [];
if (existsSync(path.join(root, scriptPath))) {
  const scriptSource = read(scriptPath);
  const match = scriptSource.match(/const translations = (\{[\s\S]*?\n\});/);
  if (!match) {
    fail(`${scriptPath}: could not locate "const translations = {...};" block`);
  } else {
    translations = eval(`(${match[1]})`);
    locales = Object.keys(translations);
    for (const required of ["en", "sk", "cs"]) {
      if (!locales.includes(required)) {
        fail(`${scriptPath}: missing required locale "${required}"`);
      }
    }
  }
}

// 2. Check each HTML page
const pages = ["index.html", "support.html", "privacy.html"];
for (const page of pages) {
  if (!existsSync(path.join(root, page))) {
    fail(`${page}: file does not exist`);
    continue;
  }
  const html = read(page);

  const i18nKeys = [...html.matchAll(/data-i18n=["']([\w.]+)["']/g)].map((m) => m[1]);
  for (const key of i18nKeys) {
    for (const locale of locales) {
      if (!(key in translations[locale])) {
        fail(`${page}: data-i18n key "${key}" missing from translations.${locale}`);
      }
    }
  }

  const refs = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (
      ref.startsWith("http://") ||
      ref.startsWith("https://") ||
      ref.startsWith("mailto:") ||
      ref.startsWith("#") ||
      ref.startsWith("/#")
    ) {
      continue;
    }
    let localPath = ref.split("#")[0];
    if (localPath === "/" || localPath === "") continue;
    if (localPath.startsWith("/")) localPath = localPath.slice(1);
    if (localPath === "support" || localPath === "privacy") {
      localPath = `${localPath}.html`;
    }
    if (!existsSync(path.join(root, localPath))) {
      fail(`${page}: reference "${ref}" does not resolve to an existing file (${localPath})`);
    }
  }

  const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const [, block] of jsonLdBlocks) {
    try {
      JSON.parse(block);
    } catch (err) {
      fail(`${page}: invalid JSON-LD — ${err.message}`);
    }
  }
}

// 3. Assets referenced only via meta content (not href/src) must still exist
for (const assetPath of [
  "assets/icon.png",
  "assets/og-image.png",
  "assets/screenshots/menu.png",
  "assets/screenshots/riding.png",
  "assets/screenshots/tutorial.png",
]) {
  if (!existsSync(path.join(root, assetPath))) {
    fail(`${assetPath}: expected generated asset does not exist`);
  }
}

// 4. sitemap.xml lists exactly the real pages
if (!existsSync(path.join(root, "sitemap.xml"))) {
  fail("sitemap.xml: file does not exist");
} else {
  const sitemap = read("sitemap.xml");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (locs.length !== 3) {
    fail(`sitemap.xml: expected 3 <loc> entries, found ${locs.length}`);
  }
}

// 5. robots.txt references the sitemap
if (!existsSync(path.join(root, "robots.txt"))) {
  fail("robots.txt: file does not exist");
} else if (!read("robots.txt").includes("Sitemap:")) {
  fail("robots.txt: missing Sitemap: directive");
}

if (failures.length > 0) {
  console.error(`FAIL — ${failures.length} issue(s):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
} else {
  console.log(`PASS — ${pages.length} pages, ${locales.length} locales, all references resolve.`);
}
