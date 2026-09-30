# Compares colours of a reference screenshot and one of ours at matching relative points (CIE76 dE; under ~3 looks the same).
# python design/tools/compare_colors.py <reference.png> <ours.png>   - edit R / O (card boxes) and pts for another element
from PIL import Image
import math, sys
def lab(h):
    r,g,b=[c/255 for c in h]
    r,g,b=[((c+0.055)/1.055)**2.4 if c>0.04045 else c/12.92 for c in (r,g,b)]
    x=(r*.4124+g*.3576+b*.1805)/.95047; y=r*.2126+g*.7152+b*.0722; z=(r*.0193+g*.1192+b*.9505)/1.08883
    f=lambda t: t**(1/3) if t>0.008856 else 7.787*t+16/116
    return 116*f(y)-16, 500*(f(x)-f(y)), 200*(f(y)-f(z))
ref=Image.open(sys.argv[1]).convert('RGB')
R=(30,50,440,415); O=(119,116,700,320)   # card boxes: reference crop / ours at 1366x768
pts=[(0.06,0.1),(0.06,0.5),(0.06,0.9),(0.5,0.97),(0.5,0.04),(0.85,0.97),(0.85,0.04)]   # margins only: no text, no character
im=Image.open(sys.argv[2]).convert('RGB'); tot=0
for fx,fy in pts:
    rp=ref.getpixel((int(R[0]+(R[2]-R[0])*fx), int(R[1]+(R[3]-R[1])*fy)))
    op=im.getpixel((int(O[0]+(O[2]-O[0])*fx), int(O[1]+(O[3]-O[1])*fy)))
    d=math.dist(lab(rp),lab(op)); tot+=d
    print(f'({fx},{fy}) ref #%02x%02x%02x  ours #%02x%02x%02x  dE %.1f'%(*rp,*op,d))
print('mean dE %.1f  (under ~3 is hard to tell apart)'%(tot/len(pts)))
