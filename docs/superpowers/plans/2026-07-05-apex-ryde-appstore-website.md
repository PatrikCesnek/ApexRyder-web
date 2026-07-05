# Apex Ryde App Store Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production-grade, EN/SK/CS-localized Apex Ryde marketing/support/privacy-policy static website described in `docs/superpowers/specs/2026-07-05-apex-ryde-appstore-website-design.md`, run it locally for review, on the `develop` branch.

**Architecture:** Plain static HTML/CSS/JS, zero build step, three pages (`index.html`, `support.html`, `privacy.html`) sharing one `styles.css` and one `script.js` (a `translations` dictionary applied via `data-i18n` attributes). A generated `assets/` folder holds the app icon, three rotated screenshots, and a composited OG/social card. A Node validator script (no dependencies) checks structural correctness in place of unit tests, since this project has no application logic to unit-test.

**Tech Stack:** HTML5, CSS3 (custom properties, grid, no frameworks), vanilla JS (ES2020+, no build tooling), Python 3 + Pillow (one-off local asset generation, not shipped/served), Node.js (validator script only), Netlify (hosting, config only — no deploy in this plan).

## Global Constraints

- Game name on this site is **"Apex Ryde"** everywhere (title tags, headings, JSON-LD `name`, alt text).
- Support email: `pcesnek290@gmail.com` — used in `mailto:` links and privacy/support copy.
- Canonical/OG/JSON-LD URLs target `https://apex-ryde-ios.netlify.app/` (not live yet).
- No live App Store URL exists yet — every download CTA is a **non-link "Coming to the App Store" badge**, not an `<a>` pointing anywhere. JSON-LD `SoftwareApplication` omits `offers`/`downloadUrl`, with a comment marking where to add them later.
- Languages: `en` (default/fallback), `sk`, `cs` — every `data-i18n` key must have a value in all three.
- Colors are the exact sampled hex values from the spec — do not substitute approximate/guessed colors:
  `--bg:#0a0f1c` `--surface:#131b2e` `--surface-high:#1c2740` `--text:#f5f1ea` `--muted:#93a0c2` `--accent:#e23f2e` `--gold:#eabb89` `--asphalt:#4e4f5a`.
- All screenshots ship real captured game screenshots (`menu.png`, `riding.png`, `tutorial.png` from `~/Desktop/personalProjects/bikeGame/docs/images/`) rotated 90° **counter-clockwise** (`PIL.Image.ROTATE_90` / `transpose(Image.ROTATE_90)`) — this exact direction was verified visually against the raw files during planning; do not re-derive or use the opposite rotation.
- Every image needs real, descriptive `alt` text (not `alt=""` except for the two purely decorative brand-icon/download-icon instances next to visible text).
- All work happens on the `develop` branch (already created from `main`). Commit after every task.
- No npm install, no `node_modules`, no external CDNs, no webfonts — system font stack only.

---

### Task 1: Asset pipeline — rotate screenshots, copy icon, generate OG card

**Files:**
- Create: `scripts/generate-assets.py`
- Generates (not hand-written, produced by running the script): `assets/icon.png`, `assets/screenshots/menu.png`, `assets/screenshots/riding.png`, `assets/screenshots/tutorial.png`, `assets/og-image.png`

**Interfaces:**
- Produces: `assets/icon.png` (1024×1024), `assets/screenshots/{menu,riding,tutorial}.png` (1334×750 landscape), `assets/og-image.png` (1200×630) — all later tasks' HTML references these exact paths.

- [ ] **Step 1: Write the asset generation script**

Create `scripts/generate-assets.py`:

```python
#!/usr/bin/env python3
"""One-off asset pipeline for the Apex Ryde marketing site.

Rotates the game's raw (portrait-captured, landscape-content) screenshots
into correctly oriented landscape PNGs, copies the app icon, and composites
a 1200x630 Open Graph/Twitter social card from the riding screenshot.

Run from the apex-web repo root:
    python3 scripts/generate-assets.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent
GAME_IMAGES = Path("/Users/matee/Desktop/personalProjects/bikeGame/docs/images")
GAME_ICON = Path(
    "/Users/matee/Desktop/personalProjects/bikeGame/App/Assets.xcassets/"
    "AppIcon.appiconset/icon-1024.png"
)
ASSETS = REPO_ROOT / "assets"
SCREENSHOTS = ASSETS / "screenshots"

# Verified visually: ROTATE_90 (90 degrees counter-clockwise) is the
# orientation that makes "APEX" and the dash read upright and left-to-right.
ROTATION = Image.ROTATE_90

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def rotate_screenshots() -> None:
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    for name in ("menu.png", "riding.png", "tutorial.png"):
        img = Image.open(GAME_IMAGES / name).convert("RGB")
        rotated = img.transpose(ROTATION)
        rotated.save(SCREENSHOTS / name, "PNG")
        print(f"rotated {name}: {img.size} -> {rotated.size}")


def copy_icon() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    icon = Image.open(GAME_ICON).convert("RGB")
    icon.save(ASSETS / "icon.png", "PNG")
    print(f"copied icon: {icon.size}")


def generate_og_image() -> None:
    riding = Image.open(SCREENSHOTS / "riding.png").convert("RGB")
    target_w, target_h = 1200, 630
    target_ratio = target_w / target_h
    src_ratio = riding.width / riding.height
    if src_ratio > target_ratio:
        new_height = riding.height
        new_width = int(new_height * target_ratio)
    else:
        new_width = riding.width
        new_height = int(new_width / target_ratio)
    left = (riding.width - new_width) // 2
    top = (riding.height - new_height) // 2
    cropped = riding.crop((left, top, left + new_width, top + new_height))
    card = cropped.resize((target_w, target_h), Image.LANCZOS).convert("RGBA")

    # Bottom gradient scrim so the wordmark/tagline stay legible.
    gradient = Image.new("L", (1, target_h), color=0)
    fade_start = int(target_h * 0.45)
    for y in range(target_h):
        alpha = 0 if y < fade_start else int(200 * (y - fade_start) / (target_h - fade_start))
        gradient.putpixel((0, y), alpha)
    gradient = gradient.resize((target_w, target_h))
    overlay = Image.new("RGBA", card.size, (10, 15, 28, 255))
    overlay.putalpha(gradient)
    card = Image.alpha_composite(card, overlay)

    icon = Image.open(ASSETS / "icon.png").convert("RGBA").resize((84, 84), Image.LANCZOS)
    card.paste(icon, (56, target_h - 168), icon)

    draw = ImageDraw.Draw(card)
    title_font = load_font(56)
    tagline_font = load_font(28)
    draw.text((158, target_h - 160), "Apex Ryde", font=title_font, fill=(245, 241, 234, 255))
    draw.text(
        (158, target_h - 96),
        "First-person supersport motorcycle game",
        font=tagline_font,
        fill=(147, 160, 194, 255),
    )

    card.convert("RGB").save(ASSETS / "og-image.png", "PNG")
    print(f"generated og-image.png: {card.size}")


if __name__ == "__main__":
    rotate_screenshots()
    copy_icon()
    generate_og_image()
```

- [ ] **Step 2: Run it**

```bash
cd /Users/matee/Desktop/personalProjects/apex-web
python3 scripts/generate-assets.py
```

Expected output:
```
rotated menu.png: (750, 1334) -> (1334, 750)
rotated riding.png: (750, 1334) -> (1334, 750)
rotated tutorial.png: (750, 1334) -> (1334, 750)
copied icon: (1024, 1024)
generated og-image.png: (1200, 630)
```

- [ ] **Step 3: Verify the files exist with correct dimensions**

```bash
python3 -c "
from PIL import Image
import pathlib
for p in ['assets/icon.png','assets/screenshots/menu.png','assets/screenshots/riding.png','assets/screenshots/tutorial.png','assets/og-image.png']:
    im = Image.open(p)
    print(p, im.size)
"
```

