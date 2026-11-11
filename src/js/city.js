/* ===== Elevated v2 — simulated traffic (Map → Traffic, off by default; shows when zoomed in) =====
   The map's road pieces are joined into a network. Cars drive along it, carry on through intersections (sometimes
   turning), keep a gap to the car ahead, and fade in and out at the edge of the area around the view instead of popping.
   Busier at rush hour and slow on the expressways at 5 pm. (The city's live speed feed stopped updating in April 2026.) */
const CITY = { key: "", edges: [], out: new Map(), cars: [], timer: 0, area: null };
const CITY_MIN_Z = 15.2;
function scheduleCity() { if (CITY.timer) return; CITY.timer = setTimeout(() => { CITY.timer = 0; buildCity(); }, 700); }
function rushFactor() {                                               // 0.12 at night … 1 at the weekday rush
  const d = new Date(simT), h = d.getUTCHours() + d.getUTCMinutes() / 60, we = d.getUTCDay() === 0 || d.getUTCDay() === 6;
  const bump = (c, w) => Math.exp(-((h - c) * (h - c)) / (2 * w * w));
  return we ? .12 + .55 * bump(14, 4) : Math.min(1, .12 + .5 * bump(12.5, 4) + .55 * bump(8, 1.1) + .6 * bump(17.2, 1.3));
}
const CAR_CAP = { car: 1100, suv: 450, truck: 160 };
function initCity() {
  const g = new THREE.Group();
  const env = envTexture(), paint = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .35, roughness: .4, envMap: env }), trim = new THREE.MeshStandardMaterial({ color: 0x1a1f26, metalness: .3, roughness: .2, envMap: env });
  const sets = {}, trims = {};
  for (const k of ["car", "suv", "truck"]) { const G = carModel(k), m = new THREE.InstancedMesh(G.b, paint, CAR_CAP[k]), t = new THREE.InstancedMesh(G.g, trim, CAR_CAP[k]);
    for (const x of [m, t]) { x.count = 0; x.frustumCulled = false; g.add(x); }
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAR_CAP[k] * 3), 3); sets[k] = m; trims[k] = t; }
  const box = new THREE.BoxGeometry(1, 1, 1), lamp = c => { const m = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: c }), 1800); m.count = 0; m.frustumCulled = false; g.add(m); return m; };
  return { group: g, sets, trims, paint, head: lamp(0xfff3d6), tail: lamp(0xff3b30) };
}
/* ---------- road network: deduplicated pieces → directed edges joined at shared ends ---------- */
function buildNetwork(feats, cx, cy, R) {
  const seen = new Set(), edges = [], out = new Map(), nk = (x, y) => Math.round(x / 2) + "," + Math.round(y / 2);
  for (const f of feats) { const p = f.properties || {}, cl = p.class;
    if (!["motorway", "trunk", "primary", "secondary", "tertiary"].includes(cl) || p.brunnel === "tunnel") continue;
    const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [];
    for (const l of lines) { if (l.length < 2) continue;
      const pts = l.map(q => T.toLocal(q[0], q[1])); if (!pts.some(q => Math.hypot(q[0] - cx, q[1] - cy) < R + 400)) continue;
      const a = pts[0], b = pts[pts.length - 1], key = [nk(...a), nk(...b)].sort().join("|") + "|" + pts.length;   // the same piece from two tiles
      if (seen.has(key)) continue; seen.add(key);
      const lanes = p.ramp ? 1 : cl === "motorway" ? 3 : cl === "tertiary" ? 1 : 2, ow = +p.oneway || 0, big = cl === "motorway" || cl === "trunk";
      const dirs = ow === 1 ? [1] : ow === -1 ? [-1] : big && !p.ramp ? [1] : [1, -1];
      for (const dir of dirs) { const P = dir > 0 ? pts : pts.slice().reverse(), cum = [0];
        for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
        const L = cum[cum.length - 1]; if (L < 3) continue;
        const e = { pts: P, cum, L, cl, big, lanes, two: dirs.length === 2, from: nk(...P[0]), to: nk(...P[P.length - 1]), id: edges.length,
          h0: Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]), h1: Math.atan2(P[P.length - 1][1] - P[P.length - 2][1], P[P.length - 1][0] - P[P.length - 2][0]) };
        edges.push(e); (out.get(e.from) || out.set(e.from, []).get(e.from)).push(e); } } }
  return { edges, out };
}
function nextEdge(e, rnd) {                                           // the road to take at the end of this one: mostly straight on, sometimes a turn
  const opts = (CITY.out.get(e.to) || []).filter(n => n.to !== e.from || n.pts.length !== e.pts.length);
  if (!opts.length) return null;
  let tot = 0; const w = opts.map(n => { const t = Math.abs(((n.h0 - e.h1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);   // turn angle 0 … π
    const v = (t < .5 ? 6 : t < 2 ? 1.2 : .05) * (n.cl === e.cl ? 2 : 1); tot += v; return v; });
  let r = rnd() * tot; for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) return opts[i]; } return opts[opts.length - 1];
}
function edgeAt(e, d, hint) {
  let i = Math.min(hint || 1, e.cum.length - 1); while (i > 1 && e.cum[i - 1] > d) i--; while (i < e.cum.length - 1 && e.cum[i] < d) i++;
  const a = e.pts[i - 1], q = e.pts[i], f = (d - e.cum[i - 1]) / ((e.cum[i] - e.cum[i - 1]) || 1);
  return [a[0] + (q[0] - a[0]) * f, a[1] + (q[1] - a[1]) * f, Math.atan2(q[1] - a[1], q[0] - a[0]), i];
}
const laneOff = (e, ln) => e.two ? 1.9 + Math.min(ln, e.lanes - 1) * 3.3 : (Math.min(ln, e.lanes - 1) - (e.lanes - 1) / 2) * 3.3;
const edgeSpeed = (e, rf) => { const jam = e.big ? Math.max(0, rf - .55) / .45 : Math.max(0, rf - .7) / .3; return e.big ? 27 - 19 * jam : 12 - 6 * jam; };
let cityRnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(9);
const CAR_PAL = [0xe9eaec, 0x26292e, 0x8d939b, 0x1f3b63, 0x7a1f24, 0xc7c9cc, 0x3d4a3f, 0x5b6470, 0x9aa6b4, 0x4b2f2a];
function spawnCar(e, d, downtown) {
  const t = cityRnd(), kind = t < .07 ? "truck" : t < .37 ? "suv" : "car";
  return { e, d, ln: Math.floor(cityRnd() * e.lanes), kind, col: downtown && kind === "car" && cityRnd() < .12 ? 0xf2c200 : CAR_PAL[Math.floor(cityRnd() * CAR_PAL.length)],
    v: 0, vj: .9 + cityRnd() * .2, i: 1, a: 0, fade: 1 };
}
function buildCity() {
  if (!T || !T.city) return;
  const z = map.getZoom(), C = T.city, on = SET.traffic === true && z >= CITY_MIN_Z && SET.bldg3d !== false;
  C.group.visible = on; if (!on) { CITY.key = ""; CITY.cars = []; return; }
  const c = map.getCenter(), key = [Math.round(c.lng / .004), Math.round(c.lat / .003), Math.round(z)].join();
  if (key === CITY.key) return;
  const feats = map.querySourceFeatures("omt", { sourceLayer: "transportation" }); if (!feats.length) return;
  CITY.key = key;
  const [cx, cy] = T.toLocal(c.lng, c.lat), R = 1400 / Math.pow(2, Math.max(0, z - 16)) + 500;
  const net = buildNetwork(feats, cx, cy, R); CITY.edges = net.edges; CITY.out = net.out; CITY.area = { cx, cy, R };
  // keep the cars already on screen: move each onto the matching new edge (same road, same direction) or let it fade out
  const grid = new Map(), cell = 40;
  for (const e of CITY.edges) for (let i = 0; i < e.pts.length; i++) { const k = Math.floor(e.pts[i][0] / cell) + "," + Math.floor(e.pts[i][1] / cell); (grid.get(k) || grid.set(k, []).get(k)).push([e, i]); }
  for (const k of CITY.cars) { if (k.fade < 0) continue;
    const [x, y, hd] = edgeAt(k.e, k.d, k.i); let best = null, bd = 9;
    for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) for (const [e, i] of grid.get((Math.floor(x / cell) + gx) + "," + (Math.floor(y / cell) + gy)) || []) {
      const j = Math.max(1, i), a = e.pts[j - 1], q = e.pts[j], hh = Math.atan2(q[1] - a[1], q[0] - a[0]); if (Math.abs(Math.sin((hh - hd) / 2)) > .3) continue;
      const ux = q[0] - a[0], uy = q[1] - a[1], L2 = ux * ux + uy * uy || 1, f = Math.max(0, Math.min(1, ((x - a[0]) * ux + (y - a[1]) * uy) / L2)), dd = Math.hypot(a[0] + ux * f - x, a[1] + uy * f - y);
      if (dd < bd) { bd = dd; best = { e, d: e.cum[j - 1] + f * (e.cum[j] - e.cum[j - 1]), i: j }; } }
    if (best) Object.assign(k, best); else k.fade = -1;            // fade out
  }
  topUpCars(true);
  map.triggerRepaint();
}
function topUpCars(initial) {                                         // add cars until the network holds the right number for the hour
  const A = CITY.area; if (!A || !CITY.edges.length) return;
  const rf = rushFactor(), downtown = Math.hypot(A.cx, A.cy) < 2500, live = CITY.cars.filter(k => k.fade >= 0).length;
  let laneLen = 0; for (const e of CITY.edges) laneLen += e.L * e.lanes * (e.cl === "tertiary" ? .55 : 1);
  const want = Math.min(CAR_CAP.car + CAR_CAP.suv + CAR_CAP.truck - 20, laneLen * Math.max(.12, rf) / 30);
  let n = 0;
  while (live + n < want && n < (initial ? 4000 : 6)) {
    const e = CITY.edges[Math.floor(cityRnd() * CITY.edges.length)], d = cityRnd() * e.L, [x, y] = edgeAt(e, d);
    if (Math.hypot(x - A.cx, y - A.cy) > A.R) { n++; continue; }
    const k = spawnCar(e, d, downtown); k.a = initial ? 1 : 0; CITY.cars.push(k); n++;
  }
}
const _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _ce = new THREE.Euler(), _cv = new THREE.Vector3(), _cs = new THREE.Vector3(), _cl = new THREE.Vector3(.22, 1.5, .26), _cc = new THREE.Color();
let cityLast = performance.now(), cityTop = 0;
function updateCity(now) {
  if (!T || !T.city) return; const C = T.city, dt = Math.min(.1, (now - cityLast) / 1000); cityLast = now;
  if (!C.group.visible || !CITY.cars.length) { C.head.count = C.tail.count = 0; for (const k in C.sets) C.sets[k].count = C.trims[k].count = 0; return; }
  const rf = rushFactor(), A = CITY.area;
  // car-following: on each edge and lane, nobody gets closer than ~8 m to the car ahead
  const lanes = new Map(); for (const k of CITY.cars) { const key = k.e.id * 4 + Math.min(k.ln, k.e.lanes - 1); (lanes.get(key) || lanes.set(key, []).get(key)).push(k); }
  for (const list of lanes.values()) { list.sort((a, b) => b.d - a.d);
    for (let j = 0; j < list.length; j++) { const k = list[j], vmax = edgeSpeed(k.e, rf) * k.vj, ahead = list[j - 1];
      const gap = ahead ? ahead.d - k.d - 8 : 1e9; k.v += ((gap < 0 ? 0 : Math.min(vmax, gap * .9)) - k.v) * Math.min(1, dt * 2); } }
  const idx = { car: 0, suv: 0, truck: 0 }; let nh = 0;
  CITY.cars = CITY.cars.filter(k => {
    k.d += Math.max(0, k.v) * dt;
    while (k.d > k.e.L) { const n = nextEdge(k.e, cityRnd); if (!n) { k.d = k.e.L; k.fade = -1; break; } k.d -= k.e.L; k.e = n; k.i = 1; }
    k.a += (k.fade < 0 ? -1 : 1) * dt * 1.4; if (k.a <= 0 && k.fade < 0) return false; k.a = Math.min(1, k.a);
    const [x, y, yaw, i] = edgeAt(k.e, k.d, k.i); k.i = i;
    if (k.fade >= 0 && Math.hypot(x - A.cx, y - A.cy) > A.R + 150) k.fade = -1;   // left the area: fade out
    const off = laneOff(k.e, k.ln), px = x + Math.sin(yaw) * off, py = y - Math.cos(yaw) * off, s = Math.max(.01, k.a * k.a * (3 - 2 * k.a));
    if (idx[k.kind] >= CAR_CAP[k.kind]) return true;
    const slot = idx[k.kind]++; _ce.set(0, 0, yaw); _cq.setFromEuler(_ce); _cv.set(px, py, 0); _cs.set(s, s, s); _cm.compose(_cv, _cq, _cs); C.sets[k.kind].setMatrixAt(slot, _cm); C.trims[k.kind].setMatrixAt(slot, _cm);
    _cc.set(k.col); C.sets[k.kind].instanceColor.setXYZ(slot, _cc.r, _cc.g, _cc.b);
    if (nh < 1800 && s > .6) { const L2 = k.kind === "truck" ? 3.45 : 2.3, back = k.kind === "truck" ? 4.05 : 2.3, cy0 = Math.cos(yaw), sy0 = Math.sin(yaw), zz = k.kind === "truck" ? 1.0 : .75;
      _cv.set(px + cy0 * L2, py + sy0 * L2, zz); _cm.compose(_cv, _cq, _cl); C.head.setMatrixAt(nh, _cm); _cv.set(px - cy0 * back, py - sy0 * back, zz + .1); _cm.compose(_cv, _cq, _cl); C.tail.setMatrixAt(nh, _cm); nh++; }
    return true;
  });
  for (const [k, m] of Object.entries(C.sets)) { m.count = C.trims[k].count = idx[k]; m.instanceMatrix.needsUpdate = C.trims[k].instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  C.paint.envMapIntensity = nightLevel() > .5 ? .25 : .9;
  C.head.count = C.tail.count = nh; C.head.instanceMatrix.needsUpdate = C.tail.instanceMatrix.needsUpdate = true;
  if (now - cityTop > 400) { cityTop = now; topUpCars(false); }       // new cars fade in to replace the ones that left
}
