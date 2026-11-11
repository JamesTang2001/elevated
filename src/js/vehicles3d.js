/* ===== Elevated v2 — 3D vehicles: CTA L car, Metra bilevel coach + locomotive, CTA bus (original procedural models) =====
   Each model is built once per material and drawn with instancing. Nearby vehicles get the detailed model,
   the rest a light three-box version, so a 2018 Intel laptop can keep up. */
const CARS_N = { red: 8, blue: 8, brn: 8, g: 6, o: 8, pnk: 6, p: 8, y: 2 };
const VDIM = { L: { len: 14.6, gap: .9 }, M: { len: 25.9, gap: 1.1 }, ML: { len: 21, gap: 1.1 }, B: { len: 12.5, gap: 0 }, AC: { len: 22, gap: 1.1 }, AS: { len: 25.9, gap: 1.1 }, AA: { len: 25.9, gap: 1.1 }, SS: { len: 25.9, gap: .9 } };
const LO_OF = { M: "Mlo", ML: "Mlo", AC: "AAlo", AS: "ASlo", AA: "AAlo", SS: "SSlo" };
const HI_CAP = { L: 240, M: 90, ML: 24, B: 90 }, LO_CAP = 2200;

/* geometry collector: boxes and cylinders in model space (x forward, y left, z up from rail top) */
function Geo() { this.p = {}; }
Geo.prototype.add = function (k, g, x, y, z, rx = 0) {
  g = g.index ? g.toNonIndexed() : g; if (rx) g.rotateX(rx); g.translate(x, y, z);
  const P = g.attributes.position.array, N = g.attributes.normal.array, A = this.p[k] = this.p[k] || [];
  for (let i = 0; i < P.length; i += 3) A.push(P[i], P[i + 1], P[i + 2], N[i], N[i + 1], N[i + 2]);
  g.dispose(); return this;
};
Geo.prototype.box = function (k, x0, x1, y0, y1, z0, z1) { return this.add(k, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); };
Geo.prototype.wheel = function (k, x, y, z, r, w) { return this.add(k, new THREE.CylinderGeometry(r, r, w, 10), x, y, z); };          // cylinder axis = y (lateral)
Geo.prototype.both = function (k, x0, x1, y, t, z0, z1) { this.box(k, x0, x1, y, y + t, z0, z1); return this.box(k, x0, x1, -y - t, -y, z0, z1); };
Geo.prototype.windows = function (k, x0, x1, w, gap, y, z0, z1) { for (let x = x0; x + w <= x1 + .01; x += w + gap) this.both(k, x, x + w, y, .03, z0, z1); return this; };
Geo.prototype.done = function () { const out = {}; for (const [k, A] of Object.entries(this.p)) {
  const g = new THREE.BufferGeometry(), ib = new THREE.InterleavedBuffer(new Float32Array(A), 6);
  g.setAttribute("position", new THREE.InterleavedBufferAttribute(ib, 3, 0)); g.setAttribute("normal", new THREE.InterleavedBufferAttribute(ib, 3, 3)); out[k] = g; } return out; };

function modelLlo() { const G = new Geo(); G.box("body", -7.3, 7.3, -1.42, 1.42, .5, 3.4); G.both("glass", -6.8, 6.8, 1.42, .03, 2.02, 2.94); G.box("accent", 7.3, 7.34, -.72, .72, 3.0, 3.28); G.box("accent", -7.34, -7.3, -.72, .72, 3.0, 3.28); return G.done(); }
function modelMlo() { const G = new Geo(); G.box("body", -12.95, 12.95, -1.6, 1.6, .6, 4.8); G.both("glass", -12, 12, 1.6, .03, 1.72, 2.46); G.both("glass", -12, 12, 1.6, .03, 3.28, 3.98); G.both("accent", -12.9, 12.9, 1.6, .035, 2.66, 2.8); return G.done(); }
function modelBlo() { const G = new Geo(); G.box("white", -6.25, 6.25, -1.3, 1.3, .2, 3.1); G.both("glass", -5.9, 5.9, 1.3, .03, 1.3, 2.56); G.box("glass", 6.25, 6.28, -1.16, 1.16, .95, 2.6); return G.done(); }
/* headlight beam: a soft fan on the track ahead (vertex alpha, additive) */
function beamGeo() {
  const g = new THREE.BufferGeometry(), L = 26, segs = 8, pos = [], col = [];
  for (let i = 0; i < segs; i++) { const a = i / segs, b = (i + 1) / segs, wa = .7 + a * 6, wb = .7 + b * 6, A = .55 * (1 - a) ** 1.6, Bv = .55 * (1 - b) ** 1.6;
    pos.push(a * L, wa / 2, 0, a * L, -wa / 2, 0, b * L, -wb / 2, 0, a * L, wa / 2, 0, b * L, -wb / 2, 0, b * L, wb / 2, 0);
    col.push(1, .92, .74, A, 1, .92, .74, A, 1, .92, .74, Bv, 1, .92, .74, A, 1, .92, .74, Bv, 1, .92, .74, Bv); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); return g;
}

