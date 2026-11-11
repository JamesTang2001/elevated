"""Amtrak and South Shore Line (NICTD) timetables from their published GTFS feeds, in the same pattern format as Metra.
Amtrak trips are clipped to the map region (plus a margin), keeping the part of each run that is near Chicago."""
import csv, json, math, collections, re
from shapely.geometry import LineString, Point

REP = {"wk": "20261110", "sa": "20261114", "su": "20261115"}
DOW = {"wk": 1, "sa": 5, "su": 6}
BOX = (-89.15, 41.15, -86.75, 42.85)              # lon0, lat0, lon1, lat1
KX = math.cos(math.radians(41.88)); M = 111320
LONG = {"Empire Builder", "California Zephyr", "Southwest Chief", "Texas Eagle", "City of New Orleans", "Capitol Limited", "Cardinal", "Lake Shore Limited", "Floridian"}

def rows(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        r = csv.reader(f); head = [h.strip() for h in next(r)]
        for row in r: yield dict(zip(head, (c.strip() for c in row)))
def secs(t): h, m, s = t.split(":"); return int(h) * 3600 + int(m) * 60 + int(s)
def services(folder):
    act = {k: set() for k in REP}
    for c in rows(f"{folder}/calendar.txt"):
        for k, d in REP.items():
            day = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][DOW[k]]
            if c["start_date"] <= d <= c["end_date"] and c[day] == "1": act[k].add(c["service_id"])
    try:
        for c in rows(f"{folder}/calendar_dates.txt"):
            for k, d in REP.items():
                if c["date"] == d: (act[k].add if c["exception_type"] == "1" else act[k].discard)(c["service_id"])
    except FileNotFoundError: pass
    return act
def hav(a, b): return math.hypot((a[0] - b[0]) * KX, a[1] - b[1]) * M
inbox = lambda x, y, m=0: BOX[0] - m <= x <= BOX[2] + m and BOX[1] - m <= y <= BOX[3] + m