Expected: `assets/icon.png (1024, 1024)`, all three screenshots `(1334, 750)`, `assets/og-image.png (1200, 630)`.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-assets.py assets/
git commit -m "Add asset pipeline: rotated screenshots, icon, generated OG card"
```

---

### Task 2: Site content validator (structural test harness)

**Files:**
- Create: `scripts/validate-site.mjs`

**Interfaces:**
- Consumes: reads `script.js`'s `const translations = {...}` block (via `eval`, trusted local file), and `index.html`/`support.html`/`privacy.html`/`sitemap.xml`/`robots.txt` from the repo root.
- Produces: exit code `0` on success, `1` with a printed list of failures otherwise. Used by Task 9 as the acceptance check for the whole site.

- [ ] **Step 1: Write the validator**

Create `scripts/validate-site.mjs`:

```js
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
```

- [ ] **Step 2: Run it now and confirm it fails (red) — the site pages don't exist yet**

```bash
cd /Users/matee/Desktop/personalProjects/apex-web
node scripts/validate-site.mjs
```

Expected: exit code `1`, output listing failures including `script.js: file does not exist`, `index.html: file does not exist`, `support.html: file does not exist`, `privacy.html: file does not exist`, `sitemap.xml: file does not exist`, `robots.txt: file does not exist`.

- [ ] **Step 3: Commit**

```bash
git add scripts/validate-site.mjs
git commit -m "Add static site validator (structural test harness)"
```

---

### Task 3: `script.js` — translations dictionary and language switching

**Files:**
- Create: `script.js`

**Interfaces:**
- Produces: global `translations` object (keys: `en`, `sk`, `cs`, each a flat string map covering every `data-i18n` key used in Tasks 5–7, plus `meta.home.title`, `meta.home.description`, `meta.support.title`, `meta.support.description`, `meta.privacy.title`, `meta.privacy.description`); a `setLanguage(language: string): void` function wired to `[data-lang]` buttons; expects `document.body.dataset.page` to be `"home"`, `"support"`, or `"privacy"` (set by each HTML page in Tasks 5–7).

- [ ] **Step 1: Write `script.js`**

```js
const translations = {
  en: {
    "nav.features": "Features",
    "nav.support": "Support",
    "nav.privacy": "Privacy",
    "hero.eyebrow": "iPhone & iPad game",
    "hero.title": "Apex Ryde",
    "hero.text": "A first-person supersport motorcycle game. Real friction-circle physics, a proper sequential gearbox, and an endless golden-hour coastal road that never rides the same way twice.",
    "hero.cta": "Coming to the App Store",
    "hero.support": "Get support",
    "features.eyebrow": "Built on real riding",
    "features.title": "Every system modeled on how a bike actually behaves.",
    "features.physics.title": "Friction-circle physics",
    "features.physics.text": "Braking, throttle, and lean all draw from one shared grip budget. Push past it while leaned over and you lowside — exactly like the real thing.",
    "features.gearbox.title": "A real sequential gearbox",
    "features.gearbox.text": "Shift 1 N 2 3 4 5 6 with a half or full swipe, just like a lever. Quickshifter cuts ignition for 80 ms on upshifts — no clutch, no compromise.",
    "features.steering.title": "Tilt steering",
    "features.steering.text": "Lean your phone to lean the bike, with trail-inspired self-centering when you're upright. A touch-drag fallback covers the Simulator and accessibility needs.",
    "features.roads.title": "Endless coastal roads",
    "features.roads.text": "Every run generates a new twisty, golden-hour coastal road — sweepers, hairpins, chicanes, crests. Same seed, same run, every time: fully deterministic.",
    "features.gamecenter.title": "Game Center built in",
    "features.gamecenter.text": "Chase the longest-ride leaderboard and unlock achievements for your first wheelie, your first 10 km, and fifty near-misses.",
    "features.universal.title": "iPhone and iPad",
    "features.universal.text": "One universal app for iPhone and iPad, landscape-only, tuned for both touch and tilt.",
    "gallery.eyebrow": "In the cockpit",
    "gallery.title": "See it in action.",
    "gallery.menu.caption": "Main menu — shift into first and go.",
    "gallery.riding.caption": "TFT dash, clip-ons, and the road ahead.",
    "gallery.tutorial.caption": "Learn the shifter before you ride for real.",
    "skill.eyebrow": "The skill ceiling",
    "skill.title": "Any of these ends the run.",
    "skill.text": "There's no health bar and no second chance. Ride within the friction circle, or don't ride at all.",
    "skill.lowside": "Lowside",
    "skill.highside": "Highside",
    "skill.loopout": "Wheelie loop-out",
    "skill.wide": "Running wide",
    "skill.obstacle": "Obstacle hit",
    "download.title": "Coming to the App Store.",
    "download.text": "Apex Ryde is in final testing for iPhone and iPad. Get support or check back soon.",
    "download.button": "Coming soon",
    "footer.support": "Support",
    "footer.privacy": "Privacy",
    "footer.marketing": "Marketing page",
    "support.eyebrow": "Support",
    "support.title": "Apex Ryde Support",
    "support.intro": "Questions about riding, controls, Game Center, or something that doesn't feel right? Start here.",
    "support.contact.title": "Contact",
    "support.contact.text": "For support, include your device model, iOS version, and a short description of the issue.",
    "support.contact.button": "Email support",
    "support.contact.note": "Current support email: pcesnek290@gmail.com",
    "support.gamecenter.title": "Game Center",
    "support.gamecenter.text": "Leaderboards and achievements use Apple's Game Center. If scores aren't syncing, check that you're signed in to Game Center under iOS Settings.",
    "support.data.title": "Run history and settings",
    "support.data.text": "Your run history, personal bests, and settings are stored on your device.",
    "support.offline.title": "Playing offline",
    "support.offline.text": "Apex Ryde is fully playable offline. Game Center features need a connection to sync; scores are saved locally either way.",
    "faq.title": "FAQ",
    "faq.languages.summary": "Which languages are supported?",
    "faq.languages.text": "Apex Ryde is localized in English, Slovak, and Czech.",
    "faq.tilt.summary": "What if tilt steering doesn't work?",
    "faq.tilt.text": "In the Simulator, or if motion access is unavailable, Apex Ryde automatically falls back to touch-drag steering.",
    "faq.gamecenter.summary": "Do I have to use Game Center?",
    "faq.gamecenter.text": "No. If Game Center is unavailable or declined, Apex Ryde keeps your scores locally with no nagging.",
    "faq.offline.summary": "Does it need an internet connection?",
    "faq.offline.text": "No. Apex Ryde is fully playable offline.",
    "privacy.eyebrow": "Privacy",
    "privacy.title": "Privacy Policy",
    "privacy.updated": "Last updated: July 5, 2026",
    "privacy.overview.title": "Overview",
    "privacy.overview.text": "Apex Ryde is built to keep your data on your device. There is no account system, no advertising network, and no analytics service in the app.",
    "privacy.storage.summary": "Information the app stores",
    "privacy.storage.text": "Apex Ryde stores your settings, run history, and personal bests locally on your device so the app can work.",
    "privacy.gamecenter.summary": "Game Center",
    "privacy.gamecenter.text": "If you sign in to Game Center, your Game Center identity and scores are shared with Apple's Game Center service to power leaderboards and achievements. That data is governed by Apple's own privacy policy.",
    "privacy.motion.summary": "Motion data",
    "privacy.motion.text": "Tilt steering reads your device's motion data in real time to control the bike. This data is processed on-device only and is never recorded or transmitted anywhere.",
    "privacy.third.summary": "Third parties",
    "privacy.third.text": "Apex Ryde uses Apple services such as Game Center and the App Store. Those services are governed by Apple's privacy policies. We do not sell your personal information.",
    "privacy.support.summary": "Support email",
    "privacy.support.text": "If you contact support by email, we receive the information you choose to send, such as your email address, device details, and message. We use it only to respond to your request.",
    "privacy.delete.summary": "Deleting your data",
    "privacy.delete.text": "All app data is stored locally. You can remove it by deleting the app from your device.",
    "privacy.contact.summary": "Contact",
    "privacy.contact.text": "For privacy questions, email pcesnek290@gmail.com.",
    "meta.home.title": "Apex Ryde | First-Person Motorcycle Game for iPhone & iPad",
    "meta.home.description": "Apex Ryde is a first-person supersport motorcycle game for iPhone and iPad with real friction-circle physics, a sequential gearbox, tilt steering, and endless procedural coastal roads.",
    "meta.support.title": "Apex Ryde Support | Help, Game Center, and Controls",
    "meta.support.description": "Get support for Apex Ryde on iPhone and iPad, including Game Center, controls, run history, and offline play.",
    "meta.privacy.title": "Apex Ryde Privacy Policy",
    "meta.privacy.description": "Read the Apex Ryde privacy policy covering local run history, Game Center data sharing, on-device motion processing, and support email data."
  },
  sk: {
    "nav.features": "Funkcie",
    "nav.support": "Podpora",
    "nav.privacy": "Súkromie",
    "hero.eyebrow": "Hra pre iPhone a iPad",
    "hero.title": "Apex Ryde",
    "hero.text": "Pretekárska hra na motorke z pohľadu jazdca. Skutočná fyzika trakčného kruhu, poriadna sekvenčná prevodovka a nekonečná pobrežná cesta v zlatej hodinke, ktorá sa nikdy neopakuje rovnako.",
    "hero.cta": "Čoskoro v App Store",
    "hero.support": "Získať podporu",
    "features.eyebrow": "Postavené na skutočnom jazdení",
    "features.title": "Každý systém modelovaný podľa toho, ako sa motorka naozaj správa.",
    "features.physics.title": "Fyzika trakčného kruhu",
    "features.physics.text": "Brzdenie, plyn aj náklon čerpajú z jedného spoločného rozpočtu trakcie. Prekroč ho v náklone a padneš na vnútornú stranu — presne ako v realite.",
    "features.gearbox.title": "Skutočná sekvenčná prevodovka",
    "features.gearbox.text": "Radíš 1 N 2 3 4 5 6 polovičným alebo plným ťahom, presne ako pákou. Quickshifter pri podradení preruší zapaľovanie na 80 ms — bez spojky, bez kompromisov.",
    "features.steering.title": "Riadenie náklonom telefónu",
    "features.steering.text": "Nakloň telefón a motorka sa nakloní s tebou, so samovyrovnávaním inšpirovaným geometriou riadenia, keď si vzpriamený. Náhradné ovládanie ťahom prsta funguje v simulátore aj pri obmedzeniach prístupnosti.",
    "features.roads.title": "Nekonečné pobrežné cesty",
    "features.roads.text": "Každá jazda vygeneruje novú kľukatú pobrežnú cestu v zlatej hodinke — zákruty, vlásenky, esíčka, kopce. Rovnaký seed, rovnaká jazda, vždy identicky: plne deterministické.",
    "features.gamecenter.title": "Game Center v aplikácii",
    "features.gamecenter.text": "Naháňaj rebríček najdlhšej jazdy a odomkni achievementy za prvý wheelie, prvých 10 km a päťdesiat tesných priblížení.",
    "features.universal.title": "iPhone aj iPad",
    "features.universal.text": "Jedna univerzálna aplikácia pre iPhone aj iPad, iba na šírku, doladená pre dotyk aj náklon.",
    "gallery.eyebrow": "V kokpite",
    "gallery.title": "Pozri si to v akcii.",
    "gallery.menu.caption": "Hlavné menu — zaraď jednotku a choď.",
    "gallery.riding.caption": "TFT palubovka, plocháče a cesta pred tebou.",
    "gallery.tutorial.caption": "Nauč sa radenie skôr, než vyrazíš naostro.",
    "skill.eyebrow": "Strop zručnosti",
    "skill.title": "Ktorákoľvek z týchto vecí ukončí jazdu.",
    "skill.text": "Nie je tu žiadny ukazovateľ zdravia ani druhá šanca. Jazdi v rámci trakčného kruhu, alebo nejazdi vôbec.",
    "skill.lowside": "Pád na vnútornú stranu",
    "skill.highside": "Highside",
    "skill.loopout": "Prevrátenie pri wheelie",
    "skill.wide": "Vyjazdenie zo zákruty",
    "skill.obstacle": "Náraz do prekážky",
    "download.title": "Čoskoro v App Store.",
    "download.text": "Apex Ryde je vo finálnom testovaní pre iPhone a iPad. Získaj podporu alebo sa vráť neskôr.",
    "download.button": "Čoskoro",
    "footer.support": "Podpora",
    "footer.privacy": "Súkromie",
    "footer.marketing": "Marketingová stránka",
    "support.eyebrow": "Podpora",
    "support.title": "Podpora Apex Ryde",
    "support.intro": "Otázky ohľadom jazdenia, ovládania, Game Center alebo niečoho, čo nefunguje správne? Začni tu.",
    "support.contact.title": "Kontakt",
    "support.contact.text": "Pre podporu uveď model zariadenia, verziu iOS a krátky popis problému.",
    "support.contact.button": "Napísať podpore",
    "support.contact.note": "Aktuálny e-mail podpory: pcesnek290@gmail.com",
    "support.gamecenter.title": "Game Center",
    "support.gamecenter.text": "Rebríčky a achievementy používajú Apple Game Center. Ak sa skóre nesynchronizuje, over, či si prihlásený do Game Center v nastaveniach iOS.",
    "support.data.title": "História jázd a nastavenia",
    "support.data.text": "Tvoja história jázd, osobné rekordy a nastavenia sú uložené v zariadení.",
    "support.offline.title": "Hranie offline",
    "support.offline.text": "Apex Ryde je plne hrateľné offline. Funkcie Game Center potrebujú pripojenie na synchronizáciu, no skóre sa ukladá lokálne v oboch prípadoch.",
    "faq.title": "Časté otázky",
    "faq.languages.summary": "Aké jazyky aplikácia podporuje?",
    "faq.languages.text": "Apex Ryde je lokalizovaný do angličtiny, slovenčiny a češtiny.",
    "faq.tilt.summary": "Čo ak riadenie náklonom nefunguje?",
    "faq.tilt.text": "V simulátore, alebo ak nie je dostupný prístup k pohybu zariadenia, Apex Ryde automaticky prepne na ovládanie ťahom prsta.",
    "faq.gamecenter.summary": "Musím používať Game Center?",
    "faq.gamecenter.text": "Nie. Ak je Game Center nedostupný alebo ho odmietneš, Apex Ryde si skóre naďalej ukladá lokálne bez otravovania.",
    "faq.offline.summary": "Potrebuje internetové pripojenie?",
    "faq.offline.text": "Nie. Apex Ryde je plne hrateľné offline.",
    "privacy.eyebrow": "Súkromie",
    "privacy.title": "Zásady ochrany súkromia",
    "privacy.updated": "Naposledy aktualizované: 5. júla 2026",
    "privacy.overview.title": "Prehľad",
    "privacy.overview.text": "Apex Ryde je navrhnutý tak, aby tvoje dáta zostali v zariadení. V aplikácii neprevádzkujeme vlastný systém účtov, reklamnú sieť ani analytickú službu.",
    "privacy.storage.summary": "Informácie uložené aplikáciou",
    "privacy.storage.text": "Apex Ryde lokálne v zariadení ukladá tvoje nastavenia, históriu jázd a osobné rekordy, aby aplikácia mohla fungovať.",
    "privacy.gamecenter.summary": "Game Center",
    "privacy.gamecenter.text": "Ak sa prihlásiš do Game Center, tvoja identita a skóre v Game Center sa zdieľajú so službou Apple Game Center kvôli rebríčkom a achievementom. Tieto dáta sa riadia vlastnými zásadami ochrany súkromia spoločnosti Apple.",
    "privacy.motion.summary": "Pohybové dáta",
    "privacy.motion.text": "Riadenie náklonom číta pohybové dáta zariadenia v reálnom čase, aby ovládalo motorku. Tieto dáta sa spracúvajú iba lokálne v zariadení a nikdy sa nezaznamenávajú ani neprenášajú.",
    "privacy.third.summary": "Tretie strany",
    "privacy.third.text": "Apex Ryde používa služby Apple, napríklad Game Center a App Store. Tieto služby sa riadia zásadami ochrany súkromia spoločnosti Apple. Tvoje osobné informácie nepredávame.",
    "privacy.support.summary": "E-mail podpory",
    "privacy.support.text": "Ak kontaktuješ podporu e-mailom, dostaneme informácie, ktoré sa rozhodneš poslať, napríklad e-mailovú adresu, údaje o zariadení a správu. Použijeme ich iba na odpoveď na tvoju požiadavku.",
    "privacy.delete.summary": "Vymazanie dát",
    "privacy.delete.text": "Všetky dáta aplikácie sú uložené lokálne. Môžeš ich odstrániť vymazaním aplikácie zo zariadenia.",
    "privacy.contact.summary": "Kontakt",
    "privacy.contact.text": "S otázkami k súkromiu napíš na pcesnek290@gmail.com.",
    "meta.home.title": "Apex Ryde | Motorkárska hra z pohľadu jazdca pre iPhone a iPad",
    "meta.home.description": "Apex Ryde je motorkárska hra z pohľadu jazdca pre iPhone a iPad so skutočnou fyzikou trakčného kruhu, sekvenčnou prevodovkou, riadením náklonom a nekonečnými procedurálnymi pobrežnými cestami.",
    "meta.support.title": "Podpora Apex Ryde | Pomoc, Game Center a ovládanie",
    "meta.support.description": "Získaj podporu pre Apex Ryde na iPhone a iPad vrátane Game Center, ovládania, histórie jázd a offline hrania.",
    "meta.privacy.title": "Zásady ochrany súkromia Apex Ryde",
    "meta.privacy.description": "Prečítaj si zásady ochrany súkromia Apex Ryde o lokálnej histórii jázd, zdieľaní dát cez Game Center, lokálnom spracovaní pohybu a dátach z e-mailu podpory."
  },
  cs: {
    "nav.features": "Funkce",
    "nav.support": "Podpora",
    "nav.privacy": "Soukromí",
    "hero.eyebrow": "Hra pro iPhone a iPad",
    "hero.title": "Apex Ryde",
    "hero.text": "Motorkářská hra z pohledu jezdce. Skutečná fyzika třecí kružnice, pořádná sekvenční převodovka a nekonečná pobřežní silnice ve zlaté hodince, která se nikdy neopakuje stejně.",
    "hero.cta": "Již brzy v App Store",
    "hero.support": "Získat podporu",
    "features.eyebrow": "Postaveno na skutečném jezdění",
    "features.title": "Každý systém modelovaný podle toho, jak se motorka opravdu chová.",
    "features.physics.title": "Fyzika třecí kružnice",
    "features.physics.text": "Brzdění, plyn i náklon čerpají ze společného rozpočtu trakce. Překroč ho v náklonu a padneš na vnitřní stranu — přesně jako v realitě.",
    "features.gearbox.title": "Skutečná sekvenční převodovka",
    "features.gearbox.text": "Řaď 1 N 2 3 4 5 6 polovičním nebo plným tahem, přesně jako pákou. Quickshifter při podřazení přeruší zapalování na 80 ms — bez spojky, bez kompromisů.",
    "features.steering.title": "Řízení náklonem telefonu",
    "features.steering.text": "Nakloň telefon a motorka se nakloní s tebou, se samovyrovnáváním inspirovaným geometrií řízení, když jsi vzpřímený. Náhradní ovládání tahem prstu funguje v simulátoru i při omezeních přístupnosti.",
    "features.roads.title": "Nekonečné pobřežní silnice",
    "features.roads.text": "Každá jízda vygeneruje novou klikatou pobřežní silnici ve zlaté hodince — zatáčky, vlásenky, esíčka, kopce. Stejný seed, stejná jízda, vždy identicky: plně deterministické.",
    "features.gamecenter.title": "Game Center v aplikaci",
    "features.gamecenter.text": "Honíme se za žebříčkem nejdelší jízdy a odemkni achievementy za první wheelie, prvních 10 km a padesát těsných přiblížení.",
    "features.universal.title": "iPhone i iPad",
    "features.universal.text": "Jedna univerzální aplikace pro iPhone i iPad, pouze na šířku, doladěná pro dotyk i náklon.",
    "gallery.eyebrow": "V kokpitu",
    "gallery.title": "Podívej se na to v akci.",
    "gallery.menu.caption": "Hlavní menu — zařaď jedničku a jeď.",
    "gallery.riding.caption": "TFT paluba, plocháče a cesta před tebou.",
    "gallery.tutorial.caption": "Nauč se řazení, než vyrazíš naostro.",
    "skill.eyebrow": "Strop dovednosti",
    "skill.title": "Kterákoli z těchto věcí ukončí jízdu.",
    "skill.text": "Není tu žádný ukazatel zdraví ani druhá šance. Jezdi v rámci třecí kružnice, nebo nejezdi vůbec.",
    "skill.lowside": "Pád na vnitřní stranu",
    "skill.highside": "Highside",
    "skill.loopout": "Převrácení při wheelie",
    "skill.wide": "Vyjetí ze zatáčky",
    "skill.obstacle": "Náraz do překážky",
    "download.title": "Již brzy v App Store.",
    "download.text": "Apex Ryde je ve finálním testování pro iPhone a iPad. Získej podporu nebo se vrať později.",
    "download.button": "Již brzy",
    "footer.support": "Podpora",
    "footer.privacy": "Soukromí",
    "footer.marketing": "Marketingová stránka",
    "support.eyebrow": "Podpora",
    "support.title": "Podpora Apex Ryde",
    "support.intro": "Otázky ohledně jízdy, ovládání, Game Center nebo něčeho, co nefunguje správně? Začni tady.",
    "support.contact.title": "Kontakt",
    "support.contact.text": "Pro podporu uveď model zařízení, verzi iOS a krátký popis problému.",
    "support.contact.button": "Napsat podpoře",
    "support.contact.note": "Aktuální e-mail podpory: pcesnek290@gmail.com",
    "support.gamecenter.title": "Game Center",
    "support.gamecenter.text": "Žebříčky a achievementy používají Apple Game Center. Pokud se skóre nesynchronizuje, ověř, že jsi přihlášen do Game Center v nastavení iOS.",
    "support.data.title": "Historie jízd a nastavení",
    "support.data.text": "Tvoje historie jízd, osobní rekordy a nastavení jsou uložené v zařízení.",
    "support.offline.title": "Hraní offline",
    "support.offline.text": "Apex Ryde je plně hratelné offline. Funkce Game Center potřebují připojení k synchronizaci, ale skóre se ukládá lokálně v obou případech.",
    "faq.title": "Časté dotazy",
    "faq.languages.summary": "Jaké jazyky aplikace podporuje?",
    "faq.languages.text": "Apex Ryde je lokalizovaný do angličtiny, slovenštiny a češtiny.",
    "faq.tilt.summary": "Co když řízení náklonem nefunguje?",
    "faq.tilt.text": "V simulátoru, nebo pokud není dostupný přístup k pohybu zařízení, Apex Ryde automaticky přepne na ovládání tahem prstu.",
    "faq.gamecenter.summary": "Musím používat Game Center?",
    "faq.gamecenter.text": "Ne. Pokud je Game Center nedostupný nebo ho odmítneš, Apex Ryde si skóre nadále ukládá lokálně bez obtěžování.",
    "faq.offline.summary": "Potřebuje internetové připojení?",
    "faq.offline.text": "Ne. Apex Ryde je plně hratelné offline.",
    "privacy.eyebrow": "Soukromí",
    "privacy.title": "Zásady ochrany soukromí",
    "privacy.updated": "Naposledy aktualizováno: 5. července 2026",
    "privacy.overview.title": "Přehled",
    "privacy.overview.text": "Apex Ryde je navržený tak, aby tvoje data zůstala v zařízení. V aplikaci neprovozujeme vlastní systém účtů, reklamní síť ani analytickou službu.",
    "privacy.storage.summary": "Informace uložené aplikací",
    "privacy.storage.text": "Apex Ryde lokálně v zařízení ukládá tvoje nastavení, historii jízd a osobní rekordy, aby aplikace mohla fungovat.",
    "privacy.gamecenter.summary": "Game Center",
    "privacy.gamecenter.text": "Pokud se přihlásíš do Game Center, tvoje identita a skóre v Game Center se sdílí se službou Apple Game Center kvůli žebříčkům a achievementům. Tato data se řídí vlastními zásadami ochrany soukromí společnosti Apple.",
    "privacy.motion.summary": "Pohybová data",
    "privacy.motion.text": "Řízení náklonem čte pohybová data zařízení v reálném čase, aby ovládalo motorku. Tato data se zpracovávají pouze lokálně v zařízení a nikdy se nezaznamenávají ani nepřenášejí.",
    "privacy.third.summary": "Třetí strany",
    "privacy.third.text": "Apex Ryde používá služby Apple, například Game Center a App Store. Tyto služby se řídí zásadami ochrany soukromí společnosti Apple. Tvoje osobní informace neprodáváme.",
    "privacy.support.summary": "E-mail podpory",
    "privacy.support.text": "Pokud kontaktuješ podporu e-mailem, obdržíme informace, které se rozhodneš poslat, například e-mailovou adresu, údaje o zařízení a zprávu. Použijeme je pouze k odpovědi na tvůj požadavek.",
    "privacy.delete.summary": "Smazání dat",
    "privacy.delete.text": "Všechna data aplikace jsou uložená lokálně. Můžeš je odstranit smazáním aplikace ze zařízení.",
    "privacy.contact.summary": "Kontakt",
    "privacy.contact.text": "S dotazy k soukromí napiš na pcesnek290@gmail.com.",
    "meta.home.title": "Apex Ryde | Motorkářská hra z pohledu jezdce pro iPhone a iPad",
    "meta.home.description": "Apex Ryde je motorkářská hra z pohledu jezdce pro iPhone a iPad se skutečnou fyzikou třecí kružnice, sekvenční převodovkou, řízením náklonem a nekonečnými procedurálními pobřežními silnicemi.",
    "meta.support.title": "Podpora Apex Ryde | Pomoc, Game Center a ovládání",
    "meta.support.description": "Získej podporu pro Apex Ryde na iPhone a iPad včetně Game Center, ovládání, historie jízd a offline hraní.",
    "meta.privacy.title": "Zásady ochrany soukromí Apex Ryde",
    "meta.privacy.description": "Přečti si zásady ochrany soukromí Apex Ryde o lokální historii jízd, sdílení dat přes Game Center, lokálním zpracování pohybu a datech z e-mailu podpory."
  }
};

