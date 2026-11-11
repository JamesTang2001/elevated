/* ===== Elevated v2 — interface: settings panel, cards, search, time bar, shortcuts ===== */
const UI_FONT = getComputedStyle(document.documentElement).getPropertyValue("--f") || "sans-serif";
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const mins = t => Math.max(0, Math.round((t - simT) / 60000));
let tab = null, cardTab = "times";

/* ---------- theme ---------- */
function applyUiTheme() {
  const r = document.documentElement; r.dataset.ui = uiDark() ? "dark" : "light"; r.dataset.translucent = SET.translucent ? "1" : "0"; r.dataset.font = SET.font;
}
prefersDark.addEventListener("change", () => { applyUiTheme(); setMapTheme(); haloCache.clear(); });

/* ---------- toast ---------- */
let toastT = 0;
function toast(msg, ms = 4200) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms); }

/* ---------- clock ---------- */
function updateClock() {
  $("clockT").textContent = hmLong(simT).replace(" ", " ");
  const n = VEH.l.length + VEH.m.length + VEH.x.filter(v => v.type === "amtrak").length, liveNow = liveCurrent() && !LIVE.err;
  $("clockDot").className = "dot" + (liveNow ? " live" : "");
  const day = DOW[new Date(simT).getUTCDay()].slice(0, 3);
  const off = live && (LIVE.offline || (LIVE.on && !liveCurrent()));   // the server stopped or isn't running
  const wl = wxLabel(); $("clockS").textContent = `${liveNow ? "Live" : off ? "Offline · timetable" : live ? "Scheduled" : "Replay · " + day} · ${n} trains${wl ? " · " + wl : ""}`;
}
$("clock").onclick = () => toast((WX.cur ? `${WX_TEXT(WX.cur.code)}, ${Math.round(WX.cur.temp)}°F. ` : "") + (liveCurrent() ? (LIVE.err ? "Live data paused: " + LIVE.err : `L trains are live from CTA Train Tracker (updated ${Math.round((Date.now() - LIVE.t) / 1000)} s ago). Metra and South Shore run on their published timetables${amtrakLive() ? "; Amtrak is live" : ""}.`)
  : LIVE.offline || (LIVE.on && live) ? "Live data is offline, so trains follow the timetable. Start the Elevated server (start.command) for live positions; the map reconnects by itself." : LIVE.on ? "Showing the timetable for the time on the clock. Press Now to return to live positions." : "Positions come from the published timetables of CTA, Metra, Amtrak and the South Shore Line. Run the local server for live data."), 6000);

/* ---------- systems quick filter ---------- */
const SYS_ALL = [...LINES, "metra", "amtrak", "ss", "bus", "boats"];
const SYS_SHOW = { all: SYS_ALL, l: LINES, rail: ["metra", "amtrak", "ss"], bus: ["bus"], boats: ["boats"] };
const SYS = Object.fromEntries(Object.entries(SYS_SHOW).map(([k, show]) => [k, SYS_ALL.filter(x => !show.includes(x))]));
function setSystem(s) {
  SET.hidden = SET.hidden.filter(x => x.startsWith("m:"));
  SET.hidden.push(...SYS[s]); if (s === "bus" && SET.buses === "off") SET.buses = "near";
  saveSet(); refreshTransitPaint(); syncSystemsUI(); if (tab === "labels") renderSettings();
}
function syncSystemsUI() {
  const h = new Set(SET.hidden), cur = Object.keys(SYS).find(k => SYS[k].length === [...h].filter(x => !x.startsWith("m:")).length && SYS[k].every(x => h.has(x))) || "";
  for (const b of $("sysSeg").children) b.setAttribute("aria-pressed", b.dataset.sys === cur);
}
$("nearBtn").onclick = () => nearMe();
$("sysSeg").onclick = e => { const b = e.target.closest("button"); if (b) setSystem(b.dataset.sys); };

