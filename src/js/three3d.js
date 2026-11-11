/* ===== Elevated v2 — 3D layer (three.js inside MapLibre): track, L structure, portals; vehicles live in vehicles3d.js ===== */
const T3D_MIN = 14.6, STRUCT_MIN = 14.6, RAIL_MIN = 15.4, TIE_MIN = 16.3, DECK_H = 6.0, RAMP_M = 220;
const TRACK_HALF = 1.9, GAUGE_HALF = .72;
const ORIGIN = [-87.6298, 41.8781];
let T = null;
const threeActive = () => !!T && SET.trains3d;

/* landmark outlines are approximate (shape and height), like Rail Island's "appearance sketches" */
const LANDMARKS = [
  { id: "willis", name: "Willis Tower", lon: -87.63591, lat: 41.87888, clear: 62 },
  { id: "hancock", name: "John Hancock Center", lon: -87.62293, lat: 41.89889, clear: 58 },
  { id: "trump", name: "Trump International Hotel & Tower", lon: -87.62618, lat: 41.88892, clear: 60 },
  { id: "aon", name: "Aon Center", lon: -87.62139, lat: 41.88528, clear: 50 },
  { id: "mart", name: "Merchandise Mart", lon: -87.63536, lat: 41.88855, clear: 125 },
  { id: "union", name: "Union Station", lon: -87.64035, lat: 41.87865, clear: 70 },
  { id: "bean", name: "Cloud Gate (the Bean)", lon: -87.62331, lat: 41.88265, clear: 0 },
  { id: "wrigley", name: "Wrigley Field", lon: -87.65534, lat: 41.94839, clear: 130 },
];

/* track height along a route: elevated stretches ramp up from grade/subway over RAMP_M metres */
for (const r of ROUTES) r.kind.sort((a, b) => a[0] - b[0]);
function heightAt(r, d) {
  const K = r.kind; let i = K.findIndex(x => d >= x[0] && d <= x[1]); if (i < 0) return 0;
  const [a, b, k] = K[i]; if (k !== "elev") return 0;
  let h = DECK_H;
  if (!(i > 0 && K[i - 1][2] === "elev") && a > 1) h = Math.min(h, DECK_H * (d - a) / RAMP_M);
  if (!(i < K.length - 1 && K[i + 1][2] === "elev") && b < r.length - 1) h = Math.min(h, DECK_H * (b - d) / RAMP_M);
  return Math.max(0, h);
}

