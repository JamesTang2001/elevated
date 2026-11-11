/* Elevated — live data for the hosted map (Cloudflare Pages Functions).
   The same /api/… endpoints as the local server.py, so the page works unchanged in both places.
   Keys live only in Cloudflare (Settings → Variables and Secrets): CTA_TRAIN_KEY, CTA_BUS_KEY.
   Every answer is cached at Cloudflare's edge, so all visitors share the same upstream calls:
   CTA Bus Tracker allows about 10,000 requests a day per key, and the whole bus fleet costs 13 requests. */

const CTA_TRAIN_URL = "https://lapi.transitchicago.com/api/1.0/ttpositions.aspx";
const CTA_ARR_URL = "https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx";
const CTA_ALERTS_URL = "https://www.transitchicago.com/api/1.0/alerts.aspx?outputType=JSON&activeonly=true";
const BT = "https://www.ctabustracker.com/bustime/api/v2";
const AMTRAK_URL = "https://api-v3.amtraker.com/v3/trains";
const COMED_URL = "https://hourlypricing.comed.com/api?type=5minutefeed";
const L_ROUTES = "red,blue,brn,G,org,P,pink,Y";
const BUS_ROUTES = ("1 2 3 4 X4 6 7 8 8A 9 X9 10 11 12 J14 15 18 19 20 21 22 24 26 28 29 30 31 34 35 36 37 39 43 44 47 48 49 49B X49 " +
  "50 51 52 52A 53 53A 54 54A 54B 55 55A 55N 56 57 59 60 62 62H 63 63W 65 66 67 68 70 71 72 73 74 75 76 77 78 79 80 81 81W " +
  "82 84 85 85A 86 87 88 90 91 92 93 94 95 96 97 100 103 106 108 111 111A 112 115 119 120 121 124 125 126 128 130 134 135 " +
  "136 143 146 147 148 151 152 155 156 157 165 169 171 172 192 201 206").split(" ");
const BUS_SET = new Set(BUS_ROUTES);

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const now = () => Math.floor(Date.now() / 1000);
async function getJSON(url, timeout = 12000) {
  const r = await fetch(url, { headers: { "User-Agent": "Elevated-map/1.0" }, signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`);
  return r.json();
}
/* shared edge cache: one upstream call per key per ttl, per Cloudflare data center */
const MEM = new Map();
async function cached(ctx, key, ttl, make) {
  const m = MEM.get(key); if (m && Date.now() - m.t < ttl * 1000) return m.d;
  const req = new Request("https://elevated.cache/" + encodeURIComponent(key)), cache = caches.default;
  const hit = await cache.match(req); if (hit) { const d = await hit.json(); MEM.set(key, { t: Date.now(), d }); return d; }
  const d = await make();
  if (!d || !d.error) {
    MEM.set(key, { t: Date.now(), d });
    ctx.waitUntil(cache.put(req, new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` } })));
  }
  return d;
}
const arr = x => Array.isArray(x) ? x : x ? [x] : [];