const supportedLanguages = Object.keys(translations);
const browserLanguage = navigator.language.slice(0, 2);
const savedLanguage = localStorage.getItem("apex-ryde-language");
const initialLanguage = supportedLanguages.includes(savedLanguage)
  ? savedLanguage
  : supportedLanguages.includes(browserLanguage)
    ? browserLanguage
    : "en";

const pageMetaKey = document.body.dataset.page || "home";

function setLanguage(language) {
  const dictionary = translations[language] || translations.en;
  document.documentElement.lang = language;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (dictionary[key]) {
      element.textContent = dictionary[key];
    }
  });

  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === language);
    button.setAttribute("aria-pressed", String(button.dataset.lang === language));
  });

  const titleKey = `meta.${pageMetaKey}.title`;
  const descriptionKey = `meta.${pageMetaKey}.description`;
  if (dictionary[titleKey]) {
    document.title = dictionary[titleKey];
  }
  const descriptionTag = document.querySelector('meta[name="description"]');
  if (descriptionTag && dictionary[descriptionKey]) {
    descriptionTag.setAttribute("content", dictionary[descriptionKey]);
  }

  localStorage.setItem("apex-ryde-language", language);
}

document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.lang));
});

setLanguage(initialLanguage);
```

- [ ] **Step 2: Check it's syntactically valid**

```bash
node --check script.js
```

Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "Add script.js: EN/SK/CS translations and language switching"
```