/* ---------- settings panel ---------- */
const TITLES = { view: "View", map: "Map", trains: "Vehicles", labels: "Layers", display: "Display" };
const curVal = k => k === "musicMode" ? (SET.music ? (SET.musicStyle || "ambient") : "off") : k === "bldgMode" ? (SET.bldg3d ? SET.seeThrough : "flat") : k === "vehMode" ? (SET.trains3d ? SET.tsize : "flat") : SET[k];
const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button type="button" data-set="${key}" data-val="${v}" aria-pressed="${curVal(key) === v}">${l}</button>`).join("")}</div>`;
const tgl = key => `<button type="button" class="tg" role="switch" data-tog="${key}" aria-checked="${!!SET[key]}"></button>`;
const row = (label, ctl) => `<div class="row"><span>${label}</span>${ctl}</div>`;
const VIEWS = [
  { n: "The Loop", s: "Five lines circling the elevated Loop", c: [-87.6295, 41.8815], z: 15.4, p: 60, b: -24 },
  { n: "Tower 18", s: "Lake and Wells, the busiest junction on the L", c: [-87.6338, 41.8857], z: 16.4, p: 62, b: 35 },
  { n: "Four tracks north", s: "Red, Brown and Purple side by side at Fullerton", c: [-87.6529, 41.9253], z: 15.8, p: 62, b: -70 },
  { n: "Howard", s: "Where the Red, Purple and Yellow lines meet", c: [-87.6729, 42.019], z: 15.4, p: 58, b: 20 },
  { n: "Blue Line, Kennedy median", s: "Trains between the expressway lanes", c: [-87.7123, 41.9384], z: 15.3, p: 60, b: -40 },
  { n: "Union Station approach", s: "Metra fanning out south of Union Station", c: [-87.6392, 41.8722], z: 15.4, p: 60, b: 8 },
];
function renderSettings() {
  const B = $("setBody"); $("setTitle").textContent = TITLES[tab];
  let h = "";
  const note = t => `<div class="note">${t}</div>`;
  if (innerWidth <= 760) h += `<div class="ptabs">${Object.entries(TITLES).map(([k, t]) => `<button type="button" data-ptab="${k}" aria-pressed="${k === tab}">${t}</button>`).join("")}</div>`;   // phones: tabs inside the sheet
  if (tab === "view") {
    h += row("Map angle", seg("mapAngle", [["top", "Top-down"], ["tilt", "Tilted"]]));
    h += row("Follow camera", seg("follow", [["north", "North"], ["behind", "Behind"], ["side", "Side"], ["orbit", "Orbit"]]));
    h += `<button type="button" class="view" id="zoneFromSet"><div><b>Zone out</b><small>Full screen without controls: Follow, Group or Free camera</small></div><span>›</span></button>`;
    h += `<div class="sub">Viewpoints</div>` + VIEWS.map((v, i) => `<button type="button" class="view" data-vp="${i}"><div><b>${esc(v.n)}</b><small>${esc(v.s)}</small></div><span>›</span></button>`).join("");
  } else if (tab === "map") {
    h += row("Map style", seg("mapStyle", [["light", "Light"], ["dark", "Dark"], ["auto", "Auto"]]));
    h += row("Buildings", seg("bldgMode", [["see", "See-through"], ["solid", "Solid"], ["flat", "Flat"]]));
    h += row("Landmarks", tgl("landmarks"));
    h += row("Film locations", tgl("films"));
    h += row("Night lights", tgl("nightLights"));
    h += row("Live weather", tgl("weather"));
    h += row("Sun and moon", tgl("sky"));
    h += row("Traffic", tgl("traffic"));
    h += note("Night lights: lit windows and headlight beams after dark. Sun and moon: their real positions and the sunrise and sunset glow, seen when you tilt toward the horizon. Traffic is simulated and shows when zoomed in.");
  } else if (tab === "trains") {
    h += row("Vehicles", seg("vehMode", [["flat", "Flat"], ["chibi", "Cute"], ["easy", "Easy"], ["real", "True"]]));
    h += row("Markers", `<div class="seg">${[["halo", "Halo"], ["arrows", "Arrows"]].map(([k, l]) => `<button type="button" data-tog="${k}" aria-pressed="${!!SET[k]}">${l}</button>`).join("")}</div>`);
    h += note("Easy widens vehicles when zoomed out; True is real scale.");
    h += row("Rider stories", tgl("stories"));
    h += note("A made-up rider on each train, shown in its card.");
  } else if (tab === "labels") {
    h += row("Track display", seg("track", [["auto", "Auto"], ["faint", "Faded"], ["hidden", "Hidden"]]));
    h += `<div class="sub">L lines</div><div class="chips">${LINES.map(l => `<button type="button" class="chip" data-line="${l}" aria-pressed="${lineOn(l)}"><i class="sw" style="background:${LCOL[l]}"></i>${LNAME[l]}</button>`).join("")}</div>`;
    const chip = (id, col, name) => `<button type="button" class="chip" data-line="${id}" aria-pressed="${lineOn(id)}"><i class="sw" style="background:${col}"></i>${name}</button>`;
    h += `<div class="sub">Rail</div><div class="chips">${chip("metra", "#7a7f87", "Metra")}<button type="button" class="chip more" id="metraMore" aria-expanded="${!!metraOpen}">Lines ${metraOpen ? "‹" : "›"}</button>${chip("amtrak", "#4a77a8", "Amtrak")}${chip("ss", "#e08a2e", "South Shore")}</div>`;
    if (metraOpen) h += `<div class="chips">${M_LINES.map(r => chip("m:" + r, MCOL(r), esc(r))).join("")}</div>`;
    h += `<div class="sub">Boats</div><div class="chips">${chip("boats", "#f2c200", "Water taxi and tours")}</div>` + row("Other ships", tgl("ships"));
    h += `<div class="sub">Buses</div>` + row("Show buses", seg("buses", [["off", "Off"], ["near", "Up close"], ["all", "Always"]]));
  } else if (tab === "display") {
    h += row("Appearance", seg("appearance", [["light", "Light"], ["dark", "Dark"], ["auto", "Auto"]]));
    h += row("Text size", seg("font", [["s", "Small"], ["m", "Standard"], ["l", "Large"]]));
    h += row("Translucent panels", tgl("translucent"));
    h += `<div class="sub">Music</div><div class="row">${seg("musicMode", [["off", "Off"], ["ambient", "Ambient"], ["lofi", "Lo-fi"], ["jazz", "Jazz"], ["drive", "Drive"]])}</div>`;
    h += note("Original music made in your browser, following the time of day. ⏭ beside Zone out switches style.");
    h += row("Performance", seg("perf", [["auto", "Auto"], ["smooth", "Smooth"], ["detailed", "Detailed"]]));
    h += `<div class="note">Auto adapts to this computer. Smooth runs at 30 fps with less detail; Detailed uses full resolution.</div>`;
        h += `<div class="sub">About</div><div class="note" style="padding-top:0">Elevated is a personal project. Its look and feel are inspired by <a class="link" href="https://railisland.tw/" target="_blank" rel="noopener">Rail Island</a> (railisland.tw), the animated map of Taiwan's railways. All code here is original.<br><br>Data: CTA Train Tracker, Bus Tracker and GTFS; Metra, Amtrak and South Shore Line GTFS; live Amtrak via Amtraker; ships via aisstream.io; weather by Open-Meteo.com; Chicago Water Taxi and tour schedules (approximate); City of Chicago Data Portal; map tiles © OpenFreeMap, OpenMapTiles, OpenStreetMap contributors.</div>`;
  }
  B.innerHTML = h;
}
function openSettings(t) {
  if (tab === t && !$("settings").hidden) return closeSettings();
  tab = t; renderSettings(); $("settings").hidden = false;
  for (const b of $("tabs").children) b.setAttribute("aria-pressed", b.dataset.tab === t);
}
function closeSettings() { $("settings").hidden = true; tab = null; for (const b of $("tabs").children) b.setAttribute("aria-pressed", "false"); }
function syncSettingsUI() { if (tab) renderSettings(); }
$("setBtn").onclick = () => $("settings").hidden ? openSettings(tab || "view") : closeSettings();
/* phones: the search box opens from its icon; the card is a bottom sheet whose handle folds it down to its header */
$("search").addEventListener("click", () => { if (innerWidth <= 760 && !document.body.classList.contains("search-open")) { document.body.classList.add("search-open"); closeSettings(); $("q").focus(); } });
new MutationObserver(() => { document.body.classList.toggle("card-open", !$("card").hidden); if ($("card").hidden) $("card").classList.remove("min"); }).observe($("card"), { attributes: true, attributeFilter: ["hidden"] });
$("card").addEventListener("click", e => { if (innerWidth > 760) return; const r = $("card").getBoundingClientRect(); if (e.clientY - r.top < 18) $("card").classList.toggle("min"); }, true);
$("tabs").onclick = e => { const b = e.target.closest("button"); if (b) openSettings(b.dataset.tab); };
$("setClose").onclick = closeSettings;
$("setBody").onclick = e => {
  const s = e.target.closest("[data-set]"), t = e.target.closest("[data-tog]"), c = e.target.closest("[data-line]"), v = e.target.closest("[data-vp]");
  if (s) { let val = s.dataset.val; if (val === "true") val = true; else if (val === "false") val = false; changeSetting(s.dataset.set, val); }
  else if (t) changeSetting(t.dataset.tog, !SET[t.dataset.tog]);
  else if (c) { const id = c.dataset.line; SET.hidden = lineOn(id) ? [...SET.hidden, id] : SET.hidden.filter(x => x !== id); saveSet(); refreshTransitPaint(); syncSystemsUI(); renderSettings(); }
  else if (v) { const p = VIEWS[+v.dataset.vp]; stopFollow(); closePanel(); map.flyTo({ center: p.c, zoom: p.z, pitch: p.p, bearing: p.b, duration: 2600 }); }
  else if (e.target.closest("[data-ptab]")) openSettings(e.target.closest("[data-ptab]").dataset.ptab);
  else if (e.target.closest("#zoneFromSet")) enterZone();
  else if (e.target.closest("[data-vp]")) { const p = VIEWS[+e.target.closest("[data-vp]").dataset.vp]; stopFollow(); closePanel(); if (innerWidth <= 760) closeSettings();
    map.flyTo({ center: p.c, zoom: p.z, pitch: SET.mapAngle === "top" ? 0 : p.p, bearing: p.b, duration: 2600 }); }
  else if (e.target.closest("#metraMore")) { metraOpen = !metraOpen; renderSettings(); }
};
let metraOpen = false;
function changeSetting(k, v) {
  if (k === "musicMode") { SET.music = v !== "off"; if (SET.music) { SET.musicStyle = v; music.on ? music.setStyle(v) : music.start(); } else music.stop(); saveSet(); syncMusicUI(); renderSettings(); return; }
  if (k === "bldgMode") { SET.bldg3d = v !== "flat"; if (v !== "flat") SET.seeThrough = v; k = "bldg3d"; v = SET.bldg3d; }       // one control for building style
  if (k === "vehMode") { SET.trains3d = v !== "flat"; if (v !== "flat") SET.tsize = v; k = "trains3d"; v = SET.trains3d; }     // one control for vehicle look
  SET[k] = v; saveSet();
  if (k === "mapAngle") map.easeTo({ pitch: v === "top" ? 0 : TILT, duration: 700 });
  if (k === "appearance" || k === "translucent" || k === "font") { applyUiTheme(); }
  if (k === "appearance" || k === "mapStyle") { setMapTheme(); haloCache.clear(); }
  if (["track", "seeThrough", "bldg3d", "trains3d", "buses"].includes(k)) refreshTransitPaint();
  if (k === "bldg3d") { if (typeof scheduleEdges === "function") scheduleEdges(); if (T && T.win) T.win.key = ""; scheduleWindows(); }
  if (k === "traffic") { CITY.key = ""; buildCity(); }
  if (k === "nightLights") { if (T && T.win) T.win.key = ""; scheduleWindows(); sync3dTheme(); }
  if (k === "weather") { WX.key = ""; WX.cur = null; applyWeather(); lastLightKey = ""; applyLight(); sync3dTheme(); updateClock(); }
  if (k === "perf") applyPerf();
  if (k === "films") { drawFilms(); if (!v && selected && selected.type === "film") closePanel(); }
  if (k === "landmarks") { excludeLandmarkBuildings(); if (typeof scheduleEdges === "function") scheduleEdges(); map.triggerRepaint(); }
  if (k === "seeThrough" || k === "daylight") { lastLightKey = ""; applyLight(); sync3dTheme(); }
  if (k === "music") v ? music.start() : music.stop();
  renderSettings();
}

