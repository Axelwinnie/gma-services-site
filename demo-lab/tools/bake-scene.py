"""Bake true-text HUD patches over the invented figures in the GPT dashboard art,
then write the WebP and AVIF versions (wrapped in SVG so they can live in git as text).
Usage: python3 tools/bake-scene.py <source.png>"""
import sys, base64
from PIL import Image, ImageDraw, ImageFont
src = Image.open(sys.argv[1]).convert("RGB")
d = ImageDraw.Draw(src)
M = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
S = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
f = lambda p, s: ImageFont.truetype(p, s)
PATCH, EDGE, INK, MUTED, GREEN, BLUE = (6,12,19), (38,64,96), (226,232,240), (150,162,178), (52,211,153), (96,165,250)
def box(x0,y0,x1,y1,edge=True,fill=PATCH):
    d.rounded_rectangle((x0,y0,x1,y1), 5, fill=fill, outline=EDGE if edge else None)
def dotline(x,y,t,c=GREEN,s=11):
    d.ellipse((x,y-4,x+8,y+4), fill=c); d.text((x+16,y), t, font=f(M,s), fill=INK, anchor="lm")
# stats panel (Workflows running / Data processed / Success rate)
box(162,68,312,175)
for i,t in enumerate(["4 DEMOS LIVE","SANDBOX ONLINE","RESETS ON RELOAD","FAKE DATA ONLY"]): dotline(174,88+i*25,t)
# Active Workflows 12 Running
box(1124,10,1299,61); d.text((1140,27),"RESETS ON RELOAD",font=f(M,13),fill=INK,anchor="lm"); d.text((1140,45),"No sign-up needed",font=f(S,12),fill=MUTED,anchor="lm")
# CPU 28%
box(1308,10,1467,61); d.text((1324,27),"SAMPLE DATA",font=f(M,13),fill=INK,anchor="lm"); d.text((1324,45),"Nothing is saved",font=f(S,12),fill=MUTED,anchor="lm")
# bell with badge: decorative, blank it
box(1474,8,1527,59,edge=False,fill=(9,14,20))
# sidebar menu and search box: decorative controls, replace with plain labels
box(0,78,146,346,edge=False,fill=(5,10,16))
d.line((145,78,145,346),fill=(24,40,60))
for i,t in enumerate(["PICK A","STATION","","TICKETS","EXTRACT","FILES","ESTIMATING"]):
    if t: d.text((22,104+i*34),t,font=f(M,12),fill=(BLUE if i<2 else MUTED),anchor="lm")
box(472,13,916,51); d.text((494,32),"4 SANDBOX DEMOS  /  CLICK A STATION TO START",font=f(M,13),fill=MUTED,anchor="lm")
# bottom bar figures
for (x0,x1,t) in [(552,702,"RESETS ON RELOAD"),(724,868,"FAKE DATA ONLY"),(898,1038,"NO SIGN-UP")]:
    box(x0,904,x1,929,edge=False,fill=(6,13,20)); dotline(x0+10,916,t,BLUE,10)
src.save(sys.argv[2] if len(sys.argv)>2 else "/tmp/baked.png")
def wrap(img,name,w,h):
    for t,kw in (("avif",dict(quality=55,speed=4)),("webp",dict(quality=78,method=6))):
        img.save(f"/tmp/{name}.{t}",**kw)
        b=base64.b64encode(open(f"/tmp/{name}.{t}","rb").read()).decode()
        open(f"public/assets/{name}.{t}.svg","w").write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><image width="{w}" height="{h}" href="data:image/{t};base64,{b}"/></svg>')
wrap(src,"lab-scene",1672,941)
wrap(src.resize((960,540),Image.LANCZOS),"lab-scene-960",960,540)