---

### Task 4: `styles.css` — design system stylesheet

**Files:**
- Create: `styles.css`

**Interfaces:**
- Consumes: nothing (pure CSS).
- Produces: every class name referenced by Tasks 5–7's HTML (`site-header`, `brand`, `brand-icon`, `nav`, `language-switch`, `hero`, `hero-copy`, `eyebrow`, `hero-text`, `hero-actions`, `button`/`primary`/`secondary`, `badge`/`pending`, `device-frame`, `section`, `section-heading`, `feature-grid`, `feature-card`, `feature-icon`, `gallery-grid`, `gallery-card`, `split-section`, `tag-list`, `tag`/`severe`, `download`, `download-icon`, `footer`, `support-main`, `support-hero`, `support-grid`, `support-card`, `note`, `faq`).

- [ ] **Step 1: Write `styles.css`**

```css
:root {
  color-scheme: dark;
  --bg: #0a0f1c;
  --surface: #131b2e;
  --surface-high: #1c2740;
  --text: #f5f1ea;
  --muted: #93a0c2;
  --accent: #e23f2e;
  --gold: #eabb89;
  --asphalt: #4e4f5a;
  --line: rgba(255, 255, 255, 0.08);
  --radius: 18px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}

img {
  max-width: 100%;
  display: block;
}

.site-header {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 20px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
}

.brand-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(226, 63, 46, 0.25);
}

.nav {
  display: flex;
  align-items: center;
  gap: 18px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}

.nav a:hover {
  color: var(--text);
}

.language-switch {
  display: inline-flex;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 3px;
}

.language-switch button {
  width: 38px;
  height: 30px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  cursor: pointer;
}

.language-switch button.active {
  background: var(--surface-high);
  color: var(--text);
}

.hero {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.95fr);
  align-items: center;
  gap: 56px;
  padding: 18px 0 34px;
}

.eyebrow {
  margin: 0 0 14px;
  color: var(--gold);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero-copy h1,
.support-hero h1 {
  margin: 0;
  font-size: clamp(48px, 9vw, 88px);
  line-height: 0.95;
  background: linear-gradient(90deg, var(--accent), var(--gold));
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
}

.hero-text,
.support-hero p {
  color: var(--muted);
  font-size: clamp(18px, 2.6vw, 24px);
  line-height: 1.35;
  max-width: 560px;
}

.hero-actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 22px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  padding: 0 22px;
  border-radius: 14px;
  font-weight: 900;
  font-size: 15px;
}

.button.primary {
  background: var(--accent);
  color: white;
}

.button.secondary {
  background: var(--surface-high);
  color: var(--text);
  border: 1px solid var(--line);
}

.badge.pending {
  background: var(--surface-high);
  color: var(--gold);
  border: 1px dashed rgba(234, 187, 137, 0.5);
  cursor: default;
}

.badge.pending::before {
  content: "●";
  margin-right: 8px;
  font-size: 10px;
  color: var(--gold);
}

.inline-button {
  margin-top: 6px;
}

.device-frame {
  border: 1px solid var(--line);
  border-radius: 28px;
  padding: 10px;
  background: #05070a;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45), 0 0 80px rgba(226, 63, 46, 0.14);
}

.device-frame img {
  border-radius: 20px;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.hero .device-frame {
  justify-self: center;
  width: 100%;
}

.section {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 42px 0 70px;
}

.section-heading {
  max-width: 640px;
  margin-bottom: 24px;
}

h2 {
  margin: 0 0 12px;
  font-size: clamp(28px, 5vw, 44px);
  line-height: 1.05;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.feature-card,
.support-card,
.gallery-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.feature-card {
  padding: 24px;
}

.feature-icon {
  font-size: 34px;
}

.feature-card h3,
.support-card h2 {
  margin: 16px 0 8px;
  font-size: 20px;
}

.feature-card p,
.support-card p,
.split-section p,
.download p,
.faq p {
  color: var(--muted);
  line-height: 1.55;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.gallery-card {
  padding: 16px;
}

.gallery-card .device-frame {
  padding: 6px;
  border-radius: 20px;
}

.gallery-card .device-frame img {
  border-radius: 14px;
}

.gallery-card figcaption {
  margin-top: 12px;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}

.split-section {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto 70px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 32px;
  padding: 34px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.tag-list {
  display: grid;
  gap: 12px;
}

.tag {
  min-height: 48px;
  padding: 12px 16px;
  font-weight: 800;
  background: var(--surface-high);
  border-radius: 999px;
  color: var(--text);
  display: flex;
  align-items: center;
}

.tag.severe {
  color: var(--accent);
  box-shadow: 0 0 34px rgba(226, 63, 46, 0.18);
}

.download {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto 70px;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 26px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.download-icon {
  width: 88px;
  height: 88px;
  border-radius: 24px;
}

.footer {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 30px 0 48px;
  color: var(--muted);
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid var(--line);
}

.support-main {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 40px 0 70px;
}

.support-hero {
  max-width: 760px;
  margin-bottom: 28px;
}

.support-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 22px;
}

.support-card {
  padding: 24px;
}

.note {
  font-size: 13px;
}

.faq {
  padding: 24px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

details {
  border-top: 1px solid var(--line);
  padding: 18px 0;
}

details:first-of-type {
  border-top: 0;
}

summary {
  cursor: pointer;
  font-weight: 850;
}

@media (max-width: 820px) {
  .site-header,
  .download {
    flex-direction: column;
    align-items: flex-start;
  }

  .nav {
    width: 100%;
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .hero,
  .split-section,
  .feature-grid,
  .gallery-grid,
  .support-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    padding-top: 34px;
    gap: 28px;
  }
}

@media (max-width: 480px) {
  .hero-actions,
  .button {
    width: 100%;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "Add styles.css: Apex Ryde design system"
```

