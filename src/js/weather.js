const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;   // honour the system setting: no flashes, gentler camera
/* ===== Elevated v2 — weather and sky from Open-Meteo (no key): cloud cover dims the sun and casts drifting
   cloud shadows, rain and snow fall over the map, low visibility brings in fog, and the sky follows it all.
   Hourly data covers the last three days and the next two, so replaying earlier times shows that hour's weather. */
const WX = { hours: null, t: 0, busy: false, cur: null, key: "" };
const WX_URL = "https://api.open-meteo.com/v1/forecast?latitude=41.88&longitude=-87.63&hourly=temperature_2m,weather_code,cloud_cover,precipitation,rain,snowfall,visibility,wind_speed_10m,wind_direction_10m&past_days=3&forecast_days=2&timezone=America%2FChicago&temperature_unit=fahrenheit&wind_speed_unit=mph";
const WX_TEXT = c => c === 0 ? "Clear" : c === 1 ? "Mostly clear" : c === 2 ? "Partly cloudy" : c === 3 ? "Cloudy" : c === 45 || c === 48 ? "Fog" : c >= 51 && c <= 57 ? "Drizzle"
  : c >= 61 && c <= 67 ? (c === 61 ? "Light rain" : c === 65 ? "Heavy rain" : c >= 66 ? "Freezing rain" : "Rain") : c >= 71 && c <= 77 ? (c === 71 ? "Light snow" : c === 75 ? "Heavy snow" : "Snow")
  : c >= 80 && c <= 82 ? "Showers" : c === 85 || c === 86 ? "Snow showers" : c >= 95 ? "Thunderstorm" : "";
async function loadWeather() {
  if (WX.busy || Date.now() - WX.t < 15 * 60000) return; WX.busy = true;
  try { const d = await fetch(WX_URL).then(r => r.json()), h = d.hourly;
    if (h && h.time) WX.hours = h.time.map((t, i) => ({ t: Date.parse(t + ":00Z"), temp: h.temperature_2m[i], code: h.weather_code[i], cloud: h.cloud_cover[i] || 0, precip: h.precipitation[i] || 0,
      rain: h.rain[i] || 0, snow: h.snowfall[i] || 0, vis: h.visibility[i] == null ? 24000 : h.visibility[i], wind: h.wind_speed_10m[i] || 0, dir: h.wind_direction_10m[i] || 0 }));
    WX.t = Date.now();
  } catch (e) { WX.t = Date.now() - 10 * 60000; }                // try again in five minutes
  WX.busy = false;
}
function wxAt(t) {                                               // that hour's weather, blended toward the next hour
  const H = WX.hours; if (!H || SET.weather === false) return null;
  const i = Math.floor((t - H[0].t) / 3600000); if (i < 0 || i >= H.length) return null;
  const a = H[i], b = H[Math.min(H.length - 1, i + 1)], f = (t - a.t) / 3600000, mix = k => a[k] + (b[k] - a[k]) * f;
  return { temp: mix("temp"), code: f < .5 ? a.code : b.code, cloud: mix("cloud"), precip: mix("precip"), rain: mix("rain"), snow: mix("snow"), vis: mix("vis"), wind: mix("wind"), dir: a.dir };
}
const wxSunDim = () => { const w = WX.cur; return w ? 1 - .55 * w.cloud / 100 - (w.precip > .2 ? .1 : 0) : 1; };   // how much of the sun gets through
function wxIcon(c) { const n = nightLevel() > .5, t = "\uFE0E";                // small text-style symbols, not emoji
  return c >= 95 ? "⚡" + t : (c >= 71 && c <= 77) || c === 85 || c === 86 ? "❄" + t : c >= 51 && c <= 82 ? "☂" + t : c === 45 || c === 48 ? "≋" : c === 3 ? "☁" + t : n ? "☾" + t : "☀" + t; }
function wxLabel() { const w = WX.cur; return w ? `${wxIcon(w.code)} ${Math.round(w.temp)}°` : ""; }

