/* ===== Elevated v2 — vehicles (scheduled + live), animation loop, follow camera ===== */
let VEH = { l: [], m: [], x: [] }, metraNow = [], selected = null, following = false, locked = true;

/* ---------- live data from the local Elevated server ---------- */
const LIVE = { on: false, trains: [], t: 0, buses: null, busT: 0, err: null };
const LIVE_LINE = { red: "red", blue: "blue", brn: "brn", g: "g", org: "o", p: "p", pink: "pnk", y: "y" };
const liveCurrent = () => LIVE.on && Date.now() - LIVE.t < 60000 && Math.abs(simT - chicagoNow()) < 90000;   // stale data (server stopped) falls back to the timetable
/* Train Tracker JSON times look like 2026-11-10T00:07:41 */
function parseCtaTime(s) { const m = /^(\d{4})-?(\d\d)-?(\d\d)[ T](\d\d):(\d\d):(\d\d)$/.exec(s || ""); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null; }
async function liveFetch(path) { const r = await fetch(path, { cache: "no-store" }); if (!r.ok) throw new Error(path + " " + r.status); return r.json(); }
async function liveBoot() {
  if (!/^https?:$/.test(location.protocol)) return;                 // the home server, phone mode on Wi-Fi, or the hosted site

  let st; try { st = await liveFetch("/api/status"); } catch (e) { LIVE.offline = true; updateClock(); setTimeout(liveBoot, 30000); return; }   // server not running: show the timetable, keep trying
  LIVE.offline = false;
  if (!st.keys || !st.keys.CTA_TRAIN_KEY) { if (!st.hosted) toast("Add CTA_TRAIN_KEY to keys.env, then restart the server"); return; }
  LIVE.on = true; LIVE.busKey = !!st.keys.CTA_BUS_KEY; updateClock();
  pollTrains(); setInterval(pollTrains, 15000);
  if (LIVE.busKey) { pollBuses(); setInterval(pollBuses, 30000); setInterval(pollNearBuses, 45000); setTimeout(pollNearBuses, 8000); }
  pollAmtrak(); setInterval(pollAmtrak, 60000);
  pollAlerts(); setInterval(pollAlerts, 180000);
  if (st.keys.AISSTREAM_KEY) { setTimeout(pollShips, 4000); setInterval(pollShips, 20000); }
}
const ROUTES_BY_LINE = {}; for (const r of ROUTES) (ROUTES_BY_LINE[r.line] = ROUTES_BY_LINE[r.line] || []).push(r);
function projectToLine(line, lon, lat) {                    // nearest point on any of the line's routes → route + distance along it
  let best = null;
  for (const r of ROUTES_BY_LINE[line] || []) {
    const c = r.coords;
    for (let i = 0; i < c.length - 1; i++) {
      const ax = c[i][0] * KX, ay = c[i][1], bx = c[i + 1][0] * KX, by = c[i + 1][1], px = lon * KX, py = lat;
      const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1e-12; let f = ((px - ax) * vx + (py - ay) * vy) / L2; f = Math.max(0, Math.min(1, f));
      const dx = ax + vx * f - px, dy = ay + vy * f - py, dd = dx * dx + dy * dy;
      if (!best || dd < best.dd) best = { dd, r, d: r.cum[i] + (r.cum[i + 1] - r.cum[i]) * f, tx: vx, ty: vy };
    }
  }
  if (!best || Math.sqrt(best.dd) * MPD > 300) return null;
  return best;
}
async function pollTrains() {
  try {
    const d = await liveFetch("/api/trains"); if (d.error) throw new Error(d.error);
    const now = performance.now(), old = new Map(LIVE.trains.map(t => [t.key, t])), out = [];
    for (const r of (d.ctatt && d.ctatt.route) || []) {
      const line = LIVE_LINE[(r["@name"] || "").toLowerCase()]; if (!line) continue;
      let ts = r.train || []; if (!Array.isArray(ts)) ts = [ts];
      for (const t of ts) {
        const lat = +t.lat, lon = +t.lon; if (!lat || !lon) continue;
        const pr = projectToLine(line, lon, lat), key = "live:" + line + ":" + t.rn, prev = old.get(key);
        const hd = (+t.heading || 0) * RAD, hx = Math.sin(hd), hy = Math.cos(hd);   // heading: degrees from north
        const sgn = pr ? ((pr.tx * hx + pr.ty * hy) >= 0 ? 1 : -1) : 1;
        const sameRoute = prev && pr && prev.r === pr.r && Math.abs(prev.cur() - pr.d) < 2500;
        out.push({ key, rn: t.rn, line, dest: t.destNm, next: t.nextStaNm, nextId: t.nextStaId, arr: parseCtaTime(t.arrT), app: t.isApp === "1", dly: t.isDly === "1",
          r: pr && pr.r, d1: pr ? pr.d : 0, d0: sameRoute ? prev.cur() : (pr ? pr.d : 0), sgn, lon, lat, t0: now,
          cur() { const f = Math.min(1, (performance.now() - this.t0) / 15000); return this.d0 + (this.d1 - this.d0) * f; } });
      }
    }
    LIVE.trains = out; LIVE.t = Date.now(); LIVE.err = null;
  } catch (e) { LIVE.err = e.message; }
}
/* ---------- live buses: move along the real street path between reports ----------
   Bus Tracker reports each bus's pattern (pid) and distance along it (pdist, feet), refreshed every 2.5 min for all
   routes (and every 45 s for routes near the view). Between reports a bus keeps going at its recent speed and eases
   toward each new report, so it never jumps. */
