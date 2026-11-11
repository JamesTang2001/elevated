/* ===== Elevated v2 — boats: Chicago Water Taxi and architecture tours on the river, plus live ships (AIS) ===== */
/* River centreline from OpenStreetMap (Chicago River main stem, South Branch, North Branch) */
const RIVER = {
  main: [[-87.6246, 41.88889], [-87.6252, 41.88879], [-87.6253, 41.88874], [-87.62661, 41.88811], [-87.62777, 41.88756], [-87.62935, 41.88755], [-87.6356, 41.88751], [-87.63755, 41.88654], [-87.63776, 41.8864]],
  south: [[-87.63776, 41.8864], [-87.63779, 41.88616], [-87.63775, 41.88563], [-87.63793, 41.88459], [-87.63795, 41.88434], [-87.63809, 41.88329], [-87.63825, 41.88179], [-87.63823, 41.88052], [-87.63811, 41.87924], [-87.63774, 41.8782], [-87.63742, 41.8767], [-87.63687, 41.8758], [-87.63638, 41.87523], [-87.63602, 41.87457], [-87.63549, 41.87214], [-87.63506, 41.86998], [-87.63498, 41.86945], [-87.63472, 41.8673], [-87.63464, 41.86406], [-87.63452, 41.861], [-87.6345, 41.86], [-87.6342, 41.8585], [-87.6336, 41.8573]],
  north: [[-87.63776, 41.8864], [-87.63847, 41.8868], [-87.63868, 41.88699], [-87.6388, 41.88722], [-87.63918, 41.88838], [-87.63928, 41.88864], [-87.63954, 41.8892], [-87.63962, 41.88944], [-87.64066, 41.8906], [-87.64111, 41.8913], [-87.6418, 41.89228], [-87.64225, 41.8927], [-87.64357, 41.8936], [-87.64414, 41.8943]],
  lake: [[-87.6246, 41.88889], [-87.62262, 41.8888], [-87.62032, 41.88858], [-87.61765, 41.88835], [-87.6136, 41.88841], [-87.61197, 41.88841], [-87.61033, 41.8884]],
};
function pathOf(parts) {                                          // parts: [name, reversed?, cut fraction?]
  const c = [];
  for (const [n, rev, upto] of parts) { let p = RIVER[n].slice(); if (upto) p = p.slice(0, Math.max(2, Math.round(p.length * upto))); if (rev) p.reverse(); for (const q of p) if (!c.length || c[c.length - 1][0] !== q[0] || c[c.length - 1][1] !== q[1]) c.push(q); }
  const cum = [0]; for (let i = 1; i < c.length; i++) cum.push(cum[i - 1] + Math.hypot((c[i][0] - c[i - 1][0]) * KX, c[i][1] - c[i - 1][1]) * MPD);
  return { c, cum, L: cum[cum.length - 1] };
}
const WT_PATH = pathOf([["main"], ["south"]]);
const nearestD = (P, lon, lat) => { let b = 0, bd = 1e9; P.c.forEach((q, i) => { const d = Math.hypot((q[0] - lon) * KX, q[1] - lat); if (d < bd) { bd = d; b = i; } }); return P.cum[b]; };
const WT_STOPS = [["Michigan Ave", 0], ["Ogilvie / Union", nearestD(WT_PATH, -87.63809, 41.8830)], ["Chinatown", WT_PATH.L]];
const TOUR_PATH = pathOf([["main"], ["north"], ["north", true], ["south", false, .8], ["south", true, .8], ["main", true], ["lake"], ["lake", true]]);

/* Chicago Water Taxi, Main Branch: Michigan Ave → Ogilvie/Union (15 min) → Chinatown (20 min); rush-hour trips turn at Ogilvie/Union.
   Pattern from the operator's published schedule (Oct 2026); season March–December. Approximate. */