/* ---------- map controls ---------- */
$("zin").onclick = () => map.zoomIn(); $("zout").onclick = () => map.zoomOut();
$("homeBtn").onclick = goHome;
const DOWNTOWN = { center: [-87.6295, 41.8815], zoom: 15.2, pitch: 58, bearing: -18 };
function atView(v) { const c = map.getCenter(); return Math.hypot((c.lng - v.center[0]) * KX, c.lat - v.center[1]) * MPD < 400 && Math.abs(map.getZoom() - v.zoom) < .35; }
function goHome() {                                                // first tap: the whole system; tap again (already there): downtown up close
  if (zone.on) exitZone(); stopFollow(); closePanel();
  const v = atView(HOME) ? DOWNTOWN : HOME, top = SET.mapAngle === "top";
  map.flyTo({ center: v.center, zoom: v.zoom, pitch: top ? 0 : v.pitch, bearing: v === HOME || top ? 0 : v.bearing, duration: 1800 });
}
$("compass").onclick = () => {                                     // first tap: north; tap again (already north): tilted ⇄ top-down
  if (Math.abs(map.getBearing()) > 1) { FOLLOW.off = 0; map.easeTo({ bearing: 0, duration: 600 }); return; }
  changeSetting("mapAngle", map.getPitch() > 5 ? "top" : "tilt");
};
function setLockUI() {
  const b = $("lockBtn"); b.hidden = !following || zone.on;
  b.classList.toggle("free", !locked);
  b.innerHTML = locked ? `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>` : "Back to train";
  b.title = locked ? "The map follows the train. Drag the map or click to look around freely." : "Return to the train";
}
$("lockBtn").onclick = () => locked ? unlock() : relock();

