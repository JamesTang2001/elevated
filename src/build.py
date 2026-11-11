import json, re, pathlib
R = pathlib.Path(__file__).resolve().parent; D = R.parent / "data"; V = R.parent / "vendor"
app = "\n".join((R / "js" / f).read_text() for f in ["model.js", "style.js", "map.js", "three3d.js", "vehicles3d.js", "models.js", "stations.js", "landmarks.js", "boats.js", "amtrak.js", "weather.js", "sky.js", "windows.js", "city.js", "alerts.js", "saved.js", "films.js", "extras.js", "vehicles.js", "zone.js", "ui.js"])
rd = lambda n: (D / n).read_text()
# Metra + regional rail (Amtrak, South Shore) share one pattern timetable; each route carries its agency
M = json.loads(rd("metra_tt.json")); G = json.loads(rd("regional_tt.json"))
for r in M["routes"]: M["routes"][r] = list(M["routes"][r]) + ["metra"]
for k in M["stops"]: M["stops"][k] = list(M["stops"][k]) + ["metra"]
ns, npat = len(M["shapes"]), len(M["pats"])
M["routes"].update(G["routes"]); M["stops"].update(G["stops"]); M["shapes"] += G["shapes"]
M["pats"] += [[p[0], p[1] + ns] + p[2:] for p in G["pats"]]
for d in M["trips"]: M["trips"][d] = sorted(M["trips"][d] + [[t[0] + npat] + t[1:] for t in G["trips"].get(d, [])], key=lambda x: x[1])
for ph, f in [("DATA", "routes.json"), ("BUS", "bus.json"), ("RIDER", "ridership.json"), ("CTATT", "cta_rail_tt.json"), ("BSTOPALL", "bus_stops.json")]:
    app = app.replace(f"/*__{ph}__*/null", rd(f).strip())
app = app.replace("/*__METRA__*/null", json.dumps(M, separators=(",", ":")))
# last service date in each timetable, so the page can warn when one is about to run out
import csv
def last_day(folder):
    try:
        with open(R.parent / "gtfs" / folder / "calendar.txt", encoding="utf-8-sig") as f:
            r = csv.DictReader(f); k = [c for c in r.fieldnames if "end" in c][0]; return max(row[k].strip() for row in r)
    except Exception: return None
TT_UNTIL = {"CTA": last_day("cta"), "Metra": last_day("metra"), "Amtrak": last_day("amtrak"), "South Shore": last_day("nictd")}
app = "const TT_UNTIL = " + json.dumps(TT_UNTIL) + ";\n" + app
html = (R / "app.html").read_text()
html = html.replace("/*__MLCSS__*/", (V / "maplibre-gl-4.7.1/dist/maplibre-gl.css").read_text())
for ph, txt in [("/*__MLJS__*/", (V / "maplibre-gl-4.7.1/dist/maplibre-gl.js").read_text()), ("/*__THREEJS__*/", (V / "three-0.149.0/build/three.min.js").read_text()), ("/*__APP__*/", app)]:
    i = html.index(ph); html = html[:i] + txt.replace("</script", "<\\/script") + html[i + len(ph):]
(R.parent / "site").mkdir(exist_ok=True); (R.parent / "site" / "index.html").write_text(html)   # what Cloudflare Pages serves
print("index.html", len(html) // 1024, "KB")
