#!/usr/bin/env python3
"""Generate Android launcher icons from the Jobtic SVG design using PIL."""
from PIL import Image, ImageDraw
import os, math

BG_COLOR = (21, 19, 43)        # #15132B
PURPLE   = (140, 133, 245)     # #8C85F5
GREEN    = (31, 203, 139)      # #1FCB8B

def draw_checkmark(draw, size, stroke_width):
    """Draw the Jobtic checkmark logo centered in the icon."""
    # Scale factor from 64x64 SVG to target size
    # The SVG viewBox is 64x64, icon safe zone is ~66% of 108dp adaptive icon
    # For foreground, we want the logo centered in 108x108 with safe zone
    s = size / 64.0
    
    # Original SVG coordinates
    # M20,32 L27.7,41.6 (purple stroke)
    # M27.7,41.6 L45.8,20.3 (green stroke)
    
    x1, y1 = 20 * s, 32 * s
    x2, y2 = 27.7 * s, 41.6 * s
    x3, y3 = 45.8 * s, 20.3 * s
    
    sw = max(int(stroke_width * s), 2)
    
    # Purple part of checkmark
    draw.line([(x1, y1), (x2, y2)], fill=PURPLE, width=sw)
    # Green part of checkmark
    draw.line([(x2, y2), (x3, y3)], fill=GREEN, width=sw)
    
    # Round caps
    r = sw // 2
    for (cx, cy) in [(x1, y1), (x2, y2), (x3, y3)]:
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=PURPLE if (cx, cy) == (x1, y1) else GREEN)
    # Middle point gets both colors overlapping - use green (top layer)
    draw.ellipse([x2-r, y2-r, x2+r, y2+r], fill=GREEN)

def make_foreground(size):
    """Create adaptive icon foreground (108dp-equivalent with padding)."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Adaptive icons have 18/108 = ~16.7% padding on each side (safe zone is 66/108)
    # Draw the logo in the center 66% area
    padding = int(size * 18 / 108)
    inner_size = size - 2 * padding
    
    # Create inner image with the logo
    inner = Image.new('RGBA', (inner_size, inner_size), (0, 0, 0, 0))
    inner_draw = ImageDraw.Draw(inner)
    draw_checkmark(inner_draw, inner_size, 6)
    
    img.paste(inner, (padding, padding), inner)
    return img

def make_legacy_icon(size):
    """Create a legacy (pre-API 26) square icon with rounded corners."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw rounded rectangle background
    r = int(size * 18 / 64)  # corner radius proportional to SVG
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=r, fill=BG_COLOR)
    
    # Draw checkmark
    draw_checkmark(draw, size, 6)
    return img

def make_round_icon(size):
    """Create a round icon."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw circle background
    draw.ellipse([0, 0, size-1, size-1], fill=BG_COLOR)
    
    # Draw checkmark
    draw_checkmark(draw, size, 6)
    return img

# Android mipmap sizes
DENSITIES = {
    'mdpi':    48,
    'hdpi':    72,
    'xhdpi':   96,
    'xxhdpi':  144,
    'xxxhdpi': 192,
}

FOREGROUND_DENSITIES = {
    'mdpi':    108,
    'hdpi':    162,
    'xhdpi':   216,
    'xxhdpi':  324,
    'xxxhdpi': 432,
}

RES_DIR = '/home/preetrajput12/Jobtic APK/android/app/src/main/res'

for density, size in DENSITIES.items():
    mipmap_dir = os.path.join(RES_DIR, f'mipmap-{density}')
    os.makedirs(mipmap_dir, exist_ok=True)
    
    # Legacy icon
    icon = make_legacy_icon(size)
    icon.save(os.path.join(mipmap_dir, 'ic_launcher.png'))
    
    # Round icon
    round_icon = make_round_icon(size)
    round_icon.save(os.path.join(mipmap_dir, 'ic_launcher_round.png'))
    
    print(f"  {density}: {size}x{size} ✓")

for density, size in FOREGROUND_DENSITIES.items():
    mipmap_dir = os.path.join(RES_DIR, f'mipmap-{density}')
    os.makedirs(mipmap_dir, exist_ok=True)
    
    # Foreground for adaptive icon
    fg = make_foreground(size)
    fg.save(os.path.join(mipmap_dir, 'ic_launcher_foreground.png'))
    
    print(f"  {density} foreground: {size}x{size} ✓")

print("\n✅ All Jobtic launcher icons generated!")