/* ---------- left card ---------- */
function closePanel() { selected = null; stopFollow(); $("card").hidden = true; map.easeTo({ padding: { left: 0, top: 0, right: 0, bottom: 0 }, duration: 300 }); }
function openTrainCard() { cardTab = "times"; $("card").hidden = false; refreshPanel(); }
function refreshPanel() {
  if (!selected) return;
  const c = $("card"), keepScroll = c.querySelector(".cb") ? c.querySelector(".cb").scrollTop : 0;
  if (selected.type === "train" || selected.type === "live" || selected.type === "metra" || selected.type === "amtrak" || selected.type === "boat") renderTrain();
  else if (selected.type === "station") renderStation();
  else if (selected.type === "mstop") renderMetraStop();
  else if (selected.type === "bus") renderBus();
  else if (selected.type === "near") renderNear();
  else if (selected.type === "film") renderFilm();
  const cb = c.querySelector(".cb"); if (cb) cb.scrollTop = keepScroll;
}
/* Ride along lives on the card: one button to board; once riding, pick the front or side window right there */
function rideBtn() {
  if (!RIDE.on) return `<button class="btn" type="button" data-act="ride">Ride along</button>`;
  return `<div class="seg ride-seg">${[["front", "Front"], ["side", "Side"]].map(([k, l]) => `<button type="button" data-ridev="${k}" aria-pressed="${SET.rideView === k}">${l}</button>`).join("")}</div><button class="btn pri" type="button" data-act="ride">Leave</button>`;
}
function cardHead(badge, color, title, sub, right) {
  return `<div class="ch"><span class="badge" style="background:${color};color:${isLight(color) ? "#16191d" : "#fff"}">${esc(badge)}</span><div class="tt"><b>${title}</b><span>${sub}</span></div>${right || ""}<button class="x zone-keep" type="button" data-act="close" aria-label="Close">✕</button></div>`;
}
function speedCurve(samples, pos, color) {
  if (!samples.length) return "";
  const vmax = Math.max(...samples, 1), W = 288, H = 60, pts = samples.map((v, i) => `${(i / (samples.length - 1) * W).toFixed(1)},${(H - 4 - v / vmax * (H - 12)).toFixed(1)}`);
  const x = Math.max(0, Math.min(1, pos)) * W;
  return `<svg class="curve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="0,${H} ${pts.join(" ")} ${W},${H}" fill="${color}" fill-opacity=".14" stroke="none"/><polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="1.6"/><line x1="${x}" x2="${x}" y1="0" y2="${H}" stroke="var(--red)" stroke-width="1.2"/></svg><div class="meta"><span>Top ${Math.round(vmax * 2.23694)} mph</span><span>Whole trip</span></div>`;
}
/* ---------- bus transfers at the followed train's next stop (live Bus Tracker predictions) ---------- */
const XF = { key: null, t: 0, data: null, busy: false };
function busRoutesNear(lon, lat, m = 250) {
  const rts = new Set(); for (const s of BSTOPS) if (Math.abs(s[1] - lat) < .003 && Math.hypot((s[0] - lon) * KX, s[1] - lat) * MPD < m) for (const [ri] of s[4]) rts.add(BUS[ri].r);
  return [...rts];
}
function transferBlock(stopName, lon, lat, arrT, selfIds = []) {         // buses (live) plus Metra, South Shore, Amtrak and the water taxi
  const bus = busTransferBlock(stopName, lon, lat, arrT), rail = lon == null ? "" : railTransferBlock(lon, lat, arrT, selfIds);
  return bus || rail ? (bus || `<div class="sub">Transfers at ${esc(stopName)}</div>`) + rail : `<div class="note" style="padding-top:10px">No bus, rail or water-taxi connections close to ${esc(stopName)} right now.</div>`;
}
function busTransferBlock(stopName, lon, lat, arrT) {
  if (!liveCurrent() || !LIVE.busKey || lon == null) return "";
  const key = lon.toFixed(4) + "," + lat.toFixed(4), rts = busRoutesNear(lon, lat);
  if (!rts.length) return "";
  if ((XF.key !== key || Date.now() - XF.t > 60000) && !XF.busy) {
    XF.busy = true; if (XF.key !== key) XF.data = null; XF.key = key;
    liveFetch(`/api/transfers?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&rt=${encodeURIComponent(rts.join(","))}`).then(d => { if (XF.key === key) { XF.data = d; XF.t = Date.now(); } })
      .catch(() => { XF.t = Date.now(); }).finally(() => { XF.busy = false; });
  }
  let h = `<div class="sub">Bus transfers at ${esc(stopName)}</div>`;
  if (!XF.data || XF.key !== key) return h + `<div class="note">Checking the buses at this stop…</div>`;
  if (XF.data.error || XF.data.skipped) return h + `<div class="note">Bus predictions aren't available right now.</div>`;
  const now = chicagoNow(), seen = new Set();
  const rows = (XF.data.prd || []).map(p => { const t = parseBusTime(p.t), walk = 60000 + (p.m || 100) / 80 * 60000; return Object.assign({}, p, { tm: t, ok: t && t >= arrT + walk }); })
    .filter(p => p.tm && p.tm > now - 30000).sort((a, b) => a.tm - b.tm)
    .filter(p => { const k = p.rt + p.dir + (p.ok ? 1 : 0); if (p.ok && seen.has(k)) return false; seen.add(k); return true; })     // first catchable bus per route and direction
    .filter(p => p.ok || p.tm > arrT - 5 * 60000).slice(0, 7);
  if (!rows.length) return h + `<div class="note">No buses predicted at the stops around this station in the next half hour.</div>`;
  h += `<div class="board xf">` + rows.map(p => `<div class="row${p.ok ? "" : " miss"}"><span><b class="rt">${esc(p.rt)}</b>${esc(p.dir.replace("bound", ""))} · ${esc(p.des || "")}<small>${esc(p.stop || "")}${p.m != null ? " · " + Math.max(1, Math.round(p.m / 80)) + " min walk" : ""}</small></span><span class="min">${mins(p.tm) <= 0 ? "Due" : mins(p.tm)}<small>${mins(p.tm) <= 0 ? "" : " min"}</small><em>${p.ok ? "You can catch it" : "Leaves before you arrive"}</em></span></div>`).join("") + `</div>`;
  return h + `<div class="note">"You can catch it" allows a minute to get off plus the walk.</div>`;
}
/* ---------- delay history (logged by the local server from Train Tracker) ---------- */
const HISTORY = { data: null, t: 0 };
function loadHistory() { if (!LIVE.on || Date.now() - HISTORY.t < 30 * 60000) return; HISTORY.t = Date.now(); liveFetch("/api/history").then(d => { if (d && d.days) HISTORY.data = d; }).catch(() => {}); }
function delayBlock(line, color) {
  loadHistory(); const H = HISTORY.data; if (!H) return "";
  const key = Object.keys(LIVE_LINE).find(k => LIVE_LINE[k] === line), pick = o => o && key && (o[key] ?? o[key.toUpperCase()]);   // Train Tracker names: red, blue, brn, G, org, P, pink, Y
  const days = Object.keys(H.days).sort().slice(-30).map(d => [d, pick(H.days[d])]).filter(x => x[1] != null), hours = pick(H.hours);
  if (days.length < 2 && !hours) return "";
  const avg = days.reduce((a, x) => a + x[1], 0) / Math.max(1, days.length), W = 288, Hh = 46, mx = Math.max(.05, ...days.map(x => x[1]), ...(hours || []).filter(x => x != null));
  const bars = (vals, w, lab) => vals.map((v, i) => v == null ? "" : `<rect x="${(i * w + .5).toFixed(1)}" y="${(Hh - 2 - v / mx * (Hh - 6)).toFixed(1)}" width="${Math.max(1, w - 1.5).toFixed(1)}" height="${Math.max(1, v / mx * (Hh - 6)).toFixed(1)}" rx="1" fill="${color}" fill-opacity=".75"><title>${lab(i)}: ${Math.round(v * 100)}% of trains delayed</title></rect>`).join("");
  let h = `<div class="sub">How often the ${LNAME[line]} Line runs late</div><div class="meta" style="padding:0 0 6px"><span>${avg > 0 && avg < .01 ? (avg * 100).toFixed(1) : Math.round(avg * 100)}% of trains flagged delayed, on average</span><span>${days.length} day${days.length === 1 ? "" : "s"} logged</span></div>`;
  if (days.length >= 2) { const w = W / days.length; h += `<svg class="curve" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none">${bars(days.map(x => x[1]), w, i => days[i][0])}</svg><div class="meta"><span>${days[0][0].slice(5)}</span><span>By day</span><span>${days[days.length - 1][0].slice(5)}</span></div>`; }
  if (hours) h += `<svg class="curve" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none">${bars(hours, W / 24, i => (i % 12 || 12) + (i < 12 ? " am" : " pm"))}</svg><div class="meta"><span>Midnight</span><span>By hour of day</span><span>11 pm</span></div>`;
  return h + `<div class="note">Logged by your server from Train Tracker's delay flag.</div>`;
}
/* card tabs: only the ones with something to show; falls back to the first if the chosen one isn't offered */
function cardTabs(ids) {
  const v = findVeh(selected && selected.key), L = { times: "Timetable", speed: "Speed", xfer: "Transfers", delay: "Delays" };
  loadHistory();
  const ok = ids.filter(id => id === "xfer" ? true : id === "delay" ? !!HISTORY.data && v && (v.type === "train" || v.type === "live") : true);
  if (!ok.length) { cardTab = "times"; return ""; }
  if (!ok.includes(cardTab)) cardTab = ok[0];
  return `<div class="ctabs">${ok.map(id => `<button type="button" data-ct="${id}" aria-pressed="${cardTab === id}">${L[id]}</button>`).join("")}</div>`;
}
function renderTrain() {
  const v = findVeh(selected.key), c = $("card");
  if (!v) { c.innerHTML = cardHead("·", "#8b9099", "Trip complete", "This train has finished its run") + `<div class="cb"><div class="acts"><button class="btn pri" type="button" data-act="rand">Follow another train</button></div></div>`; return; }
  let h = "";
  if (v.type === "train") {
    const tr = v.tr, p = tr.prof, st = v.st, started = simT >= tr.dep, cars = (CARS_N[p.route.line] || 6);
    const nextI = st.atStop ? st.idx : st.nextIdx, nxt = p.stops[nextI], arrT = tr.dep + tr.A[nextI] * 1000;
    const total = tr.len, done = Math.max(0, Math.min(total, (p.dir === 0 ? st.along : p.route.length - st.along) - p.stops[tr.i0].d));
    const nmT = trainName(v);
    h += cardHead(tr.run, v.color, `${LNAME[p.route.line]} Line`, `To ${esc(destOf(tr, st.e))} · ${cars} cars${nmT ? " · " + nmT : ""}`, `<div class="spd"><b>${Math.round(st.v * 2.23694)}</b><span> mph</span></div>`);
    h += `<div class="cb"><div class="kv"><span class="k">${st.atStop ? "At" : "Next stop"}</span><span class="k r">${st.atStop ? "Departs" : "Arrives"}</span><span class="v">${esc(nxt.name)}</span><span class="v r">${st.atStop ? hm(tr.dep + tr.D[nextI] * 1000) : hm(arrT)} · ${mins(arrT)} min</span></div>`;
    h += `<div class="bar"><i style="width:${(done / total * 100).toFixed(1)}%;background:${v.color}"></i></div><div class="meta"><span>${esc(p.stops[tr.i0].name)} ${hm(tr.dep)}</span><span>${(done / 1609).toFixed(1)} / ${(total / 1609).toFixed(1)} mi</span><span>${esc(p.stops[tr.i1].name)} ${hm(tr.dep + tr.T * 1000)}</span></div>`;
    h += `<div class="meta" style="padding-top:8px"><span>${started ? (st.atStop ? "● Stopped at station" : "▶ Moving") : "Waiting to depart"} · ${({ elev: "elevated", sub: "subway", grade: "at grade" })[v.kind]}</span><span>Scheduled</span></div>`;
    if (v.type === "train") h += alertHtml(alertsForLine(v.line));
    h += cardTabs(["times", "speed", "xfer", "delay"]);
    if (cardTab === "times") h += `<ol class="stops" style="--c:${v.color}">${p.stops.slice(tr.i0, tr.i1 + 1).map((s, j) => { const i = tr.i0 + j, cls = !started ? "" : i < nextI ? "past" : i === nextI ? "next" : "";
      return `<li class="${cls}"><i></i><span>${esc(s.name)}</span><time>${hm(tr.dep + tr.D[i] * 1000)}</time></li>`; }).join("")}</ol>`;
    else if (cardTab === "xfer") { const S0 = ST[nxt.id]; h += S0 ? transferBlock(nxt.name, S0.lon, S0.lat, arrT) : ""; }
    else if (cardTab === "delay") h += delayBlock(v.line, v.color);
    else { const smp = []; for (let e = 0; e <= tr.T; e += Math.max(10, tr.T / 160)) smp.push(runState(tr.A, tr.D, i => p.stops[i].d, tr.i0, tr.i1, e).v); h += speedCurve(smp, st.e / tr.T, v.color); }
  } else if (v.type === "metra") {
    const t = v.t, P = t.P, st = v.st, nm = s => METRA.stops[s] ? METRA.stops[s][0] : s, nextI = st.atStop ? st.idx : st.nextIdx, arrT = t.dep + P.D[nextI] * 1000;
    const agName = v.ag === "amtrak" ? `Amtrak ${esc(MNAME(P.rid))}` : v.ag === "ss" ? esc(MNAME(P.rid)) : `Metra ${esc(MNAME(P.rid))}`;
    const nmM = trainName(v);
    h += cardHead(t.num, v.color, agName, `To ${esc(P.head || nm(P.stops[P.n - 1]))}${nmM ? " · " + nmM : ""}`, `<div class="spd"><b>${Math.round(st.v * 2.23694)}</b><span> mph</span></div>`);
    h += `<div class="cb"><div class="kv"><span class="k">${st.atStop ? "At" : "Next stop"}</span><span class="k r">Time</span><span class="v">${esc(nm(P.stops[nextI]))}</span><span class="v r">${hm(arrT)} · ${mins(arrT)} min</span></div>`;
    h += `<div class="bar"><i style="width:${(st.d / Math.max(1, P.ds[P.n - 1]) * 100).toFixed(1)}%;background:${v.color}"></i></div><div class="meta"><span>${esc(nm(P.stops[0]))} ${hm(t.dep)}</span><span>${esc(nm(P.stops[P.n - 1]))} ${hm(t.dep + P.T * 1000)}</span></div>`;
    h += cardTabs(["times", "speed", "xfer", "delay"]);
    if (cardTab === "times") h += `<ol class="stops" style="--c:${v.color}">${P.stops.map((s, i) => `<li class="${i < nextI ? "past" : i === nextI ? "next" : ""}"><i></i><span>${esc(nm(s))}</span><time>${hm(t.dep + P.D[i] * 1000)}</time></li>`).join("")}</ol>`;
    else if (cardTab === "xfer") { const S0 = METRA.stops[P.stops[nextI]]; h += S0 ? transferBlock(S0[0], S0[1], S0[2], arrT, Object.keys(METRA.stops).filter(k => Math.hypot((METRA.stops[k][1] - S0[1]) * KX, METRA.stops[k][2] - S0[2]) * MPD < 80)) : ""; }
    else { const smp = []; for (let e = 0; e <= P.T; e += Math.max(10, P.T / 160)) smp.push(runState(P.A, P.D, i => P.ds[i], 0, P.n - 1, e).v); h += speedCurve(smp, st.e / P.T, v.color); }
  } else if (v.type === "amtrak") {
    const r = v.a.raw, eta = r.eta ? Date.parse(r.eta) : null, sch = r.sch ? Date.parse(r.sch) : null, late = eta && sch ? Math.round((eta - sch) / 60000) : null, m = eta ? Math.round((eta - Date.now()) / 60000) : null;
    h += cardHead(r.num, v.color, `Amtrak ${esc(r.route || "")}`, `To ${esc(r.dest || "")} · live`, `<div class="spd"><b>${Math.round(+r.mph || 0)}</b><span> mph</span></div>`);
    h += `<div class="cb"><div class="kv"><span class="k">Next stop</span><span class="k r">Arrives</span><span class="v">${esc(r.next || "–")}</span><span class="v r">${m === null ? "–" : m <= 0 ? "Due" : m + " min"}</span></div>`;
    h += `<div class="meta" style="padding-top:6px"><span style="color:${late > 5 ? "var(--red)" : "inherit"}">${late === null ? "" : late > 5 ? late + " min late" : "On time"}</span><span>From ${esc(r.orig || "")}</span></div>`;
    h += `<div class="note">Live position from Amtrak's train map (via Amtraker), reported ${Math.round((Date.now() - v.a.ts) / 60000)} min ago. Between reports the train glides along the track at its last speed.</div>`;
  } else if (v.type === "boat") {
    if (v.ship) { const x = v.ship, KIND = { shippass: "Passenger vessel", cargo: "Cargo ship", tug: "Tug", small: "Boat", patrol: "Patrol boat" };
      h += cardHead("⛴", v.color, esc(x.name || "Ship"), `${KIND[v.kind] || "Vessel"} · live`, `<div class="spd"><b>${Math.round((+x.sog || 0) * 1.15078)}</b><span> mph</span></div>`);
      h += `<div class="cb"><div class="meta"><span>${x.len ? Math.round(x.len * 3.281) + " ft long" : ""}</span><span>MMSI ${esc(x.mmsi)}</span></div><div class="note">Live position from ship AIS broadcasts, via aisstream.io. Coverage on the river is patchy, so some boats come and go.</div>`;
    } else if (v.kind === "taxi") { const tr = v.trip, nx = tr.dir === "Southbound" ? (v.d < WT_STOPS[1][1] ? WT_STOPS[1] : WT_STOPS[2]) : (v.d > WT_STOPS[1][1] + 5 ? WT_STOPS[1] : WT_STOPS[0]);
      h += cardHead("WT", v.color, "Chicago Water Taxi", `${tr.dir} · to ${esc(tr.to)}`);
      h += `<div class="cb"><div class="kv"><span class="k">Next stop</span><span class="k r">Left ${tr.dir === "Southbound" ? "Michigan Ave" : tr.legs[0][0] > WT_STOPS[1][1] + 5 ? "Chinatown" : "Ogilvie"}</span><span class="v">${esc(nx[0])}</span><span class="v r">${hm(tr.t0)}</span></div>`;
      h += `<div class="note">Michigan Ave · Ogilvie / Union Station · Chinatown. Position estimated from the water taxi's usual schedule, which runs about every 30 to 40 minutes in season (March to December). Check the operator's schedule before you ride.</div>`;
    } else { h += cardHead("Tour", v.color, "Architecture river tour", "90-minute loop · estimated");
      h += `<div class="cb"><div class="bar"><i style="width:${(v.d / TOUR_PATH.L * 100).toFixed(1)}%;background:${v.color}"></i></div><div class="meta"><span>Left ${hm(v.trip.t0)}</span><span>Back ${hm(v.trip.t0 + v.trip.T)}</span></div>`;
      h += `<div class="note">Up the North Branch, down the South Branch past Willis Tower, then out to the lake. Position estimated from typical hourly departures in season (mid-April to November); several companies run tours.</div>`; }
  } else {
    const t = v.t, m = t.arr ? Math.round((t.arr - chicagoNow()) / 60000) : null;
    const nmL = trainName(v);
    h += cardHead(t.rn, v.color, `${LNAME[t.line]} Line`, `To ${esc(t.dest || "")} · live${nmL ? " · " + nmL : ""}`);
    h += `<div class="cb"><div class="kv"><span class="k">${t.app ? "Arriving at" : "Next stop"}</span><span class="k r">Arrives</span><span class="v">${esc(t.next || "–")}</span><span class="v r">${m === null ? "–" : m <= 0 ? "Due" : m + " min"}</span></div>`;
    h += `<div class="meta" style="padding-top:6px"><span style="color:${t.dly ? "var(--red)" : "inherit"}">${t.dly ? "Delayed" : "On time"} · ${({ elev: "elevated", sub: "subway", grade: "at grade" })[v.kind]}</span><span>Run ${esc(t.rn)}</span></div>`;
    h += alertHtml(alertsForLine(v.line));
    h += cardTabs(["xfer", "delay"]);
    if (cardTab === "xfer") { const S0 = t.nextId && ST[t.nextId]; if (S0) h += transferBlock(t.next || S0.name, S0.lon, S0.lat, t.arr || chicagoNow()); }
    else if (cardTab === "delay") h += delayBlock(v.line, v.color);
    h += `<div class="note">Live position from CTA Train Tracker, updated ${Math.round((Date.now() - LIVE.t) / 1000)} s ago. Between updates the train glides along the track.</div>`;
  }
  { const story = riderStory(v); if (story) h += `<div class="story">${esc(story)}</div>`; }
  h += `<div class="acts zone-keep">${rideBtn()}<button class="btn" type="button" data-act="rand">${v.type === "boat" ? "Follow a train" : v.type === "bus" ? "Switch bus" : "Switch train"}</button></div></div>`;
  c.innerHTML = h;
}
function arrivalsAt(id) {
  const out = [];
  if (liveCurrent()) for (const t of LIVE.trains) if (t.nextId === id) out.push({ line: t.line, dest: t.dest, t: t.arr ? t.arr + (simT - chicagoNow()) : simT, key: t.key, live: true });
  if (!out.length) for (const prof of PROFILES) for (const ts of tripsAround(prof, simT)) for (const tr of ts) {
    const i = prof.stops.findIndex(s => s.id === id); if (i < tr.i0 || i >= tr.i1) continue;
    const tm = tr.dep + tr.D[i] * 1000; if (tm >= simT - 20000 && tm < simT + 50 * 60000) out.push({ line: prof.route.line, dest: destOf(tr, tr.D[i] + 1), t: tm, key: trainKey(tr) });
  }
  return out.sort((a, b) => a.t - b.t).slice(0, 10);
}
function openStation(id) { stopFollow(); selected = { type: "station", id }; $("card").hidden = false; refreshPanel(); const s = ST[id]; map.easeTo({ center: [s.lon, s.lat], zoom: Math.max(map.getZoom(), 14.5), duration: 700, padding: panelPadding() }); }
function renderStation() {
  const s = ST[selected.id], rows = bestArrivals(selected.id).slice(0, 10), star = isStarred(selected.id);
  let h = cardHead("L", "#1c2026", esc(s.name), s.kinds.map(k => ({ elev: "Elevated", sub: "Subway", grade: "At grade" })[k]).join(" · ") + (s.ada ? " · ♿ Accessible" : ""), `<button type="button" class="star${star ? " on" : ""}" data-act="star" aria-label="${star ? "Unstar" : "Star"} this station" title="${star ? "Starred" : "Star this station"}">${star ? "★" : "☆"}</button>`);
  h += `<div class="cb"><div class="lines">${s.lines.map(l => `<span style="background:${LCOL[l]};color:${dk(l) ? "#16191d" : "#fff"}">${LNAME[l]}</span>`).join("")}</div>`;
  h += alertHtml([...new Set(alertsForStation(selected.id).concat(s.lines.flatMap(l => ALERTS.list.filter(a => a.L.includes(l) && (a.major || a.sev >= 40)))))]);
  h += `<div class="sub">${rows.some(r => r.live) ? "Live arrivals" : "Next trains"}</div><div class="board">${rows.length ? rows.map(r => `<div class="row" data-follow="${esc(r.key)}"><span><i class="sw" style="display:inline-block;background:${LCOL[r.line]};margin-right:8px"></i>${esc(r.dest)}</span><span class="min">${mins(r.t) <= 0 ? "Due" : mins(r.t)}<small>${mins(r.t) <= 0 ? "" : " min"}</small></span></div>`).join("") : `<div class="note">No trains in the next 50 minutes.</div>`}</div>`;
  h += `<div class="note">Tap a row to follow that train.</div></div>`;
  $("card").innerHTML = h;
}
function openMetraStop(id) { stopFollow(); selected = { type: "mstop", id }; $("card").hidden = false; refreshPanel(); const [, lon, lat] = METRA.stops[id]; map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 14), duration: 700, padding: panelPadding() }); }
function renderMetraStop() {
  const id = selected.id, [name, lon0, lat0, ag0] = METRA.stops[id];
  const ids = Object.keys(METRA.stops).filter(k => { const q = METRA.stops[k]; return k === id || Math.hypot((q[1] - lon0) * KX, q[2] - lat0) * MPD < 250; });   // same station, other railroads
  const rows = ids.flatMap(k => metraDepartures(k, 120)).filter(r => agOn(MAG(r.t.P.rid))).sort((a, b) => a.tm - b.tm).slice(0, 8);
  const lines = [...new Set(M_PAT.filter(P => ids.some(k => P.stops.includes(k))).map(P => P.rid))];
  const ags = [...new Set(lines.map(MAG))], AGN = { metra: "Metra", ss: "South Shore Line", amtrak: "Amtrak" };
  let h = cardHead(ag0 === "amtrak" ? "A" : ag0 === "ss" ? "S" : "M", "#3d4450", esc(name), ags.map(a => AGN[a]).join(" · ") + " station");
  h += `<div class="cb"><div class="lines">${lines.map(r => `<span style="background:${MCOL(r)}">${esc(MNAME(r))}</span>`).join("")}</div><div class="sub">Departures</div><div class="board">`;
  h += rows.length ? rows.map(r => `<div class="row" data-follow="${esc(metraKey(r.t))}"><span><i class="sw" style="display:inline-block;background:${MCOL(r.t.P.rid)};margin-right:8px"></i>${esc(r.t.P.head || "")} <small style="color:var(--ink3)">${MAG(r.t.P.rid) === "amtrak" ? "Amtrak " : ""}#${r.t.num}</small></span><span class="min">${mins(r.tm) <= 0 ? "Due" : mins(r.tm)}<small>${mins(r.tm) <= 0 ? "" : " min"}</small></span></div>`).join("") : `<div class="note">No trains in the next two hours.</div>`;
  $("card").innerHTML = h + `</div><div class="note">Scheduled times from each railroad's published timetable.</div></div>`;
}
function openBus(key) { followTrain(key); }
function renderBus() {
  const b = liveBusList().find(x => x.key === selected.key);
  if (!b) { $("card").innerHTML = cardHead("Bus", "#3a77a8", "Bus", "This bus left the map") + `<div class="cb"></div>`; return; }
  let h; const nm = trainName({ type: "bus", b, key: selected.key }), st = riderStory({ type: "bus", b, key: selected.key }), nmS = nm ? " · " + nm : "";
  if (b.live) { const x = b.b; h = cardHead(x.rt, "#3a77a8", `Route ${esc(x.rt)}`, `To ${esc(x.des || "")} · live${nmS}`) + `<div class="cb">${alertHtml(alertsForBus(x.rt))}<div class="meta"><span style="color:${x.dly ? "var(--red)" : "inherit"}">${x.dly ? "Delayed" : "On time"}</span><span>Bus ${esc(x.vid)}</span></div><div class="note">Live position from CTA Bus Tracker, refreshed every minute.</div></div>`; }
  else { const R = BUS[b.sb.ri]; h = cardHead(R.r, "#3a77a8", esc(R.n), `${esc(busDirName(b.sb))} · estimated${nmS}`) + `<div class="cb"><div class="note">Estimated from this route's typical frequency. Live bus positions appear when the local server is running at the current time.</div></div>`; }
  h = h.replace(/<\/div>$/, "") + (st ? `<div class="story">${esc(st)}</div>` : "") + `<div class="acts zone-keep">${rideBtn()}<button class="btn" type="button" data-act="rand">Switch bus</button></div></div>`;
  $("card").innerHTML = h;
}
$("card").onclick = e => {
  const a = e.target.closest("[data-act]"), f = e.target.closest("[data-follow]"), ct = e.target.closest("[data-ct]");
  if (a && a.dataset.act === "close") { if (zone.on) exitZone(); closePanel(); }
  else if (e.target.closest("[data-ridev]")) { SET.rideView = e.target.closest("[data-ridev]").dataset.ridev; saveSet(); RIDE.bearing = null; refreshPanel(); }
  else if (a && a.dataset.act === "star") toggleStar(selected.id);
  else if (a && a.dataset.act === "ride") { RIDE.on ? exitRide() : enterRide(); refreshPanel(); }
  else if (a && a.dataset.act === "rand") { if (zone.on) pickZoneTrain(); else randomFollow(); }
  else if (f) followTrain(f.dataset.follow);
  else if (e.target.closest("[data-station]")) openStation(e.target.closest("[data-station]").dataset.station);
  else if (e.target.closest("[data-mstop]")) openMetraStop(e.target.closest("[data-mstop]").dataset.mstop);
  else if (ct) { cardTab = ct.dataset.ct; refreshPanel(); }
};

