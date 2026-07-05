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
