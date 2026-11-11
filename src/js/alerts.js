/* ===== Elevated v2 — CTA service alerts (via the local server) and "near me" =====
   Alerts: stations named in a train alert get a soft amber ring; train, station and bus cards show the alerts that apply.
   Near me: the locate button in the search box finds the closest L and Metra stations to where you are. */
const ALERTS = { list: [], t: 0 };
const ALERT_LINE = { Red: "red", Blue: "blue", Brn: "brn", G: "g", Org: "o", P: "p", Pexp: "p", Pink: "pnk", Y: "y" };
async function pollAlerts() {
  try { const d = await liveFetch("/api/alerts"); if (!d || !d.alerts) return;
    ALERTS.list = d.alerts.map(a => Object.assign(a, { L: a.lines.map(x => ALERT_LINE[x]).filter(Boolean), st: [] })); ALERTS.t = Date.now();
    matchAlertStations(); markAlertStations();
  } catch (e) {}
}
function matchAlertStations() {                                     // stations named in the alert text, on the alert's lines
  const names = ST_IDS.map(id => [id, ST[id].name.toLowerCase()]).sort((a, b) => b[1].length - a[1].length);
  for (const a of ALERTS.list) { if (!a.L.length) continue;
    const hit = [], find = txt => { for (const [id, nm] of names) { const i = txt.indexOf(nm); if (i < 0) continue;
      const before = txt[i - 1] || " ", after = txt[i + nm.length] || " ";
      if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;       // whole names only ("Lake" is not "State/Lake")
      if (hit.some(h => ST[h].name.toLowerCase().includes(nm))) continue;
      if (ST[id].lines.some(l => a.L.includes(l))) hit.push(id); } };
    find(a.head.toLowerCase());                                       // the headline names the affected station; the text often names alternatives
    if (!hit.length) { find(a.short.toLowerCase()); hit.length = Math.min(hit.length, 1); }
    a.st = hit; }
}
let alertMarked = [];
function markAlertStations() {
  if (!map || !map.getSource("st")) return;
  for (const id of alertMarked) map.setFeatureState({ source: "st", id: +id }, { alert: false });
  alertMarked = [...new Set(ALERTS.list.flatMap(a => a.st))];
  for (const id of alertMarked) map.setFeatureState({ source: "st", id: +id }, { alert: true });
}
const alertsForLine = l => ALERTS.list.filter(a => a.L.includes(l) && (!a.st.length || a.major || a.sev >= 40));   // line-wide or serious
const alertsForStation = id => ALERTS.list.filter(a => a.st.includes(id));
const alertsForBus = rt => ALERTS.list.filter(a => a.buses.includes(String(rt)));
function alertHtml(list) {
  if (!list.length) return "";
  return list.slice(0, 3).map(a => `<div class="alert"><b>${esc(a.head)}</b><span>${esc(a.short.length > 160 ? a.short.slice(0, 157) + "…" : a.short)}</span></div>`).join("")
    + (list.length > 3 ? `<div class="note">${list.length - 3} more alerts on transitchicago.com</div>` : "");
}