/* timetables carry an end date; warn a week ahead so they can be refreshed */
function checkTimetables() {
  const soon = Object.entries(TT_UNTIL).filter(([, d]) => d && Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)) - chicagoNow() < 7 * DAY);
  if (soon.length) toast(`The ${soon.map(([n]) => n).join(" and ")} timetable${soon.length > 1 ? "s run" : " runs"} out on ${soon.map(([, d]) => +d.slice(4, 6) + "/" + +d.slice(6, 8)).join(", ")}. Ask Claude to refresh ${soon.length > 1 ? "them" : "it"}.`, 9000);
}
/* ---------- search ---------- */
function searchIndex() {
  const idx = [];
  for (const id of ST_IDS) idx.push({ k: "st", id, name: ST[id].name, sub: ST[id].lines.map(l => LNAME[l]).join(" · "), color: LCOL[ST[id].lines[0]] });
  for (const [id, [name, , , ag]] of Object.entries(METRA.stops)) idx.push({ k: "ms", id, name, sub: ({ metra: "Metra", ss: "South Shore Line", amtrak: "Amtrak" })[ag] || "Metra", color: "#7a7f87" });
  for (const l of LINES) idx.push({ k: "line", id: l, name: LNAME[l] + " Line", sub: "L line", color: LCOL[l] });
  for (const r of M_LINES) idx.push({ k: "mline", id: r, name: "Metra " + MNAME(r), sub: r, color: MCOL(r) });
  for (const lm of LANDMARKS) idx.push({ k: "lm", id: lm.id, name: lm.name, sub: "Landmark", color: "#8b9099" });
  FILMS.forEach((f, i) => idx.push({ k: "film", id: i, name: f[0], sub: "Film location · " + f[3].map(x => x[0]).join(", "), color: "#3d4450" }));
  VIEWS.forEach((v, i) => idx.push({ k: "vp", id: i, name: v.n, sub: "Viewpoint · " + v.s, color: "#6b7480" }));
  BUS.forEach((R, ri) => idx.push({ k: "bus", id: ri, name: `${R.r} ${R.n}`, sub: "Bus route", color: "#3a77a8" }));
  return idx;
}
let SIDX = null, resSel = 0, resList = [];
$("q").addEventListener("focus", () => { if (!$("q").value.trim()) renderHome(); });
document.addEventListener("pointerdown", e => { if (!e.target.closest("#search")) { $("results").hidden = true; homeEditing = null; } });
$("q").addEventListener("input", () => {
  const q = $("q").value.trim().toLowerCase(), box = $("results");
  if (!q) { renderHome(); return; }
  SIDX = SIDX || searchIndex();
  const AGT = { metra: "Metra train", ss: "South Shore train", amtrak: "Amtrak train" };
  const trains = VEH.l.concat(VEH.m, VEH.x.filter(v => v.type === "amtrak")).filter(v => v.label.toLowerCase() === q).map(v => ({ k: "veh", id: v.key, name: `${v.ag ? AGT[v.ag] : "Run"} ${v.label}`, sub: v.type === "amtrak" ? v.a.raw.route : v.type === "metra" ? MNAME(v.line) : LNAME[v.line] + " Line", color: v.color }));
  resList = trains.concat(SIDX.filter(x => x.name.toLowerCase().includes(q)).sort((a, b) => a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q))).slice(0, 12);
  resSel = 0; box.hidden = !resList.length;
  box.innerHTML = resList.map((r, i) => `<button type="button" class="res${i ? "" : " on"}" data-i="${i}"><i class="sw" style="background:${r.color}"></i><span>${esc(r.name)}</span><small>${esc(r.sub)}</small></button>`).join("");
});
$("q").addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { resSel = (resSel + (e.key === "ArrowDown" ? 1 : -1) + resList.length) % resList.length; [...$("results").children].forEach((b, i) => b.classList.toggle("on", i === resSel)); e.preventDefault(); }
  if (e.key === "Enter" && resList[resSel]) pick(resList[resSel]);
  if (e.key === "Escape") { $("q").value = ""; $("results").hidden = true; $("q").blur(); }
});
$("results").onclick = e => { if (homeClick(e)) return; const b = e.target.closest(".res"); if (b) pick(resList[+b.dataset.i]); };
$("results").addEventListener("submit", e => { if (e.target.id === "hForm") homeSubmit(e); });
function pick(r) {
  $("results").hidden = true; $("q").blur();
  if (r.k === "st") openStation(r.id);
  else if (r.k === "ms") openMetraStop(r.id);
  else if (r.k === "veh") followTrain(r.id);
  else if (r.k === "vp") { const p = VIEWS[r.id]; stopFollow(); closePanel(); map.flyTo({ center: p.c, zoom: p.z, pitch: p.p, bearing: p.b, duration: 2600 }); }
  else if (r.k === "film") { if (!SET.films) { SET.films = true; saveSet(); drawFilms(); } openFilm(r.id); }
  else if (r.k === "lm") { const lm = LANDMARKS.find(x => x.id === r.id); stopFollow(); map.flyTo({ center: [lm.lon, lm.lat], zoom: lm.id === "bean" ? 17.6 : 15.6, pitch: 62, bearing: map.getBearing() - 30, duration: 2600 }); toast("Looking at " + lm.name + ". Models show the overall shape, not exact architecture.", 3500); }
  else if (r.k === "line" || r.k === "mline" || r.k === "bus") {
    const coords = r.k === "line" ? ROUTES.filter(x => x.line === r.id).flatMap(x => x.coords) : r.k === "mline" ? M_PAT.filter(P => P.rid === r.id).flatMap(P => METRA.shapes[P.si].c) : BUS[r.id].c;
    const b = coords.reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[0]), Math.max(a[3], c[1])], [180, 90, -180, -90]);
    stopFollow(); closePanel(); map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 80, pitch: 0, bearing: 0, duration: 1600 });
    if (r.k !== "bus") { SET.hidden = SET.hidden.filter(x => x !== r.id && x !== (r.k === "mline" ? "m:" + r.id : r.id)); if (r.k === "mline") SET.hidden = SET.hidden.filter(x => x !== "metra"); saveSet(); refreshTransitPaint(); }
  }
}