const BUSES = new Map(), PATS = new Map(), patWant = new Set();
const ARTIC_VID = v => +v >= 4000 && +v < 4300;                // CTA's 60 ft articulated fleet numbers (approximate)
function parseBusTime(s) { const m = /^(\d{4})(\d\d)(\d\d) (\d\d):(\d\d)(?::(\d\d))?$/.exec(s || ""); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : null; }
function ingestBuses(list, full) {
  const seen = new Set(), now = chicagoNow();
  for (const b of list) {
    const vid = String(b.vid), t = parseBusTime(b.tmstmp) || now, pd = +b.pdist || 0, pid = String(b.pid || ""); seen.add(vid);
    let s = BUSES.get(vid); if (!s) { s = { vid, v: 5, disp: null }; BUSES.set(vid, s); }            // speed unknown until a second report: creep, don't race
    if (s.t && t <= s.t && s.pid === pid) { s.raw = b; continue; }                          // same report again
    if (s.t && s.pid === pid && t > s.t && pd >= s.pd) { const vn = (pd - s.pd) / ((t - s.t) / 1000); s.v = Math.max(0, Math.min(55, s.v * .4 + vn * .6)); }
    else if (s.pid && s.pid !== pid) { s.v = 5; s.disp = null; }
    Object.assign(s, { pid, pd, t, raw: b, lat: +b.lat, lon: +b.lon, hdg: +b.hdg || 0, artic: ARTIC_VID(vid) });
    if (pid && !PATS.has(pid)) patWant.add(pid);
  }
  if (full) for (const vid of [...BUSES.keys()]) if (!seen.has(vid)) BUSES.delete(vid);
  if (patWant.size) loadPatterns();
}
async function loadPatterns() {
  const ids = [...patWant].filter(p => !PATS.has(p)).slice(0, 60); patWant.clear(); if (!ids.length) return;
  try { const d = await liveFetch("/api/patterns?pid=" + ids.join(","));
    for (const [pid, rec] of Object.entries(d)) { const pts = rec.pts || []; if (pts.length < 2) continue;
      const pd = patDistances(pts); PATS.set(pid, { pts, pd, ln: rec.ln || pd[pd.length - 1] }); } } catch (e) {}
}
/* Bus Tracker gives a distance along the route only at stops (waypoints carry 0). Measure the shape itself
   and stretch it between stops so every point has a distance that matches the buses' reported pdist. */
