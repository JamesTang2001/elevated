/* ===== Elevated v2 — Saved (starred stations, saved views, your own spots), line status, live station arrivals =====
   Tap the empty search box: line status, your starred stations with their next trains, saved views and spots.
   Everything saved stays in this browser. */
const SAVED = Object.assign({ stations: [], views: [], spots: [] }, load("v2saved", {}));
const saveSaved = () => save("v2saved", SAVED);
const isStarred = id => SAVED.stations.includes(id);
function toggleStar(id) { SAVED.stations = isStarred(id) ? SAVED.stations.filter(x => x !== id) : [...SAVED.stations, id].slice(-8); saveSaved(); refreshPanel(); toast(isStarred(id) ? "Starred. Tap the search box to see it." : "Removed from starred.", 2400); }

/* live arrival predictions for an L station (Train Tracker arrivals), falling back to the timetable */
const ARRV = new Map(), ARR_RT = { Red: "red", Blue: "blue", Brn: "brn", G: "g", Org: "o", P: "p", Pink: "pnk", Y: "y" };
function liveArrivals(id) {
  if (!liveCurrent()) return null;
  const c = ARRV.get(id);
  if (!c || (Date.now() - c.t > 30000 && !c.busy)) {
    const e = c || { t: 0, rows: null }; e.busy = true; ARRV.set(id, e);
    liveFetch("/api/arrivals?mapid=" + encodeURIComponent(id)).then(d => { e.t = Date.now(); e.busy = false;
      if (d && d.eta) e.rows = d.eta.map(x => ({ line: ARR_RT[x.rt] || "red", dest: x.dest, t: parseCtaTime(x.arr) + (simT - chicagoNow()), key: `live:${ARR_RT[x.rt]}:${x.rn}`, live: true, app: x.app, dly: x.dly, sch: x.sch }));
      if (selected && (selected.type === "station" || selected.type === "near")) refreshPanel(); }).catch(() => { e.t = Date.now(); e.busy = false; });
  }
  return c && c.rows && c.rows.filter(r => r.t > simT - 30000);
}
function bestArrivals(id) { const L = liveArrivals(id); return L && L.length ? L : arrivalsAt(id); }

/* line status: a dot per L line, amber when CTA has an alert affecting it */
function lineStatusHtml() {
  const bad = new Set(ALERTS.list.filter(a => a.major || a.sev >= 40 || !a.st.length).flatMap(a => a.L));
  return `<div class="ls">${LINES.map(l => `<span title="${LNAME[l]} Line: ${bad.has(l) ? "service alert" : "no major alerts"}"><i style="background:${LCOL[l]}"></i>${LNAME[l]}${bad.has(l) ? '<b>!</b>' : ""}</span>`).join("")}</div>`;
}
/* what the search box shows before you type */
let homeEditing = null;
function renderHome() {
  const box = $("results");
  let h = `<div class="home"><div class="hs">Lines${ALERTS.t ? "" : " · live status when the server is running"}</div>${lineStatusHtml()}`;
  if (SAVED.stations.length) { h += `<div class="hs">Starred</div>`;
    for (const id of SAVED.stations) { const s = ST[id]; if (!s) continue; const next = bestArrivals(id).slice(0, 3);
      h += `<button type="button" class="hrow" data-hst="${id}"><span><b>${esc(s.name)}</b>${s.lines.map(l => `<i class="sw" style="background:${LCOL[l]}"></i>`).join("")}</span><small>${next.length ? next.map(r => `${LNAME[r.line][0]} ${mins(r.t) <= 0 ? "Due" : mins(r.t) + "m"}`).join(" · ") : "No trains soon"}</small></button>`; } }
  if (SAVED.views.length || SAVED.spots.length) { h += `<div class="hs">Saved</div>`;
    SAVED.views.forEach((v, i) => h += `<div class="hrow"><button type="button" class="hgo" data-hview="${i}">◫ ${esc(v.name)}</button><button type="button" class="hx" data-hdelv="${i}" aria-label="Delete">×</button></div>`);
    SAVED.spots.forEach((v, i) => h += `<div class="hrow"><button type="button" class="hgo" data-hspot="${i}">● ${esc(v.name)}</button><button type="button" class="hx" data-hdels="${i}" aria-label="Delete">×</button></div>`); }
  if (homeEditing) h += `<form class="hedit" id="hForm"><input id="hName" maxlength="40" placeholder="${homeEditing === "view" ? "Name this view" : "Name this spot"}" autocomplete="off"><button type="submit">Save</button></form>`;
  else h += `<div class="hacts"><button type="button" data-hadd="view">＋ Save this view</button><button type="button" data-hadd="spot">＋ Add a spot here</button></div>`;
  if (!SAVED.stations.length) h += `<div class="hnote">Star a station from its card to see its next trains here.</div>`;
  box.innerHTML = h + `</div>`; box.hidden = false;
  if (homeEditing) setTimeout(() => $("hName") && $("hName").focus(), 0);
}
function drawSpots() {
  for (const m of drawSpots.mk || []) m.remove(); drawSpots.mk = [];
  for (const s of SAVED.spots) { const el = document.createElement("div"); el.className = "spot"; el.title = s.name; el.innerHTML = `<i></i><span>${esc(s.name)}</span>`;
    drawSpots.mk.push(new maplibregl.Marker({ element: el, anchor: "bottom-left", offset: [-6, 6] }).setLngLat([s.lon, s.lat]).addTo(map)); }
}
function homeClick(e) {
  const t = e.target, g = sel => t.closest(sel);
  if (g("[data-hst]")) { closeSearch(); openStation(g("[data-hst]").dataset.hst); }
  else if (g("[data-hview]")) { const v = SAVED.views[+g("[data-hview]").dataset.hview]; closeSearch(); stopFollow(); map.flyTo({ center: v.center, zoom: v.zoom, pitch: v.pitch, bearing: v.bearing, duration: 2200 }); }
  else if (g("[data-hspot]")) { const v = SAVED.spots[+g("[data-hspot]").dataset.hspot]; closeSearch(); stopFollow(); map.flyTo({ center: [v.lon, v.lat], zoom: Math.max(map.getZoom(), 15.5), duration: 1800 }); }
  else if (g("[data-hdelv]")) { SAVED.views.splice(+g("[data-hdelv]").dataset.hdelv, 1); saveSaved(); renderHome(); }
  else if (g("[data-hdels]")) { SAVED.spots.splice(+g("[data-hdels]").dataset.hdels, 1); saveSaved(); drawSpots(); renderHome(); }
  else if (g("[data-hadd]")) { homeEditing = g("[data-hadd]").dataset.hadd; renderHome(); }
  else return false;
  return true;
}
function homeSubmit(e) {
  e.preventDefault(); const name = ($("hName").value || "").trim() || (homeEditing === "view" ? "My view" : "My spot"), c = map.getCenter();
  if (homeEditing === "view") SAVED.views.push({ name, center: [+c.lng.toFixed(5), +c.lat.toFixed(5)], zoom: +map.getZoom().toFixed(2), pitch: Math.round(map.getPitch()), bearing: Math.round(map.getBearing()) });
  else { SAVED.spots.push({ name, lon: +c.lng.toFixed(5), lat: +c.lat.toFixed(5) }); drawSpots(); }
  homeEditing = null; saveSaved(); renderHome(); toast(`Saved "${name}".`, 2000);
}
function closeSearch() { $("results").hidden = true; homeEditing = null; $("q").blur(); document.body.classList.remove("search-open"); }
