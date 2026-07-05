# Apex Ryde — App Store Marketing Website — Design

**Date:** 2026-07-05
**Status:** Approved
**Repo:** `~/Desktop/personalProjects/apex-web` (local only, no remote configured yet)

## Purpose

Build the App Store Connect–required web presence for **Apex Ryde**
(bundle id `com.patrikCesnek.apex`, source at `~/Desktop/personalProjects/bikeGame`):
a marketing URL, a support URL, and a privacy-policy URL, all on one
production-grade, localized, SEO-optimized static site — built to the same
standard as the sibling site `sidequest-ios.netlify.app` but skinned in
Apex's own visual identity.

The game itself is not submitted to the App Store yet (iPad screenshots are
still pending per the Apex project notes), so download CTAs render as a
"Coming to the App Store" badge rather than a live link.

## Reference site analysis (sidequest-ios.netlify.app)

Fetched and inspected directly (HTML/CSS/JS, not just the rendered page):

- Plain static site, **no build step**: `index.html`, `support.html`,
  `privacy.html`, one `styles.css`, one `script.js`, an `assets/` folder,
  `sitemap.xml`, `robots.txt`. No `_redirects`/`netlify.toml` — relies on
  Netlify's default clean-URL behavior for `/support` and `/privacy`.
- i18n: a single `translations` object in `script.js` keyed by `en`/`cs`/`sk`,
  applied via `data-i18n` attributes on load. Language resolved from
  `localStorage` → `navigator.language` → `en` fallback. Same URL for every
  language (no per-locale paths, no hreflang tags).
- Dark theme (`color-scheme: dark`), CSS custom properties for the palette,
  system font stack (no webfonts), gradient-fill hero heading, rounded card
  surfaces, a fabricated interactive "phone" mockup in the hero.
- Per-page `<meta description>`, Open Graph/Twitter cards (using the app icon
  as the social image, `summary` card type), one JSON-LD `SoftwareApplication`
  block on the homepage, one `WebPage`/`FAQPage` block on privacy/support.
- Support page: contact mailto, purchase-restore note, data/storage note,
  FAQ via `<details>`. Privacy page: overview + `<details>` sections per
  topic, ending in a contact line with the support email.

Apex Ryde will follow this exact architecture and file layout for consistency
across the developer's app portfolio, with the improvements listed below.

## Visual identity

Colors sampled directly (via Pillow, pixel-sampled) from
`bikeGame/App/Assets.xcassets/AppIcon.appiconset/icon-1024.png`, not guessed:

| Token | Hex | Sampled from |
|---|---|---|
| `--bg` | `#0a0f1c` | darkened from icon sky top `#0f1c37` |
| `--surface` | `#131b2e` | icon sky upper-mid tone |
| `--surface-high` | `#1c2740` | icon sky mid tone |
| `--text` | `#f5f1ea` | icon road-line white `#f7f7f3`, warmed |
| `--muted` | `#93a0c2` | icon steel-blue sky `#4b6090` |
| `--accent` (primary/CTA) | `#e23f2e` | icon chevron red, exact sample |
| `--gold` (secondary accent) | `#eabb89` | icon horizon glow, exact sample |
| `--asphalt` | `#4e4f5a` | icon road surface, exact sample |

Hero `<h1>` and other emphasis headings use a `linear-gradient(90deg, var(--accent), var(--gold))` text fill — the sunset-to-road motif from the icon — mirroring the technique Sidequest uses with its own blue→purple gradient.

Typography: system font stack (`-apple-system, "SF Pro", ui-sans-serif...`),
matching Sidequest's zero-webfont-latency approach. Layout: rounded
(18px-radius) card surfaces, `min(1120px, 100%-32px)` content width, same
proven responsive breakpoints as the reference site (820px, 480px).

## Site map

- `/` — homepage (marketing URL)
- `/support` — support URL
- `/privacy` — privacy-policy URL
- `styles.css`, `script.js`, `assets/` (app icon + 3 rotated screenshots + generated OG card)
- `sitemap.xml`, `robots.txt`, `netlify.toml`

## Homepage sections

