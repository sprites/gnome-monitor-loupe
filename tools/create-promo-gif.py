#!/usr/bin/env python3
"""Illustrate Monitor Loupe's shapes and scroll-wheel lens resizing."""

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


def magnified_patch(base, cx, cy, radius, shape, scale=1):
    # Keep content magnification constant while the aperture changes size.
    if shape == "rectangle":
        width, height = round(290 * scale), round(196 * scale)
    elif shape == "binoculars":
        width, height = round(224 * scale), round(130 * scale)
    else:
        width = height = round(radius * 2 * scale)
    left, top = cx - width // 2, cy - height // 2
    box = (left, top, left + width, top + height)
    mask = Image.new("L", (width, height), 0)
    if shape == "rectangle":
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=16, fill=255)
    elif shape == "binoculars":
        md = ImageDraw.Draw(mask)
        md.ellipse((0, 0, round(128 * scale), height - 1), fill=255)
        md.ellipse((round(96 * scale), 0, width - 1, height - 1), fill=255)
    else:
        ImageDraw.Draw(mask).ellipse((0, 0, width - 1, height - 1), fill=255)
    crop_box = (cx - width / 2 / 1.4, cy - height / 2 / 1.4,
                cx + width / 2 / 1.4, cy + height / 2 / 1.4)
    patch = base.crop(crop_box).resize(mask.size, Image.Resampling.LANCZOS)
    return box, patch, mask


def draw_lens(base, shape, cx, cy, scale=1):
    radius = round(78 * scale)
    box, patch, mask = magnified_patch(base, cx, cy, 78, shape, scale)
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
        r = round(64 * scale)
        for lx in (cx - round(48 * scale), cx + round(48 * scale)):
            d.ellipse((lx - r, cy - r, lx + r, cy + r), outline=(31, 222, 242, 255), width=8)
            d.ellipse((lx - r + 7, cy - r + 7, lx + r - 7, cy + r - 7), outline=(219, 249, 255, 210), width=2)
        d.rounded_rectangle((cx - 20 * scale, cy - 11 * scale, cx + 20 * scale, cy + 11 * scale), radius=8, fill=(26, 44, 82, 245), outline=(68, 225, 249, 255), width=3)
    else:
        ring = (128, 90, 245, 255) if shape == "telescope" else (38, 214, 242, 255)
        width = 13 if shape == "telescope" else 8
        d.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=ring, width=width)
        d.ellipse((cx - radius + 8, cy - radius + 8, cx + radius - 8, cy + radius - 8), outline=(230, 250, 255, 230), width=2)
        if shape == "loupe":
            # The handle scales with the lens; the telescope has no handle.
            handle = (cx + 54 * scale, cy + 54 * scale, cx + 93 * scale, cy + 93 * scale)
            d.line(handle, fill=(27, 45, 76, 255), width=round(22 * scale))
            d.line(handle, fill=ring, width=round(14 * scale))
            d.line((cx + 59 * scale, cy + 57 * scale, cx + 89 * scale, cy + 88 * scale), fill=(210, 248, 255, 210), width=3)
    # Tiny pointer dot inside the magnified view.
    d.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=(255, 255, 255, 245))
    return Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")


def render():
    desktop = make_desktop()
    frames = []
    modes = [("rectangle", "RECHTECK"), ("loupe", "LUPE"), ("binoculars", "FELDSTECHER"), ("telescope", "FERNROHR")]
    ticks_per_mode = 48
    transition_ticks = 7
    preview_frames = []
    for mode_index, (shape, label) in enumerate(modes):
        next_shape, next_label = modes[(mode_index + 1) % len(modes)]
        for frame_index in range(ticks_per_mode):
            phase = 2 * math.pi * frame_index / ticks_per_mode
            # A continuous swooping path with two size pulses per form. The
            # loop closes smoothly, including the last-to-first shape change.
            x = round(480 + 210 * math.sin(phase) + 14 * math.sin(3 * phase + .3))
            y = round(240 + 52 * math.sin(2 * phase))
            scale = 1.075 - .525 * math.cos(2 * phase)
            caption = "LINSE VERGRÖSSERN" if math.sin(2 * phase) >= 0 else "LINSE VERKLEINERN"
            frame = draw_lens(desktop, shape, x, y, scale)
            visible_label = label
            visible_mode = mode_index
            if frame_index >= ticks_per_mode - transition_ticks:
                t = (frame_index - (ticks_per_mode - transition_ticks)) / (transition_ticks - 1)
                blend = t * t * (3 - 2 * t)
                frame = Image.blend(frame, draw_lens(desktop, next_shape, x, y, scale), blend)
                caption = "FORMWECHSEL"
                if blend >= .5:
                    visible_label = next_label
                    visible_mode = (mode_index + 1) % len(modes)
            d = ImageDraw.Draw(frame, "RGBA")
            # Separate window size from content zoom in the caption.
            rounded(d, (235, 44, 725, 79), 12, (8, 14, 29, 225), (93, 200, 237, 110), 1)
            shortcut = "Umschalt + Strg + Super + Mausrad"
            d.text((W / 2, 61), shortcut, anchor="mm", font=font(17, True), fill=(234, 248, 255, 255))
            rounded(d, (267, 430, 693, 466), 12, (8, 14, 29, 225))
            d.text((W / 2, 448), caption, anchor="mm", font=font(16, True), fill=(234, 248, 255, 255))
            # Mode caption and progress markers.
            rounded(d, (24, 455, 207, 505), 16, (8, 14, 29, 205), (93, 200, 237, 110), 1)
            d.text((42, 470), visible_label, font=font(17, True), fill=(234, 248, 255, 255))
            for i in range(4):
                d.ellipse((797 + i * 31, 488, 811 + i * 31, 502), fill=(42, 220, 243, 250) if i == visible_mode else (180, 201, 231, 90))
            frames.append(frame)
            if mode_index < 2 and frame_index in (0, 12, 24):
                preview_frames.append(frame.copy())
    OUT.mkdir(exist_ok=True)
    # Save a crisp PNG poster using a scene that highlights the loupe.
    poster = draw_lens(desktop, "loupe", 310, 220)
    pd = ImageDraw.Draw(poster, "RGBA")
    rounded(pd, (24, 455, 207, 505), 16, (8, 14, 29, 205), (93, 200, 237, 110), 1)
    pd.text((42, 470), "LUPE", font=font(17, True), fill=(234, 248, 255, 255))
    poster.save(OUT / "monitor-loupe-demo.png", optimize=True)
    # Contact sheet for visual review; keep it outside the published docs.
    review = Image.new("RGB", (W * 3, H * 2))
    for index, frame in enumerate(preview_frames):
        review.paste(frame, ((index % 3) * W, (index // 3) * H))
    review.save("/tmp/monitor-loupe-animation-review.png")
    # One palette avoids color flicker and lets GIF encode only changed areas.
    samples = Image.new("RGB", (240 * 4, 135 * 3))
    for index in range(12):
        frame = frames[index * (len(frames) - 1) // 11]
        samples.paste(frame.resize((240, 135)), ((index % 4) * 240, (index // 4) * 135))
    palette = samples.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    palette_frames = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    palette_frames[0].save(OUT / "monitor-loupe-demo-v14-slow.gif", save_all=True, append_images=palette_frames[1:], duration=120, loop=0, optimize=True, disposal=1)


if __name__ == "__main__":
    render()
