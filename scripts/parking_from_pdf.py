"""Parking spaces from the tender drawings -> plan images + outlines for the admin's parking map.

    python scripts\\parking_from_pdf.py          (needs PyMuPDF: pip install pymupdf)

Writes public/parking/garaz.png + exterier.jpg (the plans as background) and supabase/seed/parking.sql (an upsert of
public.parking_spaces: id, kind, number, plan, shape = polygon in the plan image's pixels; price/status are kept on
update, they belong to /admin). Sources (Tendrová dokumentácia 2026, ASR):
  - E.1 Pôdorys 1.PP.pdf: the garage, spaces 1-42 numbered in the plan; outline = the painted separators either side
    of the number, depth = the row's separators.
  - zastavovacia situácia.pdf (1:200): outdoor spaces, not numbered in the plan. Numbered here E01-E12 along the north
    street (west -> east, E10 is the wide accessible one), E13-E18 on the west side (north -> south), E19-E24 the
    parallel spaces by the south road (west -> east).
"""
import os, re, json
import pymupdf

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PDF = r"G:\My Drive\Nehnutelnosti\_Matadorka\_Predaj a prenajom\_Tendrova dokumentacia\ASR\PDF"
OUT_IMG = os.path.join(ROOT, "public", "parking")
OUT_SQL = os.path.join(ROOT, "supabase", "seed", "parking.sql")


def garage():
    page = pymupdf.open(os.path.join(PDF, "E.1 Pôdorys 1.PP.pdf"))[0]
    clip, zoom = pymupdf.Rect(60, 40, 2440, 960), 1.25
    labels = {}
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                t = s["text"].strip()
                if re.fullmatch(r"\d{1,2}", t) and s["size"] > 10 and 1 <= int(t) <= 42:
                    labels[int(t)] = s["bbox"]
    rows = {}                                  # (y0, y1) -> separator x's: vertical lines 100-200 pt long
    for dr in page.get_drawings():
        for it in dr["items"]:
            if it[0] == "l" and abs(it[1].x - it[2].x) < 0.5 and 120 < abs(it[1].y - it[2].y) < 200:
                y0, y1 = sorted((round(it[1].y, 1), round(it[2].y, 1)))
                rows.setdefault((y0, y1), set()).add(round(it[1].x, 1))
    rows = {k: sorted(v) for k, v in rows.items() if len(v) >= 18}
    spaces = []
    for n, (x0, y0, x1, y1) in sorted(labels.items()):
        fits = []                              # rows overlap (21-27 and 28-42): take the one with separators round it
        for (ry0, ry1), seps in rows.items():
            l = [s for s in seps if s < x0]; r = [s for s in seps if s > x1 - 1]
            if ry0 <= y0 <= ry1 and l and r and min(r) - max(l) < 100:
                fits.append((min(r) - max(l), ry0, ry1, max(l), min(r)))
        _, ry0, ry1, left, right = min(fits)
        quad = [(left, ry0), (right, ry0), (right, ry1), (left, ry1)]
        spaces.append(dict(id="G%02d" % n, kind="garage", number=n, plan="garaz", accessible=right - left > 85,
                           shape=[[round((x - clip.x0) * zoom, 1), round((y - clip.y0) * zoom, 1)] for x, y in quad]))
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip, colorspace=pymupdf.csGRAY)
    pix.save(os.path.join(OUT_IMG, "garaz.png"))
    return spaces, (pix.width, pix.height)


