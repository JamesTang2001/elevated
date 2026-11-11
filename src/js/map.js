/* ===== Elevated v2 — map: MapLibre setup, transit layers, overlay canvas for vehicles ===== */
const BOUNDS = [[-88.70, 41.38], [-87.20, 42.62]];          // Metra terminals (Harvard, Kenosha, Joliet, University Park) + lake to Gary
const PAD_BOUNDS = [[-89.05, 41.20], [-86.85, 42.80]];
const HOME = { center: [-87.668, 41.872], zoom: 10.9, pitch: 50, bearing: 0 };   // the whole L network, from Linden to 95th
const TILT = 55;
const ST_IDS = Object.keys(ST);
const MCOL = rid => METRA.routes[rid] ? METRA.routes[rid][1] : "#4a77a8", MNAME = rid => METRA.routes[rid] ? METRA.routes[rid][0] : "";
const MAG = rid => (METRA.routes[rid] && METRA.routes[rid][2]) || "metra";                  // agency: metra · ss (South Shore) · amtrak
const M_LINES = Object.keys(METRA.routes).filter(r => MAG(r) === "metra");
let map, overlay, octx, OW = 0, OH = 0, ODPR = 1, styleTheme = null;

/* ---------- settings (per browser) ---------- */
const DEF = { mapAngle: "tilt", follow: "behind",
  mapStyle: "auto", seeThrough: "see", bldg3d: true, daylight: true,
  trains3d: true, formation: "full", tsize: "easy", showTrains: "all", halo: true, arrows: false,
  track: "auto", hidden: [], appearance: "auto", font: "m", translucent: false, perf: "auto", stories: false, music: false,
  buses: "near", metra: true, ships: false, landmarks: true, films: false, sky: true, weather: true, nightLights: true, traffic: false, rideView: "front" };
const SET = Object.assign({}, DEF, load("v2settings", {}));
if (SET.tsize === true || SET.tsize === "true") SET.tsize = "real";                  // older saves stored "True" as a yes/no flag
if (!["north", "behind", "side", "orbit"].includes(SET.follow)) SET.follow = SET.headingUp === false ? "north" : "behind";
delete SET.watch; delete SET.headingUp;
if (!SET._v3) { SET.seeThrough = "see"; SET._v3 = 1; }   // see-through buildings became the default
if (SET.fps30) SET.perf = "smooth"; delete SET.fps30;
SET.daylight = true; delete SET.minimal; delete SET.formation; delete SET.showTrains; delete SET.windows; delete SET.streetLife; delete SET.birds;   // tidy pass: these controls were merged or removed
const saveSet = () => save("v2settings", SET);
const prefersDark = matchMedia("(prefers-color-scheme: dark)");
const uiDark = () => SET.appearance === "dark" || (SET.appearance === "auto" && prefersDark.matches);
const mapDark = () => SET.mapStyle === "dark" || (SET.mapStyle === "auto" && uiDark());
const lineOn = id => !SET.hidden.includes(id);
function visible(l) { return lineOn(l); }                        // used by the timetable model
const metraOn = () => SET.metra && lineOn("metra");
const agOn = ag => ag === "metra" ? metraOn() : lineOn(ag);
const railAgs = () => ["metra", "ss", "amtrak"].filter(agOn);
const railOn = () => railAgs().length > 0;
const agFilter = () => ["in", ["get", "ag"], ["literal", railAgs()]];

