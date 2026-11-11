"""Every CTA bus stop with its routes, from the CTA GTFS (gtfs/cta/) → data/bus_stops.json (used by the map's bus stops and Near me)."""
import csv, json, collections, re, pathlib
R = pathlib.Path(__file__).resolve().parent.parent; G = R / "gtfs" / "cta"
route_of = {r["trip_id"]: r["route_id"] for r in csv.DictReader(open(G / "trips.txt", encoding="utf-8-sig"))}
bus = {r["route_id"] for r in csv.DictReader(open(G / "routes.txt", encoding="utf-8-sig")) if r["route_type"] == "3"}
sr = collections.defaultdict(set)
with open(G / "stop_times.txt", encoding="utf-8-sig") as f:
    rd = csv.reader(f); h = next(rd); ti, si = h.index("trip_id"), h.index("stop_id")
    for row in rd:
        r = route_of.get(row[ti])
        if r in bus: sr[row[si]].add(r)
routes = sorted({r for s in sr.values() for r in s}, key=lambda x: (len(x), x)); ri = {r: i for i, r in enumerate(routes)}
out = []
for s in csv.DictReader(open(G / "stops.txt", encoding="utf-8-sig")):
    if s["stop_id"] not in sr or s["location_type"] not in ("0", ""): continue
    m = re.search(r"(North|South|East|West)bound", s["stop_desc"] or ""); d = (m.group(1)[0] + "B") if m else ""
    out.append([round(float(s["stop_lon"]), 5), round(float(s["stop_lat"]), 5), s["stop_name"], d, sorted(ri[r] for r in sr[s["stop_id"]]), int(s["stop_id"])])
json.dump({"routes": routes, "stops": out}, open(R / "data" / "bus_stops.json", "w"), separators=(",", ":"))
print(len(out), "bus stops,", len(routes), "routes")
