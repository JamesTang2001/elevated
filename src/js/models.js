/* ===== Elevated v2 — detailed vehicle models (original, procedural) =====
   Bodies are lofted from rounded cross-sections (smooth roof corners, slight tumblehome), fronts are raked,
   and windshields sit on the sloped nose. Model space: x forward, y left, z up. Lengths match VDIM. */

/* rounded body cross-section in the y–z plane, counter-clockwise: w half-width at the shoulder, bw at the sill */
function rprof(w, zb, zt, r, bw = w, seg = 4) {
  const P = [[-bw, zb], [bw, zb], [w, zb + Math.min(.35, (zt - zb) * .15)]];
  for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI / 2; P.push([w - r + Math.cos(a) * r, zt - r + Math.sin(a) * r]); }
  for (let i = 0; i <= seg; i++) { const a = Math.PI / 2 + i / seg * Math.PI / 2; P.push([-(w - r) + Math.cos(a) * r, zt - r + Math.sin(a) * r]); }
  P.push([-w, zb + Math.min(.35, (zt - zb) * .15)]); return P;
}
const shrink = (P, sy, zTop, zb) => { const t0 = Math.max(...P.map(p => p[1])); return P.map(([y, z]) => [y * sy, zb + (z - zb) * (zTop - zb) / (t0 - zb)]); };   // narrower, lower ring with the same points
/* loft between two rings (same point count) from x0 to x1; smooth normals around the ring; optional end caps */
Geo.prototype.loft = function (k, x0, x1, A, B, capA = false, capB = false) {
  const D = this.p[k] = this.p[k] || [], n = A.length, nrm = R => R.map((p, i) => { const a = R[(i - 1 + n) % n], b = R[(i + 1) % n], ty = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(ty, tz) || 1; return [tz / l, -ty / l]; });
  const NA = nrm(A), NB = nrm(B), push = (q, nn) => D.push(q[0], q[1], q[2], nn[0], nn[1], nn[2]);
  const tri = (a, b, c, na, nb, nc, ref) => {                          // wind each triangle so its front faces outward
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (cr[0] * ref[0] + cr[1] * ref[1] + cr[2] * ref[2] < 0) { push(a, na); push(c, nc); push(b, nb); } else { push(a, na); push(b, nb); push(c, nc); } };
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, a = [x0, ...A[i]], b = [x1, ...B[i]], c = [x1, ...B[j]], d = [x0, ...A[j]];
    const na = [0, ...NA[i]], nb = [0, ...NB[i]], nc = [0, ...NB[j]], nd = [0, ...NA[j]], ref = [0, NA[i][0] + NA[j][0], NA[i][1] + NA[j][1]];
    tri(a, b, c, na, nb, nc, ref); tri(a, c, d, na, nc, nd, ref); }
  const cap = (x, R, s) => { const c = [x, R.reduce((a, p) => a + p[0], 0) / n, R.reduce((a, p) => a + p[1], 0) / n], N = [s, 0, 0];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; tri(c, [x, ...R[i]], [x, ...R[j]], N, N, N, N); } };
  if (capA) cap(x0, A, x1 > x0 ? -1 : 1); if (capB) cap(x1, B, x1 > x0 ? 1 : -1);
  return this;
};
/* a flat panel through four points (both faces), e.g. a windshield lying on a raked nose */
Geo.prototype.quad = function (k, a, b, c, d) {
  const D = this.p[k] = this.p[k] || [], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  let N = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const l = Math.hypot(...N) || 1; N = N.map(x => x / l);
  const tri = (p, q, r, s) => { for (const P of [p, q, r]) D.push(P[0], P[1], P[2], N[0] * s, N[1] * s, N[2] * s); };
  tri(a, b, c, 1); tri(a, c, d, 1); tri(a, c, b, -1); tri(a, d, c, -1); return this;
};
/* a windshield on the raked section between x0 (full ring top zA, half-width wA) and x1 (zB, wB), lifted 3 cm off the skin */
function shield(G, k, x0, x1, zA0, zA1, zB0, zB1, wA, wB, s = 1) {
  const o = .03, X0 = x0 * s, X1 = x1 * s, dx = (x1 - x0), dz = (zB1 - zA1), l = Math.hypot(dx, dz), ox = dz / l * o * s, oz = -dx / l * o;
  G.quad(k, [X0 - ox, -wA, zA0 - oz], [X0 - ox, wA, zA0 - oz], [X1 - ox, wB, zB1 - oz], [X1 - ox, -wB, zB1 - oz]);
}
function trucks(G, xs, axle, r, z, frameW) { for (const tx of xs) { G.box("dark", tx - axle - r * .9, tx + axle + r * .9, -frameW, frameW, z - r * .5, z + r * 1.05); for (const ax of [-axle, axle]) for (const s of [-1, 1]) G.wheel("wheel", tx + ax, s * .74, z, r, .14); } }