/* ---------- endpoints ---------- */
async function trains(ctx) {
  const key = ctx.env.CTA_TRAIN_KEY; if (!key) return { error: "No CTA_TRAIN_KEY" };
  return cached(ctx, "trains", 15, async () => {
    const d = await getJSON(`${CTA_TRAIN_URL}?` + new URLSearchParams({ key, rt: L_ROUTES, outputType: "JSON" }));
    const err = (d.ctatt || {}).errNm; if (err) return { error: "CTA says: " + err };
    return d;
  });
}
async function busesFor(ctx, routes) {
  const key = ctx.env.CTA_BUS_KEY, vehicles = [], errors = [];
  const calls = []; for (let i = 0; i < routes.length; i += 10) calls.push(routes.slice(i, i + 10));
  await Promise.all(calls.map(async rts => {
    try { const r = (await getJSON(`${BT}/getvehicles?` + new URLSearchParams({ key, rt: rts.join(","), format: "json" })))["bustime-response"] || {};
      vehicles.push(...arr(r.vehicle)); for (const e of arr(r.error)) if (!/No data found/.test(e.msg || "")) errors.push(e.msg);
    } catch (e) { errors.push(String(e.message || e)); }
  }));
  return { vehicle: vehicles, errors: errors.slice(0, 5), t: now() };
}
async function buses(ctx) {
  if (!ctx.env.CTA_BUS_KEY) return { error: "No CTA_BUS_KEY" };
  return cached(ctx, "buses", 240, () => busesFor(ctx, BUS_ROUTES));     // the whole fleet every 4 minutes: about 4,700 requests a day
}
async function busesNear(ctx, rts) {                                        // the page asks for routes near the view: answer from the fleet snapshot
  const all = await buses(ctx); if (all.error) return all;
  const want = new Set(rts.filter(r => BUS_SET.has(r)));
  return { vehicle: (all.vehicle || []).filter(v => want.has(String(v.rt))), t: all.t };
}
async function patterns(ctx, pids) {
  const key = ctx.env.CTA_BUS_KEY, out = {}, missing = [];
  for (const p of pids.slice(0, 60)) { if (!/^\d+$/.test(p)) continue;
    const hit = await caches.default.match(new Request("https://elevated.cache/pat/" + p)); if (hit) out[p] = await hit.json(); else missing.push(p); }
  if (key && missing.length) for (let i = 0; i < missing.length; i += 10) {
    try { const r = (await getJSON(`${BT}/getpatterns?` + new URLSearchParams({ key, pid: missing.slice(i, i + 10).join(","), format: "json" })))["bustime-response"] || {};
      for (const ptr of arr(r.ptr)) {
        const rec = { ln: +ptr.ln || 0, dir: ptr.rtdir || "", pts: arr(ptr.pt).map(p => [+(+p.lat).toFixed(6), +(+p.lon).toFixed(6), Math.round(+p.pdist)]) }, pid = String(ptr.pid);
        out[pid] = rec; ctx.waitUntil(caches.default.put(new Request("https://elevated.cache/pat/" + pid), new Response(JSON.stringify(rec), { headers: { "Cache-Control": "public, max-age=604800" } })));
      }
    } catch (e) {}
  }
  return out;
}
async function arrivals(ctx, mapid) {
  const key = ctx.env.CTA_TRAIN_KEY; if (!key) return { error: "No CTA_TRAIN_KEY" };
  if (!/^\d+$/.test(mapid)) return { error: "bad station" };
  return cached(ctx, "arr:" + mapid, 30, async () => {
    const eta = arr(((await getJSON(`${CTA_ARR_URL}?` + new URLSearchParams({ key, mapid, max: 12, outputType: "JSON" }))).ctatt || {}).eta);
    return { eta: eta.map(e => ({ rt: e.rt, rn: e.rn, dest: e.destNm, dir: e.stpDe, arr: e.arrT, app: e.isApp === "1", dly: e.isDly === "1", sch: e.isSch === "1", flt: e.isFlt === "1" })), t: now() };
  });
}
async function alerts(ctx) {
  return cached(ctx, "alerts", 120, async () => {
    const raw = arr(((await getJSON(CTA_ALERTS_URL)).CTAAlerts || {}).Alert), out = [];
    for (const a of raw) {
      const sv = arr((a.ImpactedService || {}).Service), lines = sv.filter(x => x.ServiceType === "R").map(x => x.ServiceId), buses = sv.filter(x => x.ServiceType === "B").map(x => x.ServiceId);
      if (!lines.length && !buses.length) continue;
      const url = a.AlertURL && typeof a.AlertURL === "object" ? a.AlertURL["#cdata-section"] : a.AlertURL;
      out.push({ id: a.AlertId, head: a.Headline || "", short: (a.ShortDescription || "").trim(), sev: +(a.SeverityScore || 0), impact: a.Impact || "", major: a.MajorAlert === "1", lines, buses, url, start: a.EventStart, end: a.EventEnd });
    }
    return { alerts: out, t: now() };
  });
}
async function routeStops(ctx, rt) {                                      // every stop of a route, both directions (cached a week)
  return cached(ctx, "stops:" + rt, 604800, async () => {
    const key = ctx.env.CTA_BUS_KEY, out = [];
    const dirs = arr(((await getJSON(`${BT}/getdirections?` + new URLSearchParams({ key, rt, format: "json" })))["bustime-response"] || {}).directions).map(d => typeof d === "object" ? d.dir : d);
    for (const d of dirs) for (const st of arr(((await getJSON(`${BT}/getstops?` + new URLSearchParams({ key, rt, dir: d, format: "json" })))["bustime-response"] || {}).stops))
      out.push({ id: String(st.stpid), name: st.stpnm || "", lat: +st.lat, lon: +st.lon, dir: d });
    return { stops: out };
  });
}
async function transfers(ctx, lat, lon, rts) {
  if (!ctx.env.CTA_BUS_KEY) return { error: "No CTA_BUS_KEY" };
  if (!isFinite(lat) || !isFinite(lon)) return { error: "bad location" };
  rts = [...new Set(rts.filter(r => BUS_SET.has(r)))].sort().slice(0, 8);
  return cached(ctx, `xfer:${lat.toFixed(4)},${lon.toFixed(4)}:${rts.join(",")}`, 60, async () => {
    const kx = Math.cos(lat * Math.PI / 180), near = {};
    for (const rt of rts) { let stops = []; try { stops = (await routeStops(ctx, rt)).stops || []; } catch (e) {}
      for (const st of stops) { const m = Math.hypot((st.lon - lon) * kx, st.lat - lat) * 111320; if (m < 230 && (!near[st.id] || m < near[st.id].m)) near[st.id] = { ...st, m: Math.round(m), rt }; } }
    const best = {}; for (const st of Object.values(near)) { const k = st.rt + "|" + st.dir; if (!best[k] || st.m < best[k].m) best[k] = st; }
    const ids = [...new Set(Object.values(best).map(s => s.id))].slice(0, 20), prd = [];
    for (let i = 0; i < ids.length; i += 10) {
      try { const r = (await getJSON(`${BT}/getpredictions?` + new URLSearchParams({ key: ctx.env.CTA_BUS_KEY, stpid: ids.slice(i, i + 10).join(","), top: 12, format: "json" })))["bustime-response"] || {};
        for (const p of arr(r.prd)) if (rts.includes(p.rt)) { const st = near[String(p.stpid)] || {}; prd.push({ rt: p.rt, dir: p.rtdir, des: p.des, stop: p.stpnm, m: st.m, t: p.prdtm, dly: !!p.dly, vid: p.vid }); }
      } catch (e) {}
    }
    return { prd, stops: ids.length, t: now() };
  });
}
async function amtrak(ctx) {
  return cached(ctx, "amtrak", 60, async () => {
    const raw = await getJSON(AMTRAK_URL, 20000), out = [];
    for (const runs of Object.values(raw)) for (const t of runs) {
      const { lat, lon } = t; if (lat == null || lon == null || lat < 41.15 || lat > 42.85 || lon < -89.15 || lon > -86.75) continue;
      if (!["Active", "Predeparture"].includes(t.trainState)) continue;
      const nxt = (t.stations || []).find(s => s.status === "Enroute");
      out.push({ num: t.trainNum, id: t.trainID, route: t.routeName, lat, lon, heading: t.heading, mph: t.velocity, state: t.trainState, orig: t.origName, dest: t.destName,
        next: nxt && nxt.name, nextCode: nxt && nxt.code, eta: nxt && nxt.arr, sch: nxt && nxt.schArr, upd: t.lastValTS });
    }
    return { trains: out, t: now() };
  });
}
async function price(ctx) {
  return cached(ctx, "price", 60, async () => {
    const rows = (await getJSON(COMED_URL)).map(r => ({ t: +r.millisUTC, cents: +r.price })).sort((a, b) => a.t - b.t);
    return { latest: rows[rows.length - 1] || null, last24h: rows.slice(-288) };
  });
}