---

### Task 5: `index.html` — homepage

**Files:**
- Create: `index.html`

**Interfaces:**
- Consumes: `styles.css` (Task 4), `script.js` (Task 3, expects `<body data-page="home">`), `assets/icon.png`, `assets/screenshots/{menu,riding,tutorial}.png` (Task 1).

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Apex Ryde | First-Person Motorcycle Game for iPhone & iPad</title>
    <meta name="description" content="Apex Ryde is a first-person supersport motorcycle game for iPhone and iPad with real friction-circle physics, a sequential gearbox, tilt steering, and endless procedural coastal roads.">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#0a0f1c">
    <link rel="canonical" href="https://apex-ryde-ios.netlify.app/">
    <meta property="og:site_name" content="Apex Ryde">
    <meta property="og:title" content="Apex Ryde | First-Person Motorcycle Game for iPhone & iPad">
    <meta property="og:description" content="Real friction-circle physics, a sequential gearbox, tilt steering, and endless procedural coastal roads.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://apex-ryde-ios.netlify.app/">
    <meta property="og:image" content="https://apex-ryde-ios.netlify.app/assets/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Apex Ryde — first-person motorcycle game">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Apex Ryde | First-Person Motorcycle Game for iPhone & iPad">
    <meta name="twitter:description" content="Real friction-circle physics, a sequential gearbox, tilt steering, and endless procedural coastal roads.">
    <meta name="twitter:image" content="https://apex-ryde-ios.netlify.app/assets/og-image.png">
    <link rel="icon" href="assets/icon.png">
    <link rel="apple-touch-icon" href="assets/icon.png">
    <link rel="stylesheet" href="styles.css">
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Apex Ryde",
        "applicationCategory": "GameApplication",
        "operatingSystem": "iOS",
        "description": "Apex Ryde is a first-person supersport motorcycle game for iPhone and iPad with real friction-circle physics, a sequential gearbox, tilt steering, and endless procedural coastal roads.",
        "image": "https://apex-ryde-ios.netlify.app/assets/icon.png",
        "url": "https://apex-ryde-ios.netlify.app/"
      }
    </script>
    <!--
      Once Apex Ryde ships on the App Store, add an "offers" block above with
      the real numeric app id, e.g.:
      "offers": { "@type": "Offer", "url": "https://apps.apple.com/app/idXXXXXXXXX", "price": "0", "priceCurrency": "USD" }
      and swap the "Coming to the App Store" badges below for real <a> links
      to that same URL.
    -->
  </head>
  <body data-page="home">
    <header class="site-header">
      <a aria-label="Apex Ryde home" class="brand" href="/">
        <img src="assets/icon.png" alt="" class="brand-icon">
        <span>Apex Ryde</span>
      </a>
      <nav class="nav" aria-label="Main navigation">
        <a href="#features" data-i18n="nav.features">Features</a>
        <a data-i18n="nav.support" href="/support">Support</a>
        <a data-i18n="nav.privacy" href="/privacy">Privacy</a>
        <div class="language-switch" aria-label="Language">
          <button type="button" data-lang="en">EN</button>
          <button type="button" data-lang="sk">SK</button>
          <button type="button" data-lang="cs">CS</button>
        </div>
      </nav>
    </header>

    <main>
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow" data-i18n="hero.eyebrow">iPhone & iPad game</p>
          <h1 data-i18n="hero.title">Apex Ryde</h1>
          <p class="hero-text" data-i18n="hero.text">A first-person supersport motorcycle game. Real friction-circle physics, a proper sequential gearbox, and an endless golden-hour coastal road that never rides the same way twice.</p>
          <div class="hero-actions">
            <span class="button badge pending" data-i18n="hero.cta" aria-disabled="true">Coming to the App Store</span>
            <a class="button secondary" data-i18n="hero.support" href="/support">Get support</a>
          </div>
        </div>
        <figure class="device-frame">
          <img src="assets/screenshots/riding.png" alt="First-person cockpit view of Apex Ryde: TFT dash, clip-on handlebars, and a twisty golden-hour coastal road ahead." width="1334" height="750" loading="eager">
        </figure>
      </section>

      <section id="features" class="section">
        <div class="section-heading">
          <p class="eyebrow" data-i18n="features.eyebrow">Built on real riding</p>
          <h2 data-i18n="features.title">Every system modeled on how a bike actually behaves.</h2>
        </div>
        <div class="feature-grid">
          <article class="feature-card">
            <span class="feature-icon" aria-hidden="true">🏍️</span>
            <h3 data-i18n="features.physics.title">Friction-circle physics</h3>
            <p data-i18n="features.physics.text">Braking, throttle, and lean all draw from one shared grip budget. Push past it while leaned over and you lowside — exactly like the real thing.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon" aria-hidden="true">⚙️</span>
            <h3 data-i18n="features.gearbox.title">A real sequential gearbox</h3>
            <p data-i18n="features.gearbox.text">Shift 1 N 2 3 4 5 6 with a half or full swipe, just like a lever. Quickshifter cuts ignition for 80 ms on upshifts — no clutch, no compromise.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon" aria-hidden="true">🕹️</span>
            <h3 data-i18n="features.steering.title">Tilt steering</h3>
            <p data-i18n="features.steering.text">Lean your phone to lean the bike, with trail-inspired self-centering when you're upright. A touch-drag fallback covers the Simulator and accessibility needs.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon" aria-hidden="true">🌅</span>
            <h3 data-i18n="features.roads.title">Endless coastal roads</h3>
            <p data-i18n="features.roads.text">Every run generates a new twisty, golden-hour coastal road — sweepers, hairpins, chicanes, crests. Same seed, same run, every time: fully deterministic.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon" aria-hidden="true">🏆</span>
            <h3 data-i18n="features.gamecenter.title">Game Center built in</h3>
            <p data-i18n="features.gamecenter.text">Chase the longest-ride leaderboard and unlock achievements for your first wheelie, your first 10 km, and fifty near-misses.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon" aria-hidden="true">📱</span>
            <h3 data-i18n="features.universal.title">iPhone and iPad</h3>
            <p data-i18n="features.universal.text">One universal app for iPhone and iPad, landscape-only, tuned for both touch and tilt.</p>
          </article>
        </div>
      </section>

      <section id="screenshots" class="section">
        <div class="section-heading">
          <p class="eyebrow" data-i18n="gallery.eyebrow">In the cockpit</p>
          <h2 data-i18n="gallery.title">See it in action.</h2>
        </div>
        <div class="gallery-grid">
          <figure class="gallery-card">
            <div class="device-frame">
              <img src="assets/screenshots/menu.png" alt="Apex Ryde main menu overlaying the cockpit, with a Ride button and a shift-into-first tutorial hint." width="1334" height="750" loading="lazy">
            </div>
            <figcaption data-i18n="gallery.menu.caption">Main menu — shift into first and go.</figcaption>
          </figure>
          <figure class="gallery-card">
            <div class="device-frame">
              <img src="assets/screenshots/riding.png" alt="Crash summary screen showing distance ridden and best score, over the cockpit and coastal road." width="1334" height="750" loading="lazy">
            </div>
            <figcaption data-i18n="gallery.riding.caption">TFT dash, clip-ons, and the road ahead.</figcaption>
          </figure>
          <figure class="gallery-card">
            <div class="device-frame">
              <img src="assets/screenshots/tutorial.png" alt="In-game tutorial explaining the sequential shifter: full swipe changes gear, half swipe finds neutral." width="1334" height="750" loading="lazy">
            </div>
            <figcaption data-i18n="gallery.tutorial.caption">Learn the shifter before you ride for real.</figcaption>
          </figure>
        </div>
      </section>

      <section class="split-section">
        <div>
          <p class="eyebrow" data-i18n="skill.eyebrow">The skill ceiling</p>
          <h2 data-i18n="skill.title">Any of these ends the run.</h2>
          <p data-i18n="skill.text">There's no health bar and no second chance. Ride within the friction circle, or don't ride at all.</p>
        </div>
        <div class="tag-list">
          <span class="tag severe" data-i18n="skill.lowside">Lowside</span>
          <span class="tag severe" data-i18n="skill.highside">Highside</span>
          <span class="tag severe" data-i18n="skill.loopout">Wheelie loop-out</span>
          <span class="tag" data-i18n="skill.wide">Running wide</span>
          <span class="tag" data-i18n="skill.obstacle">Obstacle hit</span>
        </div>
      </section>

      <section id="download" class="download">
        <img src="assets/icon.png" alt="" class="download-icon">
        <div>
          <h2 data-i18n="download.title">Coming to the App Store.</h2>
          <p data-i18n="download.text">Apex Ryde is in final testing for iPhone and iPad. Get support or check back soon.</p>
          <span class="button badge pending inline-button" data-i18n="download.button" aria-disabled="true">Coming soon</span>
        </div>
      </section>
    </main>

    <footer class="footer">
      <span>Apex Ryde</span>
      <a data-i18n="footer.support" href="/support">Support</a>
      <a data-i18n="footer.privacy" href="/privacy">Privacy</a>
    </footer>

    <script src="script.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "Add index.html: Apex Ryde homepage"