function add3dLayer() {
  if (typeof THREE === "undefined") return;
  const mc0 = maplibregl.MercatorCoordinate.fromLngLat(ORIGIN, 0), S = mc0.meterInMercatorCoordinateUnits();
  const toLocal = (lon, lat) => { const m = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], 0); return [(m.x - mc0.x) / S, -(m.y - mc0.y) / S]; };
  const layer = {
    id: "three", type: "custom", renderingMode: "3d",
    onAdd(m, gl) {
      const scene = new THREE.Scene(), camera = new THREE.Camera();
      const amb = new THREE.HemisphereLight(0xffffff, 0x8a8f99, .75), sun = new THREE.DirectionalLight(0xffffff, .85);
      scene.add(amb, sun);
      const renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      const model = new THREE.Matrix4().makeTranslation(mc0.x, mc0.y, mc0.z).scale(new THREE.Vector3(S, -S, S));
      T = { scene, camera, renderer, model, amb, sun, toLocal, S, mat: null, markMats: new Map() };
      mats();
      T.net = buildTrackNet();
      T.struct = buildStructure(T.net); scene.add(T.struct);
      T.rails = buildRails(T.net); scene.add(T.rails);
      T.ties = buildTieMeshes(); scene.add(T.ties.group);
      T.marks = buildLandmarks(); scene.add(T.marks);
      T.stations = buildStations(); scene.add(T.stations);
      T.veh = buildVehicleMeshes(); scene.add(T.veh.group);
      T.win = initWindows(); scene.add(T.win.glass, T.win.lit);
      T.city = initCity(); T.city.group.visible = false; scene.add(T.city.group);
      T.edges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, depthWrite: false })); T.edges.frustumCulled = false; T.edges.renderOrder = 5; scene.add(T.edges);
      m.on("moveend", () => { scheduleEdges(); scheduleWindows(); scheduleCity(); }); m.on("sourcedata", e => { if (e.sourceId === "omt") { scheduleEdges(); if (T && T.win) T.win.key = ""; scheduleWindows(); CITY.key = ""; scheduleCity(); } });
      sync3dTheme();
    },
    render(gl, matrix) {
      if (!T) return;
      const z = map.getZoom(), on = SET.trains3d;
      T.struct.visible = on && z >= STRUCT_MIN;
      T.rails.visible = on && z >= RAIL_MIN;
      T.ties.group.visible = on && z >= TIE_MIN;
      T.marks.visible = z >= 12 && SET.bldg3d && SET.landmarks !== false;
      T.edges.visible = SET.seeThrough === "see" && SET.bldg3d && z >= 14.6;
      T.veh.group.visible = on && z >= T3D_MIN;
      T.stations.visible = T.struct.visible;
      if (T.win.glass.visible && !windowsWanted()) T.win.glass.visible = T.win.lit.visible = false;
      if (T.city.group.visible && z < CITY_MIN_Z) T.city.group.visible = false;
      if (!T.struct.visible && !T.marks.visible && !T.veh.group.visible && !T.edges.visible && !T.win.glass.visible && !T.city.group.visible) return;
      if (T.ties.group.visible) updateTies();
      if (T.struct.visible) cullChunks(T.struct, Math.max(900, 6000 * Math.pow(2, STRUCT_MIN - z)));
      if (T.rails.visible) cullChunks(T.rails, Math.max(500, 2600 * Math.pow(2, RAIL_MIN - z)));
      T.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(T.model);
      T.renderer.resetState(); T.renderer.render(T.scene, T.camera);
    },
    onRemove() { if (T) { T.renderer.dispose(); T = null; } },
  };
  // draw the 3D before the building blocks: see-through walls then fade over trains and stations instead of hiding them
  map.addLayer(layer, map.getLayer("bldg-3d") ? "bldg-3d" : map.getLayer("st-dot") ? "st-dot" : undefined);
}

/* ---------- materials ---------- */
function mats() {
  if (T.mat) return T.mat;
  const L = c => new THREE.MeshLambertMaterial({ color: c }), B = c => new THREE.MeshBasicMaterial({ color: c });
  T.mat = {
    steel: L(0x4b525c), girder: L(0x3d444d), tie: L(0x5b4a3c), ballast: L(0x9d978b), rail: L(0x8b9097), concrete: L(0xb9b6ad), tunnel: B(0x0b0d10),
  };
  return T.mat;
}
function sync3dTheme() {
  if (!T) return;
  const dark = styleTheme === "dark", n = night3d();
  T.amb.intensity = dark ? .95 : .9 - .1 * n;
  const el = Math.max(.12, SUN.el), az = SUN.az;
  T.sun.position.set(Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el));
  T.sun.intensity = (SET.daylight ? Math.max(.18, .9 * (1 - n)) : .7) * wxSunDim();
  T.sun.color.set(n > .5 ? 0x9fb4ff : 0xfff1dc);
  const M = T.mat;
  M.steel.color.set(dark ? 0x56606f : 0x5a616b); M.girder.color.set(dark ? 0x485262 : 0x474e58);
  M.tie.color.set(dark ? 0x4a3f36 : 0x6b5847); M.ballast.color.set(dark ? 0x3b414b : 0xa49e92);
  M.rail.color.set(dark ? 0xaab3bf : 0x8d939b); M.concrete.color.set(dark ? 0x5b616b : 0xbdb9b0);
  syncVehicleTheme(dark, n);
  for (const b of T.beacons || []) b.visible = n > .35 || dark;
  T.edgeKey = "";  scheduleEdges(); if (T.win) scheduleWindows();
  for (const [, ms] of T.markMats) for (const [mm, d, l] of ms) mm.color.set(dark ? d : l);
}
const night3d = () => SET.daylight ? nightLevel() : (styleTheme === "dark" ? .8 : 0);