/* ---------- transit GeoJSON ---------- */
function routeSegments() {
  const feats = [];
  for (const r of ROUTES) {
    let cur = null, cut = Infinity;
    if (r.loop) { const ex = LOOP_EXIT[r.id] || LOOP_EXIT[r.line], hits = r.stops.filter(s => s.id === ex); if (hits.length) cut = hits[hits.length - 1].d + 30; }   // out-and-back routes: draw the return leg once
    r.coords.forEach((c, i) => {
      if (r.cum[i] > cut) return;
      const k = kindAt(r, r.cum[i]);
      if (!cur || cur.k !== k) { const prev = cur; if (prev) { prev.pts.push(c); feats.push(prev); } cur = { k, line: r.line, pts: [] }; }
      cur.pts.push(c);
    });
    if (cur) feats.push(cur);
  }
  return { type: "FeatureCollection", features: feats.filter(f => f.pts.length > 1).map(f => ({ type: "Feature",
    properties: { line: f.line, color: LCOL[f.line], tcolor: muted(LCOL[f.line]), kind: f.k, off: OFFSET[f.line] || 0, z: LINES.indexOf(f.line) },
    geometry: { type: "LineString", coordinates: f.pts } })) };
}
/* track colours are blended toward the map (trains and station rings keep the true CTA colour) */
function muted(hex, keepL = .7, keepD = .66) {
  const keep = styleTheme === "dark" ? keepD : keepL, bg = parseInt(PALETTES[styleTheme || "light"].bg.slice(1), 16), c = parseInt(hex.slice(1), 16);
  const mix = sh => Math.round(((c >> sh) & 255) * keep + ((bg >> sh) & 255) * (1 - keep));
  return "#" + [16, 8, 0].map(sh => mix(sh).toString(16).padStart(2, "0")).join("");
}
function stationTier(id, s) {
  if (LOOP_IDS.has(id) || s.lines.length >= 2) return 0;
  if (TERM[id] || rides(id) > 6000) return 1;
  return 2;
}
function stationFC() {
  return { type: "FeatureCollection", features: ST_IDS.map(id => { const s = ST[id];
    return { type: "Feature", id: +id, properties: { id, name: s.name, tier: stationTier(id, s), ring: s.lines.length > 1 ? "multi" : LCOL[s.lines[0]], lines: s.lines.join(",") },
      geometry: { type: "Point", coordinates: [s.lon, s.lat] } }; }) };
}
function metraFC() {
  const seen = new Set(), feats = [];
  for (const P of M_PAT) { if (seen.has(P.si)) continue; seen.add(P.si);
    feats.push({ type: "Feature", properties: { rid: P.rid, ag: MAG(P.rid), color: muted(MCOL(P.rid), .62, .6) }, geometry: { type: "LineString", coordinates: METRA.shapes[P.si].c } }); }
  const ord = { amtrak: 0, ss: 1, metra: 2 }; feats.sort((a, b) => ord[a.properties.ag] - ord[b.properties.ag]);   // Metra drawn on top where tracks are shared
  return { type: "FeatureCollection", features: feats };
}
function metraStopFC() {
  const lines = {}; for (const P of M_PAT) for (const s of P.stops) (lines[s] = lines[s] || new Set()).add(P.rid);
  return { type: "FeatureCollection", features: Object.entries(METRA.stops).filter(([id, s]) => s[3] !== "amtrak" && !(s[3] === "ss" && Object.values(METRA.stops).some(m => m[3] === "metra" && Math.hypot((m[1] - s[1]) * KX, m[2] - s[2]) * MPD < 220))).map(([id, [name, lon, lat, ag]]) => ({ type: "Feature",
    properties: { id, name, ag: ag || "metra", big: ["CUS", "OTC", "LSS", "MILLENNIUM", "VANBUREN", "ROOSEVELT"].includes(id) ? 1 : 0, rids: [...(lines[id] || [])].join(",") },
    geometry: { type: "Point", coordinates: [lon, lat] } })) };
}
function busFC() {
  return { type: "FeatureCollection", features: BUS.map((R, ri) => ({ type: "Feature", properties: { ri, r: R.r }, geometry: { type: "LineString", coordinates: R.c } })) };
}

/* ---------- transit layer styling ---------- */
const LW = ["interpolate", ["exponential", 1.4], ["zoom"], 8, 1.7, 11, 3.2, 13, 4.4, 16, 7.4, 18, 11];
const LW_CASE = ["interpolate", ["exponential", 1.4], ["zoom"], 8, 3.2, 11, 5.4, 13, 6.8, 16, 10.6, 18, 15];
const OFF = ["interpolate", ["exponential", 1.4], ["zoom"], 8, ["*", ["get", "off"], 1.7], 11, ["*", ["get", "off"], 3.3], 13, ["*", ["get", "off"], 4.5], 16, ["*", ["get", "off"], 7.5], 18, ["*", ["get", "off"], 11.2]];
function trackOpacity(base, part = "line") {           // part: line (thick), rail (two thin lines), glow
  if (SET.track === "hidden") return 0;
  const f = SET.track === "faint" ? .35 : 1, B = base * f, on3d = SET.trains3d;
  const k = (sub, elev, grade) => ["case", ["==", ["get", "kind"], "sub"], sub, ["==", ["get", "kind"], "elev"], elev, grade];
  if (part === "rail") return ["interpolate", ["linear"], ["zoom"], 14.9, k(0, 0, 0), 15.5, k(B * .55, B, B), 15.9, k(B * (SET.seeThrough === "see" ? .6 : .45), on3d ? B * .35 : B, on3d ? B * .35 : B), 16.3, k(B * (SET.seeThrough === "see" ? .6 : .45), on3d ? 0 : B, on3d ? 0 : B)];
  if (part === "glow") return ["interpolate", ["linear"], ["zoom"], 13, B, 15.5, k(B * .2, B * .25, B * .25), 16.3, k(B * .2, on3d ? 0 : B * .25, on3d ? 0 : B * .25)];
  return ["interpolate", ["linear"], ["zoom"], 13.5, k(B, B, B), 14.9, k(B * .6, B, B), 15.5, k(0, 0, 0)];
}
function lineFilter() { return ["match", ["get", "line"], LINES.filter(lineOn).length ? LINES.filter(lineOn) : ["__none"], true, false]; }