```

---

### Task 6: `support.html`

**Files:**
- Create: `support.html`

**Interfaces:**
- Consumes: same as Task 5, plus `mailto:pcesnek290@gmail.com`.

- [ ] **Step 1: Write `support.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Apex Ryde Support | Help, Game Center, and Controls</title>
    <meta name="description" content="Get support for Apex Ryde on iPhone and iPad, including Game Center, controls, run history, and offline play.">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#0a0f1c">
    <link rel="canonical" href="https://apex-ryde-ios.netlify.app/support.html">
    <meta property="og:site_name" content="Apex Ryde">
    <meta property="og:title" content="Apex Ryde Support">
    <meta property="og:description" content="Support for Game Center, controls, run history, and offline play.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://apex-ryde-ios.netlify.app/support.html">
    <meta property="og:image" content="https://apex-ryde-ios.netlify.app/assets/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Apex Ryde — first-person motorcycle game">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Apex Ryde Support">
    <meta name="twitter:description" content="Support for Game Center, controls, run history, and offline play.">
    <meta name="twitter:image" content="https://apex-ryde-ios.netlify.app/assets/og-image.png">
    <link rel="icon" href="assets/icon.png">
    <link rel="apple-touch-icon" href="assets/icon.png">
    <link rel="stylesheet" href="styles.css">
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Which languages are supported?",
            "acceptedAnswer": { "@type": "Answer", "text": "Apex Ryde is localized in English, Slovak, and Czech." }
          },
          {
            "@type": "Question",
            "name": "What if tilt steering doesn't work?",
            "acceptedAnswer": { "@type": "Answer", "text": "In the Simulator, or if motion access is unavailable, Apex Ryde automatically falls back to touch-drag steering." }
          },
          {
            "@type": "Question",
            "name": "Do I have to use Game Center?",
            "acceptedAnswer": { "@type": "Answer", "text": "No. If Game Center is unavailable or declined, Apex Ryde keeps your scores locally with no nagging." }
          },
          {
            "@type": "Question",
            "name": "Does it need an internet connection?",
            "acceptedAnswer": { "@type": "Answer", "text": "No. Apex Ryde is fully playable offline." }
          }
        ]
      }
    </script>
  </head>
  <body data-page="support">
    <header class="site-header">
      <a aria-label="Apex Ryde home" class="brand" href="/">
        <img src="assets/icon.png" alt="" class="brand-icon">
        <span>Apex Ryde</span>
      </a>
      <nav class="nav" aria-label="Main navigation">
        <a data-i18n="nav.features" href="/#features">Features</a>
        <a data-i18n="nav.support" href="/support">Support</a>
        <a data-i18n="nav.privacy" href="/privacy">Privacy</a>
        <div class="language-switch" aria-label="Language">
          <button type="button" data-lang="en">EN</button>
          <button type="button" data-lang="sk">SK</button>
          <button type="button" data-lang="cs">CS</button>
        </div>
      </nav>
    </header>

    <main class="support-main">
      <section class="support-hero">
        <p class="eyebrow" data-i18n="support.eyebrow">Support</p>
        <h1 data-i18n="support.title">Apex Ryde Support</h1>
        <p data-i18n="support.intro">Questions about riding, controls, Game Center, or something that doesn't feel right? Start here.</p>
      </section>

      <section class="support-grid">
        <article class="support-card">
          <h2 data-i18n="support.contact.title">Contact</h2>
          <p data-i18n="support.contact.text">For support, include your device model, iOS version, and a short description of the issue.</p>
          <a class="button primary" href="mailto:pcesnek290@gmail.com?subject=Apex%20Ryde%20Support" data-i18n="support.contact.button">Email support</a>
          <p class="note" data-i18n="support.contact.note">Current support email: pcesnek290@gmail.com</p>
        </article>
        <article class="support-card">
          <h2 data-i18n="support.gamecenter.title">Game Center</h2>
          <p data-i18n="support.gamecenter.text">Leaderboards and achievements use Apple's Game Center. If scores aren't syncing, check that you're signed in to Game Center under iOS Settings.</p>
        </article>
        <article class="support-card">
          <h2 data-i18n="support.data.title">Run history and settings</h2>
          <p data-i18n="support.data.text">Your run history, personal bests, and settings are stored on your device.</p>
        </article>
        <article class="support-card">
          <h2 data-i18n="support.offline.title">Playing offline</h2>
          <p data-i18n="support.offline.text">Apex Ryde is fully playable offline. Game Center features need a connection to sync; scores are saved locally either way.</p>
        </article>
      </section>

      <section class="faq">
        <h2 data-i18n="faq.title">FAQ</h2>
        <details open>
          <summary data-i18n="faq.languages.summary">Which languages are supported?</summary>
          <p data-i18n="faq.languages.text">Apex Ryde is localized in English, Slovak, and Czech.</p>
        </details>
        <details>
          <summary data-i18n="faq.tilt.summary">What if tilt steering doesn't work?</summary>
          <p data-i18n="faq.tilt.text">In the Simulator, or if motion access is unavailable, Apex Ryde automatically falls back to touch-drag steering.</p>
        </details>
        <details>
          <summary data-i18n="faq.gamecenter.summary">Do I have to use Game Center?</summary>
          <p data-i18n="faq.gamecenter.text">No. If Game Center is unavailable or declined, Apex Ryde keeps your scores locally with no nagging.</p>
        </details>
        <details>
          <summary data-i18n="faq.offline.summary">Does it need an internet connection?</summary>
          <p data-i18n="faq.offline.text">No. Apex Ryde is fully playable offline.</p>
        </details>
      </section>
    </main>

    <footer class="footer">
      <span>Apex Ryde</span>
      <a data-i18n="footer.marketing" href="/">Marketing page</a>
      <a data-i18n="footer.privacy" href="/privacy">Privacy</a>
    </footer>

    <script src="script.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add support.html
