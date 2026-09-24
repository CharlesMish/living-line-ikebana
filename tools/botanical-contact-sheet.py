"""Offline mesh review, deliberately no browser/phone-performance claim.
Usage: python tools/botanical-contact-sheet.py mesh.json sheet.png
Requires Pillow. Painter-sorted flat shading, not the production WebGL lighting.
"""
import json
import sys
from PIL import Image, ImageDraw, ImageFont

data = json.load(open(sys.argv[1]))
w, h = 400, 440
cols = data['columns']
rows = (len(data['panels']) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), '#ede9dd')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
for n, panel in enumerate(data['panels']):
    ox, oy = n % cols * w, n // cols * h
    for t in sorted(panel['triangles'], key=lambda t: (t[2] + t[5] + t[8]), reverse=True):
        points = [(ox + (t[k] + 1) * w / 2, oy + 30 + (1 - t[k + 1]) * (h - 40) / 2) for k in (0, 3, 6)]
        rgb = tuple(max(0, min(255, round(c * 255))) for c in t[9:12])
        draw.polygon(points, fill=rgb)
    draw.text((ox + 8, oy + 8), panel['label'], font=font, fill='#354332')
    draw.rectangle((ox, oy, ox + w - 1, oy + h - 1), outline='#cec9bb')
sheet.save(sys.argv[2])