function modelAlo(h) { const G = new Geo(); G.box("silver", -12.95, 12.95, -1.55, 1.55, .6, h); G.both("glass", -12, 12, 1.55, .03, h - 1.6, h - .8); G.both("navy", -12.9, 12.9, 1.55, .035, 1.85, 2.1); return G.done(); }
/* boats (water at z = 0): Chicago Water Taxi, river architecture tour boat, lake freighter, tug, small craft */
function modelWT() {
  const G = new Geo();
  G.box("yellow", -9, 8, -2.6, 2.6, -.6, 1.1); G.box("yellow", 8, 10, -1.7, 1.7, -.4, 1.1);
  G.box("dark", -9.05, 10.05, -2.65, 2.65, -.2, .05);
  G.box("white", -6.5, 6.5, -2.3, 2.3, 1.1, 3.0); G.windows("glass", -6.2, 6.2, 1.05, .25, 2.3, 1.6, 2.7);
  G.box("glass", 6.5, 6.53, -2.0, 2.0, 1.6, 2.7); G.box("yellow", -7, 7, -2.45, 2.45, 3.0, 3.18);
  G.both("dark", -7, 7, 2.3, .06, 3.18, 3.95);                                  // upper-deck railing
  for (let x = -5.5; x <= 5; x += 1.4) G.box("door", x, x + .9, -1.8, 1.8, 3.18, 3.6);   // benches
  return G.done();
}
function modelTB() {
  const G = new Geo();
  G.box("white", -14, 12, -4, 4, -.8, 1.4); G.box("white", 12, 15, -2.6, 2.6, -.6, 1.4);
  G.box("navy", -14.05, 15.05, -4.05, 4.05, -.2, .25);
  G.box("white", -12, 10.5, -3.6, 3.6, 1.4, 3.6); G.windows("glass", -11.5, 10, 1.6, .3, 3.6, 2.0, 3.3);
  G.box("glass", 10.5, 10.53, -3.2, 3.2, 2.0, 3.3); G.box("navy", -12.4, 10.9, -3.8, 3.8, 3.6, 3.8);
  G.both("white", -12, 10.5, 3.6, .06, 3.8, 4.7);
  for (let x = -10.5; x <= 9; x += 1.2) G.box("door", x, x + .75, -3.0, 3.0, 3.8, 4.25);  // rows of seats on the open top deck
  G.box("white", 6.5, 9.5, -1.5, 1.5, 3.8, 5.2); G.box("glass", 9.5, 9.53, -1.3, 1.3, 4.3, 5.0);
  return G.done();
}
function modelCG() {                                                            // ~100 m in model units, scaled by reported length
  const G = new Geo();
  G.box("hullred", -50, 46, -6, 6, -1.5, 4); G.box("hullred", 46, 51, -4, 4, -1, 4); G.box("dark", -50.1, 51.1, -6.05, 6.05, 1.5, 4.05);
  G.box("roof", -36, 42, -5.2, 5.2, 4, 4.6); for (let x = -32; x < 40; x += 6) G.box("roofdark", x, x + 4.6, -4.6, 4.6, 4.6, 4.9);   // hatches
  G.box("white", -49, -38, -5.6, 5.6, 4, 12); G.windows("glass", -48.5, -38.5, 1.4, .5, 5.6, 9.6, 10.8); G.box("glass", -38, -37.97, -5, 5, 9.6, 10.8);
  G.box("dark", -47, -44, -1.2, 1.2, 12, 15); G.box("white", 44, 49, -3.5, 3.5, 4, 7.5);
  return G.done();
}
function modelTG() {
  const G = new Geo();
  G.box("hullred", -9, 7, -3.4, 3.4, -.8, 1.6); G.box("hullred", 7, 9.5, -2.2, 2.2, -.6, 1.6); G.box("dark", -9.05, 9.55, -3.45, 3.45, 1.2, 1.7);
  G.box("white", -3, 4, -2.4, 2.4, 1.6, 4.0); G.box("white", 0, 3.6, -1.9, 1.9, 4.0, 6.0); G.box("glass", 3.6, 3.63, -1.7, 1.7, 4.6, 5.6); G.both("glass", .3, 3.3, 1.9, .03, 4.6, 5.6);
  G.box("dark", -2.4, -1.2, -.5, .5, 4.0, 7.2);
  return G.done();
}
function modelSM() {
  const G = new Geo();
  G.box("white", -5, 4, -1.6, 1.6, -.4, .9); G.box("white", 4, 6, -.9, .9, -.3, .9); G.box("navy", -5.05, 6.05, -1.65, 1.65, -.1, .15);
  G.box("white", -1.5, 2, -1.2, 1.2, .9, 2.2); G.box("glass", 2, 2.03, -1, 1, 1.3, 2.0);
  return G.done();
}