git commit -m "Add support.html: Apex Ryde support page"
```

---

### Task 7: `privacy.html`

**Files:**
- Create: `privacy.html`

**Interfaces:**
- Consumes: same as Task 5.

- [ ] **Step 1: Write `privacy.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Apex Ryde Privacy Policy</title>
    <meta name="description" content="Read the Apex Ryde privacy policy covering local run history, Game Center data sharing, on-device motion processing, and support email data.">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#0a0f1c">
    <link rel="canonical" href="https://apex-ryde-ios.netlify.app/privacy.html">
    <meta property="og:site_name" content="Apex Ryde">
    <meta property="og:title" content="Apex Ryde Privacy Policy">
    <meta property="og:description" content="Privacy policy for local run history, Game Center data sharing, on-device motion processing, and support email data.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://apex-ryde-ios.netlify.app/privacy.html">
    <meta property="og:image" content="https://apex-ryde-ios.netlify.app/assets/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Apex Ryde — first-person motorcycle game">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Apex Ryde Privacy Policy">
    <meta name="twitter:description" content="Privacy policy for local run history, Game Center data sharing, on-device motion processing, and support email data.">
    <meta name="twitter:image" content="https://apex-ryde-ios.netlify.app/assets/og-image.png">
    <link rel="icon" href="assets/icon.png">
    <link rel="apple-touch-icon" href="assets/icon.png">
    <link rel="stylesheet" href="styles.css">
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "Apex Ryde Privacy Policy",
        "description": "Privacy policy for the Apex Ryde iPhone and iPad game.",
        "url": "https://apex-ryde-ios.netlify.app/privacy.html",
        "isPartOf": { "@type": "WebSite", "name": "Apex Ryde", "url": "https://apex-ryde-ios.netlify.app/" }
      }
    </script>
  </head>
  <body data-page="privacy">
    <header class="site-header">
      <a aria-label="Apex Ryde home" class="brand" href="/">
        <img src="assets/icon.png" alt="" class="brand-icon">
        <span>Apex Ryde</span>
      </a>
      <nav class="nav" aria-label="Main navigation">
        <a data-i18n="nav.features" href="/#features">Features</a>
        <a data-i18n="nav.support" href="/support">Support</a>
        <a data-i18n="nav.privacy" href="/privacy">Privacy</a>
        <div class="language-switch" aria-label="Language">
          <button type="button" data-lang="en">EN</button>
          <button type="button" data-lang="sk">SK</button>
          <button type="button" data-lang="cs">CS</button>
        </div>
      </nav>
    </header>

    <main class="support-main">
      <section class="support-hero">
        <p class="eyebrow" data-i18n="privacy.eyebrow">Privacy</p>
        <h1 data-i18n="privacy.title">Privacy Policy</h1>
        <p data-i18n="privacy.updated">Last updated: July 5, 2026</p>
      </section>

      <section class="faq">
        <h2 data-i18n="privacy.overview.title">Overview</h2>
        <p data-i18n="privacy.overview.text">Apex Ryde is built to keep your data on your device. There is no account system, no advertising network, and no analytics service in the app.</p>

        <details open>
          <summary data-i18n="privacy.storage.summary">Information the app stores</summary>
          <p data-i18n="privacy.storage.text">Apex Ryde stores your settings, run history, and personal bests locally on your device so the app can work.</p>
        </details>
        <details>
          <summary data-i18n="privacy.gamecenter.summary">Game Center</summary>
          <p data-i18n="privacy.gamecenter.text">If you sign in to Game Center, your Game Center identity and scores are shared with Apple's Game Center service to power leaderboards and achievements. That data is governed by Apple's own privacy policy.</p>
        </details>
        <details>
          <summary data-i18n="privacy.motion.summary">Motion data</summary>
          <p data-i18n="privacy.motion.text">Tilt steering reads your device's motion data in real time to control the bike. This data is processed on-device only and is never recorded or transmitted anywhere.</p>
        </details>
        <details>
          <summary data-i18n="privacy.third.summary">Third parties</summary>
          <p data-i18n="privacy.third.text">Apex Ryde uses Apple services such as Game Center and the App Store. Those services are governed by Apple's privacy policies. We do not sell your personal information.</p>
        </details>
        <details>
          <summary data-i18n="privacy.support.summary">Support email</summary>
          <p data-i18n="privacy.support.text">If you contact support by email, we receive the information you choose to send, such as your email address, device details, and message. We use it only to respond to your request.</p>
        </details>
        <details>
          <summary data-i18n="privacy.delete.summary">Deleting your data</summary>
          <p data-i18n="privacy.delete.text">All app data is stored locally. You can remove it by deleting the app from your device.</p>
        </details>
        <details>
          <summary data-i18n="privacy.contact.summary">Contact</summary>
          <p data-i18n="privacy.contact.text">For privacy questions, email pcesnek290@gmail.com.</p>
        </details>
      </section>
    </main>

    <footer class="footer">
      <span>Apex Ryde</span>
      <a data-i18n="footer.marketing" href="/">Marketing page</a>
      <a data-i18n="footer.support" href="/support">Support</a>
    </footer>

    <script src="script.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add privacy.html