function patDistances(pts) {
  const n = pts.length, g = new Float64Array(n), pd = new Float64Array(n), FT = 364000;   // ≈ feet per degree of latitude
  for (let i = 1; i < n; i++) g[i] = g[i - 1] + Math.hypot((pts[i][1] - pts[i - 1][1]) * KX, pts[i][0] - pts[i - 1][0]) * FT;
  const anc = [0]; for (let i = 1; i < n; i++) if (pts[i][2] > pd[anc[anc.length - 1]] && pts[i][2] > 0 && g[i] > g[anc[anc.length - 1]]) { anc.push(i); pd[i] = pts[i][2]; }
  for (let k = 0; k < anc.length; k++) { const a = anc[k], b = anc[k + 1];
    if (b === undefined) { for (let i = a + 1; i < n; i++) pd[i] = pd[a] + (g[i] - g[a]); break; }
    for (let i = a + 1; i < b; i++) pd[i] = pd[a] + (g[i] - g[a]) / (g[b] - g[a]) * (pd[b] - pd[a]); }
  return pd;
}
function patAt(P, d) {
  const pd = P.pd; let lo = 0, hi = pd.length - 1; d = Math.max(pd[0], Math.min(pd[hi], d));
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (pd[m] <= d) lo = m; else hi = m; }
  const a = P.pts[lo], b = P.pts[hi], f = (d - pd[lo]) / ((pd[hi] - pd[lo]) || 1);
  return [a[1] + (b[1] - a[1]) * f, a[0] + (b[0] - a[0]) * f, Math.atan2(b[0] - a[0], (b[1] - a[1]) * KX)];
}
function busFrame() {
  const now = chicagoNow();
  for (const s of BUSES.values()) {
    const P = PATS.get(s.pid);
    if (!P) { s.lonD = s.lon; s.latD = s.lat; s.yaw = (90 - s.hdg) * RAD; continue; }
    const ago = Math.max(0, Math.min(150, (now - s.t) / 1000)), v = s.pd < 300 ? 0 : s.v, est = Math.min(P.ln, s.pd + Math.min(1100, v * ago));   // no creeping at the terminal; at most ~1/5 mile ahead of the last report
    if (s.disp === null || Math.abs(est - s.disp) > 2500) s.disp = est;
    else { const dd = est - s.disp; s.disp += dd > 0 ? dd * .05 : dd * .01; }                     // ease forward; never snap backward
    const r = patAt(P, s.disp); s.lonD = r[0]; s.latD = r[1]; s.yaw = r[2];
  }
}
async function pollBuses() {
  try { const d = await liveFetch("/api/buses"); if (d.error) return; ingestBuses(d.vehicle || [], true); LIVE.buses = true; LIVE.busT = Date.now(); } catch (e) {}
}
async function pollNearBuses() {                                  // fresher data for the routes on screen when zoomed in
  if (!liveCurrent() || map.getZoom() < 13 || !BUSES.size) return;
  const b = map.getBounds(), count = new Map();
  for (const s of BUSES.values()) if (s.latD && b.contains([s.lonD, s.latD])) count.set(s.raw.rt, (count.get(s.raw.rt) || 0) + 1);
  const rts = [...count.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10).map(x => x[0]); if (!rts.length) return;
  try { const d = await liveFetch("/api/buses/near?rt=" + encodeURIComponent(rts.join(","))); if (d.vehicle) ingestBuses(d.vehicle, false); } catch (e) {}
}

/* ---------- vehicles for this frame ---------- */
function schedL() {
  const out = [];
  for (const tr of activeTrains(simT, false)) {
    const p = tr.prof, st = stateOf(tr, simT), r = p.route, v = vehPos(r.coords, r.cum, st.along, p.dir);
    out.push({ type: "train", key: trainKey(tr), tr, line: r.line, color: LCOL[r.line], label: String(tr.run), lon: v.lon, lat: v.lat, dx: v.dx, dy: v.dy,
      coords: r.coords, cum: r.cum, d: st.along, sgn: p.dir === 0 ? 1 : -1, route: r, routeD: d => d, kind: kindAt(r, st.along), st });
  }
  return out;
}
function liveL() {
  const out = [];
  for (const t of LIVE.trains) {
    if (!lineOn(t.line)) continue;
    if (!t.r) { out.push({ type: "live", key: t.key, t, line: t.line, color: LCOL[t.line], label: t.rn, lon: t.lon, lat: t.lat, dx: 0, dy: 0, kind: "grade" }); continue; }
    const d = t.cur(), p = along(t.r.coords, t.r.cum, d), q = along(t.r.coords, t.r.cum, d + t.sgn * 15);
    out.push({ type: "live", key: t.key, t, line: t.line, color: LCOL[t.line], label: t.rn, lon: p[0], lat: p[1], dx: (q[0] - p[0]) * KX, dy: -(q[1] - p[1]),
      coords: t.r.coords, cum: t.r.cum, d, sgn: t.sgn, route: t.r, routeD: x => x, kind: kindAt(t.r, d) });
  }
  return out;
}
function metraVehicles() {
  if (!railOn()) return [];
  const amLive = amtrakLive();
  return metraNow.filter(t => { const ag = MAG(t.P.rid); return agOn(ag) && (ag !== "metra" || lineOn("m:" + t.P.rid)) && !(ag === "amtrak" && amLive); }).map(t => { const sh = METRA.shapes[t.P.si], st = metraState(t, simT), v = vehPos(sh.c, sh.cum, st.d, 0);
    return { type: "metra", ag: MAG(t.P.rid), key: metraKey(t), t, line: t.P.rid, color: MCOL(t.P.rid), label: String(t.num), lon: v.lon, lat: v.lat, dx: v.dx, dy: v.dy,
      coords: sh.c, cum: sh.cum, d: st.d, sgn: 1, route: null, kind: "grade", st }; });
}
const ARTIC_RT = new Set(["9", "X9", "49", "X49", "66", "77", "79", "J14", "146", "147", "148", "151", "3", "4", "6", "20", "53", "63"]);
function liveBusList() {
  if (liveCurrent() && LIVE.buses) { const out = []; for (const s of BUSES.values()) if (s.latD) out.push({ key: "lbus:" + s.vid, label: String(s.raw.rt), lon: s.lonD, lat: s.latD, yaw: s.yaw, b: s.raw, live: true, artic: s.artic }); return out; }
  return activeBuses(simT).map(b => { const R = BUS[b.ri], v = vehPos(R.c, R.cum, busAlong(b, simT), b.dir); return { key: busKey(b), label: R.r, lon: v.lon, lat: v.lat, yaw: Math.atan2(-v.dy, v.dx), sb: b, artic: ARTIC_RT.has(R.r) }; });
}