/* ---------- near me ---------- */
function nearMe() {
  if (!navigator.geolocation) { toast("This browser can't share your location."); return; }
  toast("Finding stations near you…", 2500);
  navigator.geolocation.getCurrentPosition(p => {
    const lon = p.coords.longitude, lat = p.coords.latitude;
    if (lon < PAD_BOUNDS[0][0] || lon > PAD_BOUNDS[1][0] || lat < PAD_BOUNDS[0][1] || lat > PAD_BOUNDS[1][1]) { toast("You're outside the Chicago area this map covers."); return; }
    stopFollow(); selected = { type: "near", lon, lat }; $("card").hidden = false; refreshPanel();
    map.easeTo({ center: [lon, lat], zoom: 15, duration: 900, padding: panelPadding() });
    nearMarker(lon, lat);
  }, () => toast("Location is off. Allow it for this page in your browser to use Near me."), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}
let nearMk = null;
function nearMarker(lon, lat) { if (nearMk) nearMk.remove(); const el = document.createElement("div"); el.className = "me-dot"; nearMk = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map); }
function renderNear() {
  const { lon, lat } = selected, d = (a, b) => Math.hypot((a - lon) * KX, b - lat) * MPD;
  const L = ST_IDS.map(id => [id, d(ST[id].lon, ST[id].lat)]).sort((a, b) => a[1] - b[1]).slice(0, 4).filter(x => x[1] < 2500);
  const seenM = new Set(), M = Object.entries(METRA.stops).filter(([, s]) => s[3] !== "amtrak").map(([id, s]) => [id, d(s[1], s[2])]).sort((a, b) => a[1] - b[1])
    .filter(([id]) => { const n = METRA.stops[id][0]; if (seenM.has(n)) return false; seenM.add(n); return true; }).slice(0, 2).filter(x => x[1] < 2500);
  const walk = m => `${Math.max(1, Math.round(m / 80))} min walk`;
  const when = ts => { if (!ts.length) return "–"; const v = ts.map(t => mins(t) <= 0 ? "Due" : mins(t)); return v.join(", ") + (typeof v[v.length - 1] === "number" ? "<small> min</small>" : ""); };
  let h = cardHead("◎", "#3d4450", "Near you", L.length || M.length ? "Closest stops and stations" : "No stations within a 30-minute walk");
  h += `<div class="cb">`;
  for (const [id, m] of L) { const s = ST[id], next = bestArrivals(id).slice(0, 2), al = alertsForStation(id);
    h += `<div class="row" data-station="${id}"><span><b>${esc(s.name)}</b> ${s.lines.map(l => `<i class="sw" style="display:inline-block;background:${LCOL[l]};margin-left:4px"></i>`).join("")}<small style="display:block;color:var(--ink3)">${walk(m)}${al.length ? " · ⚠ alert" : ""}</small></span><span class="min">${when(next.map(r => r.t))}</span></div>`; }
  for (const [id, m] of M) { const s = METRA.stops[id], next = metraDepartures(id, 120).slice(0, 2);
    h += `<div class="row" data-mstop="${id}"><span><b>${esc(s[0])}</b><small style="display:block;color:var(--ink3)">${s[3] === "ss" ? "South Shore" : "Metra"} · ${walk(m)}</small></span><span class="min">${when(next.map(r => r.tm))}</span></div>`; }
  const B = [], seenB = new Set(); for (const [i, m] of BSTOP_ALL.map((s, i) => [i, Math.abs(s[1] - lat) < .006 ? d(s[0], s[1]) : 1e9]).filter(x => x[1] < 450).sort((a, b) => a[1] - b[1])) { const k = BSTOP_ALL[i][2] + BSTOP_ALL[i][3]; if (seenB.has(k)) continue; seenB.add(k); B.push([i, m]); if (B.length === 4) break; }
  if (B.length) h += `<div class="sub">Bus stops</div>` + B.map(([i, m]) => { const s = BSTOP_ALL[i], rts = s[4].map(k => BSTOP_RT[k]);
    return `<div class="row" data-bstop="${i}"><span><b>${esc(s[2])}</b><small style="display:block;color:var(--ink3)">${DIRN[s[3]] || "Bus"} · ${rts.slice(0, 5).map(esc).join(", ")} · ${walk(m)}</small></span><span class="min">›</span></div>`; }).join("");
  const dock = WT_DOCKS.map(([n, x, y, k]) => [n, k, d(x, y)]).filter(x => x[2] < 2500).sort((a, b) => a[2] - b[2])[0];
  if (dock && boatsOn()) { const next = wtDepartures(dock[1], simT, simT + 3 * 3600000).slice(0, 2);
    h += `<div class="sub">Water taxi</div><div class="row"><span><b>${esc(dock[0])}</b><small style="display:block;color:var(--ink3)">${walk(dock[2])}</small></span><span class="min">${next.length ? when(next.map(w => w.t)) : "–"}</span></div>`; }
  $("card").innerHTML = h + `<div class="note">Tap a stop for its next trains or buses. Walking times assume a straight line.</div></div>`;
}
