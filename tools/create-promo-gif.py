#!/usr/bin/env python3
"""Render a small looping promo animation illustrating Monitor Loupe's views."""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
from pathlib import Path

W, H = 960, 540
OUT = Path(__file__).resolve().parents[1] / "docs"


def font(size, bold=False):
    options = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for path in options:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_desktop():
    im = Image.new("RGB", (W, H))
    px = im.load()
    for y in range(H):
        for x in range(W):
            glow = max(0, 1 - math.sqrt(((x - 220) / 850) ** 2 + ((y - 480) / 560) ** 2))
            px[x, y] = (int(9 + 10 * glow), int(17 + 30 * glow), int(39 + 53 * glow))
    d = ImageDraw.Draw(im, "RGBA")
    # Abstract soft ribbons in the wallpaper.
    d.ellipse((540, 65, 1120, 660), fill=(55, 92, 185, 72))
    d.ellipse((610, 120, 1080, 595), fill=(18, 179, 179, 56))
    d.ellipse((-150, 250, 540, 840), fill=(53, 49, 151, 62))
    # GNOME-like top bar and dock.
    d.rectangle((0, 0, W, 30), fill=(9, 13, 24, 220))
    d.text((18, 7), "Activities", font=font(12, True), fill=(242, 245, 255, 235))
    d.text((427, 7), "Sep 25   10:08", font=font(12, True), fill=(235, 240, 255, 240))
    for i, color in enumerate([(245, 115, 99), (249, 193, 88), (80, 210, 158)]):
        d.ellipse((W - 89 + i * 20, 10, W - 79 + i * 20, 20), fill=(*color, 255))
    # Editor window.
    rounded(d, (76, 95, 569, 430), 13, (22, 29, 47, 242), (135, 174, 225, 150), 1)
    rounded(d, (76, 95, 569, 132), 13, (37, 48, 72, 250))
    d.rectangle((76, 119, 569, 132), fill=(37, 48, 72, 250))
    for i, color in enumerate([(250, 103, 105), (255, 190, 78), (75, 210, 145)]):
        d.ellipse((94 + i * 17, 108, 104 + i * 17, 118), fill=(*color, 255))
    d.text((159, 105), "monitor-loupe.js  ·  editor", font=font(12), fill=(186, 204, 233, 240))
    # Code-like strokes, no meaningful content.
    colors = [(114, 196, 255, 240), (170, 137, 255, 230), (110, 224, 186, 230), (229, 236, 250, 205)]
    for row in range(11):
        y = 157 + row * 22
        d.text((99, y), f"{row + 1:02}", font=font(11), fill=(100, 125, 158, 220))
        x = 133
        for k in range(3 + (row * 3) % 5):
            length = 15 + ((row * 31 + k * 17) % 62)
            d.rounded_rectangle((x, y + 5, x + length, y + 12), radius=3, fill=colors[(row + k) % len(colors)])
            x += length + 8
            if x > 530:
                break
    # Right-side dashboard card.
    rounded(d, (607, 85, 884, 249), 15, (247, 250, 255, 238), (255, 255, 255, 170), 1)
    d.text((629, 104), "DISPLAY OVERVIEW", font=font(11, True), fill=(55, 72, 102, 245))
    d.text((629, 123), "Workspace activity", font=font(17, True), fill=(25, 40, 69, 255))
    for i, h in enumerate([39, 57, 46, 78, 65, 99, 83, 117]):
        x = 632 + i * 27
        rounded(d, (x, 224 - h * .55, x + 15, 225), 6, (61, 188 + (i % 2) * 28, 204, 230))
    # floating terminal card
    rounded(d, (605, 280, 876, 412), 15, (18, 25, 43, 230), (128, 173, 218, 135), 1)
    d.text((626, 296), "⌘  TERMINAL", font=font(11, True), fill=(128, 213, 222, 240))
    for row in range(4):
        y = 324 + row * 20
        d.text((626, y), "$", font=font(12, True), fill=(111, 230, 171, 255))
        d.rounded_rectangle((642, y + 5, 642 + 62 + (row * 41) % 100, y + 12), radius=3, fill=(177, 198, 231, 210))
    # Dock.
    rounded(d, (334, 483, 626, 527), 17, (10, 15, 27, 175), (192, 211, 255, 90), 1)
    dock_colors = [(94, 174, 255), (177, 119, 255), (64, 213, 178), (255, 177, 82), (255, 105, 136)]
    for i, color in enumerate(dock_colors):
        x = 360 + i * 51
        rounded(d, (x, 492, x + 28, 520), 9, (*color, 245))
        d.ellipse((x + 9, 501, x + 19, 511), fill=(255, 255, 255, 210))
    return im


