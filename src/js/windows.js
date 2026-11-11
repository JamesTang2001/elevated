/* ===== Elevated v2 — building windows: a grid of panes on the walls of nearby buildings.
   At night about a third glow warm or cool white (the "Night lights" switch); by day they can show as faint glass.
   Map → Building detail: Night only (default) · Day and night · Off. Rebuilt for the view after the map settles. */
let winTimer = 0;
function scheduleWindows() { if (winTimer) return; winTimer = setTimeout(() => { winTimer = 0; buildWindows(); }, 600); }   // throttle, so it also refreshes while following
function windowsWanted() {
  if (!SET.bldg3d || map.getZoom() < 15 || SET.nightLights === false) return null;   // windows are part of Night lights
  return nightLevel() > .55 ? "night" : null;
}
function initWindows() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; const g2 = cv.getContext("2d");    // one window cell: a 1.9 × 2.1 m pane in a 3.2 × 3.6 m bay
  g2.fillStyle = "#000"; g2.fillRect(0, 0, 64, 64); g2.fillStyle = "#fff"; g2.fillRect(0, 64 - 37, 38, 37);
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  const glass = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x1b2230, alphaMap: tex, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const lit = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 }));
  glass.frustumCulled = lit.frustumCulled = false; glass.renderOrder = 2; lit.renderOrder = 2;
  return { glass, lit, key: "" };
}
function buildWindows() {
  if (!T || !T.win) return;
  if (map.isMoving()) { scheduleWindows(); return; }                              // never stall the map while it's moving
  const W = T.win, want = windowsWanted();
  if (!want) { W.glass.visible = W.lit.visible = false; W.key = ""; return; }
  const c = map.getCenter(), b = map.getBounds(), key = [want, Math.round(c.lng / .0025), Math.round(c.lat / .0018), Math.round(map.getZoom() * 2)].join();   // rebuild after moving ~200 m
  if (key === W.key) return;
  const seen = new Set(), cand = [];
  for (const f of map.querySourceFeatures("omt", { sourceLayer: "building" })) {
    const p = f.properties || {}, h = +(p.render_height ?? p.height ?? 8), base = +(p.render_min_height ?? p.min_height ?? 0); if (!(h > base + 5) || h > 600) continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
    for (const P of polys) { const r = P[0]; if (!r || r.length < 4 || r.length > 160) continue;
      const k = r[0][0].toFixed(6) + r[0][1].toFixed(6) + r.length; if (seen.has(k)) continue; seen.add(k);
      if (!b.contains(r[0])) continue; cand.push({ r, h, base, d: Math.hypot((r[0][0] - c.lng) * KX, r[0][1] - c.lat) }); }
  }
  if (!cand.length) return;                                                      // tiles not loaded yet; the next sourcedata event tries again
  W.key = key; cand.sort((a, q) => a.d - q.d);
  const gp = [], gu = [], lp = [], lc = [], limit = map.getZoom() >= 16.3 ? 320 : 220;
  const quad = (A, a, q, z0, z1, n) => { const o0 = a[0] + n[0], o1 = a[1] + n[1], e0 = q[0] + n[0], e1 = q[1] + n[1]; A.push(o0, o1, z0, e0, e1, z0, e0, e1, z1, o0, o1, z0, e0, e1, z1, o0, o1, z1); };
  for (const bd of cand.slice(0, limit)) {
    const pts = bd.r.map(q => T.toLocal(q[0], q[1])); let area = 0;
    for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
    const sgn = area > 0 ? 1 : -1;                                                  // counter-clockwise ring: outside is to the right of each edge
    let seed = Math.abs(Math.round(pts[0][0] * 7 + pts[0][1] * 13)) % 2147483646 + 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // same lit pattern every rebuild
    const office = bd.h > 40, litShare = office ? .26 : .38, lg = Math.log(1 - litShare);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], q = pts[i + 1], L = Math.hypot(q[0] - a[0], q[1] - a[1]); if (L < 4) continue;
      const ux = (q[0] - a[0]) / L, uy = (q[1] - a[1]) / L, n = [uy * sgn * .3, -ux * sgn * .3], cols = Math.floor((L - 1.5) / 3.2), pad = (L - 1.5 - cols * 3.2) / 2;
      const z0 = bd.base + 3.4, nf = Math.max(0, Math.ceil((bd.h - 2.2 - z0) / 3.6)); if (!nf || !cols) continue;
      { const s0 = .9 + pad, s1 = s0 + cols * 3.2 - 1.3, o0 = a[0] + n[0], o1 = a[1] + n[1];       // the whole wall as one textured quad of dark panes
        const P0 = [o0 + ux * s0, o1 + uy * s0], P1 = [o0 + ux * s1, o1 + uy * s1], zt = z0 + nf * 3.6 - 1.5, u1 = (s1 - s0) / 3.2, v1 = (zt - z0) / 3.6;
        gp.push(P0[0], P0[1], z0, P1[0], P1[1], z0, P1[0], P1[1], zt, P0[0], P0[1], z0, P1[0], P1[1], zt, P0[0], P0[1], zt); gu.push(0, 0, u1, 0, u1, v1, 0, 0, u1, v1, 0, v1); }
      if (want !== "night") continue;
      const nl = [n[0] * 1.15, n[1] * 1.15];
      for (let z = z0; z < bd.h - 2.2; z += 3.6) {
        const floorLit = rnd() < .7;                                                // some floors are dark entirely, like real offices at night
        if (!floorLit) continue;
        for (let j = Math.floor(Math.log(1 - rnd()) / lg); j < cols; j += 1 + Math.floor(Math.log(1 - rnd()) / lg)) {   // jump straight to the next lit window
          const s = .9 + pad + j * 3.2, A0 = [a[0] + ux * s, a[1] + uy * s], A1 = [a[0] + ux * (s + 1.9), a[1] + uy * (s + 1.9)];
          quad(lp, A0, A1, z, z + 2.1, nl); const warm = rnd() < .78; for (let k = 0; k < 6; k++) warm ? lc.push(1, .78, .46) : lc.push(.82, .9, 1);
        }
      }
    }
    if (lp.length > 8e5) break;
  }
  const setG = (mesh, pos, col, uv) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); if (col) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    if (uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); mesh.geometry.dispose(); mesh.geometry = g; };
  setG(W.glass, gp, null, gu); setG(W.lit, lp, lc);
  const dark = styleTheme === "dark";
  if (want === "day") { W.glass.material.color.set(dark ? 0x31404f : 0x6a7d91); W.glass.material.opacity = SET.seeThrough === "see" ? .18 : .3; W.lit.visible = false; }
  else { W.glass.material.color.set(0x161c26); W.glass.material.opacity = SET.seeThrough === "see" ? .55 : .85; W.lit.visible = true; }
  W.glass.visible = true; map.triggerRepaint();
}
