/* ===== Elevated v2 — 3D elevated stations: side platforms at deck height, canopies on columns, railings and stairs =====
   Built once for every elevated L station from the route geometry (station position, track heading, deck height).
   Where two routes run side by side (four tracks), the platforms go outside the outer tracks. Shown with the L structure. */
const PLAT_L = 125, PLAT_W = 3.4, PLAT_IN = 3.45;                     // 8-car platform length; inner edge clears the car body
function buildStations() {
  const out = new Geo(), mat = { plat: 0, canopy: 0, steel: 0, rail: 0, stair: 0 };
  const bake = (G, ox, oy, oz, yaw) => {                               // move a station's local geometry into place and merge it
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const [k, A] of Object.entries(G.p)) { const D = out.p[k] = out.p[k] || [];
      for (let i = 0; i < A.length; i += 6) { const x = A[i], y = A[i + 1], nx = A[i + 3], ny = A[i + 4];
        D.push(ox + x * c - y * s, oy + x * s + y * c, oz + A[i + 2], nx * c - ny * s, nx * s + ny * c, A[i + 5]); } } };
  const rect = (a, b, z0, z1) => [[a, z0], [b, z0], [b, z1], [a, z1]];
  let n = 0;
  for (const id of ST_IDS) {
    const st = ST[id]; if (!st.kinds || !st.kinds.includes("elev")) continue;
    const lines = [];                                                  // centre-lines of the elevated routes stopping here
    for (const r of ROUTES) { const sp = r.stops.find(x => x.id === id); if (!sp || kindAt(r, sp.d) !== "elev") continue;
      const h = heightAt(r, sp.d); if (h < 3) continue;
      const a = along(r.coords, r.cum, Math.max(0, sp.d - 10)), b = along(r.coords, r.cum, Math.min(r.length, sp.d + 10)), p = along(r.coords, r.cum, sp.d);
      const P = T.toLocal(p[0], p[1]), A = T.toLocal(a[0], a[1]), B = T.toLocal(b[0], b[1]);
      if (!lines.some(l => Math.hypot(l.x - P[0], l.y - P[1]) < 3)) lines.push({ x: P[0], y: P[1], yaw: Math.atan2(B[1] - A[1], B[0] - A[0]), h }); }
    if (!lines.length) continue;
    let { x, y, yaw, h } = lines[0], half = 0;
    if (lines.length > 1) { const o = lines[1], ny = -Math.sin(yaw), nyy = Math.cos(yaw), off = (o.x - x) * ny + (o.y - y) * nyy;   // four tracks: widen to the outer pair
      x += ny * off / 2; y += nyy * off / 2; half = Math.abs(off) / 2; h = Math.max(h, o.h); }
    const G = new Geo(), pz = h + 1.05, L2 = PLAT_L / 2, inner = half + PLAT_IN, outer = inner + PLAT_W;
    for (const s of [-1, 1]) {
      const yi = s * inner, yo = s * outer, a = Math.min(yi, yo), b = Math.max(yi, yo);
      G.box("plat", -L2, L2, a, b, pz - .45, pz);                                      // platform deck
      for (let px = -L2 + 4; px <= L2 - 4; px += 12.5) G.box("steel", px - .2, px + .2, s * (outer - .5) - .2, s * (outer - .5) + .2, h - .2, pz - .45);   // posts down to the structure
      const ca = Math.min(s * (inner - .3), s * (outer + .25)), cb = Math.max(s * (inner - .3), s * (outer + .25));
      G.box("canopy", -L2 + 8, L2 - 8, ca, cb, pz + 3.0, pz + 3.18);                    // canopy, a little shorter than the platform
      G.box("canopy", -L2 + 8, L2 - 8, s > 0 ? cb - .12 : ca, s > 0 ? cb : ca + .12, pz + 2.75, pz + 3.18);   // fascia on the street side
      for (let px = -L2 + 10; px <= L2 - 10; px += 12.5) G.box("steel", px - .1, px + .1, s * (outer - .6) - .1, s * (outer - .6) + .1, pz, pz + 3.0);   // canopy columns
      G.box("rail", -L2, L2, s > 0 ? b - .06 : a, s > 0 ? b : a + .06, pz, pz + 1.1);   // windbreak / railing on the outer edge
      // a stair from the platform end down to the sidewalk, along the street on the outside
      const sy0 = s > 0 ? b - .2 : a + .2 - 1.8, sy1 = sy0 + 1.8, run = Math.max(10, pz * 1.6), x0 = L2 * (s > 0 ? 1 : -1), x1 = x0 + run * (s > 0 ? 1 : -1);
      G.loft("stair", x0, x1, rect(sy0, sy1, pz - .4, pz), rect(sy0, sy1, 0, .4), true, true);
      G.loft("rail", x0, x1, rect(s > 0 ? sy1 - .05 : sy0, s > 0 ? sy1 : sy0 + .05, pz, pz + 1.0), rect(s > 0 ? sy1 - .05 : sy0, s > 0 ? sy1 : sy0 + .05, .4, 1.4), true, true);
    }
    bake(G, x, y, 0, yaw); n++;
  }
  const geos = out.done(), L = c => new THREE.MeshLambertMaterial({ color: c }), M = mats();
  const mset = { plat: M.concrete, canopy: L(0x55606a), steel: M.steel, rail: L(0x3d444d), stair: L(0x8e8a82) }, g = new THREE.Group();
  for (const [k, geo] of Object.entries(geos)) { const m = new THREE.Mesh(geo, mset[k]); m.frustumCulled = false; g.add(m); }
  g.userData.count = n; return g;
}