/* ---------- track network: shared trackage built once (the Loop is one structure, not five) ---------- */
function buildTrackNet() {
  const claimed = new Map(), runs = [], portals = [], STEP = 6, CELL = 6;
  const cellKey = (x, y) => Math.round(x / CELL) + "," + Math.round(y / CELL);
  for (const r of ROUTES) {
    const samples = [];
    for (let d = 0; d <= r.length; d += STEP) {
      const p = along(r.coords, r.cum, d), q = along(r.coords, r.cum, Math.min(r.length, d + 3)), o = along(r.coords, r.cum, Math.max(0, d - 3));
      const lp = T.toLocal(p[0], p[1]), lq = T.toLocal(q[0], q[1]), lo = T.toLocal(o[0], o[1]);
      const hd = Math.atan2(lq[1] - lo[1], lq[0] - lo[0]), kind = kindAt(r, d);
      let shared = false;
      for (let ix = -1; ix <= 1 && !shared; ix++) for (let iy = -1; iy <= 1 && !shared; iy++) {
        const h = claimed.get((Math.round(lp[0] / CELL) + ix) + "," + (Math.round(lp[1] / CELL) + iy));
        if (h !== undefined && Math.abs(Math.cos(h - hd)) > .94) shared = true;
      }
      samples.push({ x: lp[0], y: lp[1], hd, kind, h: heightAt(r, d), shared, d });
    }
    // portals where subway meets daylight
    for (let i = 1; i < samples.length; i++) { const a = samples[i - 1], b = samples[i];
      if ((a.kind === "sub") !== (b.kind === "sub") && !a.shared && !b.shared) { const out = a.kind === "sub" ? b : a; portals.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, hd: a.kind === "sub" ? b.hd : a.hd + Math.PI }); } }
    // runs of unshared, above-ground track
    let cur = null;
    for (let i = 0; i < samples.length; i++) { const s = samples[i], ok = !s.shared && s.kind !== "sub";
      if (ok) { if (!cur) { cur = { pts: i ? [samples[i - 1]] : [] }; runs.push(cur); } cur.pts.push(s); }
      else if (cur) { cur.pts.push(s); cur = null; } }
    for (const s of samples) claimed.set(cellKey(s.x, s.y), s.hd);
  }
  const good = runs.filter(r => r.pts.length > 1);
  for (const r of good) { r.full = r.pts; r.pts = simplify(r.pts, .3); }
  return { runs: good, portals };
}
function simplify(P, tol) {                                     // Douglas–Peucker on (x, y, h): straight track keeps few points
  if (P.length < 3) return P;
  const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; const st = [[0, P.length - 1]];
  while (st.length) { const [a, b] = st.pop(), A = P[a], B = P[b], dx = B.x - A.x, dy = B.y - A.y, dh = B.h - A.h, L2 = dx * dx + dy * dy + dh * dh || 1e-9;
    let mi = -1, md = tol * tol;
    for (let i = a + 1; i < b; i++) { const p = P[i], t = Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.y - A.y) * dy + (p.h - A.h) * dh) / L2));
      const ex = A.x + dx * t - p.x, ey = A.y + dy * t - p.y, eh = A.h + dh * t - p.h, d = ex * ex + ey * ey + eh * eh; if (d > md) { md = d; mi = i; } }
    if (mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return P.filter((_, i) => keep[i]);
}

