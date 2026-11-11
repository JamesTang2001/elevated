/* ---------- landmarks: original simple models in their real colours; outlines are approximate ----------
   Positions and footprint orientation were checked against OpenStreetMap's place points and building outlines. */
LANDMARKS.length = 0;
LANDMARKS.push(
  { id: "willis", name: "Willis Tower", lon: -87.63591, lat: 41.87888, clear: 62 },
  { id: "hancock", name: "John Hancock Center", lon: -87.62309, lat: 41.89882, clear: 58 },
  { id: "trump", name: "Trump International Hotel & Tower", lon: -87.62646, lat: 41.88888, clear: 62, ang: 43 },
  { id: "aon", name: "Aon Center", lon: -87.62139, lat: 41.88528, clear: 50 },
  { id: "stregis", name: "St. Regis Chicago", lon: -87.6175, lat: 41.8873, clear: 45, ang: 170 },
  { id: "marina", name: "Marina City", lon: -87.62881, lat: 41.88787, clear: 50 },
  { id: "tribune", name: "Tribune Tower", lon: -87.62333, lat: 41.89055, clear: 52, ang: 2 },
  { id: "wrigleybld", name: "Wrigley Building", lon: -87.6246, lat: 41.8893, clear: 45 },
  { id: "cbot", name: "Chicago Board of Trade", lon: -87.63235, lat: 41.87785, clear: 34 },
  { id: "mart", name: "Merchandise Mart", lon: -87.63548, lat: 41.88853, clear: 125 },
  { id: "union", name: "Union Station", lon: -87.64041, lat: 41.87867, clear: 72 },
  { id: "theatre", name: "Chicago Theatre", lon: -87.6273, lat: 41.88542, clear: 40 },
  { id: "bean", name: "Cloud Gate (the Bean)", lon: -87.62334, lat: 41.88269, clear: 0 },
  { id: "buckingham", name: "Buckingham Fountain", lon: -87.61897, lat: 41.8758, clear: 0 },
  { id: "watertower", name: "Old Water Tower", lon: -87.62445, lat: 41.89715, clear: 0 },
  { id: "wheel", name: "Centennial Wheel, Navy Pier", lon: -87.60747, lat: 41.8917, clear: 34 },
  { id: "field", name: "Field Museum", lon: -87.61689, lat: 41.86621, clear: 135, ang: 1 },
  { id: "shedd", name: "Shedd Aquarium", lon: -87.61367, lat: 41.86766, clear: 95, ang: 78 },
  { id: "adler", name: "Adler Planetarium", lon: -87.6070, lat: 41.8664, clear: 40 },
  { id: "soldier", name: "Soldier Field", lon: -87.61668, lat: 41.86239, clear: 140, ang: 92 },
  { id: "united", name: "United Center", lon: -87.67419, lat: 41.88068, clear: 105, ang: 1 },
  { id: "ratefield", name: "Rate Field", lon: -87.6337, lat: 41.82978, clear: 135, ang: 87 },
  { id: "wrigley", name: "Wrigley Field", lon: -87.65557, lat: 41.94815, clear: 120 },
  { id: "msi", name: "Museum of Science and Industry", lon: -87.58384, lat: 41.79075, clear: 130, ang: 0 },
  { id: "art", name: "Art Institute of Chicago", lon: -87.62367, lat: 41.87957, clear: 55, ang: 1 },
  { id: "artmw", name: "Art Institute, Modern Wing", lon: -87.62191, lat: 41.88017, clear: 66, ang: 1 },
  { id: "pritzker", name: "Jay Pritzker Pavilion", lon: -87.62189, lat: 41.88351, clear: 30, ang: 1 },
  { id: "lpt", name: "Lake Point Tower", lon: -87.61238, lat: 41.89147, clear: 45, ang: 31 },
  { id: "opo", name: "Old Post Office", lon: -87.63869, lat: 41.87559, clear: 125, ang: 1 },
  { id: "crain", name: "Crain Communications Building", lon: -87.62497, lat: 41.88483, clear: 32, ang: 1 },
  { id: "w311", name: "311 South Wacker", lon: -87.6359, lat: 41.87746, clear: 50, ang: 1 },
  { id: "daley", name: "Daley Center and the Picasso", lon: -87.63021, lat: 41.88409, clear: 48, ang: 1 },
  { id: "mccormick", name: "McCormick Place", lon: -87.61674, lat: 41.85357, clear: 230, ang: 16 },
  { id: "robie", name: "Robie House", lon: -87.59593, lat: 41.78981, clear: 25, ang: 1 },
  { id: "conservatory", name: "Lincoln Park Conservatory", lon: -87.63513, lat: 41.92438, clear: 70, ang: 14 },
  { id: "bahai", name: "Baháʼí House of Worship", lon: -87.6843, lat: 42.07444, clear: 40, ang: 5 },
  { id: "navypier", name: "Navy Pier, Festival Hall and the Grand Ballroom", lon: -87.6022, lat: 41.8917, clear: 270 },
  { id: "rockefeller", name: "Rockefeller Chapel", lon: -87.59704, lat: 41.78853, clear: 50, ang: 1 },
  { id: "garfield", name: "Garfield Park Conservatory", lon: -87.71784, lat: 41.8867, clear: 115, ang: 120 },
  { id: "ohare", name: "O'Hare Airport, Terminal 1", lon: -87.90654, lat: 41.97956, clear: 0, ang: 69 },
);
function buildLandmarks() {
  const g = new THREE.Group(), L = (d, l) => [new THREE.MeshLambertMaterial({ color: l }), d, l], Bm = c => [new THREE.MeshBasicMaterial({ color: c }), c, c];
  const boxAt = (mat, cx, cy, w, d, h0, h1, rot = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, d, h1 - h0), mat); b.position.set(cx, cy, (h0 + h1) / 2); b.rotation.z = rot; return b; };
  const cyl = (mat, cx, cy, r0, r1, h0, h1, seg = 24) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h1 - h0, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(cx, cy, (h0 + h1) / 2); return m; };
  const dome = (mat, cx, cy, r, z, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat); m.rotation.x = Math.PI / 2; m.scale.set(1, sz, 1); m.position.set(cx, cy, z); return m; };
  const ring = (mat, rx, ry, w, h0, h1) => { const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2); const hole = new THREE.Path(); hole.absellipse(0, 0, rx - w, ry - w, 0, Math.PI * 2, true); s.holes.push(hole);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: h1 - h0, bevelEnabled: false, curveSegments: 36 }), mat); m.position.z = h0; return m; };
  const disc = (mat, rx, ry, z) => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat); m.scale.set(rx, ry, 1); m.position.z = z; return m; };
  const vaultX = (mat, x, y, r, len, z, sz = 1) => { const geo = new THREE.CylinderGeometry(r, r, len, 24, 1, false, -Math.PI / 2, Math.PI); geo.rotateZ(Math.PI / 2); const m = new THREE.Mesh(geo, mat); m.scale.z = sz; m.position.set(x, y, z); return m; };   // half-cylinder roof running along x
  const gable = (mat, x, y, w, len, z, h, rot = 0) => { const sh = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);   // pitched roof, ridge along y
    const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); geo.rotateX(Math.PI / 2); geo.translate(0, len / 2, 0); geo.rotateZ(rot); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  T.beacons = [];
  const beacon = (grp, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a })); m.position.set(x, y, z); grp.add(m); T.beacons.push(m); };
  for (const lm of LANDMARKS) {
    const [ox, oy] = T.toLocal(lm.lon, lm.lat), grp = new THREE.Group(); grp.position.set(ox, oy, 0); grp.rotation.z = (lm.ang || 0) * Math.PI / 180;
    let ms = [];
    if (lm.id === "willis") {                        // nine bundled black tubes stepping back at floors 50, 66, 90, 108
      const glass = L(0x2b313a, 0x23272e), ant = L(0xb9bec6, 0xd9dde2); ms = [glass, ant];
      const t = 22.86, H = { 50: 205, 66: 270, 90: 368, 108: 442 }, grid = [[50, 90, 66], [90, 108, 90], [66, 108, 50]];
      grid.forEach((row, r) => row.forEach((f, c) => grp.add(boxAt(glass[0], (c - 1) * t, (1 - r) * t, t - .3, t - .3, 0, H[f]))));
      for (const x of [-6, 6]) { grp.add(boxAt(ant[0], x, -10, 1.6, 1.6, 442, 527)); beacon(grp, x, -10, 528); }
    } else if (lm.id === "hancock") {                 // tapered black tower with X-bracing feel and two antennas
      const blk = L(0x24272c, 0x2a2d33), ant = L(0xb9bec6, 0xd9dde2); ms = [blk, ant];
      const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0, .5); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) if (p.getZ(i) > .5) { p.setX(i, p.getX(i) * .6); p.setY(i, p.getY(i) * .6); }
      geo.computeVertexNormals(); const m = new THREE.Mesh(geo, blk[0]); m.scale.set(80, 50, 344); grp.add(m);
      for (const x of [-8, 8]) { grp.add(boxAt(ant[0], x, 0, 1.4, 1.4, 344, 457)); beacon(grp, x, 0, 458); }
    } else if (lm.id === "trump") {                   // stepped blue-silver glass along the river, with spire
      const gl = L(0x6f8db0, 0x9db6d0), sp = L(0xc8cdd3, 0xe2e5e9); ms = [gl, sp];
      [[96, 40, 0, 90], [84, 34, 90, 180], [68, 28, 180, 260], [52, 24, 260, 357]].forEach(([w, d, a, b]) => grp.add(boxAt(gl[0], 0, 0, w, d, a, b)));
      grp.add(boxAt(sp[0], 0, 0, 2, 2, 357, 423)); beacon(grp, 0, 0, 424);
    } else if (lm.id === "aon") {
      const wh = L(0xd8d6cf, 0xf1efe9); ms = [wh]; grp.add(boxAt(wh[0], 0, 0, 59.4, 59.4, 0, 346)); beacon(grp, 0, 0, 348);
    } else if (lm.id === "stregis") {                 // three stacked teal glass "frustums"
      const gl = L(0x2f7f86, 0x58b3b6); ms = [gl];
      const fr = (h0, h1, s0, s1, x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(s1, s0, h1 - h0, 4, 1), gl[0]); m.rotation.x = Math.PI / 2; m.rotation.y = Math.PI / 4; m.scale.set(1.9, 1, .8); m.position.set(x, 0, (h0 + h1) / 2); grp.add(m); };
      fr(0, 140, 22, 27, -4); fr(140, 270, 24, 28, 0); fr(270, 363, 26, 20, 4);
    } else if (lm.id === "marina") {                  // the two white "corncob" towers
      const wh = L(0xc9c6bd, 0xf2f0ea), dk = L(0x3a3f47, 0x55606c); ms = [wh, dk];
      for (const x of [-26, 26]) { grp.add(cyl(dk[0], x, 0, 13, 13, 0, 179, 20)); for (let z = 3; z < 179; z += 3.2) grp.add(cyl(wh[0], x, 0, 16, 16, z, z + .7, 20)); }
    } else if (lm.id === "tribune") {                 // limestone gothic tower with crown
      const st = L(0xa49a84, 0xd8ccb0); ms = [st];
      grp.add(boxAt(st[0], 0, -18, 60, 40, 0, 70)); grp.add(boxAt(st[0], 0, 6, 26, 26, 0, 120)); grp.add(boxAt(st[0], 0, 6, 20, 20, 120, 135));
      for (const [x, y] of [[-9, -3], [9, -3], [-9, 15], [9, 15]]) grp.add(boxAt(st[0], x, y, 2.5, 2.5, 120, 141));
    } else if (lm.id === "wrigleybld") {              // white terracotta pair with the clock tower
      const wh = L(0xd9d4c6, 0xfbf8ef), gd = L(0x9b8c5e, 0xd6c27e); ms = [wh, gd];
      grp.add(boxAt(wh[0], 0, -12, 52, 36, 0, 66)); grp.add(boxAt(wh[0], 0, -12, 16, 16, 66, 112)); grp.add(cyl(wh[0], 0, -12, 6, 4, 112, 128, 12)); grp.add(cyl(gd[0], 0, -12, 1.2, .2, 128, 134, 8));
      grp.add(boxAt(wh[0], 6, 34, 40, 30, 0, 60)); grp.add(boxAt(wh[0], 3, 12, 8, 14, 30, 36));
    } else if (lm.id === "cbot") {                    // art deco tower with pyramid roof and Ceres on top
      const st = L(0x9d9a92, 0xc9c5bb), cu = L(0x5d7d70, 0x7fa696); ms = [st, cu];
      grp.add(boxAt(st[0], 0, 0, 52, 46, 0, 60)); grp.add(boxAt(st[0], 0, 0, 40, 34, 60, 120)); grp.add(boxAt(st[0], 0, 0, 30, 26, 120, 141));
      const py = new THREE.Mesh(new THREE.ConeGeometry(20, 22, 4), cu[0]); py.rotation.x = Math.PI / 2; py.rotation.y = Math.PI / 4; py.position.set(0, 0, 152); grp.add(py); grp.add(boxAt(cu[0], 0, 0, 1.6, 1.6, 163, 172));
    } else if (lm.id === "mart") {                    // two-block limestone mass with a central tower
      const st = L(0x8f7f68, 0xcdbb9c); ms = [st]; grp.add(boxAt(st[0], 0, 0, 220, 100, 0, 72)); grp.add(boxAt(st[0], 0, 0, 80, 40, 72, 104));
    } else if (lm.id === "union") {                   // head house with the Great Hall's skylight vault
      const st = L(0x8c8470, 0xd5ccb6), sky = L(0x5d6b7a, 0x9fb2c2); ms = [st, sky]; grp.add(boxAt(st[0], 0, 0, 93, 112, 0, 32));
      const v = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 64, 20, 1, false, 0, Math.PI), sky[0]); v.rotation.z = Math.PI / 2; v.rotation.y = Math.PI / 2; v.position.set(0, 0, 32); grp.add(v);
    } else if (lm.id === "theatre") {                 // the red CHICAGO vertical sign and marquee
      const st = L(0xa8957a, 0xd8c6a6), red = Bm(0xe0262c), gold = Bm(0xf6c64a); ms = [st, red, gold];
      grp.add(boxAt(st[0], 0, 0, 66, 50, 0, 30)); grp.add(boxAt(red[0], 34, 0, 2.2, 6, 10, 30)); grp.add(boxAt(gold[0], 35.4, 0, .6, 4.6, 12, 29)); grp.add(boxAt(red[0], 36, 0, 6, 22, 6, 9));
    } else if (lm.id === "bean") {                    // polished ellipsoid
      const mir = [new THREE.MeshPhongMaterial({ color: 0xc8ccd2, specular: 0xffffff, shininess: 120 }), 0x9aa1aa, 0xc8ccd2]; ms = [mir];
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), mir[0]); b.scale.set(10, 6.4, 5); b.position.set(0, 0, 5); grp.add(b);
    } else if (lm.id === "buckingham") {              // pink marble tiers in a wide blue basin, with the centre jet
      const pk = L(0xa98a83, 0xe9cbc1), wt = L(0x2a5f86, 0x5aa8d6), jet = [new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: .55 }), 0xeaf6ff, 0xeaf6ff]; ms = [pk, wt, jet];
      grp.add(disc(wt[0], 46, 46, .25)); grp.add(cyl(pk[0], 0, 0, 47, 47, 0, .9, 40)); grp.add(cyl(pk[0], 0, 0, 15, 14, 0, 3)); grp.add(cyl(pk[0], 0, 0, 10, 9, 3, 5.5)); grp.add(cyl(pk[0], 0, 0, 6, 5, 5.5, 8));
      const j = new THREE.Mesh(new THREE.ConeGeometry(2.4, 24, 12), jet[0]); j.rotation.x = -Math.PI / 2; j.position.set(0, 0, 20); grp.add(j);
    } else if (lm.id === "watertower") {              // yellow limestone castle with its octagonal tower
      const st = L(0xb5a273, 0xe6d6a6); ms = [st];
      grp.add(boxAt(st[0], 0, 0, 18, 18, 0, 16)); grp.add(cyl(st[0], 0, 0, 5, 4.2, 16, 40, 8)); grp.add(cyl(st[0], 0, 0, 3, .4, 40, 47, 8));
      for (const [x, y] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) grp.add(cyl(st[0], x, y, 1.4, 1.2, 0, 21, 8));
    } else if (lm.id === "wheel") {                   // Centennial Wheel: white rim, colourful gondolas
      const wh = L(0xbfc3c8, 0xffffff); ms = [wh];
      const rim = new THREE.Mesh(new THREE.TorusGeometry(30, .9, 8, 64), wh[0]); rim.rotation.x = Math.PI / 2; rim.position.z = 34; grp.add(rim);
      for (const s of [-1, 1]) { const leg = boxAt(wh[0], s * 9, 0, 1.6, 1.6, 0, 36); leg.rotation.y = s * .27; grp.add(leg); }
      const cols = [0xe63946, 0xf4a261, 0xe9c46a, 0x2a9d8f, 0x457b9d, 0x9b5de5];
      for (let i = 0; i < 42; i++) { const a = i / 42 * Math.PI * 2, c = Bm(cols[i % cols.length]); ms.push(c); grp.add(boxAt(c[0], Math.cos(a) * 30, 0, 2.6, 2.2, 34 + Math.sin(a) * 30 - 3.4, 34 + Math.sin(a) * 30 - .6)); }
    } else if (lm.id === "field") {                   // white marble temple with central portico
      const mb = L(0xc9c4b6, 0xf1ede2), rf = L(0x6a6f76, 0x9aa0a6); ms = [mb, rf];
      grp.add(boxAt(mb[0], 0, 0, 230, 120, 0, 24)); grp.add(boxAt(rf[0], 0, 0, 228, 118, 24, 26)); grp.add(boxAt(mb[0], 0, 0, 70, 50, 24, 36)); grp.add(boxAt(mb[0], 0, 66, 50, 12, 0, 24));
    } else if (lm.id === "shedd") {                   // Greek cross with octagonal centre and a sea-green dome
      const mb = L(0xc6c0b0, 0xefe9da), gr = L(0x3f7d73, 0x5fae9f); ms = [mb, gr];
      grp.add(boxAt(mb[0], 0, 0, 150, 46, 0, 18)); grp.add(boxAt(mb[0], 0, 0, 46, 130, 0, 18)); grp.add(cyl(mb[0], 0, 0, 30, 30, 0, 26, 8)); grp.add(dome(gr[0], 0, 0, 18, 26, .7));
    } else if (lm.id === "adler") {                   // twelve-sided building with a bronze dome
      const st = L(0x8f7c66, 0xc7b08f), br = L(0x5c6d5f, 0x86a08c); ms = [st, br];
      grp.add(cyl(st[0], 0, 0, 24, 24, 0, 14, 12)); grp.add(dome(br[0], 0, 0, 15, 14, .8));
    } else if (lm.id === "soldier") {                 // classic colonnades holding the modern bowl
      const st = L(0xb3ab98, 0xe2dccb), gl = L(0x5f6c79, 0x95a5b4), fld = L(0x2f5a33, 0x5e9c55); ms = [st, gl, fld];
      for (const y of [-52, 52]) grp.add(boxAt(st[0], 0, y, 200, 8, 0, 20));
      grp.add(disc(fld[0], 78, 36, .3)); grp.add(ring(gl[0], 110, 56, 22, 6, 34));
    } else if (lm.id === "united") {                  // brick arena with a dark roof
      const br = L(0x6e3632, 0x9a4a43), rf = L(0x3b3f45, 0x5a5f66); ms = [br, rf];
      const sh = new THREE.Shape(), w = 82, h = 62, r = 20; sh.moveTo(-w + r, -h); sh.lineTo(w - r, -h); sh.quadraticCurveTo(w, -h, w, -h + r); sh.lineTo(w, h - r); sh.quadraticCurveTo(w, h, w - r, h); sh.lineTo(-w + r, h); sh.quadraticCurveTo(-w, h, -w, h - r); sh.lineTo(-w, -h + r); sh.quadraticCurveTo(-w, -h, -w + r, -h);
      grp.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 34, bevelEnabled: false }), br[0])); const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false }), rf[0]); roof.scale.set(.96, .94, 1); roof.position.z = 34; grp.add(roof);
    } else if (lm.id === "ratefield") {               // ballpark bowl, blue-grey with a green field
      const gy = L(0x4a5462, 0x6f7c8c), fld = L(0x2f5a33, 0x5e9c55), wh = L(0xb7bcc2, 0xe8ebee); ms = [gy, fld, wh];
      grp.add(disc(fld[0], 92, 92, .3)); const b = ring(gy[0], 118, 118, 34, 0, 30); b.rotation.z = Math.PI * .25; grp.add(b); grp.add(ring(wh[0], 118, 118, 6, 30, 33));
    } else if (lm.id === "wrigley") {                 // ivy-green bowl, brick base and the red marquee
      const brick = L(0x5a3a30, 0x8a5a48), seat = L(0x23402c, 0x2f5d3a), field = L(0x234a2a, 0x5c9a52), red = Bm(0xd12d2d); ms = [brick, seat, field, red];
      grp.add(disc(field[0], 66, 58, .3)); grp.add(ring(brick[0], 94, 84, 28, 0, 22)); grp.add(ring(seat[0], 92, 82, 22, 22, 26));
      grp.add(boxAt(red[0], -40, -90, 18, 1.2, 8, 14, .6));
    } else if (lm.id === "msi") {                     // neoclassical palace with a central dome
      const mb = L(0xc4bca8, 0xece4d0), dm = L(0x7b8a88, 0xa9b9b6); ms = [mb, dm];
      grp.add(boxAt(mb[0], 0, 0, 214, 60, 0, 26)); for (const x of [-90, 90]) grp.add(boxAt(mb[0], x, -20, 34, 110, 0, 22)); grp.add(cyl(mb[0], 0, 0, 18, 18, 26, 36, 20)); grp.add(dome(dm[0], 0, 0, 18, 36, .9));
    } else if (lm.id === "art") {                     // Beaux-Arts limestone hall facing Michigan Avenue, with its glass-roofed centre
      const st = L(0x9d978a, 0xd6cfbf), sky = L(0x5d6b7a, 0x9fb2c2); ms = [st, sky];
      grp.add(boxAt(st[0], 0, 0, 64, 98, 0, 20)); grp.add(boxAt(st[0], -36, 0, 8, 40, 0, 6)); grp.add(boxAt(st[0], -4, 0, 30, 34, 20, 26));
      grp.add(boxAt(sky[0], 12, 0, 24, 60, 20, 22.5));
    } else if (lm.id === "artmw") {                   // Modern Wing: white and glass, under a thin "flying carpet" roof
      const wh = L(0xc9cbcd, 0xf4f5f6), gl = L(0x5f7080, 0xa7b8c6); ms = [wh, gl];
      grp.add(boxAt(gl[0], 0, 0, 92, 100, 0, 22)); grp.add(boxAt(wh[0], 0, 0, 104, 114, 22, 23.4)); grp.add(boxAt(wh[0], -30, 0, 30, 100, 0, 22));
    } else if (lm.id === "pritzker") {                // steel ribbons over the stage and the trellis over the Great Lawn
      const ss = L(0xb4b9bf, 0xe6e9ec), lawn = L(0x2f5a33, 0x6aa85e); ms = [ss, lawn];
      grp.add(boxAt(ss[0], -8, 0, 30, 40, 0, 14));
      for (let i = 0; i < 9; i++) { const a = (i / 8 - .5) * 2.4, rib = boxAt(ss[0], -16 + Math.cos(a) * 6, Math.sin(a) * 18, 2, 10, 14, 32 + 6 * Math.cos(a)); rib.rotation.x = Math.sin(a) * .5; rib.rotation.y = -.35; grp.add(rib); }
      grp.add(disc(lawn[0], 80, 55, .25)); grp.children[grp.children.length - 1].position.x = 95;
      for (let x = 20; x <= 170; x += 30) grp.add(boxAt(ss[0], x, 0, .8, 110, 15, 15.8));
      for (let y = -50; y <= 50; y += 25) grp.add(boxAt(ss[0], 95, y, 150, .8, 15, 15.8));
    } else if (lm.id === "lpt") {                     // three curved wings of bronze glass, alone on the lakefront
      const gl = L(0x2f2a24, 0x4a4236); ms = [gl];
      for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3, w = new THREE.Group(); w.rotation.z = a;
        w.add(boxAt(gl[0], 16, 0, 26, 20, 0, 191)); w.add(cyl(gl[0], 29, 0, 10, 10, 0, 191, 16)); grp.add(w); }
      grp.add(cyl(gl[0], 0, 0, 13, 13, 0, 194, 12));
    } else if (lm.id === "opo") {                     // the long limestone post office straddling the Eisenhower Expressway
      const st = L(0x8e8676, 0xcdc4b0), dk = L(0x2d3036, 0x3c4048); ms = [st, dk];
      grp.add(boxAt(st[0], 0, 70, 105, 99, 0, 60)); grp.add(boxAt(st[0], 0, -70, 105, 99, 0, 60)); grp.add(boxAt(st[0], 0, 0, 105, 41, 9, 60));
      grp.add(boxAt(dk[0], 0, 0, 107, 39, 0, 8.5)); grp.add(boxAt(st[0], 0, 0, 60, 150, 60, 66));
    } else if (lm.id === "crain") {                   // slim tower capped by the split diamond top
      const wh = L(0xa9adb2, 0xe3e5e8), gl = L(0x3b4652, 0x6f8397); ms = [wh, gl];
      grp.add(boxAt(wh[0], 0, 0, 39, 46, 0, 148)); grp.add(boxAt(gl[0], 0, 0, 39.4, 2, 6, 146));
      for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.ConeGeometry(23, 34, 4, 1, false, s > 0 ? 0 : Math.PI, Math.PI), wh[0]); d.rotation.x = Math.PI / 2; d.rotation.y = Math.PI / 4; d.scale.set(1.15, 1, .6); d.position.set(0, s * 1.2, 165); grp.add(d); }
    } else if (lm.id === "w311") {                    // pink granite tower with the glass cylinder crown, lit at night
      const gr = L(0x8f6a5f, 0xc9a092), cr = L(0x9fb0bf, 0xe8eef3); ms = [gr, cr];
      grp.add(boxAt(gr[0], 0, 0, 50, 50, 0, 225)); grp.add(boxAt(gr[0], 0, 0, 40, 40, 225, 250)); grp.add(cyl(cr[0], 0, 0, 14, 14, 250, 284, 20)); grp.add(dome(cr[0], 0, 0, 14, 284, .6));
      for (const [x, y] of [[-17, -17], [17, -17], [-17, 17], [17, 17]]) grp.add(cyl(cr[0], x, y, 3, 3, 250, 262, 10));
      grp.add(boxAt(cr[0], 30, -30, 34, 30, 0, 26));
    } else if (lm.id === "daley") {                   // rust-coloured weathering steel and bronze glass, with the Picasso in the plaza
      const cor = L(0x5a3424, 0x8a5134), gl = L(0x2e2a27, 0x4c4440); ms = [cor, gl];
      grp.add(boxAt(gl[0], 0, 0, 78, 43, 0, 197)); for (let z = 6; z < 197; z += 6.1) grp.add(boxAt(cor[0], 0, 0, 80, 45, z, z + 1.2));
      for (const x of [-26, 0, 26]) for (const y of [-21.5, 21.5]) grp.add(boxAt(cor[0], x, y, 2, 2, 0, 197));
      const pc = new THREE.Group(); pc.position.set(19, -52, 0); pc.add(boxAt(cor[0], 0, 0, 6, 4, 0, 1));
      for (const s of [-1, 1]) { const w = boxAt(cor[0], s * 2, 0, .5, 3.4, 1, 15); w.rotation.y = s * .18; pc.add(w); } pc.add(cyl(cor[0], 0, 0, 2.2, 1.4, 11, 15, 10)); grp.add(pc);
    } else if (lm.id === "mccormick") {               // the North Building's long hall hung from rows of masts
      const rf = L(0x50565e, 0x8b939c), wh = L(0xb7bcc2, 0xf0f2f4); ms = [rf, wh];
      grp.add(boxAt(rf[0], 0, 0, 250, 420, 0, 20));
      for (const x of [-60, 60]) for (let y = -175; y <= 175; y += 70) { grp.add(boxAt(wh[0], x, y, 2, 2, 20, 48)); for (const s of [-1, 1]) { const c = boxAt(wh[0], x + s * 26, y, 54, .4, 33, 34); c.rotation.y = s * .48; grp.add(c); } }
    } else if (lm.id === "robie") {                   // Prairie-style brick house with long cantilevered roofs
      const br = L(0x6e4532, 0xa36a4c), rf = L(0x3b3530, 0x5e554d); ms = [br, rf];
      grp.add(boxAt(br[0], 0, 0, 36, 12, 0, 5)); grp.add(boxAt(rf[0], 0, 0, 46, 15, 5, 5.5)); grp.add(boxAt(br[0], -2, 0, 22, 10, 5.5, 9)); grp.add(boxAt(rf[0], -2, 0, 32, 13, 9, 9.5));
      grp.add(boxAt(br[0], 4, 0, 10, 8, 9.5, 11.5)); grp.add(boxAt(rf[0], 4, 0, 14, 11, 11.5, 12)); grp.add(boxAt(br[0], -2, 2, 2, 3, 9, 14));
    } else if (lm.id === "conservatory") {            // Victorian glass houses with the central palm dome
      const gl = L(0x5f7a72, 0xa9c8bd), fr = L(0xb4b9b8, 0xeef1f0); ms = [gl, fr];
      grp.add(cyl(gl[0], 0, 0, 16, 16, 0, 10, 16)); grp.add(dome(gl[0], 0, 0, 16, 10, .8)); grp.add(boxAt(gl[0], 0, -34, 26, 50, 0, 9)); grp.add(boxAt(gl[0], 0, 34, 26, 50, 0, 9));
      grp.add(boxAt(gl[0], -30, 0, 34, 20, 0, 8)); for (const y of [-34, 34]) grp.add(boxAt(fr[0], 0, y, 3, 50, 9, 10.5));
    } else if (lm.id === "bahai") {                   // nine-sided white temple with its lace-like dome
      const wh = L(0xcfccc4, 0xf6f4ee); ms = [wh];
      grp.add(cyl(wh[0], 0, 0, 23, 22, 0, 4, 9)); grp.add(cyl(wh[0], 0, 0, 20, 19, 4, 14, 9)); grp.add(cyl(wh[0], 0, 0, 16, 15, 14, 22, 9)); grp.add(dome(wh[0], 0, 0, 15, 22, 1.25));
      grp.add(cyl(wh[0], 0, 0, 1, .2, 40, 42, 8));
    } else if (lm.id === "navypier") {                // Festival Hall's long arched roof and the domed Grand Ballroom at the pier's end
      const brk = L(0x6e5444, 0x9c7c66), rf = L(0x6f7780, 0xb9c2ca), wh = L(0xbfc1bf, 0xf2f1ec), gl = L(0x4f6170, 0x8fa6b8); ms = [brk, rf, wh, gl];
      grp.add(boxAt(brk[0], -70, 0, 378, 92, 0, 14));
      grp.add(vaultX(rf[0], -70, 0, 46, 376, 14, .22));
      grp.add(boxAt(gl[0], -70, 0, 60, 94, 0, 25));                                   // glass entrance hall halfway along
      grp.add(boxAt(wh[0], 150, 0, 70, 60, 0, 7));                                    // the open terrace before the ballroom
      grp.add(cyl(brk[0], 232, 0, 31, 31, 0, 18, 28)); grp.add(cyl(wh[0], 232, 0, 32, 32, 18, 20, 28)); grp.add(dome(rf[0], 232, 0, 27, 20, .55));
      grp.add(cyl(wh[0], 232, 0, 3, 2, 34.5, 40, 10));
    } else if (lm.id === "rockefeller") {             // Gothic limestone chapel: tall nave, transepts and the square crossing tower
      const st = L(0x8f877a, 0xcbc2b2), rf = L(0x55504a, 0x7d766c); ms = [st, rf];
      grp.add(boxAt(st[0], 0, 0, 26, 79, 0, 26)); grp.add(boxAt(st[0], 0, 6, 38, 20, 0, 26));
      grp.add(gable(rf[0], 0, 0, 26.4, 79, 26, 11)); grp.add(gable(rf[0], 0, 6, 20.4, 38, 26, 11, Math.PI / 2));
      grp.add(boxAt(st[0], 0, 6, 17, 17, 26, 63));
      for (const [x, y] of [[-8, -2], [8, -2], [-8, 14], [8, 14]]) grp.add(boxAt(st[0], x, y, 2.4, 2.4, 60, 68));
    } else if (lm.id === "garfield") {               // Jensen's glass "haystack" houses: the tall Palm House and lower show houses
      const gl = L(0x5f7a72, 0xa9c8bd), fr = L(0xa9aeac, 0xe6e9e8); ms = [gl, fr];
      const house = (x, y, w, d, h, r) => { grp.add(boxAt(gl[0], x, y, w, d, 0, h * .45)); const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gl[0]); m.rotation.x = Math.PI / 2; m.scale.set(w / 2, h * .55, d / 2); m.position.set(x, y, h * .45); grp.add(m); grp.add(boxAt(fr[0], x, y, w + .6, d + .6, h * .45 - .6, h * .45)); };
      house(0, -40, 84, 46, 20, 0);
      house(-62, -10, 40, 40, 12); house(62, -10, 40, 40, 12); house(-40, 32, 52, 34, 11); house(10, 34, 46, 34, 11); house(58, 30, 36, 30, 9);
      grp.add(boxAt(fr[0], 0, 0, 120, 10, 0, 7));
    } else if (lm.id === "ohare") {                  // Terminal 1: a long concourse under a glass barrel vault
      const gl = L(0x6f8494, 0xb8cad8), wh = L(0xb6bbc0, 0xeef0f2); ms = [gl, wh];
      grp.add(boxAt(wh[0], 0, 0, 596, 44, 0, 11));
      grp.add(vaultX(gl[0], 0, 0, 22, 594, 11, .5));
      for (let x = -280; x <= 280; x += 40) grp.add(boxAt(wh[0], x, 0, 1.2, 45, 11, 12));
      grp.add(boxAt(wh[0], -80, 46, 260, 48, 0, 16));                                 // ticketing hall on the landside

    }
    T.markMats.set(lm.id, ms); g.add(grp);
  }
  return g;
}
