#!/usr/bin/env python3
"""Elevated — local live server.

Serves the map at http://localhost:8787 and fetches live data for it, so your API keys stay on
this computer and never reach the page.  Standard library only: no installs needed.

  /api/status   which keys are set, last fetch time and errors
  /api/trains   CTA Train Tracker positions, all 8 L lines   (cached 15 s)
  /api/buses    CTA Bus Tracker vehicles, every route        (cached 150 s, only with a bus key)
  /api/buses/near?rt=9,66   up to 10 routes near the view   (cached 45 s, only while the daily budget allows)
  /api/patterns?pid=…       street paths of bus patterns    (cached on disk for 7 days)
  /api/price    ComEd real-time 5-minute price, no key      (cached 60 s)
  /api/history  share of trains flagged "delayed", per line per day and per hour of day, last 30 days
  /api/arrivals?mapid=  live arrival predictions for one L station
  /api/alerts   CTA service alerts for trains and buses (no key needed)
  /api/transfers?lat=&lon=&rt=  next buses at the stops around a station (for transfers)
  /api/amtrak   live Amtrak trains near Chicago (Amtraker, no key)   (cached 60 s)
  /api/ships    live ships on the lake and river (aisstream.io, needs AISSTREAM_KEY)
  On start it also downloads the Amtrak and South Shore Line schedule files into ./gtfs/ (refreshed weekly).

Keys go in keys.env next to this file (see that file).  Delay history is written to ./history/.
"""
import json, os, math, time, threading, urllib.request, urllib.parse, datetime, collections, socket, ssl, base64, struct, sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("ELEVATED_PORT", "8787"))
CTA_TRAIN_URL = os.environ.get("CTA_TRAIN_URL", "https://lapi.transitchicago.com/api/1.0/ttpositions.aspx")
CTA_BUS_URL = os.environ.get("CTA_BUS_URL", "https://www.ctabustracker.com/bustime/api/v2/getvehicles")
COMED_URL = os.environ.get("COMED_URL", "https://hourlypricing.comed.com/api?type=5minutefeed")
L_ROUTES = "red,blue,brn,G,org,P,pink,Y"
# CTA bus routes (Bus Tracker accepts up to 10 per request)
BUS_ROUTES = ("1 2 3 4 X4 6 7 8 8A 9 X9 10 11 12 J14 15 18 19 20 21 22 24 26 28 29 30 31 34 35 36 37 39 43 44 47 48 49 49B X49 "
              "50 51 52 52A 53 53A 54 54A 54B 55 55A 55N 56 57 59 60 62 62H 63 63W 65 66 67 68 70 71 72 73 74 75 76 77 78 79 80 81 81W "
              "82 84 85 85A 86 87 88 90 91 92 93 94 95 96 97 100 103 106 108 111 111A 112 115 119 120 121 124 125 126 128 130 134 135 "
              "136 143 146 147 148 151 152 155 156 157 165 169 171 172 192 201 206").split()