/* strip builder: flat-shaded prisms that follow a polyline, stored in 800 m chunks so off-screen track is skipped */
const CHUNK = 800;
function Strips() { this.c = new Map(); }
Strips.prototype.arr = function (k, x, y) { const ck = Math.floor(x / CHUNK) + "," + Math.floor(y / CHUNK); let c = this.c.get(ck); if (!c) { c = {}; this.c.set(ck, c); } return c[k] = c[k] || []; };
Strips.prototype.tri = function (P, a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
  P.push(...a, nx, ny, nz, ...b, nx, ny, nz, ...c, nx, ny, nz);
};
Strips.prototype.quad = function (P, a, b, c, d) { this.tri(P, a, b, c); this.tri(P, a, c, d); };
Strips.prototype.prism = function (k, pts, off, half, zTop, zBot, sides = true) {
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i], B = pts[i + 1]; if (Math.hypot(B.x - A.x, B.y - A.y) < .01) continue;
    const P = this.arr(k, (A.x + B.x) / 2, (A.y + B.y) / 2), nA = [-Math.sin(A.hd), Math.cos(A.hd)], nB = [-Math.sin(B.hd), Math.cos(B.hd)];
    const at = (S, n, o, z) => [S.x + n[0] * o, S.y + n[1] * o, z], tA = zTop(A), tB = zTop(B);
    const lA = at(A, nA, off + half, tA), rA = at(A, nA, off - half, tA), lB = at(B, nB, off + half, tB), rB = at(B, nB, off - half, tB);
    this.quad(P, rA, rB, lB, lA);
    if (sides) { const bA = zBot(A), bB = zBot(B);
      this.quad(P, lA, lB, at(B, nB, off + half, bB), at(A, nA, off + half, bA));
      this.quad(P, rB, rA, at(A, nA, off - half, bA), at(B, nB, off - half, bB)); }
  }
};
Strips.prototype.box = function (k, x, y, yaw, lx, ly, z0, z1) {        // upright box without a bottom face
  const P = this.arr(k, x, y), c = Math.cos(yaw), s = Math.sin(yaw), pt = (u, v, z) => [x + c * u - s * v, y + s * u + c * v, z], hx = lx / 2, hy = ly / 2;
  const q = [pt(-hx, -hy, 0), pt(hx, -hy, 0), pt(hx, hy, 0), pt(-hx, hy, 0)];
  const lo = q.map(p => [p[0], p[1], z0]), hi = q.map(p => [p[0], p[1], z1]);
  this.quad(P, hi[0], hi[1], hi[2], hi[3]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.quad(P, lo[i], lo[j], hi[j], hi[i]); }
};
Strips.prototype.meshes = function (group) {
  group.userData.chunks = [];
  for (const [ck, mats] of this.c) {
    const [gx, gy] = ck.split(",").map(Number);
    for (const [k, A] of Object.entries(mats)) {
      const g = new THREE.BufferGeometry(), ib = new THREE.InterleavedBuffer(new Float32Array(A), 6);
      g.setAttribute("position", new THREE.InterleavedBufferAttribute(ib, 3, 0)); g.setAttribute("normal", new THREE.InterleavedBufferAttribute(ib, 3, 3)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, T.mat[k]); group.add(m); group.userData.chunks.push({ m, x: (gx + .5) * CHUNK, y: (gy + .5) * CHUNK });
    }
  }
};
function cullChunks(group, R) {                                  // hide chunks beyond R metres of the view centre
  const c = map.getCenter(), [cx, cy] = T.toLocal(c.lng, c.lat);
  for (const ch of group.userData.chunks || []) ch.m.visible = Math.hypot(ch.x - cx, ch.y - cy) < R + CHUNK * .71;
}