/* ---------- time bar ---------- */
function setSpeedIdx(i) { speed = SPEEDS[i]; $("spd").value = i; $("speedVal").textContent = speed + "×"; if (speed !== 1) live = false; }
$("spd").oninput = e => setSpeedIdx(+e.target.value);
function syncPlay() { $("play").innerHTML = playing ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1.5" width="3.6" height="11" rx="1"/><rect x="8.4" y="1.5" width="3.6" height="11" rx="1"/></svg>` : `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9.5-5.5z"/></svg>`; }
$("play").onclick = () => { playing = !playing; if (!playing) live = false; syncPlay(); };
$("nowBtn").onclick = goNow;
function goNow() { simT = chicagoNow(); live = true; playing = true; setSpeedIdx(0); syncPlay(); updateClock(); }
function jump(ms) { simT += ms; live = false; updateClock(); }
let dayBins = null, dayKey = -1;
function drawDay() {
  const d0 = Math.floor(simT / DAY) * DAY;
  if (dayKey !== d0) { dayKey = d0; dayBins = new Array(96).fill(0);
    for (const prof of PROFILES) for (const ts of tripsAround(prof, d0 + DAY / 2)) for (const tr of ts) { const a = Math.max(0, Math.floor((tr.dep - d0) / 900000)), b = Math.min(95, Math.floor((tr.dep + tr.T * 1000 - d0) / 900000)); for (let i = a; i <= b; i++) dayBins[i]++; } }
  const mx = Math.max(...dayBins, 1), cur = (simT - d0) / DAY * 170;
  $("day").innerHTML = dayBins.map((n, i) => `<rect x="${(i * 170 / 96).toFixed(2)}" y="${(32 - n / mx * 26).toFixed(1)}" width="${(170 / 96 - .4).toFixed(2)}" height="${(n / mx * 26).toFixed(1)}" fill="var(--ink3)" opacity=".45"/>`).join("") + `<rect x="${cur - 1}" y="2" width="2" height="30" fill="var(--red)" rx="1"/>`;
}
$("day").onclick = e => { const r = $("day").getBoundingClientRect(), f = (e.clientX - r.left) / r.width; simT = Math.floor(simT / DAY) * DAY + f * DAY; live = false; updateClock(); drawDay(); };
setInterval(drawDay, 5000);
$("randBtn").onclick = randomFollow;
$("shareBtn").onclick = () => {
  const c = map.getCenter(), h = `#@${c.lng.toFixed(5)},${c.lat.toFixed(5)},${map.getZoom().toFixed(2)},${map.getBearing().toFixed(0)},${map.getPitch().toFixed(0)}` + (following && selected ? `&f=${encodeURIComponent(selected.key)}` : "") + (live ? "" : `&t=${simT}`);
  const url = location.href.split("#")[0] + h; history.replaceState(null, "", h);
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast("Link copied: this view, time and train."), () => toast("Link is in the address bar."));
};
$("aboutBtn").onclick = () => openSettings("display");
$("zoneBtn").onclick = () => zone.on ? exitZone() : enterZone();
$("zoneExit").onclick = exitZone;
$("zoneBar").onclick = e => { const b = e.target.closest("[data-zm]"); if (b) setZoneMode(b.dataset.zm); };
const CAMS = ["north", "behind", "side", "orbit"], CAM_L = { north: "North", behind: "Behind", side: "Side", orbit: "Orbit" };
$("zCam").onclick = () => { SET.follow = CAMS[(CAMS.indexOf(SET.follow) + 1) % 4]; saveSet(); syncZoneUI(); };
$("zAngle").onclick = () => { changeSetting("mapAngle", SET.mapAngle === "top" ? "tilt" : "top"); syncZoneUI(); };
$("zCard").onclick = () => { zone.card = !zone.card; save("v2zonecard", zone.card); syncZoneUI(); };
function syncZoneUI() { $("zoneBtn").textContent = zone.on ? "Leave zone out" : "Zone out"; for (const b of $("zoneBar").querySelectorAll("[data-zm]")) b.setAttribute("aria-pressed", b.dataset.zm === zone.mode);
  $("zCam").textContent = "Camera: " + CAM_L[SET.follow]; $("zCam").hidden = zone.mode === "group"; $("zAngle").textContent = SET.mapAngle === "top" ? "Top-down" : "Tilted";
  $("zCard").textContent = zone.card ? "Hide card" : "Show card"; document.body.classList.toggle("zone-nocard", !zone.card); setLockUI(); syncMusicUI(); }