def outdoor():
    page = pymupdf.open(os.path.join(PDF, "zastavovacia situácia.pdf"))[0]
    clip, zoom = pymupdf.Rect(240, 180, 1460, 935), 1.6
    north = [  # separators (top, bottom), measured from the plan's 5 m stall lines
        [((333.7, 313.1), (338.2, 386.7)), ((369.0, 310.9), (373.6, 384.5)), ((404.4, 308.8), (408.9, 382.3)),
         ((439.8, 306.6), (444.3, 380.2)), ((475.1, 304.4), (479.7, 378.0)), ((510.5, 302.2), (515.0, 375.8))],
        [((538.8, 300.5), (543.3, 374.1)), ((574.2, 298.3), (578.7, 371.9)), ((609.5, 296.1), (614.1, 369.7)),
         ((644.9, 294.0), (649.4, 367.5)), ((680.3, 291.8), (684.8, 365.4))],
        [((708.6, 290.1), (713.1, 363.6)), ((758.0, 287.0), (762.6, 360.6)), ((793.4, 284.8), (797.9, 358.4)),
         ((828.8, 282.7), (833.3, 356.2))]]
    west = [(403.5, 402.9), (438.9, 438.3), (474.4, 473.8), (509.8, 509.2), (545.2, 544.6), (580.7, 580.1), (616.1, 615.5)]
    south = [[859.8, 953.4, 1045.5, 1138.4], [1164.5, 1258.1, 1350.2, 1442.4]]
    quads = []
    for grp in north:
        for (t0, b0), (t1, b1) in zip(grp, grp[1:]):
            quads.append(([t0, t1, b1, b0], t1[0] - t0[0] > 45))
    for (l0, r0), (l1, r1) in zip(west, west[1:]):
        quads.append(([(261.5, l0), (336.0, r0), (336.0, r1), (261.5, l1)], False))
    for grp in south:
        for x0, x1 in zip(grp, grp[1:]):
            quads.append(([(x0, 846), (x1, 846), (x1, 878), (x0, 878)], False))
    spaces = [dict(id="E%02d" % (i + 1), kind="outdoor", number=i + 1, plan="exterier", accessible=acc,
                   shape=[[round((x - clip.x0) * zoom, 1), round((y - clip.y0) * zoom, 1)] for x, y in q])
              for i, (q, acc) in enumerate(quads)]
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip)
    pix.save(os.path.join(OUT_IMG, "exterier.jpg"), jpg_quality=82)
    return spaces, (pix.width, pix.height)


def main():
    os.makedirs(OUT_IMG, exist_ok=True)
    g, gsize = garage(); e, esize = outdoor()
    json.dump({"garaz": {"src": "/parking/garaz.png", "w": gsize[0], "h": gsize[1], "title": "Garáž 1.PP"},
               "exterier": {"src": "/parking/exterier.jpg", "w": esize[0], "h": esize[1], "title": "Vonkajšie státia"}},
              open(os.path.join(OUT_IMG, "plans.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    rows = []
    for i, s in enumerate(g + e):
        label = ("Garáž %d" if s["kind"] == "garage" else "Vonkajšie státie %d") % s["number"]
        rows.append("  (%s, %s, %d, %s, %s, %s, %s::jsonb, %d)" % (
            "'%s'" % s["id"], "'%s'" % s["kind"], s["number"], "'%s'" % label, "'%s'" % s["plan"],
            "true" if s["accessible"] else "false", "'%s'" % json.dumps(s["shape"]), i + 1))
    sql = ["-- generated by scripts/parking_from_pdf.py from the tender drawings (E.1 Pôdorys 1.PP, zastavovacia situácia)",
           "-- %d garage + %d outdoor spaces; price and status are not touched on update" % (len(g), len(e)),
           "insert into public.parking_spaces (id, kind, number, label, plan, accessible, shape, sort_order) values",
           ",\n".join(rows),
           "on conflict (id) do update set kind = excluded.kind, number = excluded.number, label = excluded.label,",
           "  plan = excluded.plan, accessible = excluded.accessible, shape = excluded.shape, sort_order = excluded.sort_order;"]
    open(OUT_SQL, "w", encoding="utf-8", newline="\n").write("\n".join(sql) + "\n")
    print("garage %d, outdoor %d -> %s" % (len(g), len(e), os.path.normpath(OUT_SQL)), gsize, esize)


if __name__ == "__main__":
    main()