def load_keys():
    keys = {}
    path = os.path.join(HERE, "keys.env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1); v = v.strip().strip('"').strip("'")
                if v and not v.startswith("paste"): keys[k.strip()] = v
    return keys

KEYS = load_keys()
STATE = {"trains": None, "trains_t": 0, "buses": None, "buses_t": 0, "price": None, "price_t": 0, "errors": {}}
LOCK = threading.Lock()

def fetch_json(url, timeout=12):
    req = urllib.request.Request(url, headers={"User-Agent": "Elevated-local-map/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def get_trains():
    key = KEYS.get("CTA_TRAIN_KEY")
    if not key: return {"error": "No CTA_TRAIN_KEY in keys.env"}
    with LOCK:
        if STATE["trains"] is not None and time.time() - STATE["trains_t"] < 15: return STATE["trains"]
    try:
        q = urllib.parse.urlencode({"key": key, "rt": L_ROUTES, "outputType": "JSON"})
        data = fetch_json(f"{CTA_TRAIN_URL}?{q}")
        err = (data.get("ctatt") or {}).get("errNm")
        if err: raise RuntimeError(f"CTA says: {err}")
        with LOCK:
            STATE["trains"], STATE["trains_t"] = data, time.time(); STATE["errors"].pop("trains", None)
        log_delays(data)
        return data
    except Exception as e:
        with LOCK:
            STATE["errors"]["trains"] = str(e)
            return STATE["trains"] or {"error": str(e)}

# Bus Tracker allows about 10,000 requests a day per key; keep a running count and stay under it.
BUDGET = {"day": "", "n": 0}
BUS_DAILY_MAX = 9500
def bt(url):
    day = datetime.date.today().isoformat()
    with LOCK:
        if BUDGET["day"] != day: BUDGET["day"], BUDGET["n"] = day, 0
        BUDGET["n"] += 1
    return fetch_json(url).get("bustime-response", {})
def budget_left():
    with LOCK: return BUS_DAILY_MAX - (BUDGET["n"] if BUDGET["day"] == datetime.date.today().isoformat() else 0)

def fetch_vehicles(routes):
    key = KEYS.get("CTA_BUS_KEY"); vehicles, errs = [], []
    for i in range(0, len(routes), 10):
        q = urllib.parse.urlencode({"key": key, "rt": ",".join(routes[i:i + 10]), "format": "json"})
        try:
            r = bt(f"{CTA_BUS_URL}?{q}")
            vehicles += r.get("vehicle", [])
            for e in r.get("error", []):
                if "No data found" not in str(e.get("msg", "")): errs.append(e.get("msg"))
        except Exception as e: errs.append(str(e))
    return vehicles, errs

def get_buses():
    if not KEYS.get("CTA_BUS_KEY"): return {"error": "No CTA_BUS_KEY in keys.env"}
    period = 150 if budget_left() > 1500 else 300                 # slow down near the daily limit
    with LOCK:
        if STATE["buses"] is not None and time.time() - STATE["buses_t"] < period: return STATE["buses"]
    vehicles, errs = fetch_vehicles(BUS_ROUTES)
    data = {"vehicle": vehicles, "errors": errs[:5], "t": int(time.time())}
    with LOCK:
        STATE["buses"], STATE["buses_t"] = data, time.time()
        if errs: STATE["errors"]["buses"] = errs[0]
        else: STATE["errors"].pop("buses", None)
    return data

NEAR = {}
def get_buses_near(rts):
    if not KEYS.get("CTA_BUS_KEY"): return {"error": "No CTA_BUS_KEY in keys.env"}
    rts = sorted({r for r in rts if r in BUS_ROUTES})[:10]
    if not rts: return {"vehicle": []}
    k = ",".join(rts)
    with LOCK:
        hit = NEAR.get(k)
        if hit and time.time() - hit[0] < 45: return hit[1]
    if budget_left() < 2500: return {"vehicle": [], "skipped": "daily budget"}
    vehicles, errs = fetch_vehicles(rts)
    data = {"vehicle": vehicles, "t": int(time.time())}
    with LOCK:
        NEAR[k] = (time.time(), data)
        for kk in [x for x, v in NEAR.items() if time.time() - v[0] > 300]: NEAR.pop(kk, None)
    return data

PAT_DIR = os.path.join(HERE, "patterns")
CTA_PAT_URL = os.environ.get("CTA_PAT_URL", "https://www.ctabustracker.com/bustime/api/v2/getpatterns")
def get_patterns(pids):
    os.makedirs(PAT_DIR, exist_ok=True); out, missing = {}, []
    for p in pids[:60]:
        if not p.isdigit(): continue
        f = os.path.join(PAT_DIR, p + ".json")
        if os.path.exists(f) and time.time() - os.path.getmtime(f) < 7 * 86400:
            try: out[p] = json.load(open(f)); continue
            except ValueError: pass
        missing.append(p)
    key = KEYS.get("CTA_BUS_KEY")
    if key and missing and budget_left() > 800:
        for i in range(0, len(missing), 10):
            q = urllib.parse.urlencode({"key": key, "pid": ",".join(missing[i:i + 10]), "format": "json"})
            try:
                for ptr in bt(f"{CTA_PAT_URL}?{q}").get("ptr", []):
                    pts = [[round(float(p["lat"]), 6), round(float(p["lon"]), 6), round(float(p["pdist"]))] for p in ptr.get("pt", [])]
                    rec = {"ln": float(ptr.get("ln", 0)), "dir": ptr.get("rtdir", ""), "pts": pts}
                    pid = str(ptr.get("pid")); out[pid] = rec
                    with open(os.path.join(PAT_DIR, pid + ".json"), "w") as fh: json.dump(rec, fh)
            except Exception as e: STATE["errors"]["patterns"] = str(e)
    return out

def get_price():
    with LOCK:
        if STATE["price"] is not None and time.time() - STATE["price_t"] < 60: return STATE["price"]
    try:
        rows = fetch_json(COMED_URL)
        rows = sorted(({"t": int(r["millisUTC"]), "cents": float(r["price"])} for r in rows), key=lambda r: r["t"])
        data = {"latest": rows[-1] if rows else None, "last24h": rows[-288:]}
        with LOCK:
            STATE["price"], STATE["price_t"] = data, time.time(); STATE["errors"].pop("price", None)
        return data
    except Exception as e:
        with LOCK:
            STATE["errors"]["price"] = str(e)
            return STATE["price"] or {"error": str(e)}

# ---- delay history: one line per poll, summarised per line per day ----
HIST = os.path.join(HERE, "history")
_last_log = [0]
def log_delays(data):
    if time.time() - _last_log[0] < 60: return                       # at most once a minute
    _last_log[0] = time.time()
    os.makedirs(HIST, exist_ok=True)
    row = {"t": int(time.time())}
    for r in (data.get("ctatt") or {}).get("route", []):
        trains = r.get("train") or []
        if isinstance(trains, dict): trains = [trains]
        row[r.get("@name", "?")] = [len(trains), sum(1 for t in trains if str(t.get("isDly")) == "1")]
    day = datetime.date.today().isoformat()
    with open(os.path.join(HIST, f"{day}.jsonl"), "a", encoding="utf-8") as f: f.write(json.dumps(row) + "\n")

def get_history():                                                   # share of trains flagged delayed: per line per day, and per line per hour of day
    days, htot, hdly = {}, collections.defaultdict(lambda: [0] * 24), collections.defaultdict(lambda: [0] * 24)
    if not os.path.isdir(HIST): return {"days": days, "hours": {}}
    for name in sorted(os.listdir(HIST))[-30:]:
        tot = collections.Counter(); dly = collections.Counter()
        for line in open(os.path.join(HIST, name), encoding="utf-8"):
            try: row = json.loads(line)
            except ValueError: continue
            h = datetime.datetime.fromtimestamp(row.get("t", 0)).hour
            for k, v in row.items():
                if k == "t": continue
                tot[k] += v[0]; dly[k] += v[1]; htot[k][h] += v[0]; hdly[k][h] += v[1]
        days[name[:-6]] = {k: round(dly[k] / tot[k], 4) if tot[k] else 0 for k in tot}
    hours = {k: [round(hdly[k][i] / htot[k][i], 4) if htot[k][i] else None for i in range(24)] for k in htot}
    return {"days": days, "hours": hours}

# ---- station arrival predictions (Train Tracker arrivals, same key as positions), cached 30 s per station ----
CTA_ARR_URL = os.environ.get("CTA_ARR_URL", "https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx")
ARR = {}
def get_arrivals(mapid):
    key = KEYS.get("CTA_TRAIN_KEY")
    if not key: return {"error": "No CTA_TRAIN_KEY in keys.env"}
    if not mapid.isdigit(): return {"error": "bad station"}
    with LOCK:
        hit = ARR.get(mapid)
        if hit and time.time() - hit[0] < 30: return hit[1]
    try:
        q = urllib.parse.urlencode({"key": key, "mapid": mapid, "max": 12, "outputType": "JSON"})
        eta = (fetch_json(f"{CTA_ARR_URL}?{q}").get("ctatt") or {}).get("eta") or []
        if isinstance(eta, dict): eta = [eta]
        data = {"eta": [{"rt": e.get("rt"), "rn": e.get("rn"), "dest": e.get("destNm"), "dir": e.get("stpDe"), "arr": e.get("arrT"), "app": e.get("isApp") == "1",
                         "dly": e.get("isDly") == "1", "sch": e.get("isSch") == "1", "flt": e.get("isFlt") == "1"} for e in eta], "t": int(time.time())}
    except Exception as e:
        data = {"error": str(e)}
    with LOCK:
        ARR[mapid] = (time.time(), data)
        for k in [k for k, v in ARR.items() if time.time() - v[0] > 300]: ARR.pop(k, None)
    return data

# ---- CTA service alerts (Customer Alerts API, no key needed), simplified for the map ----
CTA_ALERTS_URL = os.environ.get("CTA_ALERTS_URL", "https://www.transitchicago.com/api/1.0/alerts.aspx?outputType=JSON&activeonly=true")
ALERTS = {"t": 0, "data": None}
def get_alerts():
    if ALERTS["data"] is not None and time.time() - ALERTS["t"] < 120: return ALERTS["data"]
    try:
        raw = fetch_json(CTA_ALERTS_URL).get("CTAAlerts", {}).get("Alert", []) or []
        if isinstance(raw, dict): raw = [raw]
        out = []
        for a in raw:
            sv = (a.get("ImpactedService") or {}).get("Service") or []
            if isinstance(sv, dict): sv = [sv]
            lines = [x.get("ServiceId") for x in sv if x.get("ServiceType") == "R"]
            buses = [x.get("ServiceId") for x in sv if x.get("ServiceType") == "B"]
            if not lines and not buses: continue
            url = a.get("AlertURL"); url = url.get("#cdata-section") if isinstance(url, dict) else url
            out.append({"id": a.get("AlertId"), "head": a.get("Headline", ""), "short": (a.get("ShortDescription") or "").strip(), "sev": int(a.get("SeverityScore") or 0),
                        "impact": a.get("Impact", ""), "major": a.get("MajorAlert") == "1", "lines": lines, "buses": buses, "url": url, "start": a.get("EventStart"), "end": a.get("EventEnd")})
        data = {"alerts": out, "t": int(time.time())}
        STATE["errors"].pop("alerts", None)
    except Exception as e:
        STATE["errors"]["alerts"] = str(e); data = ALERTS["data"] or {"alerts": [], "error": str(e)}
    ALERTS["t"], ALERTS["data"] = time.time(), data
    return data

# ---- bus transfers: next buses at the stops around a station (Bus Tracker getstops + getpredictions) ----
BT_BASE = CTA_BUS_URL.rsplit("/", 1)[0]
STOP_DIR = os.path.join(HERE, "stops")
def route_stops(rt):                                                 # all stops of a route, both directions, cached on disk for 7 days
    os.makedirs(STOP_DIR, exist_ok=True); f = os.path.join(STOP_DIR, rt.replace("/", "_") + ".json")
    if os.path.exists(f) and time.time() - os.path.getmtime(f) < 7 * 86400:
        try: return json.load(open(f, encoding="utf-8"))
        except ValueError: pass
    key, out = KEYS.get("CTA_BUS_KEY"), []
    dirs = [d.get("dir") if isinstance(d, dict) else d for d in bt(f"{BT_BASE}/getdirections?" + urllib.parse.urlencode({"key": key, "rt": rt, "format": "json"})).get("directions", [])]
    for d in dirs:
        for st in bt(f"{BT_BASE}/getstops?" + urllib.parse.urlencode({"key": key, "rt": rt, "dir": d, "format": "json"})).get("stops", []):
            out.append({"id": str(st["stpid"]), "name": st.get("stpnm", ""), "lat": float(st["lat"]), "lon": float(st["lon"]), "dir": d})
    if out: json.dump(out, open(f, "w", encoding="utf-8"))
    return out
XFER = {}
def get_transfers(lat, lon, rts):
    if not KEYS.get("CTA_BUS_KEY"): return {"error": "No CTA_BUS_KEY in keys.env"}
    rts = sorted({r for r in rts if r in BUS_ROUTES})[:8]
    k = f"{lat:.4f},{lon:.4f}"
    with LOCK:
        hit = XFER.get(k)
        if hit and time.time() - hit[0] < 45: return hit[1]
    if budget_left() < 1500: return {"skipped": "daily budget", "prd": []}
    kx = math.cos(math.radians(lat)); near = {}
    for rt in rts:
        try: stops = route_stops(rt)
        except Exception as e: continue
        for st in stops:
            dm = math.hypot((st["lon"] - lon) * kx, st["lat"] - lat) * 111320
            if dm < 230 and (st["id"] not in near or dm < near[st["id"]]["m"]): near[st["id"]] = dict(st, m=round(dm), rt=rt)
    best = {}                                                        # nearest stop per route and direction
    for st in near.values():
        kk = (st["rt"], st["dir"])
        if kk not in best or st["m"] < best[kk]["m"]: best[kk] = st
    ids = list({st["id"] for st in best.values()})[:20]; prd = []
    for i in range(0, len(ids), 10):
        try:
            r = bt(f"{BT_BASE}/getpredictions?" + urllib.parse.urlencode({"key": KEYS["CTA_BUS_KEY"], "stpid": ",".join(ids[i:i + 10]), "top": 12, "format": "json"}))
            for p in r.get("prd", []):
                if p.get("rt") in rts:
                    st = near.get(str(p.get("stpid")), {})
                    prd.append({"rt": p.get("rt"), "dir": p.get("rtdir"), "des": p.get("des"), "stop": p.get("stpnm"), "m": st.get("m"), "t": p.get("prdtm"), "dly": bool(p.get("dly")), "vid": p.get("vid")})
        except Exception as e: STATE["errors"]["transfers"] = str(e)
    data = {"prd": prd, "stops": len(ids), "t": int(time.time())}
    with LOCK:
        XFER[k] = (time.time(), data)
        for kk in [x for x, v in XFER.items() if time.time() - v[0] > 600]: XFER.pop(kk, None)
    return data

# ---- schedule files (GTFS) for Amtrak and the South Shore Line ----
GTFS_DIR = os.path.join(HERE, "gtfs")
GTFS_SOURCES = {"cta.zip": "https://www.transitchicago.com/downloads/sch_data/google_transit.zip",
                "metra.zip": "https://schedules.metrarail.com/gtfs/schedule.zip",
                "amtrak.zip": "https://content.amtrak.com/content/gtfs/GTFS.zip",
                "nictd.zip": "http://www.mysouthshoreline.com/google/google_transit.zip"}
def refresh_gtfs():
    os.makedirs(GTFS_DIR, exist_ok=True)
    for name, url in GTFS_SOURCES.items():
        path = os.path.join(GTFS_DIR, name)
        if os.path.exists(path) and time.time() - os.path.getmtime(path) < 7 * 86400 and os.path.getsize(path) > 10000: continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Elevated-local-map/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r: data = r.read()
            if data[:2] != b"PK": raise RuntimeError("not a zip file")
            with open(path + ".part", "wb") as fh: fh.write(data)
            os.replace(path + ".part", path); STATE["errors"].pop("gtfs_" + name, None)
        except Exception as e: STATE["errors"]["gtfs_" + name] = str(e)

# ---- live Amtrak (Amtraker community feed of Amtrak's own train locations) ----
AMTRAK_URL = os.environ.get("AMTRAK_URL", "https://api-v3.amtraker.com/v3/trains")
BOX = (41.15, 42.85, -89.15, -86.75)                       # lat min, lat max, lon min, lon max
def get_amtrak():
    with LOCK:
        if STATE.get("amtrak") is not None and time.time() - STATE.get("amtrak_t", 0) < 60: return STATE["amtrak"]
    try:
        raw, out = fetch_json(AMTRAK_URL, timeout=20), []
        for num, runs in raw.items():
            for t in runs:
                lat, lon = t.get("lat"), t.get("lon")
                if lat is None or lon is None or not (BOX[0] <= lat <= BOX[1] and BOX[2] <= lon <= BOX[3]): continue
                if t.get("trainState") not in ("Active", "Predeparture"): continue
                nxt = next((s for s in t.get("stations", []) if s.get("status") == "Enroute"), None)
                out.append({"num": t.get("trainNum"), "id": t.get("trainID"), "route": t.get("routeName"), "lat": lat, "lon": lon,
                            "heading": t.get("heading"), "mph": t.get("velocity"), "state": t.get("trainState"), "orig": t.get("origName"), "dest": t.get("destName"),
                            "next": nxt and nxt.get("name"), "nextCode": nxt and nxt.get("code"), "eta": nxt and nxt.get("arr"), "sch": nxt and nxt.get("schArr"), "upd": t.get("lastValTS")})
        data = {"trains": out, "t": int(time.time())}
        with LOCK: STATE["amtrak"], STATE["amtrak_t"] = data, time.time(); STATE["errors"].pop("amtrak", None)
        return data
    except Exception as e:
        with LOCK:
            STATE["errors"]["amtrak"] = str(e)
            return STATE.get("amtrak") or {"error": str(e)}

# ---- live ships (aisstream.io WebSocket, standard library only) ----
SHIPS, SHIP_STATIC = {}, {}
def ws_connect(host, path):
    raw = socket.create_connection((host, 443), timeout=30)
    sock = ssl.create_default_context().wrap_socket(raw, server_hostname=host)
    key = base64.b64encode(os.urandom(16)).decode()
    sock.sendall((f"GET {path} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                  f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\nUser-Agent: Elevated-local-map/1.0\r\n\r\n").encode())
    head = b""
    while b"\r\n\r\n" not in head:
        chunk = sock.recv(4096)
        if not chunk: raise RuntimeError("closed during handshake")
        head += chunk
    if b" 101 " not in head.split(b"\r\n")[0]: raise RuntimeError("handshake refused: " + head.split(b"\r\n")[0].decode(errors="replace"))
    return sock, head.split(b"\r\n\r\n", 1)[1]
def ws_send(sock, text, op=1):
    data = text.encode() if isinstance(text, str) else text; mask = os.urandom(4); n = len(data)
    hdr = bytes([0x80 | op]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", n))
    sock.sendall(hdr + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))
def ws_frames(sock, buf):
    msg, mop = b"", None
    while True:
        while len(buf) < 2:
            chunk = sock.recv(65536)
            if not chunk: raise RuntimeError("closed")
            buf += chunk
        b0, b1 = buf[0], buf[1]; n = b1 & 127; i = 2
        if n == 126:
            while len(buf) < 4: buf += sock.recv(65536)
            n = struct.unpack(">H", buf[2:4])[0]; i = 4
        elif n == 127:
            while len(buf) < 10: buf += sock.recv(65536)
            n = struct.unpack(">Q", buf[2:10])[0]; i = 10
        while len(buf) < i + n:
            chunk = sock.recv(65536)
            if not chunk: raise RuntimeError("closed")
            buf += chunk
        payload, buf, op = buf[i:i + n], buf[i + n:], b0 & 15
        if op == 9: ws_send(sock, payload, 10); continue
        if op == 8: raise RuntimeError("server closed the stream")
        if op in (1, 2): msg, mop = payload, op
        elif op == 0: msg += payload
        if b0 & 0x80 and mop: yield msg; msg, mop = b"", None
def ais_loop():
    key = KEYS.get("AISSTREAM_KEY")
    if not key: return
    backoff = 5
    while True:
        try:
            sock, rest = ws_connect("stream.aisstream.io", "/v0/stream"); sock.settimeout(120)
            ws_send(sock, json.dumps({"APIKey": key, "BoundingBoxes": [[[BOX[0], BOX[2]], [BOX[1], BOX[3]]]],
                                      "FilterMessageTypes": ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "ShipStaticData", "StaticDataReport"]}))
            STATE["errors"].pop("ships", None); backoff = 5
            for raw in ws_frames(sock, rest):
                try: m = json.loads(raw)
                except ValueError: continue
                if "error" in m: raise RuntimeError(str(m["error"]))
                md, kind = m.get("MetaData") or {}, m.get("MessageType"); mmsi = md.get("MMSI")
                if not mmsi: continue
                body = (m.get("Message") or {}).get(kind) or {}
                if kind in ("ShipStaticData", "StaticDataReport"):
                    st = SHIP_STATIC.setdefault(mmsi, {})
                    if body.get("Type") is not None: st["type"] = body.get("Type")
                    rep = body.get("ReportB") or {}
                    if rep.get("ShipType") is not None: st["type"] = rep.get("ShipType")
                    dim = body.get("Dimension") or {}
                    if dim: st["len"] = (dim.get("A") or 0) + (dim.get("B") or 0)
                    if body.get("Destination"): st["dest"] = body.get("Destination").strip()
                    continue
                lat, lon = md.get("latitude", md.get("Latitude")), md.get("longitude", md.get("Longitude"))
                if lat is None or lon is None: continue
                SHIPS[mmsi] = {"mmsi": mmsi, "name": (md.get("ShipName") or "").strip(), "lat": lat, "lon": lon, "sog": body.get("Sog"), "cog": body.get("Cog"),
                               "hdg": body.get("TrueHeading"), "t": time.time()}
        except Exception as e:
            STATE["errors"]["ships"] = str(e); time.sleep(backoff); backoff = min(300, backoff * 2)
def get_ships():
    if not KEYS.get("AISSTREAM_KEY"): return {"error": "No AISSTREAM_KEY in keys.env"}
    now, out = time.time(), []
    for k, s in list(SHIPS.items()):
        if now - s["t"] > 1800: SHIPS.pop(k, None); continue
        out.append(dict(s, **SHIP_STATIC.get(k, {}), age=round(now - s["t"])))
    return {"ships": out, "t": int(now)}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=HERE, **kw)
    def log_message(self, fmt, *args): pass
    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/api/status":
            return self.send_json({"live": True, "keys": {k: bool(KEYS.get(k)) for k in ("CTA_TRAIN_KEY", "CTA_BUS_KEY", "AISSTREAM_KEY")},
                                   "gtfs": {n: os.path.exists(os.path.join(GTFS_DIR, n)) for n in GTFS_SOURCES}, "ships_tracked": len(SHIPS),
                                   "trains_age": round(time.time() - STATE["trains_t"]) if STATE["trains_t"] else None,
                                   "bus_requests_today": BUDGET["n"], "bus_budget_left": budget_left(),
                                   "errors": STATE["errors"]})
        if p == "/api/trains": return self.send_json(get_trains())
        if p == "/api/buses": return self.send_json(get_buses())
        q = urllib.parse.parse_qs(self.path.split("?", 1)[1] if "?" in self.path else "")
        if p == "/api/buses/near": return self.send_json(get_buses_near((q.get("rt", [""])[0]).split(",")))
        if p == "/api/patterns": return self.send_json(get_patterns((q.get("pid", [""])[0]).split(",")))
        if p == "/api/price": return self.send_json(get_price())
        if p == "/api/history": return self.send_json(get_history())
        if p == "/api/amtrak": return self.send_json(get_amtrak())
        if p == "/api/ships": return self.send_json(get_ships())
        if p == "/api/alerts": return self.send_json(get_alerts())
        if p == "/api/arrivals": return self.send_json(get_arrivals(q.get("mapid", [""])[0]))
        if p == "/api/transfers":
            try: return self.send_json(get_transfers(float(q.get("lat", ["0"])[0]), float(q.get("lon", ["0"])[0]), (q.get("rt", [""])[0]).split(",")))
            except ValueError: return self.send_json({"error": "bad location"}, 400)
        if p in ("/", "/index.html"): self.path = "/index.html"
        elif not p.startswith("/index.html"): return self.send_error(404)          # only the map page is served, never keys.env
        return super().do_GET()

if __name__ == "__main__":
    print(f"Elevated is running at http://localhost:{PORT}", flush=True)
    print("  CTA trains:", "key found" if KEYS.get("CTA_TRAIN_KEY") else "no key yet (add CTA_TRAIN_KEY to keys.env)")
    print("  CTA buses: ", "key found" if KEYS.get("CTA_BUS_KEY") else "no key yet (optional)")
    print("  Ships:     ", "key found" if KEYS.get("AISSTREAM_KEY") else "no key yet (optional)")
    print("Press Control-C to stop.", flush=True)
    threading.Thread(target=refresh_gtfs, daemon=True).start()
    threading.Thread(target=ais_loop, daemon=True).start()
    host = "127.0.0.1"
    if "--phone" in sys.argv:                                         # also reachable from phones on the same Wi-Fi (only the map page and its data, never keys.env)
        host = "0.0.0.0"
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("10.255.255.255", 1)); ip = s.getsockname()[0]; s.close()
        except OSError: ip = "this Mac's IP address"
        print(f"Phone mode: on your phone (same Wi-Fi), open  http://{ip}:{PORT}", flush=True)
    ThreadingHTTPServer((host, PORT), Handler).serve_forever()