function addTransitLayers() {
  const P = PALETTES[styleTheme], dark = styleTheme === "dark";
  map.addSource("bus", { type: "geojson", data: busFC() });
  map.addSource("metra", { type: "geojson", data: metraFC() });
  map.addSource("metra-st", { type: "geojson", data: metraStopFC() });
  map.addSource("lines", { type: "geojson", data: routeSegments(), lineMetrics: false });
  map.addSource("st", { type: "geojson", data: stationFC() });
  const before = "water-label";
  map.addLayer({ id: "bus-lines", type: "line", source: "bus", minzoom: 11, layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": dark ? "#5f87a8" : "#7d9db8", "line-width": ["interpolate", ["linear"], ["zoom"], 11, .5, 16, 2], "line-opacity": busLineOpacity() } }, before);
  map.addLayer({ id: "metra-case", filter: agFilter(), type: "line", source: "metra", layout: { "line-join": "round", "line-cap": "round", visibility: railOn() ? "visible" : "none" },
    paint: { "line-color": P.bg, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.6, 12, 4.4, 16, 8] } }, before);
  map.addLayer({ id: "metra-line", filter: agFilter(), type: "line", source: "metra", layout: { "line-join": "round", "line-cap": "round", visibility: railOn() ? "visible" : "none" },
    paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.3, 12, 2.4, 16, 4.8], "line-opacity": SET.track === "hidden" ? 0 : SET.track === "faint" ? .35 : .9 } }, before);
  map.addLayer({ id: "metra-tie", filter: agFilter(), type: "line", source: "metra", minzoom: 13, layout: { visibility: railOn() ? "visible" : "none" },
    paint: { "line-color": P.bg, "line-width": ["interpolate", ["linear"], ["zoom"], 13, .8, 16, 1.6], "line-dasharray": [2, 3], "line-opacity": SET.track === "hidden" ? 0 : .8 } }, before);
  if (dark) {
    map.addLayer({ id: "l-glow", type: "line", source: "lines", filter: lineFilter(), layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "z"] },
      paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 8, 6, 12, 11, 16, 18], "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 4, 16, 9], "line-offset": OFF, "line-opacity": trackOpacity(.26, "glow") } }, before);
  }
  map.addLayer({ id: "l-case", type: "line", source: "lines", filter: lineFilter(), layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "z"] },
    paint: { "line-color": P.bg, "line-width": LW_CASE, "line-offset": OFF, "line-opacity": trackOpacity(1) } }, before);
  map.addLayer({ id: "l-line", type: "line", source: "lines", filter: lineFilter(), layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "z"] },
    paint: { "line-color": ["get", "tcolor"], "line-width": LW, "line-offset": OFF, "line-opacity": trackOpacity(1) } }, before);
  for (const [id, side] of [["l-rail-a", 1], ["l-rail-b", -1]])                // the two-rail look at street zoom
    map.addLayer({ id, type: "line", source: "lines", minzoom: 14.8, filter: lineFilter(), layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ["get", "tcolor"], "line-width": ["interpolate", ["linear"], ["zoom"], 15, 1.2, 18, 2.2],
        "line-offset": ["interpolate", ["linear"], ["zoom"], 15, ["+", ["*", ["get", "off"], 7], 2.6 * side], 18, ["+", ["*", ["get", "off"], 16], 7 * side]], "line-opacity": trackOpacity(1, "rail") } }, before);
  if (dark) map.addLayer({ id: "l-core", type: "line", source: "lines", filter: lineFilter(), layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 8, .8, 13, 1.6, 16, 2.6], "line-blur": .6, "line-offset": OFF, "line-opacity": trackOpacity(.32, "glow") } }, before);
  // bus stops: small white rings with a blue edge, close in (tap for the next buses)
  if (!map.getSource("bstop")) map.addSource("bstop", { type: "geojson", data: { type: "FeatureCollection", features: BSTOP_ALL.map((s, i) => ({ type: "Feature", id: i, properties: { i, n: s[2] }, geometry: { type: "Point", coordinates: [s[0], s[1]] } })) } });
  map.addLayer({ id: "bus-stop", type: "circle", source: "bstop", minzoom: 14.6, layout: { visibility: busStopsOn() ? "visible" : "none" },
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 14.6, 2, 16, 3.6, 18, 5.5], "circle-color": dark ? "#0e131b" : "#ffffff", "circle-stroke-color": dark ? "#7fb2db" : "#3a77a8",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 14.6, 1, 17, 1.8], "circle-opacity": ["interpolate", ["linear"], ["zoom"], 14.6, 0, 15, 1], "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 14.6, 0, 15, 1], "circle-pitch-alignment": "map" } });
  // Metra stations (small, quiet), then L stations in tiers
  map.addLayer({ id: "metra-st", filter: agFilter(), type: "circle", source: "metra-st", minzoom: 10, layout: { visibility: railOn() ? "visible" : "none" },
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1.8, 13, 3, 16, 5], "circle-color": dark ? "#1b2330" : "#ffffff",
      "circle-stroke-color": dark ? "#8b95a5" : "#5b5f66", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, .8, 16, 1.6], "circle-pitch-alignment": "map" } });
  const R = (a, b, c) => ["match", ["get", "tier"], 0, a, 1, b, c];
  map.addLayer({ id: "st-alert", type: "circle", source: "st", minzoom: 10,                    // a soft amber ring on stations with a service alert
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 16, 14], "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#f0a020", "circle-stroke-width": 2,
      "circle-stroke-opacity": ["case", ["boolean", ["feature-state", "alert"], false], .85, 0], "circle-pitch-alignment": "map" } });
  map.addLayer({ id: "st-dot", type: "circle", source: "st", minzoom: 9,
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, R(3.2, 2.7, 2.2), 12, R(5.2, 4.3, 3.5), 16, R(8.6, 7.4, 6.4)],
      "circle-color": dark ? "#f4f2ec" : "#ffffff",
      "circle-stroke-color": ["case", ["==", ["get", "ring"], "multi"], dark ? "#0e131b" : "#1e2329", ["get", "ring"]],
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 9, ["match", ["get", "tier"], 0, 1.6, 1.2], 16, ["match", ["get", "tier"], 0, 2.6, 2.1]],
      "circle-pitch-alignment": "map", "circle-opacity": ["case", ["boolean", ["feature-state", "dim"], false], .35, 1], "circle-stroke-opacity": ["case", ["boolean", ["feature-state", "dim"], false], .35, 1] } });
  const lab = (id, src, filter, minzoom, size, weight) => map.addLayer({ id, type: "symbol", source: src, minzoom, filter,
    layout: { "text-field": ["get", "name"], "text-font": [weight], "text-size": size, "text-anchor": "left", "text-offset": [.75, 0], "text-max-width": 9,
      "text-variable-anchor": ["left", "right", "top", "bottom"], "text-radial-offset": .7, "text-padding": 3, visibility: "visible" },
    paint: { "text-color": dark ? "#e6e9ee" : "#22262c", "text-halo-color": P.bg, "text-halo-width": 1.6, "text-halo-blur": .4 } });
  lab("st-lab-0", "st", ["==", ["get", "tier"], 0], 10.6, ["interpolate", ["linear"], ["zoom"], 10.6, 11.5, 15, 13.5], "Noto Sans Bold");
  lab("st-lab-1", "st", ["==", ["get", "tier"], 1], 11.8, ["interpolate", ["linear"], ["zoom"], 12, 11, 15, 13], "Noto Sans Regular");
  lab("st-lab-2", "st", ["==", ["get", "tier"], 2], 13, ["interpolate", ["linear"], ["zoom"], 13, 10.5, 16, 12.5], "Noto Sans Regular");
  lab("metra-lab", "metra-st", ["all", ["==", ["get", "big"], 0], agFilter()], 12.4, ["interpolate", ["linear"], ["zoom"], 12.4, 10, 16, 12], "Noto Sans Italic");
  map.setLayoutProperty("metra-lab", "visibility", railOn() ? "visible" : "none");
  map.setPaintProperty("metra-lab", "text-color", dark ? "#9aa4b3" : "#5b5f66");
  excludeLandmarkBuildings();
  apply3dBuildings();
}
function busLineOpacity() {
  if (SET.buses === "off" || !lineOn("bus")) return 0;
  return ["interpolate", ["linear"], ["zoom"], 11, SET.buses === "all" ? .35 : 0, 13, SET.buses === "all" ? .5 : .28, 16, .45];
}
const busStopsOn = () => SET.buses !== "off" && lineOn("bus");
function refreshTransitPaint() {                          // settings that only change paint/filters (no style reload)
  if (!map || !map.getLayer("l-line")) return;
  if (map.getLayer("bus-stop")) map.setLayoutProperty("bus-stop", "visibility", busStopsOn() ? "visible" : "none");
  const f = lineFilter();
  for (const id of ["l-glow", "l-case", "l-line", "l-core", "l-rail-a", "l-rail-b"]) if (map.getLayer(id)) {
    map.setFilter(id, f);
    map.setPaintProperty(id, "line-opacity", id === "l-glow" ? trackOpacity(.26, "glow") : id === "l-core" ? trackOpacity(.32, "glow") : id.startsWith("l-rail") ? trackOpacity(1, "rail") : trackOpacity(1));
  }
  const mv = railOn() ? "visible" : "none", af = agFilter();
  for (const id of ["metra-case", "metra-line", "metra-tie", "metra-st", "metra-lab"]) { map.setLayoutProperty(id, "visibility", mv); map.setFilter(id, id === "metra-lab" ? ["all", ["==", ["get", "big"], 0], af] : af); }
  map.setPaintProperty("metra-line", "line-opacity", SET.track === "hidden" ? 0 : SET.track === "faint" ? .35 : .9);
  map.setPaintProperty("bus-lines", "line-opacity", busLineOpacity());
  const lineSet = new Set(LINES.filter(lineOn));
  for (const id of ST_IDS) map.setFeatureState({ source: "st", id: +id }, { dim: !ST[id].lines.some(l => lineSet.has(l)) });
  apply3dBuildings();
}
function apply3dBuildings() {
  if (!map.getLayer("bldg-3d")) return;
  map.setLayoutProperty("bldg-3d", "visibility", SET.bldg3d ? "visible" : "none");
  map.setLayerZoomRange("bldg-flat", 13, SET.bldg3d ? 15 : 24);
  map.setPaintProperty("bldg-3d", "fill-extrusion-opacity", SET.seeThrough === "see" ? ["interpolate", ["linear"], ["zoom"], 14.4, 1, 15.6, .55, 17.5, .42] : 1);
}

