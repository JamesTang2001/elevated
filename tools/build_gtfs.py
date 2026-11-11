"""Real timetables from CTA's and Metra's published GTFS schedules.

CTA rail: every trip is matched to one of the map's route profiles (route + direction), keeping its
scheduled time at each station.  Trips are stored as patterns (same profile, same stops, same running
times) + start times, for three day types: weekday, Saturday, Sunday.
Metra: lines from shapes.txt, stations, and trips the same pattern way.
"""
import csv, json, math, collections

REP = {"wk": "20261110", "sa": "20261114", "su": "20261115"}      # Tue, Sat, Sun inside both feeds
DOW = {"wk": 1, "sa": 5, "su": 6}                                  # Monday=0 … Sunday=6

def rows(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        r = csv.reader(f); head = [h.strip() for h in next(r)]
        for row in r: yield dict(zip(head, (c.strip() for c in row)))

def secs(t):
    h, m, s = t.split(":"); return int(h) * 3600 + int(m) * 60 + int(s)

def services(folder):
    act = {k: set() for k in REP}
    for c in rows(f"{folder}/calendar.txt"):
        for k, d in REP.items():
            day = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"][DOW[k]]
            if c["start_date"] <= d <= c["end_date"] and c[day] == "1": act[k].add(c["service_id"])
    try:
        for c in rows(f"{folder}/calendar_dates.txt"):
            for k, d in REP.items():
                if c["date"] == d: (act[k].add if c["exception_type"] == "1" else act[k].discard)(c["service_id"])
    except FileNotFoundError: pass
    return act

def hav(a, b):
    kx = math.cos(math.radians(41.88)); return math.hypot((a[0]-b[0])*kx, a[1]-b[1]) * 111320

# ---------------- CTA rail ----------------
R = json.load(open("data/routes.json"))
PROF = []                                  # (key, line, [station ids], [distances], loop)
for r in R["routes"]:
    ids = [s["id"] for s in r["stops"]]; ds = [s["d"] for s in r["stops"]]
    PROF.append((r["id"] + "/0", r["line"], ids, ds, r["loop"]))
    if not r["loop"]: PROF.append((r["id"] + "/1", r["line"], ids[::-1], [r["length"] - d for d in ds[::-1]], False))
LINE = {"Red": "red", "Blue": "blue", "Brn": "brn", "G": "g", "Org": "o", "Pink": "pnk", "P": "p", "Y": "y"}

parent = {s["stop_id"]: s["parent_station"] for s in rows("gtfs/cta/stops.txt") if s["parent_station"]}
act = services("gtfs/cta")
trips = {}
for t in rows("gtfs/cta/trips.txt"):
    if t["route_id"] in LINE:
        days = [k for k in REP if t["service_id"] in act[k]]
        if days: trips[t["trip_id"]] = (LINE[t["route_id"]], days)
print("CTA rail trips running on the sample days:", {k: sum(k in v[1] for v in trips.values()) for k in REP})

seq = collections.defaultdict(list)
for st in rows("gtfs/cta/stop_times.txt"):
    if st["trip_id"] in trips:
        seq[st["trip_id"]].append((int(st["stop_sequence"]), parent.get(st["stop_id"], st["stop_id"]), secs(st["departure_time"])))

def match(line, S):
    best = None
    for key, ln, ids, ds, loop in PROF:
        if ln != line: continue
        j = 0; idx = []
        for sid in S:
            while j < len(ids) and ids[j] != sid: j += 1
            if j == len(ids): break
            idx.append(j); j += 1
        if len(idx) != len(S): continue
        score = (idx[-1] - idx[0] - (len(S) - 1), len(ids))          # fewest skipped stops, then the shorter profile
        if best is None or score < best[0]: best = (score, key, idx, ds)
    return best

pats, patid, out, unmatched = [], {}, {k: [] for k in REP}, collections.Counter()
for tid, (line, days) in trips.items():
    s = sorted(seq[tid]); S = [x[1] for x in s]; T = [x[2] for x in s]
    # drop repeated consecutive stations (some trips list a terminal twice)
    S2, T2 = [], []
    for a, b in zip(S, T):
        if S2 and S2[-1] == a: T2[-1] = b; continue
        S2.append(a); T2.append(b)
    m = match(line, S2)
    if not m: unmatched[line] += 1; continue
    _, key, idx, ds = m
    i0, i1 = idx[0], idx[-1]
    full = {}
    for k, i in enumerate(idx): full[i] = T2[k]
    for i in range(i0, i1 + 1):                                     # stops the trip passes without a time: interpolate by distance
        if i not in full:
            a = max(x for x in full if x < i); b = min(x for x in full if x > i)
            full[i] = round(full[a] + (full[b] - full[a]) * (ds[i] - ds[a]) / max(1, ds[b] - ds[a]))
    start = full[i0]; offs = tuple(full[i] - start for i in range(i0, i1 + 1))
    pk = (key, i0, offs)
    if pk not in patid: patid[pk] = len(pats); pats.append([key, i0, list(offs)])
    for d in days: out[d].append([patid[pk], start])
for d in out: out[d].sort(key=lambda x: x[1])
print("matched patterns:", len(pats), "| unmatched trips:", dict(unmatched))
json.dump({"pats": pats, "trips": out}, open("data/cta_rail_tt.json", "w"), separators=(",", ":"))

# ---------------- Metra ----------------
mstops = {s["stop_id"]: (s["stop_name"], float(s["stop_lon"]), float(s["stop_lat"])) for s in rows("gtfs/metra/stops.txt")}
mroutes = {r["route_id"]: (r["route_long_name"] or r["route_short_name"], "#" + r["route_color"]) for r in rows("gtfs/metra/routes.txt")}
shp = collections.defaultdict(list)
for p in rows("gtfs/metra/shapes.txt"): shp[p["shape_id"]].append((int(p["shape_pt_sequence"]), float(p["shape_pt_lon"]), float(p["shape_pt_lat"])))
mact = services("gtfs/metra")
mtrips = {}
for t in rows("gtfs/metra/trips.txt"):
    days = [k for k in REP if t["service_id"] in mact[k]]
    if days: mtrips[t["trip_id"]] = (t["route_id"], t["shape_id"], t.get("trip_headsign", ""), days, t.get("direction_id", "0"))
mseq = collections.defaultdict(list)
for st in rows("gtfs/metra/stop_times.txt"):
    if st["trip_id"] in mtrips: mseq[st["trip_id"]].append((int(st["stop_sequence"]), st["stop_id"], secs(st["departure_time"])))
print("Metra trips on the sample days:", {k: sum(k in v[3] for v in mtrips.values()) for k in REP})

from shapely.geometry import LineString, Point
KX = math.cos(math.radians(41.88))
shapes_out, shape_idx, shape_line = [], {}, {}
def get_shape(sid):
    if sid in shape_idx: return shape_idx[sid]
    pts = [(x, y) for _, x, y in sorted(shp[sid])]
    ls = LineString(pts).simplify(0.00012)
    c = [[round(x, 5), round(y, 5)] for x, y in ls.coords]
    cum = [0.0]
    for a, b in zip(c, c[1:]): cum.append(cum[-1] + hav(a, b))
    shape_idx[sid] = len(shapes_out); shapes_out.append({"c": c, "cum": [round(v) for v in cum]})
    shape_line[sid] = LineString([(x * KX * 111320, y * 111320) for x, y in c])
    return shape_idx[sid]

mpats, mpatid, mout = [], {}, {k: [] for k in REP}
for tid, (rid, sid, head, days, dirn) in mtrips.items():
    if sid not in shp: continue
    si = get_shape(sid); L = shape_line[sid]
    s = sorted(mseq[tid]); stops = [x[1] for x in s]; T = [x[2] for x in s]
    ds = [round(L.project(Point(mstops[x][1] * KX * 111320, mstops[x][2] * 111320))) for x in stops]
    for i in range(1, len(ds)): ds[i] = max(ds[i], ds[i - 1])          # keep distances monotonic along the track
    start = T[0]; offs = [t - start for t in T]
    pk = (rid, si, tuple(stops), tuple(offs), head)
    if pk not in mpatid: mpatid[pk] = len(mpats); mpats.append([rid, si, stops, ds, offs, head, int(dirn or 0)])
    import re as _re; num=_re.search(r"_[A-Z]+(\d{1,4})_", tid); num=int(num.group(1)) if num else 0
    for d in days: mout[d].append([mpatid[pk], start, num])
for d in mout: mout[d].sort(key=lambda x: x[1])
used = {x for p in mpats for x in p[2]}
json.dump({"routes": mroutes, "stops": {k: v for k, v in mstops.items() if k in used}, "shapes": shapes_out, "pats": mpats, "trips": mout},
          open("data/metra_tt.json", "w"), separators=(",", ":"))
print("Metra lines", len(mroutes), "| stations", len(used), "| shapes", len(shapes_out), "| patterns", len(mpats))