/* ---------- clock + loop ---------- */
let lastSun = 0, frameN = 0, slowSince = 0, frameAvg = 16, lastTick = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = now - lastTick;
  if (SET.perf === "smooth" && dt < 31) return;                // Smooth: steady 30 fps, easier on the laptop
  lastTick = now; frameAvg = frameAvg * .95 + Math.min(dt, 200) * .05;
  if (playing) { if (live) simT = chicagoNow(); else simT += dt * speed; }
  if (!live && speed === 1 && Math.abs(simT - chicagoNow()) < 1500) live = true;
  metraNow = activeMetra(simT);
  if (BUSES.size) busFrame();
  VEH.l = liveCurrent() ? liveL() : schedL();
  VEH.m = metraVehicles();
  if (AMTK.trains.size) amtrakFrame();
  VEH.x = amtrakVehicles().concat(boatsOn() ? boatState(simT).concat(shipState()) : []);
  if (now - lastSun > 2000) { lastSun = now; SUN = sunPos(); loadWeather(); applyWeather(); applyLight(); sync3dTheme(); updateClock(); if (selected) refreshPanel(); }
  if (T && T.veh && T.veh.group.visible) update3dVehicles(VEH.l.concat(VEH.m, VEH.x.filter(v => v.type === "amtrak")), SET.buses !== "off" && lineOn("bus") ? liveBusList() : [], VEH.x.filter(v => v.type === "boat"));
  if (T && T.city) updateCity(now);
  guard3d(now);
  if (RIDE.on) rideStep(); else if (zone.on) zoneStep(now); else if (following && locked) followStep();
  map.triggerRepaint();
}
const COARSE = matchMedia("(pointer: coarse)").matches;            // phones and tablets
let quality = 0;                                               // 0 full, 1 lower resolution, 2 lowest resolution, 3 flat trains
/* Performance: Auto adapts to the computer; Smooth trades detail for speed; Detailed keeps full resolution and reflections */
function applyPerf() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (SET.perf === "smooth") { map.setPixelRatio(1); quality = 2; } else if (SET.perf === "detailed") { map.setPixelRatio(dpr); quality = 0; }
  if (T && T.veh) for (const [name, s] of Object.entries(T.veh.sets)) if (!/s$/.test(name)) for (const [k, m] of Object.entries(s.meshes)) {   // reflections off in Smooth
    const want = SET.perf === "smooth" ? T.veh.VL[k] : (name.endsWith("lo") ? T.veh.VL[k] : T.veh.VM[k]); if (want) m.material = want; }
}
function guard3d(now) {
  if (SET.perf !== "auto") return;          // slow device: drop reflections first, then a little resolution (never below 1.5× on sharp screens), then suggest Traffic off, then flat trains
  if (map.isMoving() || !map.areTilesLoaded() || map.getZoom() < 13) { slowSince = 0; return; }
  if (frameAvg < (COARSE ? 33 : 48)) { slowSince = 0; return; }             // phones: 30 fps and up already feels smooth
  if (!slowSince) { slowSince = now; return; }
  if (now - slowSince < 8000) return;
  slowSince = 0;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (quality === 0) { quality = .5; if (T && T.veh) for (const [name, s] of Object.entries(T.veh.sets)) if (!/s$/.test(name)) for (const [k, m] of Object.entries(s.meshes)) if (T.veh.VL[k]) m.material = T.veh.VL[k]; return; }
  if (quality <= .5 && dpr > 1.5) { quality = 1; map.setPixelRatio(1.5); return; }
  if (quality <= 1 && dpr <= 1.5 && dpr > 1 && !COARSE) { quality = 2; map.setPixelRatio(1); return; }
  if (quality <= 2 && SET.traffic) { quality = 2.5; toast("The map is running slowly here. Turning off Traffic in Map settings will help."); return; }
  if (quality <= 2.5 && threeActive() && map.getZoom() >= T3D_MIN) { quality = 3; SET.trains3d = false; refreshTransitPaint(); syncSettingsUI();   // for this visit only; not saved
    toast("3D vehicles were running slowly, so they're flat for now. Turn them back on in Vehicles settings."); }
}
function startQuality() {                                      // integrated Intel graphics: start at 1.5× instead of 2×
  applyPerf(); if (SET.perf !== "auto") return;
  try { const gl = map.painter.context.gl, d = gl.getExtension("WEBGL_debug_renderer_info"), r = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "";
    if (/Intel/i.test(r) && devicePixelRatio > 1.5) { map.setPixelRatio(1.5); quality = 1; } } catch (e) {}
}