/* ---------- router ---------- */
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url), p = url.pathname.replace(/\/+$/, ""), q = k => url.searchParams.get(k) || "";
  try {
    switch (p) {
      case "/api/status": return json({ live: true, hosted: true, keys: { CTA_TRAIN_KEY: !!ctx.env.CTA_TRAIN_KEY, CTA_BUS_KEY: !!ctx.env.CTA_BUS_KEY, AISSTREAM_KEY: false } });
      case "/api/trains": return json(await trains(ctx));
      case "/api/buses": return json(await buses(ctx));
      case "/api/buses/near": return json(await busesNear(ctx, q("rt").split(",")));
      case "/api/patterns": return json(await patterns(ctx, q("pid").split(",")));
      case "/api/arrivals": return json(await arrivals(ctx, q("mapid")));
      case "/api/alerts": return json(await alerts(ctx));
      case "/api/transfers": return json(await transfers(ctx, parseFloat(q("lat")), parseFloat(q("lon")), q("rt").split(",")));
      case "/api/amtrak": return json(await amtrak(ctx));
      case "/api/price": return json(await price(ctx));
      case "/api/history": return json({ days: {}, hours: {} });          // delay history needs storage; only the home server keeps it
      case "/api/ships": return json({ ships: [], t: now() });             // ships need an always-open connection; only the home server has them
      default: return json({ error: "not found" }, 404);
    }
  } catch (e) { return json({ error: String(e.message || e) }, 502); }
}