function syncMusicUI() { $("music").hidden = !(SET.music || zone.on); $("musicBtn").classList.toggle("on", music.on); }
$("musicBtn").onclick = () => { if (music.on) { music.stop(); } else { music.start(); } SET.music = music.on; saveSet(); syncSettingsUI(); };
$("skipBtn").onclick = () => music.skip();

/* ---------- keyboard ---------- */
addEventListener("keydown", e => {
  if (e.target.closest("input")) return;
  if (e.key === " ") { e.preventDefault(); $("play").click(); }
  else if (e.key >= "1" && e.key <= "4") setSpeedIdx([0, 5, 8, 11][+e.key - 1]);
  else if (e.key === "ArrowLeft") jump(-600000); else if (e.key === "ArrowRight") jump(600000);
  else if (e.key === "f" || e.key === "F") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
  else if (e.key === "z" || e.key === "Z") $("zoneBtn").click();
  else if (e.key === "Escape") { if (RIDE.on) { exitRide(); refreshPanel(); } else if (zone.on) exitZone(); else if (!$("settings").hidden) closeSettings(); else closePanel(); }
  else if (e.key === "/") { e.preventDefault(); $("q").focus(); }
  else if (e.key === "h" || e.key === "H") goHome();
});

/* ---------- compass follows the map ---------- */
let compassDir = "";
function syncCompass() { const b = map.getBearing(); $("compass").firstElementChild.style.transform = `rotate(${-b}deg)`;
  const d = Math.abs(b) <= 1 ? (map.getPitch() > 5 ? "2D" : "3D") : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((((b % 360) + 360) % 360) / 45) % 8]; if (d !== compassDir) {
    $("compass").title = Math.abs(b) <= 1 ? (map.getPitch() > 5 ? "Tap for the top-down view" : "Tap for the tilted view") : "Tap to face north"; compassDir = d; $("compass").lastElementChild.textContent = d; } }

/* ---------- start ---------- */
function start() {
  applyUiTheme(); buildMap(); drawSpots(); drawFilms(); syncPlay(); setSpeedIdx(0); syncSystemsUI(); syncZoneUI();
  map.on("render", () => { drawOverlay(); syncCompass(); });
  map.on("load", () => { startQuality(); setTimeout(() => $("loading").classList.add("gone"), 400); setTimeout(checkTimetables, 4000);
    const m = /#@([-\d.]+),([-\d.]+),([\d.]+),(-?\d+),(\d+)(?:&f=([^&]+))?(?:&t=(\d+))?/.exec(location.hash);
    if (m) { map.jumpTo({ center: [+m[1], +m[2]], zoom: +m[3], bearing: +m[4], pitch: +m[5] }); if (m[7]) { simT = +m[7]; live = false; } if (m[6]) setTimeout(() => followTrain(decodeURIComponent(m[6])), 600); }
  });
  SUN = sunPos(); drawDay(); updateClock(); liveBoot(); requestAnimationFrame(tick);
}
start();