def magnified_patch(base, cx, cy, radius, shape):
    # Sample a larger patch, scale it to the view aperture, then mask it.
    if shape == "rectangle":
        box = (cx - 145, cy - 98, cx + 145, cy + 98)
        mask = Image.new("L", (290, 196), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, 289, 195), radius=16, fill=255)
        crop_box = (cx - 105, cy - 72, cx + 105, cy + 72)
    elif shape == "binoculars":
        box = (cx - 112, cy - 65, cx + 112, cy + 65)
        mask = Image.new("L", (224, 130), 0)
        md = ImageDraw.Draw(mask)
        md.ellipse((0, 0, 128, 128), fill=255)
        md.ellipse((96, 0, 224, 128), fill=255)
        crop_box = (cx - 83, cy - 48, cx + 83, cy + 48)
    else:
        r = radius
        box = (cx - r, cy - r, cx + r, cy + r)
        mask = Image.new("L", (r * 2, r * 2), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, r * 2 - 1, r * 2 - 1), fill=255)
        crop_box = (cx - int(r * .72), cy - int(r * .72), cx + int(r * .72), cy + int(r * .72))
    patch = base.crop(crop_box).resize(mask.size, Image.Resampling.LANCZOS)
    return box, patch, mask


def draw_lens(base, shape, cx, cy):
    radius = 78
    box, patch, mask = magnified_patch(base, cx, cy, radius, shape)
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    patch = patch.convert("RGBA")
    # Mild cool tint makes the optical view feel like one coherent glass lens.
    tint = Image.new("RGBA", patch.size, (28, 170, 232, 25))
    patch = Image.alpha_composite(patch, tint)
    layer.paste(patch, (box[0], box[1]), mask)
    d = ImageDraw.Draw(layer, "RGBA")
    if shape == "rectangle":
        d.rounded_rectangle(box, radius=16, outline=(44, 220, 247, 255), width=5)
        d.rounded_rectangle((box[0] + 7, box[1] + 7, box[2] - 7, box[3] - 7), radius=12, outline=(225, 249, 255, 185), width=2)
    elif shape == "binoculars":
        for lx in (cx - 48, cx + 48):
            d.ellipse((lx - 64, cy - 64, lx + 64, cy + 64), outline=(31, 222, 242, 255), width=8)
            d.ellipse((lx - 57, cy - 57, lx + 57, cy + 57), outline=(219, 249, 255, 210), width=2)
        d.rounded_rectangle((cx - 20, cy - 11, cx + 20, cy + 11), radius=8, fill=(26, 44, 82, 245), outline=(68, 225, 249, 255), width=3)
    else:
        ring = (128, 90, 245, 255) if shape == "telescope" else (38, 214, 242, 255)
        width = 13 if shape == "telescope" else 8
        d.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=ring, width=width)
        d.ellipse((cx - radius + 8, cy - radius + 8, cx + radius - 8, cy + radius - 8), outline=(230, 250, 255, 230), width=2)
        # Short handle, like the existing settings symbol.
        d.line((cx + 54, cy + 54, cx + 93, cy + 93), fill=(27, 45, 76, 255), width=22)
        d.line((cx + 54, cy + 54, cx + 93, cy + 93), fill=ring, width=14)
        d.line((cx + 59, cy + 57, cx + 89, cy + 88), fill=(210, 248, 255, 210), width=3)
    # Tiny pointer dot inside the magnified view.
    d.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=(255, 255, 255, 245))
    return Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")


def render():
    desktop = make_desktop()
    frames = []
    modes = [("rectangle", "RECHTECK"), ("loupe", "LUPE"), ("binoculars", "FELDSTECHER"), ("telescope", "FERNROHR")]
    positions = [(222, 242), (376, 335), (565, 210), (756, 340)]
    for mode_index, (shape, label) in enumerate(modes):
        route = []
        for index, start in enumerate(positions):
            end = positions[(index + 1) % len(positions)]
            for tick in range(6):
                t = tick / 6
                eased = t * t * (3 - 2 * t)
                route.append((round(start[0] + (end[0] - start[0]) * eased),
                              round(start[1] + (end[1] - start[1]) * eased)))
        for x, y in route:
            frame = draw_lens(desktop, shape, x, y)
            d = ImageDraw.Draw(frame, "RGBA")
            # Mode caption and progress markers.
            rounded(d, (24, 455, 207, 505), 16, (8, 14, 29, 205), (93, 200, 237, 110), 1)
            d.text((42, 470), label, font=font(17, True), fill=(234, 248, 255, 255))
            for i in range(4):
                d.ellipse((797 + i * 31, 488, 811 + i * 31, 502), fill=(42, 220, 243, 250) if i == mode_index else (180, 201, 231, 90))
            frames.append(frame)
    OUT.mkdir(exist_ok=True)
    # Save a crisp PNG poster using a scene that highlights the loupe.
    poster = draw_lens(desktop, "loupe", 310, 220)
    pd = ImageDraw.Draw(poster, "RGBA")
    rounded(pd, (24, 455, 207, 505), 16, (8, 14, 29, 205), (93, 200, 237, 110), 1)
    pd.text((42, 470), "LUPE", font=font(17, True), fill=(234, 248, 255, 255))
    poster.save(OUT / "monitor-loupe-demo.png", optimize=True)
    # Palette conversion keeps the animated preview compact for web upload.
    palette_frames = [f.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG) for f in frames]
    palette_frames[0].save(OUT / "monitor-loupe-demo.gif", save_all=True, append_images=palette_frames[1:], duration=90, loop=0, optimize=True, disposal=2)


if __name__ == "__main__":
    render()