/* ---------- Chicago L structure: plate girders on steel bents; ballast bed at grade; tunnel portals ---------- */
function buildStructure(net) {
  const g = new THREE.Group(), S = new Strips();
  for (const run of net.runs) {
    const pts = run.pts, elev = s => s.h > .6;
    let piece = [pts[0]], mode = elev(pts[0]);
    const flush = () => {
      if (piece.length < 2) return;
      if (mode) {
        for (const t of [-TRACK_HALF, TRACK_HALF]) S.prism("girder", piece, t, .95, s => s.h - .12, s => Math.max(0, s.h - 1.3));
        for (const t of [-TRACK_HALF, TRACK_HALF]) S.prism("tie", piece, t, 1.3, s => s.h, s => s.h - .1, false);
      } else {
        S.prism("ballast", piece, 0, 4.4, s => .3 + s.h, s => 0);
        for (const t of [-TRACK_HALF, TRACK_HALF]) S.prism("tie", piece, t, 1.3, s => .34 + s.h, s => .3, false);
      }
    };
    for (let i = 1; i < pts.length; i++) { const e = elev(pts[i]);
      if (e !== mode) { piece.push(pts[i]); flush(); piece = [pts[i]]; mode = e; } else piece.push(pts[i]); }
    flush();
    // steel bents every 15 m along the unsimplified samples: two columns and a cap beam
    let acc = 0; const F = run.full;
    for (let i = 1; i < F.length; i++) { acc += Math.hypot(F[i].x - F[i - 1].x, F[i].y - F[i - 1].y); if (acc < 15) continue; acc = 0;
      const b = F[i]; if (b.h <= 2.2) continue; const nx = -Math.sin(b.hd), ny = Math.cos(b.hd), top = b.h - 1.3;
      for (const s of [-1, 1]) S.box("steel", b.x + nx * 3.4 * s, b.y + ny * 3.4 * s, b.hd, .5, .5, 0, top);
      S.box("steel", b.x, b.y, b.hd, .6, 7.6, top - .6, top); }
  }
  for (const p of net.portals) {                                 // portals: wing walls, header, dark mouth
    const c = Math.cos(p.hd), s = Math.sin(p.hd), at = (u, v) => [p.x + c * u - s * v, p.y + s * u + c * v];
    for (const v of [-4.9, 4.9]) { const q = at(7, v); S.box("concrete", q[0], q[1], p.hd, 14, .7, 0, 1.2); }
    S.box("concrete", p.x, p.y, p.hd, .7, 10.5, 0, 1.4);
    const m = at(-5, 0); S.box("tunnel", m[0], m[1], p.hd, 10, 8.6, 0, .04);
  }
  S.meshes(g);
  return g;
}

/* steel rails: four per two-track run, visible from street zoom */
function buildRails(net) {
  const g = new THREE.Group(), S = new Strips();
  for (const run of net.runs) for (const t of [-TRACK_HALF, TRACK_HALF]) for (const r of [-GAUGE_HALF, GAUGE_HALF]) {
    const top = s => (s.h > .6 ? s.h + .18 : .52 + s.h);
    S.prism("rail", run.pts, t + r, .055, top, s => top(s) - .16, false);
  }
  S.meshes(g); return g;
}

