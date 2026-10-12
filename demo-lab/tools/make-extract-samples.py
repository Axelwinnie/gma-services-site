# Builds the 3 fictional sample docs (SVG) and their text for demos/extract.
# All names, numbers and jobs are made up.
import json

docs = [
 {"id": "invoice", "name": "Supplier invoice, Northfield Steel Supply (fictional)",
  "head": ["Northfield Steel Supply", "88 Quarry Road, Millbrook, NH 03999", "(555) 010-2234"],
  "title": "INVOICE",
  "meta": ["Invoice No: NSS-20418", "Invoice Date: 09/18/2026", "Bill To: Pine Hollow Storage LLC", "Job: Pine Hollow mezzanine", "PO #: 5521", "Terms: Net 30"],
  "cols": ["Qty", "Unit", "Description", "Unit Price", "Amount"],
  "items": [[6,"EA","W12x26 x 24 ft beam","686.40","4118.40"],[8,"EA","W10x22 x 12 ft 6 in beam","302.50","2420.00"],[6,"EA","HSS6x6x1/4 x 14 ft column","292.95","1757.70"],[8,"EA","L4x4x3/8 x 20 ft angle","176.40","1411.20"],[1,"LS","Delivery, flatbed","185.00","185.00"]],
  "sums": [("Subtotal","9892.30"),("Sales Tax 6.25%","618.27"),("Total Due","10510.57")]},
 {"id": "estimate", "name": "Sub's estimate, Kettle Brook Coatings (fictional)",
  "head": ["Kettle Brook Coatings", "14 Mill Pond Lane, Ashby Falls, MA 01999", "(555) 010-8871"],
  "title": "ESTIMATE",
  "meta": ["Estimate No: KBC-0912", "Date: October 2, 2026", "Customer: Route 9 Car Wash", "Project: Entry canopy steel paint", "Valid for 30 days"],
  "cols": ["Qty", "Unit", "Description", "Rate", "Amount"],
  "items": [[1,"LS","Surface prep, SSPC-SP2 hand tool","950.00","950.00"],[3400,"SF","Primer, one coat, shop","0.85","2890.00"],[3400,"SF","Finish coat, polyurethane","1.10","3740.00"],[12,"HR","Touch-up after erection","78.00","936.00"]],
  "sums": [("Subtotal","8516.00"),("Tax","0.00"),("Estimate Total","8516.00")]},
 {"id": "delivery", "name": "Delivery ticket, Blue Ledge Building Supply (fictional)",
  "head": ["Blue Ledge Building Supply", "220 Depot Street, Harlow, VT 05999"],
  "title": "DELIVERY TICKET",
  "meta": ["Ticket No: BL-77810", "Delivery Date: 10/05/2026", "Ship To: Birch Lane Duplex, lot 4", "Job: Birch Lane stair and rail", "PO #: 6104", "Driver: R. Tanner   Truck 12"],
  "cols": ["Qty", "Unit", "Description"],
  "items": [[2,"EA","MC12x10.6 x 16 ft stringer"],[8,"EA","Pipe 1-1/2 STD x 21 ft"],[28,"EA","L2x2x1/4 x 4 ft"],[1,"BOX","1/2 in A325 bolts, 50 ct"]],
  "sums": []},
]
out = []
from xml.sax.saxutils import escape as X
for d in docs:
    W, H = 1000, 1294
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Arial, Helvetica, sans-serif">', f'<rect width="{W}" height="{H}" fill="#fbfaf6"/>']
    def T(x, y, t, size, bold=False, fill="#222", anchor="start"):
        o.append(f'<text x="{x}" y="{y+size}" font-size="{size}"{" font-weight=\"bold\"" if bold else ""} fill="{fill}" text-anchor="{anchor}">{X(str(t))}</text>')
    y = 60
    T(70, y, d["head"][0], 34, True, "#1d2733"); y += 50
    for h in d["head"][1:]: T(70, y, h, 19, fill="#444"); y += 28
    T(W-70, 60, d["title"], 34, True, "#b4531a", "end")
    y += 30; o.append(f'<line x1="70" y1="{y}" x2="{W-70}" y2="{y}" stroke="#999" stroke-width="2"/>'); y += 25
    for m in d["meta"]: T(70, y, m, 21); y += 34
    y += 20
    xs = [70, 160, 250, 700, 860] if len(d["cols"]) == 5 else [70, 160, 250]
    o.append(f'<rect x="60" y="{y-8}" width="{W-120}" height="38" fill="#e7e2d6"/>')
    for c, x in zip(d["cols"], xs): T(x, y, c, 20, True)
    y += 46
    for it in d["items"]:
        for i, (v, x) in enumerate(zip(it, xs)):
            T(x, y, "{:,.2f}".format(float(v)) if i >= 3 else str(v), 20)
        y += 36
    y += 10; o.append(f'<line x1="560" y1="{y}" x2="{W-70}" y2="{y}" stroke="#999"/>'); y += 18
    for k, v in d["sums"]:
        b = "Total" in k
        T(600, y, k, 21, b); T(W-70, y, "$" + "{:,.2f}".format(float(v)), 21, b, anchor="end"); y += 36
    if not d["sums"]:
        y += 30; T(70, y, "Received by: ______________________   Time: ________", 20); y += 40
        T(70, y, "No prices on delivery tickets. Invoice to follow.", 18, fill="#555")
    T(70, H-70, "SAMPLE DOCUMENT. FICTIONAL COMPANY AND JOB. GMA DEMO LAB.", 16, True, "#b4531a")
    open(f"public/demos/extract/samples/{d['id']}.svg", "w").write("\n".join(o) + "</svg>\n")
    # Text as it reads off the page, one line per row
    lines = d["head"] + [d["title"]] + d["meta"] + [" ".join(d["cols"])]
    for it in d["items"]:
        lines.append(" ".join(("{:,.2f}".format(float(v)) if i >= 3 else str(v)) for i, v in enumerate(it)))
    for k, v in d["sums"]: lines.append(f"{k} ${float(v):,.2f}")
    out.append({"id": d["id"], "name": d["name"], "image": f"samples/{d['id']}.svg", "text": "\n".join(lines)})
json.dump(out, open("/tmp/extract-samples.json", "w"), indent=1)
print("ok")