function buildVehicleMeshes() {
  const L = c => new THREE.MeshLambertMaterial({ color: c }), B = c => new THREE.MeshBasicMaterial({ color: c });
  const env = envTexture(), S = (c, metal, rough) => new THREE.MeshStandardMaterial({ color: c, metalness: metal, roughness: rough, envMap: env });   // stainless, paint and glass pick up soft reflections
  const VM = { body: S(0xc6cbd2, .75, .32), white: S(0xf1f2f3, .1, .38), roof: S(0x9ba1a9, .6, .45), roofdark: L(0x5d636b), dark: L(0x2b2f35), wheel: L(0x1b1e22), door: S(0xa9afb7, .7, .35),
    glass: new THREE.MeshStandardMaterial({ color: 0x1d2630, metalness: .3, roughness: .08, envMap: env, emissive: 0 }), accent: B(0xffffff), loco: S(0x23447a, .2, .4), navy: S(0x1d3f6e, .2, .4), stripe: S(0xc8102e, .2, .4), amber: B(0xffb547),
    silver: S(0xb7bdc5, .75, .3), maroon: S(0x7a2632, .2, .4), orange: S(0xe08a2e, .2, .4), yellow: L(0xf2c200), hullred: L(0x8f2f2a),
    head: B(0xfff6d8), tail: B(0xff3b30), beam: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }) };
  const VL = {}; for (const [k, m] of Object.entries(VM)) VL[k] = m.isMeshStandardMaterial ? new THREE.MeshLambertMaterial({ color: m.color, emissive: m.emissive || 0 }) : m;   // far-away vehicles: cheaper materials
    const sub = {}; for (const k of ["body", "roof", "roofdark", "dark", "wheel", "door", "glass", "accent"]) { sub[k] = VM[k].clone(); sub[k].transparent = true; sub[k].depthWrite = false; }
  const group = new THREE.Group(), sets = {};
  const make = (name, geos, cap, mset) => { const s = {}; for (const [k, g] of Object.entries(geos)) { const m = new THREE.InstancedMesh(g, mset[k], cap); m.count = 0; m.frustumCulled = false;
      if (k === "accent") m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); group.add(m); s[k] = m; } sets[name] = { meshes: s, cap, n: 0 }; };
  const gL = modelL(), gLlo = modelLlo();
  make("L", gL, HI_CAP.L, VM); make("Llo", gLlo, LO_CAP, VL); make("Ls", gL, 120, sub); make("Llos", gLlo, LO_CAP, sub);
  const gL7 = modelL(true); make("L7", gL7, 120, VM); make("L7s", gL7, 60, sub);                   // the newer car with the black face
  make("M", modelM(), HI_CAP.M, VM); make("Mlo", modelMlo(), 900, VL); make("ML", modelML(), HI_CAP.ML, VM);
  make("AC", modelAC(), 40, VM); make("AS", modelAS(), 120, VM); make("AA", modelAA(), 160, VM); make("ASlo", modelAlo(4.95), 300, VL); make("AAlo", modelAlo(3.95), 300, VL);
  make("SS", modelSS(), 140, VM); make("SSlo", modelAlo(3.95), 300, VL);
  make("WT", modelWT(), 24, VM); make("TB", modelTB(), 24, VM); make("CG", modelCG(), 30, VM); make("TG", modelTG(), 30, VM); make("SM", modelSM(), 80, VM);
  make("B", modelB(), HI_CAP.B, VM); make("Blo", modelBlo(), 1600, VL); make("BA", modelBA(), 60, VM);
  const box = new THREE.BoxGeometry(1, 1, 1), lamp = (mat, cap) => { const m = new THREE.InstancedMesh(box, mat, cap); m.count = 0; m.frustumCulled = false; group.add(m); return m; };
  const beams = new THREE.InstancedMesh(beamGeo(), VM.beam, 400); beams.count = 0; beams.frustumCulled = false; beams.renderOrder = 3; group.add(beams);
  return { group, sets, VM, VL, sub, head: lamp(VM.head, 1600), tail: lamp(VM.tail, 1600), beams };
}
function syncVehicleTheme(dark, n) {
  if (!T || !T.veh) return;
  const { VM, sub } = T.veh, lit = n > .4 || dark;
  VM.body.color.set(dark ? 0xaab2bc : 0xc6cbd2); VM.silver.color.set(dark ? 0xa3aab3 : 0xb7bdc5); VM.white.color.set(dark ? 0xe4e7ea : 0xf1f2f3);
  for (const m of Object.values(VM)) if (m.isMeshStandardMaterial) m.envMapIntensity = lit ? .25 : .9;
  VM.glass.color.set(lit ? 0x3b3020 : 0x1d2630); VM.glass.emissive.set(lit ? 0xffc879 : 0); VM.glass.emissiveIntensity = lit ? .8 : 0;
  for (const k in sub) { sub[k].color.copy(VM[k].color); if (VM[k].emissive) { sub[k].emissive.copy(VM[k].emissive); sub[k].emissiveIntensity = VM[k].emissiveIntensity; } sub[k].opacity = SET.seeThrough === "see" ? .36 : .78; }
  for (const [k, m] of Object.entries(T.veh.VL)) if (m !== VM[k]) { m.color.copy(VM[k].color); if (m.emissive && VM[k].emissive) { m.emissive.copy(VM[k].emissive); m.emissiveIntensity = VM[k].emissiveIntensity; } }
  T.veh.night = lit;
}