const hhmm = (h, m) => (h * 60 + m) * 60000;
function wtTrips(day0) {
  const d = new Date(day0), mo = d.getUTCMonth(), dow = d.getUTCDay(); if (mo < 2) return [];
  const deps = [], add = (t, short) => deps.push({ t: day0 + t, short });
  if (dow === 0 || dow === 6) for (let m = 630; m <= 1110; m += 40) add(m * 60000, false);
  else { for (let m = 445; m <= 595; m += 30) add(m * 60000, m < 595); for (let m = 630; m <= 975; m += 35) add(m * 60000, false); add(hhmm(16, 50), false); add(hhmm(17, 20), true); add(hhmm(17, 50), false); add(hhmm(18, 30), false); }
  const out = [];
  for (const { t, short } of deps) {                         // southbound, then the boat's return trip
    const ou = WT_STOPS[1][1], legs = short ? [[0, ou, t, 15]] : [[0, ou, t, 15], [ou, WT_PATH.L, t + 17 * 60000, 18]];
    out.push({ id: "wt-" + t, legs, dir: "Southbound", to: short ? "Ogilvie / Union" : "Chinatown", t0: t });
    const back = short ? [[ou, 0, t + 20 * 60000, 15]] : [[WT_PATH.L, ou, t + 45 * 60000, 18], [ou, 0, t + 65 * 60000, 15]];
    out.push({ id: "wt-" + t + "n", legs: back, dir: "Northbound", to: "Michigan Ave", t0: back[0][2] });
  }
  return out;
}
/* Architecture tours: 90-minute loop up the North Branch, down the South Branch, then out to the lake. Hourly in season (approx.). */
function tourTrips(day0) {
  const d = new Date(day0), mo = d.getUTCMonth(), dd = d.getUTCDate(); if (mo < 3 || mo > 10 || (mo === 10 && dd > 23)) return [];
  const out = []; for (let h = 10; h <= 17; h++) out.push({ id: "tour-" + day0 + "-" + h, t0: day0 + hhmm(h, 0), T: 90 * 60000 }); return out;
}
function boatState(now) {
  const out = [], d0 = Math.floor(now / DAY) * DAY;
  for (const tr of wtTrips(d0)) for (const [a, b, t, mins] of tr.legs) {
    const T = mins * 60000; if (now < t || now > t + T) continue;
    const f = (now - t) / T, e = f < .12 ? .5 * f * f / .12 / .88 : f > .88 ? 1 - .5 * (1 - f) * (1 - f) / .12 / .88 : (f - .06) / .88;   // ease in/out at docks
    out.push({ kind: "taxi", key: tr.id, trip: tr, d: a + (b - a) * e, sgn: b > a ? 1 : -1, P: WT_PATH, label: "WT", color: "#f2c200" });
  }
  for (const tr of tourTrips(d0)) { if (now < tr.t0 || now > tr.t0 + tr.T) continue;
    out.push({ kind: "tour", key: tr.id, trip: tr, d: (now - tr.t0) / tr.T * TOUR_PATH.L, sgn: 1, P: TOUR_PATH, label: "Tour", color: "#2f6fb5" }); }
  return out.map(b => { const v = vehPos(b.P.c, b.P.cum, b.d, b.sgn > 0 ? 0 : 1);
    return Object.assign(b, { type: "boat", lon: v.lon, lat: v.lat, dx: v.dx, dy: v.dy, coords: b.P.c, cum: b.P.cum, yaw: Math.atan2(-v.dy, v.dx) }); });
}

/* ---------- live ships from the local server (aisstream.io) ---------- */
const SHIPS_LIVE = { on: false, list: [], t: 0 };
const PASSENGER_NAME = /WATER ?TAXI|WENDELLA|SHORELINE|FIRST LADY|ODYSSEY|SPIRIT OF CHICAGO|MYSTIC BLUE|ANITA DEE|CHICAGO ELITE|LADY/i;
function shipKind(s) {
  const t = +s.type || 0;
  if ((t >= 60 && t <= 69) || PASSENGER_NAME.test(s.name || "")) return "pass";
  if (t >= 70 && t <= 89) return "cargo"; if (t === 31 || t === 32 || t === 52) return "tug"; if (t === 36 || t === 37) return "small";
  if (t === 35 || t === 55) return "patrol"; return (s.len || 0) > 80 ? "cargo" : "small";
}
async function pollShips() {
  try { const d = await liveFetch("/api/ships"); if (d.error) return; const now = performance.now();
    SHIPS_LIVE.list = d.ships.filter(s => s.lat && s.lon).map(s => Object.assign(s, { kind: shipKind(s), t0: now, lat0: +s.lat, lon0: +s.lon })); SHIPS_LIVE.t = Date.now(); SHIPS_LIVE.on = true; } catch (e) {}
}
function shipState() {
  if (!liveCurrent() || !SHIPS_LIVE.on) return [];
  const now = performance.now(), out = [];
  for (const s of SHIPS_LIVE.list) {
    if (s.kind !== "pass" && !SET.ships) continue;
    const moving = (+s.sog || 0) > .4 && s.cog != null && s.cog < 360, ago = Math.min(120, (now - s.t0) / 1000 + (s.age || 0));
    const hd = (moving ? +s.cog : (s.hdg != null && s.hdg < 360 ? +s.hdg : 0)) * RAD, m = moving ? (+s.sog) * .5144 * ago : 0;
    const lon = s.lon0 + Math.sin(hd) * m / (MPD * KX), lat = s.lat0 + Math.cos(hd) * m / MPD;
    out.push({ type: "boat", kind: s.kind === "pass" ? "shippass" : s.kind, key: "ship:" + s.mmsi, ship: s, lon, lat, dx: Math.sin(hd) * KX, dy: -Math.cos(hd), yaw: Math.PI / 2 - hd,
      label: (s.name || "Ship").slice(0, 14), color: s.kind === "pass" ? "#2f6fb5" : "#6b7480" });
  }
  return out;
}
const boatsOn = () => SET.boats !== false && lineOn("boats");