git commit -m "Add privacy.html: Apex Ryde privacy policy"
```

---

### Task 8: SEO infrastructure — `sitemap.xml`, `robots.txt`, `netlify.toml`

**Files:**
- Create: `sitemap.xml`
- Create: `robots.txt`
- Create: `netlify.toml`

**Interfaces:**
- Consumes: nothing.
- Produces: the 3 sitemap entries and clean-URL rewrites that Task 2's validator checks and Task 10's local server exercises.

- [ ] **Step 1: Write `sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://apex-ryde-ios.netlify.app/</loc>
    <lastmod>2026-07-05</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://apex-ryde-ios.netlify.app/support.html</loc>
    <lastmod>2026-07-05</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://apex-ryde-ios.netlify.app/privacy.html</loc>
    <lastmod>2026-07-05</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
```

- [ ] **Step 2: Write `robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://apex-ryde-ios.netlify.app/sitemap.xml
```

- [ ] **Step 3: Write `netlify.toml`**

```toml
[[redirects]]
  from = "/support"
  to = "/support.html"
  status = 200

[[redirects]]
  from = "/privacy"
  to = "/privacy.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
```

- [ ] **Step 4: Commit**

```bash
git add sitemap.xml robots.txt netlify.toml
git commit -m "Add sitemap.xml, robots.txt, netlify.toml"
```

---

### Task 9: Full validator pass

**Files:**
- Modify: none expected (this task fixes whatever the validator finds, if anything)

**Interfaces:**
- Consumes: `scripts/validate-site.mjs` (Task 2), all files from Tasks 3–8.

- [ ] **Step 1: Run the validator**

```bash
cd /Users/matee/Desktop/personalProjects/apex-web
node scripts/validate-site.mjs
```

Expected: `PASS — 3 pages, 3 locales, all references resolve.` and exit code `0`.

- [ ] **Step 2: If it fails, fix the specific file(s) it names and re-run until it passes**

Do not proceed to Task 10 until the validator exits `0`.

- [ ] **Step 3: Commit any fixes made in this task**

```bash
git add -A
git commit -m "Fix validator findings" --allow-empty
```

(Use `--allow-empty` only if Step 1 already passed clean and there was nothing to fix — otherwise omit it and commit the real fixes.)

---

### Task 10: Local server verification

**Files:** none — verification only.

**Interfaces:**
- Consumes: the complete site from Tasks 1–9.

- [ ] **Step 1: Start a local static server in the background**

```bash
cd /Users/matee/Desktop/personalProjects/apex-web
npx --yes serve . -l 4173 > /tmp/apex-web-serve.log 2>&1 &
sleep 2
cat /tmp/apex-web-serve.log
```

Expected: log shows the server accepting connections on port 4173 (serve's banner output).

- [ ] **Step 2: Verify all three pages and clean URLs return 200**

```bash
for path in / /support /privacy /index.html /support.html /privacy.html /styles.css /script.js /assets/icon.png /assets/screenshots/riding.png /assets/og-image.png /sitemap.xml /robots.txt; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:4173$path")
  echo "$path -> $code"
done
```

Expected: every path returns `200`.

- [ ] **Step 3: Verify key content is present on each page**

```bash
curl -s http://localhost:4173/ | grep -o '<title>[^<]*</title>'
curl -s http://localhost:4173/ | grep -c 'data-i18n'
curl -s http://localhost:4173/support | grep -o 'pcesnek290@gmail.com' | head -1
curl -s http://localhost:4173/privacy | grep -o 'Privacy Policy'
```

Expected: title tag present, `data-i18n` count > 0, support email found, "Privacy Policy" found.

- [ ] **Step 4: Leave the server running and report the URL**

Do not stop the background `serve` process — the user asked to view the site in their own browser before publishing. Tell the user: "Site is running at http://localhost:4173 — open it in your browser to review. Stop it later with `kill %1` or by closing the terminal."

- [ ] **Step 5: Final commit if anything changed during verification**

```bash
cd /Users/matee/Desktop/personalProjects/apex-web
git status
```

If clean, no commit needed — Task 9 already committed the final passing state.

---

## Self-Review Notes

- **Spec coverage:** every homepage section, the support/privacy page content, localization mechanism, SEO plan (meta/OG/JSON-LD/sitemap/robots), Netlify config, and git workflow from the spec map onto Tasks 1–10 above.
- **Placeholder scan:** no TBD/TODO remain; the only forward-looking note is the JSON-LD `offers` comment in `index.html`, which is an intentional, clearly-marked deferred item (no live App Store URL exists), not an unfinished requirement.
- **Type/name consistency:** verified every `data-i18n` key referenced across Tasks 5–7 has a matching entry in all three locale blocks in Task 3's `script.js`; verified every asset path referenced in Tasks 5–7 matches Task 1's output paths exactly (`assets/icon.png`, `assets/screenshots/menu.png`, `assets/screenshots/riding.png`, `assets/screenshots/tutorial.png`, `assets/og-image.png`).
