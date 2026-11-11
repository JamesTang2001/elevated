/* ===== Elevated v2 — live Amtrak (via the local server, from Amtraker's feed of Amtrak's train map) =====
   Positions arrive every minute or so. Each train is snapped to the nearest Amtrak (or shared Metra) track and
   glides along it at its reported speed, the same way live buses do. */
const AMTK = { on: false, trains: new Map(), t: 0 };
const amtrakLive = () => AMTK.on && liveCurrent() && AMTK.trains.size > 0;
let RAIL_GRID = null;
function railGrid() {                                       // shape points in ~550 m cells, Amtrak shapes first
  if (RAIL_GRID) return RAIL_GRID;
  RAIL_GRID = new Map();
  const order = METRA.shapes.map((_, i) => i), agOf = new Map(); for (const P of M_PAT) agOf.set(P.si, MAG(P.rid));
  for (const si of order) { const sh = METRA.shapes[si], am = agOf.get(si) === "amtrak";
    for (let i = 0; i + 1 < sh.c.length; i++) { const p = sh.c[i], q = sh.c[i + 1], n = Math.max(1, Math.ceil((sh.cum[i + 1] - sh.cum[i]) / 250)), done = new Set();   // every segment, in every cell it crosses
      for (let j = 0; j <= n; j++) { const x = p[0] + (q[0] - p[0]) * j / n, y = p[1] + (q[1] - p[1]) * j / n, k = Math.floor(x / .0066) + "," + Math.floor(y / .005);
        if (done.has(k)) continue; done.add(k); let a = RAIL_GRID.get(k); if (!a) RAIL_GRID.set(k, a = []); a.push(si, i, am ? 1 : 0); } } }
  return RAIL_GRID;
}
function snapRail(lon, lat) {                               // → {si, d, dist} on the nearest segment, preferring Amtrak shapes
  const G = railGrid(), cx = Math.floor(lon / .0066), cy = Math.floor(lat / .005); let best = null;
  for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) { const a = G.get(x + "," + y); if (!a) continue;
    for (let j = 0; j < a.length; j += 3) { const sh = METRA.shapes[a[j]], i = a[j + 1];
      { const k = i;
        const p = sh.c[k], q = sh.c[k + 1], ux = (q[0] - p[0]) * KX, uy = q[1] - p[1], L2 = ux * ux + uy * uy || 1e-12;
        const f = Math.max(0, Math.min(1, (((lon - p[0]) * KX) * ux + (lat - p[1]) * uy) / L2)), dx = (lon - p[0]) * KX - f * ux, dy = lat - p[1] - f * uy;
        const dist = Math.hypot(dx, dy) * MPD - (a[j + 2] ? 25 : 0);
        if (!best || dist < best.dist) best = { si: a[j], d: sh.cum[k] + f * (sh.cum[k + 1] - sh.cum[k]), dist, tan: [ux, uy] }; } } }
  return best && best.dist < 140 ? best : null;
}
const COMPASS = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const SUPERLINER = /Empire Builder|California Zephyr|Southwest Chief|Texas Eagle|City of New Orleans|Capitol Limited/;
async function pollAmtrak() {
  try { const d = await liveFetch("/api/amtrak"); if (d.error || !d.trains) return; const now = Date.now(), seen = new Set();
    for (const r of d.trains) {
      if (r.state && r.state !== "Active") continue; const id = String(r.id || r.num); seen.add(id);
      const hd = COMPASS[r.heading] != null ? COMPASS[r.heading] : null, s = snapRail(+r.lon, +r.lat), old = AMTK.trains.get(id);
      const ts = r.upd ? Date.parse(r.upd) : now, mps = Math.max(0, +r.mph || 0) * .44704;
      const t = old || { id, lonD: +r.lon, latD: +r.lat }; Object.assign(t, { raw: r, ts: isFinite(ts) ? Math.min(ts, now) : now, mps, hd, snap: s, lon: +r.lon, lat: +r.lat });
      if (s) { const sh = METRA.shapes[s.si];                 // travel direction along the shape from the reported compass heading
        let sgn = hd == null ? (old && old.snap && old.snap.si === s.si ? Math.sign(s.d - old.snap.d) || old.sgn || 1 : 1) : Math.sign(s.tan[0] * Math.sin(hd * RAD) + s.tan[1] * Math.cos(hd * RAD)) || 1;
        t.sgn = sgn; if (!old || !old.sh || old.sh !== sh || Math.abs(old.dD - s.d) > 3000) { t.sh = sh; t.dD = s.d; } }
      else t.sh = null;
      t.long = SUPERLINER.test(r.route || ""); AMTK.trains.set(id, t);
    }
    for (const k of [...AMTK.trains.keys()]) if (!seen.has(k)) AMTK.trains.delete(k);
    AMTK.on = true; AMTK.t = now; RAIL_GRID = RAIL_GRID || null;
  } catch (e) {}
}
function amtrakFrame() {                                    // dead-reckon from the last report (up to 3 minutes), ease the drawn train toward it
  const now = Date.now();
  for (const t of AMTK.trains.values()) {
    const ago = Math.min(180, Math.max(0, (now - t.ts) / 1000));
    if (t.sh && t.snap) { const L = t.sh.cum[t.sh.cum.length - 1], goal = Math.max(0, Math.min(L, t.snap.d + t.sgn * t.mps * ago));
      const diff = goal - t.dD; t.dD += Math.abs(diff) > 2500 ? diff : diff * (Math.sign(diff) === t.sgn ? .05 : .01);
      const v = vehPos(t.sh.c, t.sh.cum, t.dD, t.sgn > 0 ? 0 : 1); t.lonD = v.lon; t.latD = v.lat; t.dx = v.dx; t.dy = v.dy; }
    else { const h = (t.hd || 0) * RAD, m = t.hd == null ? 0 : t.mps * ago, lo = t.lon + Math.sin(h) * m / (MPD * KX), la = t.lat + Math.cos(h) * m / MPD;
      t.lonD += (lo - t.lonD) * .05; t.latD += (la - t.latD) * .05; t.dx = Math.sin(h) * KX; t.dy = -Math.cos(h); }
  }
}
function amtrakVehicles() {
  if (!amtrakLive() || !agOn("amtrak")) return [];
  const out = [];
  for (const t of AMTK.trains.values()) { const r = t.raw;
    out.push({ type: "amtrak", ag: "amtrak", key: "amtk:" + t.id, a: t, line: "amtrak", color: t.long ? "#3a5f8c" : "#4a77a8", label: String(r.num), lon: t.lonD, lat: t.latD, dx: t.dx || 0, dy: t.dy || 0,
      coords: t.sh ? t.sh.c : null, cum: t.sh ? t.sh.cum : null, d: t.dD, sgn: t.sgn || 1, route: null, kind: "grade", long: t.long }); }
  return out;
}