/* ---------- sun light on buildings ---------- */
let lastLightKey = "";
function applyLight() {
  if (!map || !map.isStyleLoaded()) return;
  const dark = styleTheme === "dark";
  let az = 210, polar = 50, color = dark ? "#cfdcff" : "#ffffff", intensity = dark ? .42 : .5;
  if (SET.daylight) {
    const el = SUN.el / RAD, n = nightLevel();
    az = (SUN.az / RAD + 180) % 360;                                   // light comes from the sun's direction
    polar = Math.max(25, Math.min(80, 90 - Math.max(el, 8)));
    const warm = el < 18 && el > -2 ? "#ffe2bd" : "#fff6e8";
    color = n > .6 ? "#b9c8ff" : warm;
    intensity = (dark ? .38 + .1 * (1 - n) : .62 - .22 * n) * (.75 + .25 * wxSunDim());    // cloud cover softens the sunlight
  }
  const key = [Math.round(az / 3), Math.round(polar / 3), color, intensity.toFixed(2)].join();
  if (key === lastLightKey) return; lastLightKey = key;
  map.setLight({ anchor: "map", position: [1.5, az, polar], color, intensity });
}

/* ---------- landmarks: hide the OSM block under each custom model ---------- */
function circlePoly(lon, lat, r) { const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * 2 * Math.PI; pts.push([lon + Math.cos(a) * r / (MPD * KX), lat + Math.sin(a) * r / MPD]); } return pts; }
function excludeLandmarkBuildings() {
  if (!map.getLayer("bldg-3d")) return;
  if (SET.landmarks === false) { for (const id of ["bldg-3d", "bldg-flat"]) map.setFilter(id, null); return; }   // landmarks off: show the ordinary buildings again
  const polys = LANDMARKS.filter(l => l.clear).map(l => [circlePoly(l.lon, l.lat, l.clear)]);
  const geo = { type: "MultiPolygon", coordinates: polys };
  for (const id of ["bldg-3d", "bldg-flat"]) map.setFilter(id, ["!", ["within", geo]]);
}

