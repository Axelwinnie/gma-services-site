"""Patch the GPT products art: logo subtitle spelling, and each painted VIEW PRODUCT button reads BUY HERE.
Usage: python3 tools/bake-products.py <source.png> ../public/assets/home"""
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
def edge_color(box):
    x0, y0, x1, y1 = box; px = []
    for x in range(x0, x1): px += [src.getpixel((x, y0)), src.getpixel((x, y1))]
    px.sort(key=sum); return px[len(px) // 3]
def patch(box, text, f, top, bottom, track=0, glow=None):
    x0, y0, x1, y1 = box; bg = edge_color(box)
    m = Image.new("L", (W, H), 0); ImageDraw.Draw(m).rounded_rectangle(box, 3, fill=255)
    src.paste(Image.composite(Image.new("RGB", (W, H), bg), src, m.filter(ImageFilter.GaussianBlur(1.5))))
    adv = [f.getlength(c) + track for c in text]; tw = sum(adv) - track
    mask = Image.new("L", (W, H), 0); md = ImageDraw.Draw(mask); x = (x0 + x1) / 2 - tw / 2; cy = (y0 + y1) / 2
    for c, a in zip(text, adv): md.text((x, cy), c, font=f, fill=255, anchor="lm"); x += a
    if glow: src.paste(Image.new("RGB", (W, H), glow), (0, 0), mask.filter(ImageFilter.GaussianBlur(3)).point(lambda v: v * 0.45))
    grad = Image.new("RGB", (W, H)); gd = ImageDraw.Draw(grad)
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0); gd.line((x0, y, x1, y), fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    src.paste(grad, (0, 0), mask)
MS = "Montserrat/Montserrat-VariableFont_wght.ttf"
patch((588, 141, 1078, 167), "GRANITE MODELS AUTOMATIONS", font(MS, 23, 700), (250, 250, 252), (160, 164, 176), track=1.6, glow=(70, 20, 50))
B = font("Barlow Semi Condensed/BarlowSemiCondensed-Bold.ttf", 22)
for box in [(132, 834, 290, 860), (572, 834, 738, 860), (950, 832, 1088, 858), (1368, 838, 1516, 865)]:
    patch(box, "BUY HERE", B, (246, 246, 248), (222, 224, 230), track=1.2)
src.save("/tmp/products-baked.png")
def wrap(img, name):
    w, h = img.size
    for t, kw in (("avif", dict(quality=55, speed=4)), ("webp", dict(quality=80, method=6))):
        img.save(f"/tmp/{name}.{t}", **kw)
        b = base64.b64encode(open(f"/tmp/{name}.{t}", "rb").read()).decode()
        open(f"{out}/{name}.{t}.svg", "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><image width="{w}" height="{h}" href="data:image/{t};base64,{b}"/></svg>')
wrap(src, "prod-scene")
wrap(src.resize((960, 540), Image.LANCZOS), "prod-scene-960")
