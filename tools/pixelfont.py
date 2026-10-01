#!/usr/bin/env python3
"""Builds web/assets/fonts/CheckpointPixel.ttf, the blocky number font, with only the standard library.

The digits and "#" are copied pixel for pixel from the 2025 Checkpoint recap (a recording of it, sampled cell by cell):
a 7-pixel-tall grid where "1" is 2 pixels wide, "2 3 5 7" are 3 and the rest 4, with a 1-pixel gap after every glyph.
The punctuation is drawn in the same style. One pixel is 100 font units (a tenth of the em), so the font is
sharpest at font sizes that are multiples of 10px.

Usage: python3 tools/pixelfont.py   (writes the .ttf next to the other self-hosted fonts)
"""
import pathlib
import struct
import time

FAMILY = "Checkpoint Pixel"
PX = 100  # font units per pixel
UPM = 1000
ASCENT, DESCENT = 850, 150  # glyphs sit 0..700 above the baseline, so caps centre in a line-height:1 box

# Rows are top to bottom; row 0 is the top of the digits (y 600..700), a row after row 6 hangs below the baseline.
GLYPHS = {
    "0": [".##.", "#..#", "#..#", "#..#", "#..#", "#..#", ".##."],
    "1": [".#", "##", ".#", ".#", ".#", ".#", ".#"],
    "2": ["##.", "..#", "..#", ".#.", "#..", "#..", "###"],
    "3": ["##.", "..#", "..#", "##.", "..#", "..#", "##."],
    "4": ["#...", "#...", "#.#.", "#.#.", "####", "..#.", "..#."],
    "5": ["###", "#..", "#..", "##.", "..#", "..#", "##."],
    "6": [".##.", "#...", "#...", "###.", "#..#", "#..#", ".##."],
    "7": ["###", "..#", "..#", ".#.", ".#.", "#..", "#.."],
    "8": [".##.", "#..#", "#..#", ".##.", "#..#", "#..#", ".##."],
    "9": [".##.", "#..#", "#..#", ".###", "...#", "...#", ".##."],
    "#": [".....", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", "....."],
    ",": ["..", "..", "..", "..", "..", "..", ".#", "#."],
    ".": [".", ".", ".", ".", ".", ".", "#"],
    ":": [".", ".", "#", ".", ".", "#", "."],
    "-": ["...", "...", "...", "###", "...", "...", "..."],
    "+": ["...", "...", ".#.", "###", ".#.", "...", "..."],
    "/": ["..#", "..#", ".#.", ".#.", ".#.", "#..", "#.."],
    "%": ["##..#", "##..#", "...#.", "..#..", ".#...", "#..##", "#..##"],
    "x": ["...", "...", "#.#", ".#.", "#.#", "...", "..."],
}
SPACE_ADVANCE = 3 * PX


def rects(rows):
    """Pixel rows -> rectangles (x0, y0, x1, y1) in font units: runs per row, stacked runs merged vertically."""
    out = []
    open_runs = {}  # (start, end) -> [x0, y_bottom, x1, y_top]
    for r, row in enumerate(rows):
        y_top = (7 - r) * PX
        runs, x = set(), 0
        while x < len(row):
            if row[x] == "#":
                s = x
                while x < len(row) and row[x] == "#":
                    x += 1
                runs.add((s, x))
            else:
                x += 1
        for key in list(open_runs):
            if key not in runs:
                out.append(tuple(open_runs.pop(key)))
        for key in runs:
            if key in open_runs:
                open_runs[key][1] = y_top - PX
            else:
                open_runs[key] = [key[0] * PX, y_top - PX, key[1] * PX, y_top]
    out.extend(tuple(v) for v in open_runs.values())
    return out


def glyf_data(rs):
    """A simple TrueType glyph: one clockwise 4-point contour per rectangle, all points on the curve."""
    if not rs:
        return b""
    pts = []
    for x0, y0, x1, y1 in rs:
        pts += [(x0, y0), (x0, y1), (x1, y1), (x1, y0)]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    data = struct.pack(">hhhhh", len(rs), min(xs), min(ys), max(xs), max(ys))
    data += struct.pack(f">{len(rs)}H", *[4 * i + 3 for i in range(len(rs))])
    data += struct.pack(">H", 0)  # no hinting instructions
    data += bytes([0x01] * len(pts))  # ON_CURVE, 16-bit signed deltas for x and y
    px = py = 0
    dx, dy = [], []
    for x, y in pts:
        dx.append(x - px)
        dy.append(y - py)
        px, py = x, y
    data += struct.pack(f">{len(dx)}h", *dx) + struct.pack(f">{len(dy)}h", *dy)
    return data + b"\0" * (-len(data) % 4)


def checksum(b):
    b += b"\0" * (-len(b) % 4)
    return sum(struct.unpack(f">{len(b) // 4}I", b)) & 0xFFFFFFFF


def build():
    chars = sorted(GLYPHS)
    order = [".notdef", " "] + chars  # glyph ids
    glyphs, metrics = [], []  # (advance, lsb)
    bbox = [0, 0, 0, 0]
    max_pts = max_ctrs = 0
    for name in order:
        if name in (".notdef", " "):
            glyphs.append(b"")
            metrics.append((SPACE_ADVANCE, 0))
            continue
        rows = GLYPHS[name]
        rs = rects(rows)
        glyphs.append(glyf_data(rs))
        metrics.append(((max(len(r) for r in rows) + 1) * PX, min(r[0] for r in rs)))
        bbox = [min(bbox[0], *(r[0] for r in rs)), min(bbox[1], *(r[1] for r in rs)),
                max(bbox[2], *(r[2] for r in rs)), max(bbox[3], *(r[3] for r in rs))]
        max_pts, max_ctrs = max(max_pts, 4 * len(rs)), max(max_ctrs, len(rs))

    glyf = b"".join(glyphs)
    offsets, o = [], 0
    for g in glyphs:
        offsets.append(o)
        o += len(g)
    offsets.append(o)
    loca = struct.pack(f">{len(offsets)}I", *offsets)
    hmtx = b"".join(struct.pack(">Hh", a, l) for a, l in metrics)

    now = int(time.time()) + 2082844800  # seconds since 1904
    head = struct.pack(">IIIIHHqqhhhhHHhhh", 0x00010000, 0x00010000, 0, 0x5F0F3CF5, 0x000B, UPM, now, now,
                       *bbox, 0, 8, 2, 1, 0)
    adv_max = max(a for a, _ in metrics)
    hhea = struct.pack(">IhhhHhhhhhhhhhhhH", 0x00010000, ASCENT, -DESCENT, 0, adv_max, 0, 0, bbox[2], 1, 0, 0,
                       0, 0, 0, 0, 0, len(metrics))
    maxp = struct.pack(">IHHHHHHHHHHHHHH", 0x00010000, len(order), max_pts, max_ctrs, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0)
    codes = [ord(c) for c in order[1:]]
    avg = sum(a for a, _ in metrics) // len(metrics)
    os2 = struct.pack(">HhHHH" + "h" * 11 + "10sIIII4sHHHhhhHHIIhhHHH",
                      4, avg, 400, 5, 0,  # version, xAvgCharWidth, weight, width, fsType (installable)
                      650, 600, 0, 75, 650, 600, 0, 350, 50, 250, 0,  # sub/superscript, strikeout, family class
                      bytes(10), 1, 0, 0, 0, b"NONE",  # panose, unicode ranges (basic latin), vendor
                      0x00C0, min(codes), max(codes),  # REGULAR | USE_TYPO_METRICS
                      ASCENT, -DESCENT, 0, ASCENT, DESCENT, 1, 0,  # typo + win metrics, code page latin 1
                      500, 700, 0, 32, 1)

    # cmap: one format 4 subtable (Windows, Unicode BMP), one segment per character.
    segs = sorted((ord(c), gid) for gid, c in enumerate(order) if gid > 0) + [(0xFFFF, 0)]
    n = len(segs)
    search = 2 ** (n.bit_length() - 1)
    ends = [c for c, _ in segs]
    deltas = [((g - c) & 0xFFFF) if c != 0xFFFF else 1 for c, g in segs]
    body = struct.pack(f">{n}H", *ends) + b"\0\0" + struct.pack(f">{n}H", *ends)
    body += struct.pack(f">{n}H", *deltas) + struct.pack(f">{n}H", *([0] * n))
    sub = struct.pack(">HHHHHHH", 4, 14 + len(body), 0, 2 * n, 2 * search, search.bit_length() - 1,
                      2 * n - 2 * search) + body
    cmap = struct.pack(">HHHHI", 0, 1, 3, 1, 12) + sub

    names = {0: "Digits after the Discord Checkpoint 2025 recap.", 1: FAMILY, 2: "Regular",
             3: f"{FAMILY.replace(' ', '')}-1.000", 4: FAMILY, 5: "Version 1.000",
             6: FAMILY.replace(" ", "") + "-Regular"}
    strings, records = b"", b""
    for nid, s in names.items():
        enc = s.encode("utf-16-be")
        records += struct.pack(">HHHHHH", 3, 1, 0x409, nid, len(enc), len(strings))
        strings += enc
    name = struct.pack(">HHH", 0, len(names), 6 + 12 * len(names)) + records + strings
    post = struct.pack(">IIhhIIIII", 0x00030000, 0, -100, 50, 0, 0, 0, 0, 0)

    tables = {"OS/2": os2, "cmap": cmap, "glyf": glyf, "head": head, "hhea": hhea, "hmtx": hmtx,
              "loca": loca, "maxp": maxp, "name": name, "post": post}
    tags = sorted(tables)
    nt = len(tags)
    sr = 2 ** (nt.bit_length() - 1)
    header = struct.pack(">IHHHH", 0x00010000, nt, sr * 16, sr.bit_length() - 1, nt * 16 - sr * 16)
    offset = 12 + 16 * nt
    directory, blob = b"", b""
    for tag in tags:
        data = tables[tag]
        directory += struct.pack(">4sIII", tag.encode(), checksum(data), offset + len(blob), len(data))
        blob += data + b"\0" * (-len(data) % 4)
    font = bytearray(header + directory + blob)
    head_at = offset + sum(len(tables[t]) + (-len(tables[t]) % 4) for t in tags[: tags.index("head")])
    struct.pack_into(">I", font, head_at + 8, (0xB1B0AFBA - checksum(bytes(font))) & 0xFFFFFFFF)
    return bytes(font)


if __name__ == "__main__":
    out = pathlib.Path(__file__).resolve().parent.parent / "web" / "assets" / "fonts" / "CheckpointPixel.ttf"
    out.write_bytes(build())
    print(f"wrote {out} ({out.stat().st_size} bytes)")