/* ---------- map setup ---------- */
function buildMap() {
  styleTheme = mapDark() ? "dark" : "light";
  map = new maplibregl.Map({ container: "map", style: baseStyle(styleTheme), center: load("v2view", HOME).center, zoom: load("v2view", HOME).zoom,
    pitch: SET.mapAngle === "top" ? 0 : (load("v2view", HOME).pitch || TILT), bearing: load("v2view", HOME).bearing || 0,
    maxBounds: PAD_BOUNDS, minZoom: 8.3, maxZoom: 19, maxPitch: 75, attributionControl: false, fadeDuration: 0,
    pixelRatio: Math.min(devicePixelRatio || 1, 2), dragRotate: true, pitchWithRotate: true, touchPitch: true });
  map.touchZoomRotate.enableRotation();
  map.keyboard.disable();                                                // our own shortcuts
  map.scrollZoom.disable(); padGestures();
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Inspired by <a href="https://railisland.tw/" target="_blank" rel="noopener">Rail Island</a> · CTA, Metra, City of Chicago data' }), "bottom-right");
  map.on("style.load", () => { addTransitLayers(); add3dLayer(); lastLightKey = ""; applyLight(); WX.key = ""; applyWeather(); refreshTransitPaint(); alertMarked = []; markAlertStations(); });
  map.on("moveend", () => save("v2view", { center: map.getCenter().toArray(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() }));
  map.on("click", onMapClick);
  map.on("mousemove", e => { const h = hitTest(e.point.x, e.point.y); map.getCanvas().style.cursor = h ? "pointer" : ""; });
  map.on("dragstart", () => { if (following && !zone.on) unlock(); });
  overlay = document.getElementById("overlay"); octx = overlay.getContext("2d");
  new ResizeObserver(sizeOverlay).observe(document.getElementById("map")); sizeOverlay();
}
function setMapTheme() {
  const t = mapDark() ? "dark" : "light"; if (t === styleTheme) return;
  styleTheme = t; map.setStyle(baseStyle(t), { diff: false });
}
function sizeOverlay() {
  const r = document.getElementById("map").getBoundingClientRect(); ODPR = Math.min(devicePixelRatio || 1, 2);
  sizeSky(); OW = r.width; OH = r.height; overlay.width = OW * ODPR; overlay.height = OH * ODPR; overlay.style.width = OW + "px"; overlay.style.height = OH + "px";
}

/* ---------- vehicle overlay: halos, number tags, dots ---------- */
const haloCache = new Map();
function haloSprite(color) {
  const night = styleTheme === "dark", key = color + night; if (haloCache.has(key)) return haloCache.get(key);
  const S = 64, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"), n = parseInt(color.slice(1), 16);
  let r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255;
  if (night) { r = Math.round(r * .7 + 255 * .3); gg = Math.round(gg * .7 + 198 * .3); b = Math.round(b * .7 + 109 * .3); }
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const [s, a] of [[0, .9], [.25, .72], [.5, .42], [.72, .17], [.88, .04], [1, 0]]) grd.addColorStop(s, `rgba(${r},${gg},${b},${a})`);
  g.fillStyle = grd; g.fillRect(0, 0, S, S); haloCache.set(key, c); return c;
}
function rr(x, y, w, h, r) { octx.beginPath(); octx.moveTo(x + r, y); octx.arcTo(x + w, y, x + w, y + h, r); octx.arcTo(x + w, y + h, x, y + h, r); octx.arcTo(x, y + h, x, y, r); octx.arcTo(x, y, x + w, y, r); octx.closePath(); }
const fontPx = () => ({ s: 10.5, m: 11.5, l: 13 })[SET.font];
function tag(x, y, text, bg, fg, sel, ang, alpha) {
  const f = fontPx(); octx.font = `700 ${f}px ${UI_FONT}`; const w = Math.max(f * 2.2, octx.measureText(text).width + f * 1.05), h = f + 7;
  octx.globalAlpha = alpha;
  if (sel) { octx.lineWidth = 3; octx.strokeStyle = styleTheme === "dark" ? "#fff" : "#111"; rr(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4, h / 2 + 2); octx.stroke(); }
  rr(x - w / 2, y - h / 2, w, h, h / 2); octx.fillStyle = bg; octx.fill();
  octx.lineWidth = 1.2; octx.strokeStyle = styleTheme === "dark" ? "rgba(0,0,0,.45)" : "rgba(255,255,255,.95)"; octx.stroke();
  octx.fillStyle = fg; octx.textAlign = "center"; octx.textBaseline = "middle"; octx.fillText(text, x, y + .5);
  if (ang !== null && SET.arrows) {                                         // small chevron on the leading side
    const ax = x + Math.cos(ang) * (w / 2 + 5), ay = y + Math.sin(ang) * (h / 2 + 5);
    octx.save(); octx.translate(ax, ay); octx.rotate(ang); octx.beginPath(); octx.moveTo(3.5, 0); octx.lineTo(-2.5, -3.5); octx.lineTo(-2.5, 3.5); octx.closePath(); octx.fillStyle = bg; octx.fill(); octx.restore();
  }
  octx.globalAlpha = 1;
}
const isLight = hex => { const n = parseInt(hex.slice(1), 16); return (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) > 165; };
let hits = [];
function screenAngle(lon, lat, dlon, dlat) {
  const a = map.project([lon, lat]), b = map.project([lon + dlon, lat + dlat]); return Math.atan2(b.y - a.y, b.x - a.x);
}
function drawOverlay() {
  octx.setTransform(ODPR, 0, 0, ODPR, 0, 0); octx.clearRect(0, 0, OW, OH); hits = []; placed.length = 0;
  drawSky(); HZ.y = groundTop();
  FOCUS.keys = selected && selected.type === "station" ? new Set(bestArrivals(selected.id).slice(0, 10).map(r => r.key)) : null;   // a station is open: its trains keep their labels
  if (HZ.y > 0) { const n = parseInt(SKYC.hor.slice(1), 16), rgb = `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`, g = octx.createLinearGradient(0, HZ.y - 3, 0, HZ.y + 46);   // soft haze where the ground meets the sky
    g.addColorStop(0, `rgba(${rgb},.85)`); g.addColorStop(.35, `rgba(${rgb},.35)`); g.addColorStop(1, `rgba(${rgb},0)`); octx.fillStyle = g; octx.fillRect(0, HZ.y - 3, OW, 49); }
  if (RIDE.on) { drawWeather(octx, OW, OH, map.getZoom()); return; }          // riding along: just the city and the weather, no labels
  const z = map.getZoom(), near3d = threeActive() && z >= T3D_MIN;
  const selKey = selected && selected.key;
  // buses first (under trains)
  if (SET.buses !== "off" && lineOn("bus") && (SET.buses === "all" || z >= 13.2 || (selected && selected.type === "bus"))) drawBuses(z, selKey);
  for (const v of VEH.x) if (v.type !== "boat" || z >= 12.2 || v.key === selKey) drawVehicle(v, z, near3d, selKey);
  for (const v of VEH.l) drawVehicle(v, z, near3d, selKey);         // L first, so its numbers get the room at middle zoom
  for (const v of VEH.m) drawVehicle(v, z, near3d, selKey);
  drawWeather(octx, OW, OH, z);
}
/* vehicles beyond the edge of the drawn ground would float against the sky: fade them out toward it */
const FOCUS = { keys: null }, HZ = { y: -1e9 }, horizonFade = y => Math.max(0, Math.min(1, (y - HZ.y - 10) / 40));
const placed = [];                                                // number tags already drawn this frame (to avoid overlaps at middle zoom)
function roomFor(x, y, w, h) { for (const r of placed) if (Math.abs(r[0] - x) < (r[2] + w) / 2 + 2 && Math.abs(r[1] - y) < (r[3] + h) / 2 + 1) return false; placed.push([x, y, w, h]); return true; }
function drawVehicle(v, z, near3d, selKey) {
  const p = map.project([v.lon, v.lat]); if (p.x < -40 || p.x > OW + 40 || p.y < -40 || p.y > OH + 40) return;
  const hf = v.key === selKey ? 1 : horizonFade(p.y); if (hf <= 0) return;
  if (FOCUS.keys && !FOCUS.keys.has(v.key) && v.key !== selKey) {      // other trains step back to small, quiet dots
    hits.push({ type: v.type, key: v.key, x: p.x, y: p.y, r: 10 }); if (near3d) return;
    octx.globalAlpha = .55 * hf; octx.beginPath(); octx.arc(p.x, p.y, 2.6, 0, 7); octx.fillStyle = v.color; octx.fill(); octx.globalAlpha = 1; return;
  }
  const isSel = v.key === selKey;
  const ang = screenAngle(v.lon, v.lat, v.dx / KX * 1e-4, -v.dy * 1e-4);
  const sub = v.kind === "sub", a = (sub && z >= 14 ? (SET.seeThrough === "see" ? .55 : .8) : 1) * hf;
  hits.push({ type: v.type, key: v.key, x: p.x, y: p.y, r: Math.max(12, z * 1.1) });
  if ((SET.halo || isSel) && !(near3d && !isSel)) {
    const s = isSel ? 84 : z < 11 ? 34 : z < 14 ? 48 : 58, img = haloSprite(v.color);   // a soft glow just past the number tag
    octx.globalAlpha = (isSel ? .9 : styleTheme === "dark" ? .7 : .5) * a; octx.drawImage(img, p.x - s / 2, p.y - s / 2, s, s); octx.globalAlpha = 1;
  }
  if (near3d && !isSel) {                                     // 3D cars carry the train; keep a quiet number above it
    if (z >= 16.5) return;
    tag(p.x, p.y - 22, v.label, v.color, isLight(v.color) ? "#16191d" : "#fff", false, null, .85 * a); return;
  }
  if (z >= HOME.zoom + .35 && z < 14 && !isSel) {                 // dots at the home view and further out; numbers once you zoom in past it                        // middle zoom: the number on every train that has room, a dot where labels would overlap
    const f = fontPx(); octx.font = `700 ${f}px ${UI_FONT}`; const w = Math.max(f * 2.2, octx.measureText(v.label).width + f * 1.05) + (SET.arrows ? 8 : 0);
    if (roomFor(p.x, p.y, w, f + 7)) { tag(p.x, p.y, v.label, v.color, isLight(v.color) ? "#16191d" : "#fff", false, ang, a); return; }
  }
  if (z < 14 && !isSel) {                                     // far out (or no room): glowing dots
    octx.globalAlpha = a; octx.beginPath(); octx.arc(p.x, p.y, v.type === "metra" ? 2.6 : 3, 0, 7); octx.fillStyle = v.color; octx.fill();
    octx.lineWidth = 1.2; octx.strokeStyle = styleTheme === "dark" ? "rgba(255,255,255,.8)" : "#fff"; octx.stroke(); octx.globalAlpha = 1; return;
  }
  tag(p.x, p.y, v.label, v.color, isLight(v.color) ? "#16191d" : "#fff", isSel, ang, a);
}
function drawBuses(z, selKey) {
  const dark = styleTheme === "dark", list = liveBusList();
  for (const b of list) {
    const p = map.project([b.lon, b.lat]); if (p.x < -20 || p.x > OW + 20 || p.y < -20 || p.y > OH + 20) continue;
    if (b.key !== selKey && p.y < HZ.y + 14) continue;
    const isSel = b.key === selKey; hits.push({ type: "bus", key: b.key, x: p.x, y: p.y, r: 11 });
    if (threeActive() && z >= T3D_MIN && !isSel) { if (z < 17.2) tag(p.x, p.y - (z < 16 ? 12 : 20), b.label, dark ? "#1d2a3a" : "#ffffff", dark ? "#9cc8ec" : "#2b6596", false, null, .9); continue; }
    if (z < 15.2 && !isSel) { octx.globalAlpha = .9; rr(p.x - 3, p.y - 3, 6, 6, 1.6); octx.fillStyle = dark ? "#7fb2db" : "#3a77a8"; octx.fill(); octx.globalAlpha = 1; continue; }
    tag(p.x, p.y, b.label, dark ? "#1d2a3a" : "#ffffff", dark ? "#9cc8ec" : "#2b6596", isSel, null, 1);
  }
}
function hitTest(x, y) {
  let best = null, bd = 1e9;
  for (const h of hits) { const d = Math.hypot(h.x - x, h.y - y); if (d < h.r && d < bd) { bd = d; best = h; } }
  return best;
}
function onMapClick(e) {
  if (Date.now() - SEARCH_DISMISS.t < 700) return;             // that tap only closed the search box and the keyboard
  const h = hitTest(e.point.x, e.point.y);
  if (zone.on && !h) return;                                   // in zone out, tapping empty map does nothing; tapping a vehicle switches to it
  if (zone.on && h && h.type !== "bus" && zone.mode === "follow") { zone.key = h.key; zone.picked = performance.now(); selected = { type: h.type, key: h.key }; openTrainCard(); return; }
  if (h) { if (h.type === "bus") openBus(h.key); else followTrain(h.key); return; }
  const f = map.queryRenderedFeatures([[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]], { layers: ["st-dot", "st-lab-0", "st-lab-1", "st-lab-2", "metra-st", "metra-lab", "bus-stop"].filter(id => map.getLayer(id)) });
  if (f.length) { const p = f[0].properties; if (f[0].source === "st") openStation(p.id); else if (f[0].source === "bstop") openBusStop(p.i); else openMetraStop(p.id); }
  // tapping empty map keeps the card open: only its ✕ closes it
}