/* ---------- follow ---------- */
const findVeh = key => VEH.l.find(v => v.key === key) || VEH.m.find(v => v.key === key) || VEH.x.find(v => v.key === key) || busVeh(key);
function busVeh(key) {                                         // buses can be followed too: give them a travel direction like trains
  if (!key || !(key.startsWith("lbus:") || key.startsWith("bus"))) return null;
  const b = liveBusList().find(x => x.key === key); if (!b) return null;
  return Object.assign({}, b, { type: "bus", color: "#3a77a8", dx: Math.cos(b.yaw) * KX, dy: -Math.sin(b.yaw) });
}
const travelBearing = v => Math.atan2(v.dx, -v.dy) / RAD;
const angDiff = (a, b) => ((b - a + 540) % 360) - 180;
function followTrain(key) {
  const v = findVeh(key); if (!v) return;
  const riding = RIDE.on;
  selected = { type: v.type, key }; following = true; locked = true; FOLLOW.off = 0; FOLLOW.userPitch = false;
  openTrainCard(); setLockUI();
  if (riding) return;                                           // already on board: hop straight to the new vehicle
  map.easeTo({ center: [v.lon, v.lat], zoom: Math.max(map.getZoom(), 14.2), duration: 900, padding: panelPadding() });
}
const FOLLOW = { off: 0, userPitch: false };                     // your own turn and tilt while following, kept on top of the follow camera
function followStep() {
  if (PAD.touches >= 2) return;                                    // two fingers on a touch screen: let the pinch, twist or tilt finish first
  const v = findVeh(selected && selected.key); if (!v) return;
  const opts = { center: [v.lon, v.lat], padding: panelPadding() };
  const cam = followCamera(v, map.getBearing(), 1);
  if (cam !== null) opts.bearing = cam;
  if ((SET.follow === "side" || SET.follow === "orbit") && SET.mapAngle === "tilt" && !FOLLOW.userPitch) { const p = map.getPitch(); opts.pitch = p + (64 - p) * .04; }
  if (!map.isEasing()) map.jumpTo(opts);
}
/* follow camera: North up · Behind (heading up) · Side (train crosses the screen) · Orbit (slow circle) */
let orbitT = performance.now();
function followCamera(v, b, rate) {
  const now = performance.now(), dt = Math.min(80, now - orbitT); orbitT = now;
  const tb = (v.dx || v.dy) ? travelBearing(v) : b;
  if (SET.follow === "north") return b + angDiff(b, FOLLOW.off) * .05 * rate;
  if (SET.follow === "behind") return b + angDiff(b, tb + FOLLOW.off) * .05 * rate;
  if (SET.follow === "side") return b + angDiff(b, tb - 90 + FOLLOW.off) * .04 * rate;
  return b + dt * .006;                                   // orbit: about 6° a second
}
function unlock() { if (!following) return; locked = false; setLockUI(); }
function relock() { locked = true; setLockUI(); const v = findVeh(selected && selected.key); if (v) map.easeTo({ center: [v.lon, v.lat], duration: 600, padding: panelPadding() }); }
function stopFollow() { if (RIDE.on) exitRide(); following = false; locked = true; setLockUI(); }
function panelPadding() { const p = document.getElementById("card"); return { left: p && !p.hidden && innerWidth > 760 ? p.offsetWidth + 24 : 0, top: 0, right: 0, bottom: innerWidth <= 760 && p && !p.hidden ? p.offsetHeight : 0 }; }
/* vehicles that can be picked at random: whatever the top filter (All, L, Rail, Bus, Boats) is showing */
function vehPool(scenic) {
  const L = VEH.l.filter(v => !scenic || v.kind !== "sub"), rail = VEH.m.concat(VEH.x.filter(v => v.type === "amtrak")), boats = VEH.x.filter(v => v.type === "boat");
  const buses = lineOn("bus") && SET.buses !== "off" ? liveBusList().map(b => b.key) : [];
  const keys = [...(L.length ? L : VEH.l).map(v => v.key), ...rail.map(v => v.key), ...boats.map(v => v.key)];
  if (!keys.length || (buses.length && Math.random() < (keys.length ? .25 : 1))) return buses.length ? buses : keys;
  return keys;
}
function randomFollow() {
  const pool = vehPool(true); if (!pool.length) { toast("Nothing to follow with this filter right now.", 2500); return; }
  followTrain(pool[Math.floor(Math.random() * pool.length)]);
}