/* wooden ties, instanced around the camera only (thousands up close, none far away) */
function buildTieMeshes() {
  const box = new THREE.BoxGeometry(1, 1, 1), m = new THREE.InstancedMesh(box, T.mat.tie, 9000); m.count = 0; m.frustumCulled = false;
  const group = new THREE.Group(); group.add(m); return { group, mesh: m, key: "" };
}
function updateTies() {
  const c = map.getCenter(), z = map.getZoom(), [cx, cy] = T.toLocal(c.lng, c.lat);
  const key = Math.round(cx / 30) + ":" + Math.round(cy / 30) + ":" + Math.round(z * 2); if (key === T.ties.key) return; T.ties.key = key;
  const R = Math.max(140, Math.min(560, 560 * Math.pow(2, TIE_MIN - z))), mesh = T.ties.mesh, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(2.6, .24, .14);
  let n = 0;
  for (const run of T.net.runs) {
    const P = run.pts;
    for (let i = 0; i < P.length - 1 && n < 9000; i++) {
      const A = P[i], B = P[i + 1]; if (Math.hypot(A.x - cx, A.y - cy) > R + 10) continue;
      const L = Math.hypot(B.x - A.x, B.y - A.y), hd = Math.atan2(B.y - A.y, B.x - A.x); e.set(0, 0, hd + Math.PI / 2); q.setFromEuler(e);
      const nx = -Math.sin(hd), ny = Math.cos(hd);
      for (let s = .3; s < L && n < 9000; s += .62) { const f = s / L, x = A.x + (B.x - A.x) * f, y = A.y + (B.y - A.y) * f, h = A.h + (B.h - A.h) * f, zt = h > .6 ? h + .02 : .37 + h;
        for (const t of [-TRACK_HALF, TRACK_HALF]) { v.set(x + nx * t, y + ny * t, zt); m4.compose(v, q, sc); mesh.setMatrixAt(n++, m4); } }
    }
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
}

/* ---------- see-through buildings: roof outlines, corner edges and floor lines drawn through the walls ---------- */
let edgeTimer = 0;
function scheduleEdges() { clearTimeout(edgeTimer); edgeTimer = setTimeout(buildEdges, 350); }
function buildEdges() {
  if (!T || !T.edges) return;
  const z = map.getZoom();
  if (SET.seeThrough !== "see" || !SET.bldg3d || z < 14.6) { T.edges.geometry.setDrawRange(0, 0); return; }
  const dark = styleTheme === "dark", col = dark ? [.59, .75, 1] : [.33, .4, .5], A = dark ? [.42, .26, .11] : [.3, .18, .08], floors = z >= 15.5;
  const c = map.getCenter(), b = map.getBounds(), seen = new Set(), cand = [];
  for (const f of map.querySourceFeatures("omt", { sourceLayer: "building" })) {
    const p = f.properties || {}, h = +(p.render_height ?? p.height ?? 8), base = +(p.render_min_height ?? p.min_height ?? 0);
    if (!(h > base) || h > 600) continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
    for (const P of polys) { const ring = P[0]; if (!ring || ring.length < 4 || ring.length > 160) continue;
      const k = ring[0][0].toFixed(6) + ring[0][1].toFixed(6) + ring.length; if (seen.has(k)) continue; seen.add(k);
      const x = ring[0][0], y = ring[0][1]; if (!b.contains([x, y])) continue;
      cand.push({ ring, h, base, d: Math.hypot((x - c.lng) * KX, y - c.lat) }); }
  }
  cand.sort((a, b) => a.d - b.d);
  const pos = [], cl = [], push = (a, b, al) => { pos.push(a[0], a[1], a[2], b[0], b[1], b[2]); cl.push(...col, al, ...col, al); };
  let n = 0;
  for (const bd of cand) {
    if (n++ > 900 || pos.length > 900000) break;
    const pts = bd.ring.map(q => T.toLocal(q[0], q[1])), m = pts.length - 1;
    const step = Math.max(4, Math.ceil((bd.h - bd.base) / 10));
    for (let i = 0; i < m; i++) {
      const a = pts[i], q = pts[i + 1];
      push([a[0], a[1], bd.h], [q[0], q[1], bd.h], A[0]);
      const pr = pts[(i - 1 + m) % m], u = [a[0] - pr[0], a[1] - pr[1]], v = [q[0] - a[0], q[1] - a[1]];
      const turn = Math.abs(u[0] * v[1] - u[1] * v[0]) / ((Math.hypot(...u) * Math.hypot(...v)) || 1);
      if (turn > .26) push([a[0], a[1], bd.base], [a[0], a[1], bd.h], A[1]);                 // only real corners
      if (floors) for (let hh = bd.base + step; hh < bd.h - 1; hh += step) push([a[0], a[1], hh], [q[0], q[1], hh], A[2]);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(cl, 4));
  T.edges.geometry.dispose(); T.edges.geometry = g; map.triggerRepaint();
}