1. **Header** — app icon, "Apex Ryde" wordmark, nav (Features / Support / Privacy), EN/SK/CS language switch.
2. **Hero** — eyebrow "iPhone & iPad game", gradient `<h1>Apex Ryde</h1>`, tagline copy built from the game's actual design doc (first-person supersport motorcycle, procedural coastal roads, real riding discipline as the skill ceiling), a **"Coming to the App Store"** badge (styled like a disabled/pending button, not a dead link) + a "Get support" secondary link. Visual: a **landscape-framed** real screenshot (device-glass bezel, wide aspect) — not a portrait phone silhouette, since the game is landscape-only and a portrait mockup would misrepresent it.
3. **Screenshots gallery** — all three real screenshots (`menu.png`, `riding.png`, `tutorial.png`), rotated 90° to their correct landscape orientation (they're saved sideways in a portrait canvas), each with a real, descriptive `alt` and short caption.
4. **Features grid** (6 cards, real feature set from the game, not filler):
   - Friction-circle physics (brake/throttle/lean share one grip budget — lowside if you exceed it)
   - Authentic sequential gearbox (`1 N 2 3 4 5 6`, half/full swipe shifter, quickshifter)
   - Tilt steering via CoreMotion, with a touch-drag fallback
   - Endless procedural coastal roads — different every run, same seed replays identically
   - Game Center leaderboards & achievements
   - Universal iPhone + iPad, landscape, touch + tilt
5. **"The skill ceiling" split section** — crash conditions presented as a tag list (Lowside, Highside, Wheelie loop-out, Running wide, Obstacle hit), selling the sim-depth/authenticity angle to riders.
6. **Download section** — repeats the Coming Soon badge with the app icon.
7. **Footer** — wordmark, Support, Privacy links.

## Support page (`/support`)

- Contact card: `mailto:pcesnek290@gmail.com`, ask for device model + iOS version + description.
- Game Center troubleshooting (leaderboard/achievement sync).
- Data/storage note: run history and settings are stored on-device.
- FAQ (`<details>`): languages supported, tilt-steering fallback in Simulator/without motion, Game Center opt-out behavior, whether an internet connection is required (no — fully offline-playable).

## Privacy page (`/privacy`)

Adapted to Apex Ryde's actual data model (from the game's architecture: SwiftData local persistence, GameKit, CoreMotion, no ads/analytics/accounts):

- Overview: no account system, no analytics SDK, no ad network in the app.
- Information the app stores locally: settings, run history, personal bests (SwiftData).
- Game Center: if you sign in, your Game Center identity and scores are shared with Apple's Game Center service for leaderboards/achievements, governed by Apple's own privacy policy.
- Motion sensor (CoreMotion tilt-steering input): processed on-device only, in real time, never recorded or transmitted.
- Third parties: Apple services only (App Store, Game Center); no data is sold.
- Deleting your data: delete the app; local data goes with it.
- Contact: `pcesnek290@gmail.com`.

## Localization (EN / SK / CS)

Same mechanism as Sidequest: one `translations` dictionary object in
`script.js`, `data-i18n` attributes on every translatable string,
`localStorage` → browser-language → `en` fallback resolution, single URL per
page for all languages.

**Improvement over the reference implementation:** `setLanguage()` also
updates `document.title` and the `<meta name="description">` content from
the dictionary, not just visible DOM text — Sidequest's implementation
leaves the `<title>`/meta description in English regardless of the active
language.

Known, accepted trade-off (same as the reference site): because language is
a client-side toggle rather than separate per-locale URLs, only the default
English content is what search engines index/see pre-JS; this matches the
existing sibling site's approach and keeps the architecture simple (no build
step, no i18n routing).

## SEO

- Per-page `<title>`, `<meta description>`, canonical URL, Open Graph +
  Twitter Card tags.
- **Custom generated 1200×630 OG/social image** (composited from the rotated
  riding screenshot + wordmark + gradient overlay) instead of reusing the
  1024×1024 app icon as the social card, as Sidequest does.
- JSON-LD `SoftwareApplication` on the homepage — **omitting** the
  `offers`/`downloadUrl` fields until a real App Store URL exists (a code
  comment marks exactly where to add them once the app ships), to avoid
  publishing broken/misleading structured data.
- JSON-LD `FAQPage` on `/support`, `WebPage` on `/privacy`.
- `sitemap.xml` (3 URLs), `robots.txt` referencing it.
- Semantic landmarks (`header`/`main`/`footer`/`nav`), real descriptive `alt`
  text on every image (the reference site uses empty `alt=""` throughout —
  this site won't).

## Infrastructure

- `netlify.toml`: explicit clean-URL redirects (`/support` → `/support.html`,
  `/privacy` → `/privacy.html`, both as 200 rewrites so the clean path stays
  in the address bar) instead of relying on Netlify's implicit default
  behavior, plus baseline security headers (`X-Content-Type-Options`,
  `Referrer-Policy`, a light `Content-Security-Policy`).
- Local dev: `npx serve .` (resolves clean URLs the same way Netlify will).
- Canonical/OG URLs target `https://apex-ryde-ios.netlify.app/` (not live
  yet — the user will connect Netlify and publish it themselves).

## Git workflow

- `main`: initial commit already made (`.gitignore`, `README.md`).
- `develop`: created from `main`; **all site-building work happens here**,
  per instruction. No remote configured — local repo only; the user pushes
  to GitHub/Netlify themselves if/when they choose to.
- `.gitignore` excludes all AI/agent tooling directories and files
  (`.claude/`, `.claude-flow/`, `.swarm/`, `ruvector.db`,
  `claude-flow.config.json`, etc.) plus standard OS/editor/Node noise.

## Out of scope / open items for the user

- Real App Store URL and numeric app id (once reserved in App Store Connect) —
  the hero/download CTAs and JSON-LD have clearly marked spots to drop it in.
- Pushing to a GitHub remote and connecting the Netlify site — user will do
  this themselves after reviewing the site locally.