/* ---------- ride along: the camera on board, looking out the front or side window ----------
   MapLibre's camera sits behind and above the point it looks at, so we aim at a point ahead of the vehicle,
   chosen so the camera itself lands at eye height just outside the vehicle. */
const RIDE = { on: false, bearing: null };
function rideEye(v) {                                          // eye height: elevated L structures, buses, boats
  if (v.type === "boat") return 4;
  if (v.route && v.routeD) { const h = heightAt(v.route, v.routeD(v.d)); return (h > .6 ? h : 0) + 3.4; }
  return v.type === "bus" || v.live && v.b ? 2.8 : 3.6;
}
function enterRide() {
  const v = findVeh(selected && selected.key); if (!v) return;
  RIDE.on = true; RIDE.bearing = null; following = true; locked = true; setLockUI();
  map.setMaxPitch(85); map.setMaxZoom(22.5); map.setPadding({ left: 0, top: 0, right: 0, bottom: 0 });
  document.body.classList.add("riding");
}
function exitRide() {
  if (!RIDE.on) return; RIDE.on = false; document.body.classList.remove("riding");
  map.setMaxZoom(19); map.setMaxPitch(75);
  const v = findVeh(selected && selected.key);
  map.jumpTo({ zoom: 16.4, pitch: SET.mapAngle === "top" ? 0 : TILT, center: v ? [v.lon, v.lat] : map.getCenter() });
}
function rideStep() {
  const v = findVeh(selected && selected.key); if (!v) { exitRide(); return; }
  const tb = (v.dx || v.dy) ? travelBearing(v) : (RIDE.bearing ?? map.getBearing()), side = SET.rideView === "side";
  const want = side ? tb + 90 : tb;                            // side window: looking out the right-hand side
  RIDE.bearing = RIDE.bearing == null ? want : RIDE.bearing + angDiff(RIDE.bearing, want) * .08;   // smooth through curves
  const pitch = side ? 80 : 78, eye = rideEye(v), lat = v.lat, fov = 36.87 * RAD;
  const distPx = .5 / Math.tan(fov / 2) * map.getContainer().clientHeight, dist = eye / Math.cos(pitch * RAD), mPerPx = dist / distPx;
  const zoom = Math.min(22.4, Math.log2(40075016.7 * Math.cos(lat * RAD) / (512 * mPerPx)));
  const ahead = dist * Math.sin(pitch * RAD), tr = tb * RAD, br = RIDE.bearing * RAD;
  // where the camera should be: the front of the train (a little past the nose), or beside it for the side window
  let ex = v.lon, ey = v.lat; const mx = 1 / (MPD * KX), my = 1 / MPD;
  if (side) { ex += Math.sin(tr + Math.PI / 2) * 2.6 * mx - Math.sin(tr) * 8 * mx; ey += Math.cos(tr + Math.PI / 2) * 2.6 * my - Math.cos(tr) * 8 * my; }
  else { ex += Math.sin(tr) * 2 * mx; ey += Math.cos(tr) * 2 * my; }
  map.jumpTo({ center: [ex + Math.sin(br) * ahead * mx, ey + Math.cos(br) * ahead * my], zoom, pitch, bearing: RIDE.bearing });
}