/* CTA L car, 48 ft. front: "5000" stainless face with a framed windshield, or "7000" black face with a wraparound windshield */
function modelL(face7000 = false) {
  const G = new Geo(), H = 7.3, P = rprof(1.42, 1.14, 3.58, .5, 1.36), E = shrink(P, .93, 3.42, 1.14);
  G.box("dark", -6.7, 6.7, -1.2, 1.2, .62, 1.14); trucks(G, [-4.9, 4.9], .95, .36, .36, 1.08);
  G.loft("body", -6.85, 6.85, P, P);
  for (const s of [-1, 1]) { G.loft("body", 6.85 * s, H * s, P, E, false, true); }
  for (const x of [-3.7, 3.7]) { G.loft("roofdark", x - 1.1, x + 1.1, rprof(.82, 3.5, 3.86, .14), rprof(.82, 3.5, 3.86, .14), true, true); }
  for (const dx of [-3.4, 3.4]) { G.both("door", dx - .72, dx + .72, 1.405, .03, 1.18, 3.08); G.both("glass", dx - .62, dx - .06, 1.43, .02, 2.05, 2.92); G.both("glass", dx + .06, dx + .62, 1.43, .02, 2.05, 2.92); }
  G.windows("glass", -6.6, -4.3, 1.08, .14, 1.41, 2.02, 2.94).windows("glass", -2.55, 2.55, 1.12, .14, 1.41, 2.02, 2.94).windows("glass", 4.3, 6.6, 1.08, .14, 1.41, 2.02, 2.94);
  G.both("accent", -.55, .55, 1.41, .035, 2.98, 3.14);
  for (const s of [-1, 1]) {
    if (face7000) { G.quad("dark", [H * s + .02 * s, -1.3, 1.25], [H * s + .02 * s, 1.3, 1.25], [H * s + .02 * s, 1.3, 3.3], [H * s + .02 * s, -1.3, 3.3]); shield(G, "glass", 6.95, H, 1.95, 2.0, 1.95, 3.2, 1.25, 1.18, s); }
    else { shield(G, "glass", 6.95, H, 2.0, 2.0, 2.0, 3.0, .95, .9, s); G.quad("dark", [H * s + .02 * s, -1.25, 1.2], [H * s + .02 * s, 1.25, 1.2], [H * s + .02 * s, 1.25, 1.75], [H * s + .02 * s, -1.25, 1.75]); }
    G.box("accent", s > 0 ? H - .02 : -H - .02, s > 0 ? H + .02 : -H + .02, -.62, .62, 3.12, 3.32);
  }
  return G.done();
}
/* Metra bilevel gallery coach, 85 ft */
function modelM() {
  const G = new Geo(), H = 12.95, P = rprof(1.6, 1.16, 4.84, .5, 1.52);
  G.box("dark", -12.2, 12.2, -1.35, 1.35, .7, 1.16); trucks(G, [-9.7, 9.7], 1.3, .46, .46, 1.15);
  G.loft("body", -H, H, P, P, true, true);
  G.both("door", -.95, .95, 1.6, .025, 1.18, 3.4); G.both("glass", -.85, -.06, 1.625, .02, 2.1, 3.2); G.both("glass", .06, .85, 1.625, .02, 2.1, 3.2);
  for (const [a, b] of [[-11.9, -1.6], [1.6, 11.9]]) { G.windows("glass", a, b, 1.25, .3, 1.6, 1.72, 2.46); G.windows("glass", a + .3, b, 1.12, .43, 1.585, 3.28, 3.98); }
  G.both("accent", -12.9, 12.9, 1.6, .02, 2.66, 2.8);
  for (const s of [-1, 1]) G.box("dark", s > 0 ? H : -H - .25, s > 0 ? H + .25 : -H, -.55, .55, 1.3, 4.3);   // gangway diaphragms
  for (let x = -10; x <= 10; x += 5) G.loft("roofdark", x - .6, x + .6, rprof(.5, 4.78, 4.95, .08), rprof(.5, 4.78, 4.95, .08), true, true);
  return G.done();
}
/* Metra diesel (MP36-style): long hood, full-width cab, short raked nose */
function modelML() {
  const G = new Geo(), hood = rprof(1.32, 1.92, 4.36, .3), cab = rprof(1.55, 1.92, 4.5, .3), nose = rprof(1.4, 1.26, 2.95, .25);
  G.box("dark", -10.2, 10.2, -1.45, 1.45, .7, 1.3); trucks(G, [-6.9, 6.9], 1.6, .52, .52, 1.2);
  G.box("dark", -10.5, 10.5, -1.55, 1.55, 1.3, 1.92);                              // walkway deck
  G.loft("loco", -10.4, 6.6, hood, hood, true, false); G.loft("loco", 6.6, 9.0, cab, cab, true, true);
  G.loft("loco", 9.0, 10.5, nose, shrink(nose, .85, 2.7, 1.26), false, true);
  G.both("stripe", -10.4, 9.0, 1.33, .02, 2.0, 2.16);
  G.quad("glass", [9.02, -1.25, 3.3], [9.02, 1.25, 3.3], [9.02, 1.25, 4.2], [9.02, -1.25, 4.2]);
  G.both("glass", 7.0, 8.7, 1.555, .02, 3.3, 4.1);
  G.loft("roofdark", -9.2, 5.8, rprof(1.0, 4.3, 4.68, .2), rprof(1.0, 4.3, 4.68, .2), true, true);
  return G.done();
}
/* CTA bus, New Flyer 40 ft proportions: rounded roof, raked windshield, navy skirt with red pinstripe */
function modelB() {
  const G = new Geo(), P = rprof(1.295, .34, 3.0, .32, 1.27), F = shrink(P, .93, 2.86, .34), R = shrink(P, .97, 2.94, .34);
  for (const [x, s] of [[3.95, 1], [3.95, -1], [-2.75, 1], [-2.75, -1]]) G.wheel("wheel", x, s * 1.06, .5, .5, .3);
  G.loft("white", -6.05, 5.75, P, P); G.loft("white", 5.75, 6.25, P, F, false, true); G.loft("white", -6.05, -6.25, P, R, false, true);
  G.both("navy", -6.2, 6.2, 1.285, .016, .34, .8); G.both("stripe", -6.2, 6.2, 1.288, .018, .8, .88);
  G.windows("glass", -5.9, 4.4, 1.22, .16, 1.285, 1.3, 2.56);
  G.box("glass", 4.75, 5.95, -1.33, -1.285, .55, 2.6); G.box("glass", -.6, .65, -1.33, -1.285, .55, 2.6);
  shield(G, "glass", 5.75, 6.25, .95, .95, .95, 2.55, 1.16, 1.08);
  G.quad("amber", [6.235, -.85, 2.62], [6.235, .85, 2.62], [6.235, .85, 2.82], [6.235, -.85, 2.82]);
  G.quad("glass", [-6.24, -.85, 2.0], [-6.24, .85, 2.0], [-6.24, .85, 2.6], [-6.24, -.85, 2.6]);
  G.loft("roof", -2.7, 1.7, rprof(1.0, 2.95, 3.32, .18), rprof(1.0, 2.95, 3.32, .18), true, true);
  return G.done();
}
/* CTA articulated bus, 60 ft: front body, accordion, trailer, three axles */
function modelBA() {
  const G = new Geo(), P = rprof(1.295, .34, 3.0, .32, 1.27), F = shrink(P, .93, 2.86, .34), R = shrink(P, .97, 2.94, .34);
  for (const [x, s] of [[7.1, 1], [7.1, -1], [.4, 1], [.4, -1], [-7.0, 1], [-7.0, -1]]) G.wheel("wheel", x, s * 1.06, .5, .5, .3);
  G.loft("white", -.6, 8.65, P, P); G.loft("white", 8.65, 9.15, P, F, false, true); G.loft("white", -8.95, -1.3, P, P, false, true); G.loft("white", -8.95, -9.15, P, R, false, true);
  for (const [a, b] of [[-.6, 9.1], [-9.1, -1.3]]) { G.both("navy", a, b, 1.285, .016, .34, .8); G.both("stripe", a, b, 1.288, .018, .8, .88); }
  G.loft("dark", -1.3, -.6, shrink(P, .92, 2.9, .45), shrink(P, .92, 2.9, .45));                   // accordion joint
  G.windows("glass", -.3, 7.4, 1.22, .16, 1.285, 1.3, 2.56); G.windows("glass", -8.75, -1.5, 1.22, .16, 1.285, 1.3, 2.56);
  for (const [a, b] of [[7.65, 8.85], [2.9, 4.1], [-4.7, -3.5]]) G.box("glass", a, b, -1.33, -1.285, .55, 2.6);
  shield(G, "glass", 8.65, 9.15, .95, .95, .95, 2.55, 1.16, 1.08);
  G.quad("amber", [9.135, -.85, 2.62], [9.135, .85, 2.62], [9.135, .85, 2.82], [9.135, -.85, 2.82]);
  G.loft("roof", 1.0, 5.4, rprof(1.0, 2.95, 3.32, .18), rprof(1.0, 2.95, 3.32, .18), true, true);
  return G.done();
}
/* Amtrak Midwest diesel (Charger-style): silver carbody and a sloped wedge nose with a wide windshield */
function modelAC() {
  const G = new Geo(), P = rprof(1.55, 1.26, 4.3, .35, 1.5), M = shrink(P, .9, 3.25, 1.26), N = shrink(P, .72, 2.05, 1.26);
  G.box("dark", -10.4, 10.4, -1.4, 1.4, .72, 1.26); trucks(G, [-7.2, 7.2], 1.2, .52, .52, 1.2);
  G.loft("silver", -11, 7.6, P, P, true, false); G.loft("silver", 7.6, 9.6, P, M); G.loft("navy", 9.6, 11, M, N, false, true);
  shield(G, "glass", 7.7, 9.5, 3.4, 3.4, 3.4, 4.15, 1.3, 1.12);
  G.both("navy", -11, 9.6, 1.5, .02, 1.3, 1.95); G.both("stripe", -11, 9.6, 1.505, .025, 1.95, 2.08);
  G.loft("roofdark", -8.5, 6.5, rprof(1.1, 4.22, 4.6, .18), rprof(1.1, 4.22, 4.6, .18), true, true);
  return G.done();
}
/* Amtrak Superliner bilevel, 85 ft */
function modelAS() {
  const G = new Geo(), H = 12.95, P = rprof(1.55, 1.1, 4.95, .55, 1.48);
  G.box("dark", -12.2, 12.2, -1.3, 1.3, .7, 1.1); trucks(G, [-9.6, 9.6], 1.25, .46, .46, 1.1);
  G.loft("silver", -H, H, P, P, true, true);
  G.windows("glass", -12, 12, 1.15, .55, 1.535, 3.35, 4.25); G.windows("glass", -11.6, -3.5, 1.0, .9, 1.55, 1.5, 2.25); G.windows("glass", 3.5, 11.6, 1.0, .9, 1.55, 1.5, 2.25);
  G.both("navy", -H, H, 1.548, .02, 2.55, 2.75); G.both("stripe", -H, H, 1.55, .025, 2.75, 2.85); G.both("door", -.8, .8, 1.55, .02, 1.12, 3.0);
  for (const s of [-1, 1]) G.box("dark", s > 0 ? H : -H - .25, s > 0 ? H + .25 : -H, -.55, .55, 1.2, 4.6);
  return G.done();
}
/* Amtrak single-level coach (Horizon/Amfleet proportions), 85 ft */
function modelAA() {
  const G = new Geo(), H = 12.95, P = rprof(1.55, 1.1, 4.0, .6, 1.48);
  G.box("dark", -12.2, 12.2, -1.3, 1.3, .7, 1.1); trucks(G, [-9.6, 9.6], 1.25, .46, .46, 1.1);
  G.loft("silver", -H, H, P, P, true, true);
  G.windows("glass", -11.4, 11.4, .95, .55, 1.55, 2.35, 3.15);
  G.both("navy", -H, H, 1.55, .02, 1.85, 2.08); G.both("stripe", -H, H, 1.552, .025, 2.08, 2.18);
  for (const x of [-11.6, 11.6]) G.both("door", x - .55, x + .55, 1.55, .02, 1.12, 3.4);
  for (const s of [-1, 1]) G.box("dark", s > 0 ? H : -H - .25, s > 0 ? H + .25 : -H, -.55, .55, 1.2, 3.75);
  return G.done();
}
/* South Shore Line electric car, 85 ft: stainless, maroon and orange band, raked cab ends, pantograph */
function modelSS() {
  const G = new Geo(), H = 12.95, P = rprof(1.55, 1.1, 4.0, .55, 1.48), E = shrink(P, .9, 3.8, 1.1);
  G.box("dark", -12.2, 12.2, -1.3, 1.3, .7, 1.1); trucks(G, [-9.6, 9.6], 1.25, .46, .46, 1.1);
  G.loft("silver", -12.4, 12.4, P, P); for (const s of [-1, 1]) G.loft("silver", 12.4 * s, H * s, P, E, false, true);
  G.windows("glass", -10.6, 10.6, 1.0, .45, 1.55, 2.3, 3.2);
  G.both("maroon", -H, H, 1.55, .02, 1.75, 2.0); G.both("orange", -H, H, 1.552, .025, 2.0, 2.12);
  for (const x of [-11.8, 11.8]) G.both("door", x - .5, x + .5, 1.55, .02, 1.12, 3.4);
  for (const s of [-1, 1]) { shield(G, "glass", 12.45, H, 2.4, 2.4, 2.4, 3.35, 1.15, 1.02, s); G.quad("orange", [H * s + .01 * s, -1.3, 1.5], [H * s + .01 * s, 1.3, 1.5], [H * s + .01 * s, 1.3, 2.05], [H * s + .01 * s, -1.3, 2.05]); }
  G.box("dark", 6.4, 8.6, -.75, .75, 3.98, 4.12); G.box("dark", 7.0, 7.12, -.04, .04, 4.12, 5.1); G.box("dark", 6.3, 8.3, -.9, .9, 5.1, 5.16);   // pantograph
  return G.done();
}
/* road vehicles for simulated traffic: body ("b", painted per car) and "g" (glass, tyres, trim) */
function carModel(kind) {
  const G = new Geo();
  if (kind === "truck") {                                                    // box truck: cab and a tall box
    const box = rprof(1.15, .45, 3.4, .1), cab = rprof(1.1, .45, 2.5, .3);
    G.loft("b", -4, 1.3, box, box, true, true); G.loft("b", 1.4, 2.9, cab, cab, true, false); G.loft("b", 2.9, 3.4, cab, shrink(cab, .92, 2.1, .45), false, true);
    shield(G, "g", 2.9, 3.35, 1.5, 1.5, 1.5, 2.2, 1.0, .92); for (const x of [-2.6, 2.4]) for (const s of [-1, 1]) G.wheel("g", x, s * .95, .45, .45, .3);
    return G.done();
  }
  const suv = kind === "suv", L = suv ? 2.4 : 2.25, w = suv ? .95 : .9, zb = suv ? .3 : .25, zm = suv ? 1.2 : 1.0, zt = suv ? 1.85 : 1.45;
  const low = rprof(w, zb, zm, .22, w - .04), hood = shrink(low, .95, zm - .12, zb), top = rprof(w - .1, zm - .05, zt, .28, w - .06);
  G.loft("b", -L + .35, L - .55, low, low); G.loft("b", L - .55, L, low, hood, false, true); G.loft("b", -L + .35, -L, low, shrink(low, .97, zm - .05, zb), false, true);
  const r0 = suv ? -1.9 : -1.35, r1 = suv ? 1.0 : .55, rk = suv ? .35 : .6;                    // cabin with raked windshield and rear glass
  G.loft("g", r0 + rk * .6, r1 - rk, top, top); G.loft("g", r1 - rk, r1, top, shrink(top, .95, zm + .02, zm - .05), false, true); G.loft("g", r0 + rk * .6, r0, top, shrink(top, .95, zm + .05, zm - .05), false, true);
  G.loft("b", r0 + rk * .6 + .2, r1 - rk - .1, rprof(w - .12, zt - .06, zt + .02, .2), rprof(w - .12, zt - .06, zt + .02, .2), true, true);   // painted roof over the glasshouse
  for (const x of [-L + .75, L - .8]) for (const s of [-1, 1]) G.wheel("g", x, s * (w - .08), .34, .34, .24);
  return G.done();
}
/* soft reflections for metal, paint and glass: a tiny sky-to-ground gradient used as the environment */
let ENV_TEX = null;
function envTexture() {
  if (ENV_TEX) return ENV_TEX;
  const c = document.createElement("canvas"); c.width = 64; c.height = 32; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 32);
  gr.addColorStop(0, "#dfe9f5"); gr.addColorStop(.48, "#f4f6f8"); gr.addColorStop(.52, "#7d838c"); gr.addColorStop(1, "#3a3f46"); g.fillStyle = gr; g.fillRect(0, 0, 64, 32);
  ENV_TEX = new THREE.CanvasTexture(c); ENV_TEX.mapping = THREE.EquirectangularReflectionMapping; return ENV_TEX;
}