/* ---------- trackpad and touch gestures that also work while following ----------
   Trackpad: pinch to zoom, two-finger swipe up/down to tilt and left/right to turn; click-drag pans.
   Mouse wheel: zoom. Touch screens: MapLibre's own pinch, twist and two-finger tilt.
   The follow camera moves the map every frame, which would cancel MapLibre's gestures, so these set the camera directly. */
const PAD = { touches: 0 };
function padGestures() {
  const el = map.getCanvasContainer();
  const isPad = e => e.deltaX !== 0 || (e.wheelDeltaY ? Math.abs(e.wheelDeltaY) === Math.abs(e.deltaY) * 3 : e.deltaMode === 0 && Math.abs(e.deltaY) < 50);
  el.addEventListener("wheel", e => {
    e.preventDefault(); if (RIDE.on) return;
    const r = el.getBoundingClientRect(), around = following && locked ? undefined : map.unproject([e.clientX - r.left, e.clientY - r.top]);
    if (e.ctrlKey) { map.easeTo({ zoom: map.getZoom() - e.deltaY * .012, around, duration: 0 }); return; }                 // pinch
    if (isPad(e)) {
      const db = e.deltaX * .22, dp = e.deltaY * .18;
      if (Math.abs(db) > Math.abs(dp) * .6) { map.setBearing(map.getBearing() + db); if (following) FOLLOW.off += db; }
      if (Math.abs(dp) > Math.abs(db) * .6) { map.setPitch(Math.max(0, Math.min(75, map.getPitch() + dp))); if (following) FOLLOW.userPitch = true; }
      return;
    }
    map.easeTo({ zoom: map.getZoom() - Math.sign(e.deltaY) * .45, around, duration: 180 });                                 // mouse wheel
  }, { passive: false });
  const cnt = e => { PAD.touches = e.touches.length; };
  for (const ev of ["touchstart", "touchend", "touchcancel"]) el.addEventListener(ev, cnt, { passive: true });
}
