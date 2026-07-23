#!/usr/bin/env python3
"""
make_icon.py — Aegis-Sim app icon (world-class, simple, bold).

Design language: one confident idea, lots of negative space, high contrast so it
reads at 16 px and looks premium at 1024 px. A single sleek interceptor climbing
a luminous amber intercept arc toward a crisp target-lock, on a deep tactical
gradient with a squircle mask (macOS-native silhouette).
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SS = 4                         # supersample
W = 256 * SS                   # master canvas
AMBER = (255, 184, 28)
AMBER_HI = (255, 214, 120)
BLUE = (60, 214, 255)
RED = (255, 74, 42)
INK = (232, 242, 252)


def squircle_mask(size, radius_frac=0.235, n=5.0):
    """Apple-style superellipse (squircle) mask."""
    m = Image.new("L", (size, size), 0)
    px = m.load()
    cx = cy = (size - 1) / 2.0
    a = size / 2.0
    r = a  # superellipse spanning full canvas
    for y in range(size):
        for x in range(size):
            dx = abs(x - cx) / r
            dy = abs(y - cy) / r
            if dx ** n + dy ** n <= 1.0:
                px[x, y] = 255
    return m.filter(ImageFilter.GaussianBlur(0.6))


def vgrad(top, bottom):
    t = np.linspace(0, 1, W)[:, None]
    col = np.array(top)[None, None] * (1 - t)[:, :, None] + np.array(bottom)[None, None] * t[:, :, None]
    return Image.fromarray(np.repeat(col.astype(np.uint8), W, axis=1), "RGB").convert("RGBA")


def radial_glow(center, radius, color, alpha):
    g = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    cx, cy = center
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(*color, alpha))
    return g.filter(ImageFilter.GaussianBlur(radius * 0.35))


def bez(p0, c, p1, n=260):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]) for t in
            (i / n for i in range(n + 1))]


def bez_pt(p0, c, p1, t):
    x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0]
    y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]
    dx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0])
    dy = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1])
    return (x, y), math.degrees(math.atan2(dy, dx))


def stamp(draw, pts, color, r0, r1):
    """Perfectly smooth tapered stroke via overlapping circles (r0 tail → r1 head)."""
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        f = i / max(n - 1, 1)
        r = r0 + (r1 - r0) * f
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


def missile(scale, color, accent):
    """Sleek slender missile, nose UP (-y)."""
    w, h = int(120 * scale), int(150 * scale)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = w / 2
    bw = w * 0.10                      # slim body half-width
    top, bot = h * 0.20, h * 0.80
    fin = (168, 176, 188, 255)
    # two clean swept tail fins
    d.polygon([(cx - bw, h * 0.66), (cx - bw - w * 0.16, h * 0.86), (cx - bw, h * 0.80)], fill=fin)
    d.polygon([(cx + bw, h * 0.66), (cx + bw + w * 0.16, h * 0.86), (cx + bw, h * 0.80)], fill=fin)
    # body
    d.rounded_rectangle([cx - bw, top, cx + bw, bot], radius=bw, fill=color)
    # sharp ogive nose
    d.polygon([(cx - bw, top + 3), (cx + bw, top + 3), (cx, h * 0.05)], fill=(248, 251, 255, 255))
    # accent band + dark seeker tip
    d.rectangle([cx - bw, h * 0.33, cx + bw, h * 0.375], fill=(*accent, 255))
    d.polygon([(cx - bw * 0.7, h * 0.11), (cx + bw * 0.7, h * 0.11), (cx, h * 0.05)], fill=(34, 44, 60, 255))
    return im


def main():
    base = vgrad((16, 34, 58), (5, 9, 16))
    # ambient depth glows
    base = Image.alpha_composite(base, radial_glow((W * 0.30, W * 0.34), W * 0.5, (20, 90, 140), 120))
    base = Image.alpha_composite(base, radial_glow((W * 0.72, W * 0.30), W * 0.4, (255, 150, 20), 55))

    glow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    crisp = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    gd, cd = ImageDraw.Draw(glow), ImageDraw.Draw(crisp)

    # the intercept arc — a tapered amber trail from lower-left up to the missile
    p0, c, p1 = (W * 0.19, W * 0.93), (W * 0.26, W * 0.28), (W * 0.70, W * 0.285)
    t_missile = 0.60
    trail = [bez_pt(p0, c, p1, i / 200 * t_missile)[0] for i in range(201)]
    stamp(gd, trail, (*AMBER, 150), 3 * SS, 20 * SS)          # soft glow, tapered
    stamp(cd, trail, (*AMBER_HI, 255), 1.2 * SS, 8 * SS)      # bright core, tapered

    # missile riding the leading edge of the trail
    mpos, ang = bez_pt(p0, c, p1, t_missile)
    mi = missile(SS, (224, 230, 240, 255), AMBER)
    mi = mi.rotate(-(ang + 90), expand=True, resample=Image.BICUBIC)
    ex = math.radians(ang)
    epos = (mpos[0] - math.cos(ex) * 30 * SS, mpos[1] - math.sin(ex) * 30 * SS)
    glow = Image.alpha_composite(glow, radial_glow(epos, 40 * SS, (120, 210, 255), 200))
    crisp.alpha_composite(mi, (int(mpos[0] - mi.width / 2), int(mpos[1] - mi.height / 2)))

    # minimal target lock ahead of the missile — clean corner brackets + dot
    tp = (W * 0.775, W * 0.285)
    s = int(46 * SS)
    L = int(30 * SS)
    lw = int(7 * SS)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x0, y0 = tp[0] + sx * s, tp[1] + sy * s
            cd.line([x0, y0, x0 - sx * L, y0], fill=(*RED, 255), width=lw)
            cd.line([x0, y0, x0, y0 - sy * L], fill=(*RED, 255), width=lw)
    gd.ellipse([tp[0] - s, tp[1] - s, tp[0] + s, tp[1] + s], outline=(*RED, 60), width=int(4 * SS))
    cd.ellipse([tp[0] - 6 * SS, tp[1] - 6 * SS, tp[0] + 6 * SS, tp[1] + 6 * SS], fill=(*RED, 255))

    out = Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(10 * SS)))
    out = Image.alpha_composite(out, crisp)
    # top glass sheen
    sheen = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(sheen).ellipse([-W * 0.3, -W * 0.75, W * 1.3, W * 0.35], fill=(255, 255, 255, 22))
    out = Image.alpha_composite(out, sheen.filter(ImageFilter.GaussianBlur(24 * SS)))

    # squircle mask + subtle rim light
    mask = squircle_mask(W)
    final = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    final.paste(out, (0, 0), mask)
    rim = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rim)
    # trace the mask edge as a faint light ring
    edge = mask.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(SS))
    ring = Image.new("RGBA", (W, W), (150, 190, 230, 90))
    final = Image.alpha_composite(final, Image.composite(ring, Image.new("RGBA", (W, W), (0, 0, 0, 0)), edge))

    final = final.resize((1024, 1024), Image.LANCZOS)
    final.save(os.path.join(HERE, "icon_master.png"))

    iconset = os.path.join(HERE, "AegisSim.iconset")
    os.makedirs(iconset, exist_ok=True)
    for sz, name in [(16, "16x16"), (32, "16x16@2x"), (32, "32x32"), (64, "32x32@2x"),
                     (128, "128x128"), (256, "128x128@2x"), (256, "256x256"),
                     (512, "256x256@2x"), (512, "512x512"), (1024, "512x512@2x")]:
        final.resize((sz, sz), Image.LANCZOS).save(os.path.join(iconset, f"icon_{name}.png"))
    print("icon written:", iconset)


if __name__ == "__main__":
    main()
