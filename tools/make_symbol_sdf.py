#!/usr/bin/env python3
"""Rebuild assets/relativity-symbol-sdf.png from assets/relativity-symbol.svg.

The planet shader engraves the symbol from a signed distance field, so the edge stays
crisp at any zoom and the bevel can be lit. Run this only if the symbol SVG changes.

Requires: pip install playwright numpy scipy pillow  (and a Chromium for Playwright)
"""
import asyncio
import io
import pathlib
import re

import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
from scipy import ndimage as ndi

ROOT = pathlib.Path(__file__).resolve().parent.parent
SVG = ROOT / "assets" / "relativity-symbol.svg"
OUT = ROOT / "assets" / "relativity-symbol-sdf.png"

N = 2048        # working raster
SIZE = 512      # output texture
SYM_H = 0.72    # symbol height as a fraction of the square texture
SPREAD = 0.07   # distance range in texture units; must match SYMBOL_SPREAD in src/observatory.js


async def render_mask() -> np.ndarray:
    d = re.search(r'<path[^>]*\sd="([^"]+)"', SVG.read_text()).group(1)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": N, "height": N})
        await page.set_content(
            f'<html><body style="margin:0;background:#000">'
            f'<svg id="s" width="{N}" height="{N}"><g id="g"><path id="p" fill="#fff" d="{d}"/></g></svg></body></html>'
        )
        await page.evaluate(
            """([N, H]) => {
                const b = document.getElementById('p').getBBox();
                const k = H * N / b.height;
                document.getElementById('g').setAttribute('transform',
                  `translate(${N/2},${N/2}) scale(${k}) translate(${-(b.x + b.width/2)},${-(b.y + b.height/2)})`);
            }""",
            [N, SYM_H],
        )
        png = await page.screenshot()
        await browser.close()
    return np.asarray(Image.open(io.BytesIO(png)).convert("L")) > 127


def main() -> None:
    inside = asyncio.run(render_mask())
    signed = (ndi.distance_transform_edt(~inside) - ndi.distance_transform_edt(inside)) / N  # + outside
    value = np.clip(0.5 - signed / (2 * SPREAD), 0, 1)
    img = Image.fromarray((value * 255 + 0.5).astype(np.uint8)).resize((SIZE, SIZE), Image.LANCZOS)
    img.save(OUT, optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