/* sky colour and fog: blue on clear days, grey under cloud, deep blue at night, washed out in fog */
const mixHex = (a, b, f) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return "#" + A.map((x, i) => Math.round(x + (B[i] - x) * Math.max(0, Math.min(1, f))).toString(16).padStart(2, "0")).join(""); };
function applyWeather() {
  WX.cur = wxAt(simT);
  if (!map || !map.setSky || !map.style || !map.style._loaded) return;
  const w = WX.cur, n = SET.daylight ? nightLevel() : (styleTheme === "dark" ? .8 : 0), dark = styleTheme === "dark";
  const cl = w ? w.cloud / 100 : .2, fog = w ? Math.max(0, Math.min(1, (6000 - w.vis) / 5500)) : 0;
  let sky = mixHex("#8db6e3", "#a9b2bc", cl), hor = mixHex("#dce8f4", "#d2d6da", cl);
  if (dark || n > 0) { sky = mixHex(sky, dark ? "#0b1220" : "#18233a", dark ? Math.max(.85, n) : n); hor = mixHex(hor, dark ? "#1a2433" : "#2a3550", dark ? Math.max(.8, n) : n); }
  const fogCol = mixHex(hor, dark ? "#2a323d" : "#e3e5e6", fog);
  SKYC.sky = sky; SKYC.hor = hor;                                 // the sky itself is painted behind the map (sky.js)
  const key = [sky, hor, fogCol, fog.toFixed(2)].join();
  if (key === WX.key) return; WX.key = key;
  map.setSky({ "sky-color": "rgba(0,0,0,0)", "horizon-color": "rgba(0,0,0,0)", "fog-color": fogCol, "sky-horizon-blend": .55, "horizon-fog-blend": .6 + .3 * fog, "fog-ground-blend": .92 - .7 * fog, "atmosphere-blend": 0 });
}

/* rain streaks, snowflakes, lightning and fog haze, drawn on the vehicle overlay (screen space, cheap) */
const DROPS = [];
let flashT = 0, nextFlash = 0;
function drawWeather(ctx, W, H, z) {
  const w = WX.cur; if (!w) return;
  const dark = styleTheme === "dark", now = performance.now();
  const fog = Math.max(0, Math.min(1, (6000 - w.vis) / 5500)) * (w.code === 45 || w.code === 48 ? 1 : .8);
  if (fog > .02) { const g = ctx.createLinearGradient(0, 0, 0, H); const c = dark ? "40,48,60" : "236,238,239";
    g.addColorStop(0, `rgba(${c},${.55 * fog})`); g.addColorStop(.55, `rgba(${c},${.28 * fog})`); g.addColorStop(1, `rgba(${c},${.12 * fog})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  const snowy = w.snow > .02 || (w.code >= 71 && w.code <= 77) || w.code === 85 || w.code === 86, wet = !snowy && (w.rain > .05 || w.precip > .05 || (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 82) || w.code >= 95);
  const want = snowy ? Math.min(700, 120 + w.snow * 260) : wet ? Math.min(650, 70 + w.precip * 160) : 0, n = Math.round(want * Math.min(1, W * H / 1.3e6));
  while (DROPS.length < n) DROPS.push({ x: Math.random() * W, y: Math.random() * H, s: .6 + Math.random() * .8, ph: Math.random() * 6.3 });
  DROPS.length = Math.min(DROPS.length, n);
  if (n) {
    const wx = Math.sin(((w.dir + 180) % 360) * RAD - map.getBearing() * RAD) * Math.min(1, w.wind / 25);  // drift with the wind, as seen on screen
    if (snowy) { ctx.fillStyle = dark ? "rgba(235,240,248,.85)" : "rgba(255,255,255,.95)"; ctx.strokeStyle = "rgba(120,130,145,.35)"; ctx.lineWidth = .6;
      for (const d of DROPS) { d.y += 1.1 * d.s; d.x += wx * 1.4 * d.s + Math.sin(now / 900 + d.ph) * .35; if (d.y > H) { d.y = -4; d.x = Math.random() * W; } if (d.x > W) d.x -= W; if (d.x < 0) d.x += W;
        ctx.beginPath(); ctx.arc(d.x, d.y, 1.1 + d.s, 0, 7); ctx.fill(); if (!dark) ctx.stroke(); } }
    else { ctx.strokeStyle = dark ? "rgba(170,190,215,.45)" : "rgba(90,110,135,.38)"; ctx.lineWidth = 1; ctx.beginPath();
      for (const d of DROPS) { const vy = 16 * d.s, vx = wx * 6 * d.s; d.y += vy; d.x += vx; if (d.y > H) { d.y = -20; d.x = Math.random() * W; } if (d.x > W) d.x -= W; if (d.x < 0) d.x += W;
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - vx * .8, d.y - vy * .8); } ctx.stroke(); }
  }
  if (w.code >= 95 && !REDUCED_MOTION) {                         // thunderstorm: an occasional flash (not with reduced motion)
    if (now > nextFlash) { flashT = now; nextFlash = now + 6000 + Math.random() * 14000; }
    const a = now - flashT < 90 ? .28 : now - flashT > 160 && now - flashT < 230 ? .16 : 0; if (a) { ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(0, 0, W, H); }
  }
}
