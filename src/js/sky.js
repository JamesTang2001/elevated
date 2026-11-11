/* ===== Elevated v2 — the sky behind the map: colour, sunrise and sunset glow, the sun and the moon =====
   MapLibre draws the ground and buildings; its own sky is made transparent, and this canvas behind the map paints
   the sky instead, so buildings and the skyline naturally stand in front of the sun and moon.
   Sun and moon positions are worked out from the map's clock; clouds and fog dim or hide them (Map → Sun and moon). */
const SKYC = { el: null, ctx: null, sky: "#8db6e3", hor: "#dce8f4", W: 0, H: 0, dpr: 1 };
function sizeSky() {
  if (!SKYC.el) { SKYC.el = document.getElementById("sky"); SKYC.ctx = SKYC.el.getContext("2d"); }
  const r = document.getElementById("map").getBoundingClientRect(); SKYC.dpr = Math.min(devicePixelRatio || 1, 2);
  SKYC.W = r.width; SKYC.H = r.height; SKYC.el.width = r.width * SKYC.dpr; SKYC.el.height = r.height * SKYC.dpr;
}
function moonPos() {                                               // low-precision lunar position and phase (good to about a degree)
  const d = (simT - TZOFF) / 86400000 - 10957.5, e = (23.439 - 3.6e-7 * d) * RAD;
  const L = (218.316 + 13.176396 * d) * RAD, M = (134.963 + 13.064993 * d) * RAD, F = (93.272 + 13.229350 * d) * RAD;
  const lam = L + 6.289 * RAD * Math.sin(M), bet = 5.128 * RAD * Math.sin(F);
  const ra = Math.atan2(Math.sin(lam) * Math.cos(e) - Math.tan(bet) * Math.sin(e), Math.cos(lam)), dec = Math.asin(Math.sin(bet) * Math.cos(e) + Math.cos(bet) * Math.sin(e) * Math.sin(lam));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24, H = (gmst * 15 - 87.63) * RAD - ra, la = 41.88 * RAD;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(H));
  const g = (357.529 + .98560028 * d) * RAD, sunLam = (280.459 + .98564736 * d) * RAD + 1.915 * RAD * Math.sin(g);
  const elong = ((lam - sunLam) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);                 // 0 new moon, π full moon
  return { el, az: (az + 2 * Math.PI) % (2 * Math.PI), lit: (1 - Math.cos(elong)) / 2, waxing: elong < Math.PI };
}
/* screen position of a direction in the sky (elevation, azimuth from north), using MapLibre's camera */
function skyPoint(el, az) {
  const t = map.transform, b = map.getBearing() * RAD, tilt = (90 - map.getPitch()) * RAD, f = (SKYC.H / 2) / Math.tan(t._fov / 2), cp = t.centerPoint;
  const d = [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
  const fw = [Math.sin(b) * Math.cos(tilt), Math.cos(b) * Math.cos(tilt), -Math.sin(tilt)], rt = [Math.cos(b), -Math.sin(b), 0], up = [Math.sin(b) * Math.sin(tilt), Math.cos(b) * Math.sin(tilt), Math.cos(tilt)];
  const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2], z = dot(d, fw);
  if (z <= .05) return null;
  return { x: cp.x + f * dot(d, rt) / z, y: cp.y - f * dot(d, up) / z };
}
const groundTop = () => SKYC.H / 2 - map.transform.getHorizon();   // where MapLibre stops drawing ground (screen y)
function drawSky() {
  if (!SKYC.ctx || !map || !map.transform) return;
  const c = SKYC.ctx, W = SKYC.W, H = SKYC.H, hy = groundTop();
  c.setTransform(SKYC.dpr, 0, 0, SKYC.dpr, 0, 0);
  if (hy <= 0) { if (SKYC.drawn) { c.clearRect(0, 0, W, H); SKYC.drawn = false; } return; }   // looking down: no sky in view
  SKYC.drawn = true;
  const g = c.createLinearGradient(0, 0, 0, hy + 2); g.addColorStop(0, SKYC.sky); g.addColorStop(Math.max(0, 1 - .55 * (H / 2) / Math.max(hy, 1)), SKYC.sky); g.addColorStop(1, SKYC.hor);
  c.fillStyle = g; c.fillRect(0, 0, W, hy + 4);
  if (SET.sky === false) return;
  c.save(); c.beginPath(); c.rect(0, 0, W, hy + 3); c.clip();
  const w = WX.cur, cloud = w ? w.cloud / 100 : .2, fog = w ? Math.max(0, Math.min(1, (6000 - w.vis) / 5500)) : 0, clear = Math.max(0, 1 - cloud * .85) * (1 - fog);
  const sEl = SUN.el / RAD;
  // sunrise / sunset glow along the horizon toward the sun (from just before sunrise to a little after)
  if (sEl > -8 && sEl < 10 && fog < .8) {
    const p = skyPoint(Math.max(SUN.el, 0), SUN.az), k = (sEl < 1 ? (sEl + 8) / 9 : (10 - sEl) / 9) * (.35 + .65 * Math.max(0, 1 - cloud * .6)) * (1 - fog);
    if (p) { const R = Math.max(W, H) * .75, gl = c.createRadialGradient(p.x, hy, 0, p.x, hy, R);
      gl.addColorStop(0, `rgba(255,170,90,${.65 * k})`); gl.addColorStop(.25, `rgba(250,120,110,${.38 * k})`); gl.addColorStop(.6, `rgba(190,110,170,${.14 * k})`); gl.addColorStop(1, "rgba(190,110,170,0)");
      c.fillStyle = gl; c.fillRect(0, 0, W, hy + 3); }
  }
  // the sun
  if (sEl > -1 && clear > .05) { const p = skyPoint(SUN.el, SUN.az);
    if (p && p.y < hy + 20) { const low = Math.max(0, 1 - sEl / 12), core = low > .5 ? "255,214,150" : "255,247,225";
      const gl = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 70); gl.addColorStop(0, `rgba(${core},${.55 * clear})`); gl.addColorStop(.3, `rgba(255,200,120,${.18 * clear})`); gl.addColorStop(1, "rgba(255,200,120,0)");
      c.fillStyle = gl; c.fillRect(p.x - 70, p.y - 70, 140, 140);
      c.globalAlpha = Math.min(1, clear * 1.3); c.beginPath(); c.arc(p.x, p.y, 9, 0, 7); c.fillStyle = `rgb(${core})`; c.fill(); c.globalAlpha = 1; } }
  // the moon, with its phase
  const m = moonPos(), mEl = m.el / RAD;
  if (mEl > -1 && clear > .05 && m.lit > .03) { const p = skyPoint(m.el, m.az), n = nightLevel();
    if (p && p.y < hy + 20) { const a = clear * (.35 + .65 * n), r = 7.5;
      const gl = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 40); gl.addColorStop(0, `rgba(220,228,245,${.25 * a * m.lit})`); gl.addColorStop(1, "rgba(220,228,245,0)"); c.fillStyle = gl; c.fillRect(p.x - 40, p.y - 40, 80, 80);
      const sp = skyPoint(SUN.el, SUN.az), side = sp ? Math.atan2(sp.y - p.y, sp.x - p.x) : (((SUN.az - m.az) / RAD + 540) % 360 - 180 > 0 ? 0 : Math.PI);   // lit side faces the sun
      c.save(); c.translate(p.x, p.y); c.rotate(side);
      c.globalAlpha = a; c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);                  // lit limb on one side, terminator as a half-ellipse
      const tx = r * (1 - 2 * m.lit); c.ellipse(0, 0, Math.abs(tx), r, 0, Math.PI / 2, -Math.PI / 2, tx < 0);
      c.fillStyle = "#e9edf5"; c.fill(); c.restore(); c.globalAlpha = 1; } }
  c.restore();
}