/* ---------- per-frame placement ---------- */
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function placeInst(set, x, y, z, yaw, sx, sy, sz, color) {
  if (set.n >= set.cap) return false;
  _e.set(0, 0, yaw); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(sx, sy, sz); _m4.compose(_v, _q, _s);
  for (const [k, m] of Object.entries(set.meshes)) { m.setMatrixAt(set.n, _m4); if (k === "accent" && color) { _c.set(color); m.instanceColor.setXYZ(set.n, _c.r, _c.g, _c.b); } }
  set.n++; return true;
}
function lamp(mesh, x, y, z, yaw, w) { if (mesh.count >= 1600) return; _e.set(0, 0, yaw); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(.12, w, .22); _m4.compose(_v, _q, _s); mesh.setMatrixAt(mesh.count++, _m4); }
function sizeK(z) {                                           // Cute: oversized; Easy: wider and taller when far; True: real scale
  if (SET.tsize === "chibi") return [2.3, 2.3, 2.3];
  if (SET.tsize === "easy" && z < 16.2) { const f = Math.min(1, (16.2 - z) / 1.4); return [1, 1 + .7 * f, 1 + .35 * f]; }
  return [1, 1, 1];
}
function update3dVehicles(trains, buses, boats) {
  const V = T.veh; for (const s of Object.values(V.sets)) s.n = 0; V.head.count = V.tail.count = V.beams.count = 0;
  const z = map.getZoom(), c = map.getCenter(), [cx, cy] = T.toLocal(c.lng, c.lat), reach = 9000 / Math.pow(2, z - 14), hiR = 900 / Math.pow(2, Math.max(0, z - 15.5));
  let gx = cx, gy = cy; try { const cp = map.getFreeCameraOptions().position.toLngLat(); [gx, gy] = T.toLocal(cp.lng, cp.lat); } catch (e) {}   // the point under the camera
  const viewD = (x, y) => { const ux = cx - gx, uy = cy - gy, L2 = ux * ux + uy * uy || 1, f = Math.max(0, Math.min(1, ((x - gx) * ux + (y - gy) * uy) / L2)); return Math.hypot(x - gx - ux * f, y - gy - uy * f); };   // distance to the line of sight, so the nearest vehicles get the detailed model
  const k = sizeK(z), few = SET.tsize === "chibi";
  const near = [];
  const beyond = (lon, lat) => HZ.y > 0 && map.project([lon, lat]).y < HZ.y + 6;   // past the edge of the drawn ground: would float against the sky
  for (const v of trains) { if (!v.coords) continue; const p = T.toLocal(v.lon, v.lat), d = Math.hypot(p[0] - cx, p[1] - cy); if (d < reach && !beyond(v.lon, v.lat)) near.push([viewD(p[0], p[1]), v]); }
  near.sort((a, b) => a[0] - b[0]);
  const hiUsed = { L: 0, M: 0 };
  for (const [dist, v] of near) {
    const fam = v.ag === "amtrak" ? "am" : v.ag === "ss" ? "ss" : v.type === "metra" ? "metra" : "L", metra = fam !== "L";
    const n0 = fam === "am" ? (v.long || /Zephyr|Builder|Chief|Eagle|Orleans/.test(MNAME(v.line) || "") ? 8 : 5) : fam === "ss" ? 4 : metra ? 7 : (CARS_N[v.line] || 6), n = few ? Math.min(3, n0) : n0;
    const hi = dist < hiR && (metra ? hiUsed.M < HI_CAP.M - 8 : hiUsed.L < HI_CAP.L - 8);
    let off = 0;
    for (let i = 0; i < n; i++) {
      const kind = fam === "am" ? (i === 0 ? "AC" : n0 === 8 ? "AS" : "AA") : fam === "ss" ? "SS" : metra ? (i === 0 ? "ML" : "M") : "L", dim = VDIM[kind], Lk = dim.len * k[0];
      const dc = v.d - v.sgn * (off + Lk / 2); off += Lk + dim.gap * k[0];
      if (dc < 0 || dc > v.cum[v.cum.length - 1]) continue;
      const a = along(v.coords, v.cum, dc), b = along(v.coords, v.cum, dc + v.sgn * 4), la = T.toLocal(a[0], a[1]), lb = T.toLocal(b[0], b[1]);
      const yaw = Math.atan2(lb[1] - la[1], lb[0] - la[0]), rd = v.route ? v.routeD(dc) : 0;
      const sub = v.route && kindAt(v.route, rd) === "sub", h = v.route ? heightAt(v.route, rd) : 0, zc = (h > .6 ? h + .2 : .52 + h);
      let set;
      if (metra) set = hi && V.sets[kind].n < V.sets[kind].cap ? V.sets[kind] : V.sets[LO_OF[kind]]; else set = hi ? (v.line === "blue" ? (sub ? V.sets.L7s : V.sets.L7) : (sub ? V.sets.Ls : V.sets.L)) : (sub ? V.sets.Llos : V.sets.Llo);
      if (hi) hiUsed[metra ? "M" : "L"]++;
      placeInst(set, la[0], la[1], zc, yaw, k[0], k[1], k[2], v.color);
      const front = Lk / 2 + .05, cy0 = Math.cos(yaw), sy0 = Math.sin(yaw), hz = zc + (metra ? 1.6 : 1.4) * k[2], wy = (metra ? .9 : .78) * k[1];
      if (i === 0) {                                          // headlights, and a beam on the rails at night
        for (const s of [-1, 1]) lamp(V.head, la[0] + cy0 * front - sy0 * wy * s, la[1] + sy0 * front + cy0 * wy * s, hz, yaw, .22 * k[1]);
        if (V.night && SET.nightLights !== false && !sub && V.beams.count < 400) { _e.set(0, 0, yaw); _q.setFromEuler(_e); _v.set(la[0] + cy0 * front, la[1] + sy0 * front, zc + .08); _s.set(k[0], k[1], 1); _m4.compose(_v, _q, _s); V.beams.setMatrixAt(V.beams.count++, _m4); }
      }
      if (i === n - 1) for (const s of [-1, 1]) lamp(V.tail, la[0] - cy0 * front - sy0 * wy * s, la[1] - sy0 * front + cy0 * wy * s, hz, yaw, .2 * k[1]);
    }
  }
  // buses
  let hb = 0;
  for (const b of buses) {
    const p = T.toLocal(b.lon, b.lat), d = Math.hypot(p[0] - cx, p[1] - cy); if (d > reach * .7 || beyond(b.lon, b.lat)) continue;
    const yaw = b.yaw, hiB = viewD(p[0], p[1]) < hiR * .8 && hb < HI_CAP.B - 4, set = hiB ? (hb++, b.artic ? V.sets.BA : V.sets.B) : V.sets.Blo;
    placeInst(set, p[0], p[1], 0, yaw, b.artic && !hiB ? k[0] * 1.46 : k[0], k[1], k[2], null);
    const front = (b.artic ? 9.2 : 6.3) * k[0], cy0 = Math.cos(yaw), sy0 = Math.sin(yaw), hz = .95 * k[2];
    for (const s of [-1, 1]) { lamp(V.head, p[0] + cy0 * front - sy0 * .95 * s * k[1], p[1] + sy0 * front + cy0 * .95 * s * k[1], hz, yaw, .2); lamp(V.tail, p[0] - cy0 * front - sy0 * .95 * s * k[1], p[1] - sy0 * front + cy0 * .95 * s * k[1], 1.2 * k[2], yaw, .18); }
    if (V.night && SET.nightLights !== false && V.beams.count < 400) { _e.set(0, 0, yaw); _q.setFromEuler(_e); _v.set(p[0] + cy0 * front, p[1] + sy0 * front, .06); _s.set(.6 * k[0], .7 * k[1], 1); _m4.compose(_v, _q, _s); V.beams.setMatrixAt(V.beams.count++, _m4); }
  }
  // boats: water taxis, tour boats and live ships
  for (const b of boats || []) {
    const p = T.toLocal(b.lon, b.lat), d = Math.hypot(p[0] - cx, p[1] - cy); if (d > reach * .8 || beyond(b.lon, b.lat)) continue;
    const kind = b.kind === "taxi" ? "WT" : b.kind === "tour" || b.kind === "shippass" ? "TB" : b.kind === "cargo" ? "CG" : b.kind === "tug" ? "TG" : "SM";
    const len = b.ship && b.ship.len ? +b.ship.len : 0, sx = kind === "CG" ? Math.max(.6, Math.min(2.4, (len || 120) / 101)) : kind === "SM" && len ? Math.max(.6, Math.min(3, len / 11)) : 1;
    const kb = SET.tsize === "chibi" ? 1.8 : 1;
    placeInst(V.sets[kind], p[0], p[1], 0, b.yaw || 0, sx * kb, (kind === "CG" ? Math.min(1.6, sx) : 1) * kb, kb, null);
    if (V.night) { const L2 = (kind === "CG" ? 50 * sx : kind === "TB" ? 14 : 9) * kb, c0 = Math.cos(b.yaw || 0), s0 = Math.sin(b.yaw || 0);
      lamp(V.head, p[0] + c0 * L2 * .8, p[1] + s0 * L2 * .8, (kind === "CG" ? 15 : 5) * kb, b.yaw || 0, .3); lamp(V.tail, p[0] - c0 * L2, p[1] - s0 * L2, 2 * kb, b.yaw || 0, .25); }
  }
  for (const s of Object.values(V.sets)) for (const [kk, m] of Object.entries(s.meshes)) { m.count = s.n; m.instanceMatrix.needsUpdate = true; if (kk === "accent") m.instanceColor.needsUpdate = true; }
  V.head.instanceMatrix.needsUpdate = V.tail.instanceMatrix.needsUpdate = V.beams.instanceMatrix.needsUpdate = true;
}