out = {"routes": {}, "stops": {}, "shapes": [], "pats": [], "trips": {k: [] for k in REP}}
def feed(folder, ag, prefix, rail_only, route_name, color, num_of):
    stops = {s["stop_id"]: (s["stop_name"], float(s["stop_lon"]), float(s["stop_lat"])) for s in rows(f"{folder}/stops.txt")}
    routes = {r["route_id"]: r for r in rows(f"{folder}/routes.txt") if not rail_only or r["route_type"] == "2"}
    shp = collections.defaultdict(list)
    for p in rows(f"{folder}/shapes.txt"): shp[p["shape_id"]].append((int(p["shape_pt_sequence"]), float(p["shape_pt_lon"]), float(p["shape_pt_lat"])))
    act = services(folder); trips = {}
    for t in rows(f"{folder}/trips.txt"):
        if t["route_id"] not in routes: continue
        days = [k for k in REP if t["service_id"] in act[k]]
        if days: trips[t["trip_id"]] = (t, days)
    seq = collections.defaultdict(list)
    for st in rows(f"{folder}/stop_times.txt"):
        if st["trip_id"] in trips: seq[st["trip_id"]].append((int(st["stop_sequence"]), st["stop_id"], secs(st["departure_time"] or st["arrival_time"]), secs(st["arrival_time"] or st["departure_time"])))
    shape_cache, patid, n = {}, {}, 0
    for tid, (t, days) in trips.items():
        s = sorted(seq[tid]); sid = t["shape_id"]
        if len(s) < 2 or sid not in shp: continue
        ins = [i for i, x in enumerate(s) if inbox(stops[x[1]][1], stops[x[1]][2])]
        if not ins: continue
        i0, i1 = max(0, ins[0] - 1), min(len(s) - 1, ins[-1] + 1)           # one stop beyond the region on each side
        part = s[i0:i1 + 1]
        if sid not in shape_cache:
            pts = [(x, y) for _, x, y in sorted(shp[sid])]
            shape_cache[sid] = LineString([(x * KX * M, y * M) for x, y in pts])
        L = shape_cache[sid]
        ds = [L.project(Point(stops[x[1]][1] * KX * M, stops[x[1]][2] * M)) for x in part]
        for i in range(1, len(ds)): ds[i] = max(ds[i], ds[i - 1])
        T = [x[2] for x in part]; A = [x[3] for x in part]
        # cut the shape where it leaves the region + 0.25° margin, and move the outside stop's time to that point
        a, b = ds[0], ds[-1]
        def edge(lo, hi, from_lo):
            step = 400; d = lo if from_lo else hi
            while (d < hi if from_lo else d > lo):
                p = L.interpolate(d);
                if inbox(p.x / KX / M, p.y / M, .25): return d
                d += step if from_lo else -step
            return hi if from_lo else lo
        if not inbox(stops[part[0][1]][1], stops[part[0][1]][2], .25):
            na = edge(ds[0], ds[1], True); f = (na - ds[0]) / max(1, ds[1] - ds[0]); T[0] = round(T[0] + (A[1] - T[0]) * f); a = na
        if not inbox(stops[part[-1][1]][1], stops[part[-1][1]][2], .25):
            nb = edge(ds[-2], ds[-1], False); f = (nb - ds[-2]) / max(1, ds[-1] - ds[-2]); A[-1] = round(T[-2] + (A[-1] - T[-2]) * f); T[-1] = A[-1]; b = nb
        ds[0], ds[-1] = a, b
        if b - a < 500: continue
        key = (sid, round(a), round(b))
        if key not in shape_cache:
            sub = [L.interpolate(d) for d in [a + (b - a) * i / max(1, int((b - a) / 60)) for i in range(int((b - a) / 60) + 1)]]
            ls = LineString([(p.x / KX / M, p.y / M) for p in sub]).simplify(0.00012)
            c = [[round(x, 5), round(y, 5)] for x, y in ls.coords]; cum = [0.0]
            for p, q in zip(c, c[1:]): cum.append(cum[-1] + hav(p, q))
            scale = (b - a) / max(1, cum[-1])                               # keep stop distances consistent with the drawn line
            shape_cache[key] = len(out["shapes"]); out["shapes"].append({"c": c, "cum": [round(v * scale) for v in cum]})
        si = shape_cache[key]
        dl = [round(d - a) for d in ds]
        start = T[0]; offs = [x - start for x in T]; offs[-1] = A[-1] - start
        r = routes[t["route_id"]]; rid = prefix + (r["route_short_name"] or r["route_long_name"]).replace(" ", "")
        out["routes"][rid] = [route_name(r), color(r), ag]
        st_ids = [prefix + x[1] for x in part]
        for x in part: out["stops"][prefix + x[1]] = list(stops[x[1]]) + [ag]
        head = t.get("trip_headsign") or stops[s[-1][1]][0]
        pk = (rid, si, tuple(st_ids), tuple(offs), head)
        if pk not in patid: patid[pk] = len(out["pats"]); out["pats"].append([rid, si, st_ids, dl, offs, head, int(t.get("direction_id") or 0)])
        for d in days: out["trips"][d].append([patid[pk], start % 86400, num_of(t)])
        n += 1
    print(ag, "trips", n)

feed("gtfs/nictd", "ss", "ss:", False, lambda r: "South Shore Line" if r["route_id"] == "so_shore" else "South Shore Line · Monon",
     lambda r: "#" + (r["route_color"] or "F6931C"), lambda t: int(re.sub(r"\D", "", t["trip_id"]) or 0))
feed("gtfs/amtrak", "amtrak", "am:", True, lambda r: r["route_long_name"], lambda r: "#4a77a8" if r["route_long_name"] not in LONG else "#3a5f8c",
     lambda t: int(re.sub(r"\D", "", t.get("trip_short_name") or "0") or 0))
for d in out["trips"]:                                   # one consist carrying two train numbers (7/27, 48/448) is one train
    seen = {}
    for x in sorted(out["trips"][d], key=lambda x: x[2]):
        k = (out["pats"][x[0]][0], tuple(out["pats"][x[0]][2]), x[1])
        if k not in seen: seen[k] = x
    out["trips"][d] = sorted(seen.values(), key=lambda x: x[1])
json.dump(out, open("data/regional_tt.json", "w"), separators=(",", ":"))
print("routes", len(out["routes"]), {k: v[0] for k, v in out["routes"].items()})
print("stops", len(out["stops"]), "shapes", len(out["shapes"]), "pats", len(out["pats"]), {k: len(v) for k, v in out["trips"].items()})
