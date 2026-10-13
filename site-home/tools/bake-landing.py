"""Patch the GPT landing art: logo subtitle spelling and the support email.
Usage: python3 tools/bake-landing.py <source.png> ../public/assets/home"""
import sys, base64
from PIL import Image, ImageDraw, ImageFont, ImageFilter
src = Image.open(sys.argv[1]).convert("RGB"); out = sys.argv[2]
W, H = src.size
G = "/usr/share/fonts/truetype/sand-box/google/"
def font(path, size, wght=None):
    f = ImageFont.truetype(G + path, size)
    if wght:
        try: f.set_variation_by_axes([wght])
        except Exception: pass
    return f
def fit(text, path, wght, maxw, size):
    while size > 6:
        f = font(path, size, wght)
        if f.getbbox(text)[2] <= maxw: return f
        size -= 1
    return f
def text_patch(box, text, f, top, bottom, bg, glow=None, track=0):
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(src)
    d.rectangle(box, fill=bg)
    # soft blend the patch edges into the art
    m = Image.new("L", (W, H), 0); ImageDraw.Draw(m).rectangle(box, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(2))
    layer = Image.new("RGB", (W, H), bg)
    src.paste(Image.composite(layer, src, m))
    cx = (x0 + x1) / 2; cy = (y0 + y1) / 2
    adv = [f.getlength(c) + track for c in text]; tw = sum(adv) - track
    mask = Image.new("L", (W, H), 0); md = ImageDraw.Draw(mask); x = cx - tw / 2
    for c, a in zip(text, adv): md.text((x, cy), c, font=f, fill=255, anchor="lm"); x += a
    if glow:
        g = mask.filter(ImageFilter.GaussianBlur(3))
        src.paste(Image.new("RGB", (W, H), glow), (0, 0), g.point(lambda v: v * 0.5))
    # vertical metal gradient between top and bottom colors
    grad = Image.new("RGB", (W, H))
    gd = ImageDraw.Draw(grad)
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        gd.line((x0, y, x1, y), fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    src.paste(grad, (0, 0), mask)
# 1) logo subtitle: GRANITE MODELS AUTOMATION -> GRANITE MODELS AUTOMATIONS
t1 = "GRANITE MODELS AUTOMATIONS"
text_patch((586, 172, 1088, 201), t1, font("Montserrat/Montserrat-VariableFont_wght.ttf", 23, 700), (250, 250, 252), (150, 156, 166), (16, 10, 8), glow=(60, 30, 10), track=1.6)
# 2) email: INFO@ -> SUPPORT@
t2 = "SUPPORT@GRANITEMODELS.STORE"
text_patch((246, 872, 536, 898), t2, fit(t2, "Barlow Semi Condensed/BarlowSemiCondensed-Medium.ttf", None, 282, 19), (245, 247, 250), (225, 229, 235), (6, 8, 12))
src.save(out + "/landing-baked.png")
def wrap(img, name):
    w, h = img.size
    for t, kw in (("avif", dict(quality=55, speed=4)), ("webp", dict(quality=80, method=6))):
        img.save(f"/tmp/{name}.{t}", **kw)
        b = base64.b64encode(open(f"/tmp/{name}.{t}", "rb").read()).decode()
        open(f"{out}/{name}.{t}.svg", "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><image width="{w}" height="{h}" href="data:image/{t};base64,{b}"/></svg>')
wrap(src, "land-scene")
wrap(src.resize((960, 540), Image.LANCZOS), "land-scene-960")
