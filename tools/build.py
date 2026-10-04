#!/usr/bin/env python3
"""Assemble the observatory into self-contained pages.

    python3 tools/build.py                      # demo data
    python3 tools/build.py --data path/to.json  # any file with the same shape

Writes:
  index.html             full HTML document (open directly or serve with GitHub Pages)
  dist/observatory.html  the same page without <html>/<head>/<body>, the form published as a Claude artifact

Inlines src/styles.css, src/observatory.js, the tracker data and the symbol texture,
so both outputs run with no other local files (fonts and three.js load from their CDNs).
"""
import argparse
import base64
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"


def safe_in_script(text: str) -> str:
    # keep "</script" from closing the inline block early
    return re.sub(r"</(script)", r"<\\/\1", text, flags=re.I)


def build(data_path: pathlib.Path) -> str:
    page = (SRC / "index.html").read_text(encoding="utf-8")
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    js = (SRC / "observatory.js").read_text(encoding="utf-8")

    data = json.loads(data_path.read_text(encoding="utf-8"))
    for key in ("meta", "destinations"):
        if key not in data:
            sys.exit(f"{data_path}: missing top-level '{key}'")
    data_text = safe_in_script(json.dumps(data, indent=2, ensure_ascii=False))

    def inline_b64(match: re.Match) -> str:
        asset = (SRC / match.group(1)).resolve()
        mime = {".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml"}[asset.suffix]
        return f"data:{mime};base64," + base64.b64encode(asset.read_bytes()).decode()

    replacements = [
        ('<link rel="stylesheet" href="styles.css">', "<style>\n" + css + "</style>"),
        ('<script src="observatory.js"></script>', "<script>\n" + safe_in_script(js) + "</script>"),
    ]
    for old, new in replacements:
        if old not in page:
            sys.exit(f"src/index.html: expected placeholder not found: {old}")
        page = page.replace(old, new)

    page = re.sub(r"/\* @inline:[^*]+\*/", lambda m: data_text, page)
    page = re.sub(r"/\* @inline-base64:([^*\s]+) \*/", inline_b64, page)
    if "@inline" in page:
        sys.exit("src/index.html: unresolved @inline placeholder")
    return page


def as_document(page: str) -> str:
    split = page.index("</style>") + len("</style>")
    head, body = page[:split], page[split:]
    return (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n"
        "<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        + head.strip()
        + "\n</head>\n<body>\n"
        + body.strip()
        + "\n</body>\n</html>\n"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", type=pathlib.Path, default=ROOT / "data" / "tracker-data.demo.json")
    args = ap.parse_args()

    page = build(args.data)
    (ROOT / "dist").mkdir(exist_ok=True)
    (ROOT / "dist" / "observatory.html").write_text(page, encoding="utf-8")
    (ROOT / "index.html").write_text(as_document(page), encoding="utf-8")
    kb = len(page.encode("utf-8")) // 1024
    print(f"built index.html and dist/observatory.html ({kb} KB) from {args.data.relative_to(ROOT) if args.data.is_relative_to(ROOT) else args.data}")


if __name__ == "__main__":
    main()
