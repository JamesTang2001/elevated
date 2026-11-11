/* ===== Elevated v2 — connections to Metra, South Shore, Amtrak and the water taxi; train names by character; rider stories ===== */

/* ---------- rail and water-taxi connections within a short walk of a stop ---------- */
const WT_DOCKS = [["Michigan Ave dock", -87.6246, 41.88889, 0], ["Ogilvie / Union dock", -87.63809, 41.8830, 1], ["Chinatown dock", -87.6336, 41.8573, 2]];
function wtDepartures(dock, from, to) {                          // water-taxi departures from one dock between two times
  const d0 = Math.floor(from / DAY) * DAY, dd = [0, WT_STOPS[1][1], WT_PATH.L][dock], out = [];
  for (const tr of wtTrips(d0)) for (const [a, b, t] of tr.legs) if (Math.abs(a - dd) < 5 && t >= from && t <= to) out.push({ t, to: tr.to });
  return out.sort((a, b) => a.t - b.t);
}
function railTransferBlock(lon, lat, arrT, selfIds = []) {
  const walkM = 450, d = (x, y) => Math.hypot((x - lon) * KX, y - lat) * MPD, rows = [], seen = new Set();
  for (const [id, s] of Object.entries(METRA.stops)) {
    if (selfIds.includes(id)) continue; const m = d(s[1], s[2]); if (m > walkM) continue;
    const walk = 60000 + m / 80 * 60000;
    for (const r of metraDepartures(id, 120)) { const ag = MAG(r.t.P.rid), k = ag + r.t.num; if (seen.has(k) || r.tm < arrT + walk - 5 * 60000) continue; seen.add(k);
      rows.push({ tm: r.tm, ok: r.tm >= arrT + walk, badge: ag === "amtrak" ? "A" : ag === "ss" ? "S" : "M", color: MCOL(r.t.P.rid), title: `${ag === "amtrak" ? "Amtrak " + MNAME(r.t.P.rid) : ag === "ss" ? "South Shore" : "Metra " + r.t.P.rid} #${r.t.num}`, sub: `to ${r.t.P.head || ""} · ${s[0]} · ${Math.max(1, Math.round(m / 80))} min walk`, key: metraKey(r.t) }); }
  }
  for (const [name, x, y, dock] of WT_DOCKS) { const m = d(x, y); if (m > walkM) continue; const walk = 60000 + m / 80 * 60000;
    for (const w of wtDepartures(dock, arrT - 5 * 60000, arrT + 90 * 60000).slice(0, 3)) rows.push({ tm: w.t, ok: w.t >= arrT + walk, badge: "WT", color: "#f2c200", title: "Water taxi", sub: `to ${w.to} · ${name} · ${Math.max(1, Math.round(m / 80))} min walk` }); }
  rows.sort((a, b) => a.tm - b.tm);
  if (!rows.length) return "";
  return `<div class="sub">Rail and water taxi</div><div class="board xf">` + rows.slice(0, 6).map(r => `<div class="row${r.ok ? "" : " miss"}"${r.key ? ` data-follow="${esc(r.key)}"` : ""}><span><b class="rt" style="background:${r.color};color:${isLight(r.color) ? "#16191d" : "#fff"}">${r.badge}</b>${esc(r.title)}<small>${esc(r.sub)}</small></span><span class="min">${mins(r.tm) <= 0 ? "Due" : mins(r.tm)}<small>${mins(r.tm) <= 0 ? "" : " min"}</small><em>${r.ok ? "You can make it" : "Leaves before you arrive"}</em></span></div>`).join("") + `</div>`;
}

/* ---------- names by character: every train, bus and boat gets one (shown in the card subtitle) ----------
   Checked in order: something special about this run, a famous film scene it is passing right now,
   the hour, its speed, how full it is likely to be, where it is headed, and finally the line's own personality. */
const FILM_NAMES = {                                              // FILMS index → [day name, night name]
  0: ["The Skydeck Shuttle", "The Night Watch"], 1: ["The Canyon Runner", "The Canyon Runner"], 2: ["The Picasso Express", "The Midnight Chase"],
  3: ["The Boardroom Express", "The Boardroom Express"], 4: ["The Underground Chase", "The Underground Chase"], 5: ["The Rooftop Special", "The Rooftop Special"],
  6: ["The Penthouse Express", "The Penthouse Express"], 7: ["The Gallery Hopper", "The Gallery Hopper"], 8: ["The Parade Float", "The Parade Float"],
  9: ["The Day Game", "The Day Game"], 10: ["The Staircase Special", "The Staircase Special"], 11: ["The Bridge Patrol", "The Bridge Patrol"],
  12: ["The Untouchable", "The Untouchable"], 13: ["The Banquet Run", "The Banquet Run"], 14: ["The Token Booth Sweetheart", "The Token Booth Sweetheart"],
  15: ["The Biograph Bandit", "The Biograph Bandit"], 16: ["The Top Five", "The Top Five"],
};
const LINE_NAMES = { red: "The Workhorse", blue: "The Blue Streak", brn: "The Neighborhood Ride", g: "The Green Machine", o: "The Midway Shuttle", p: "The Purple Commuter", pnk: "The Pink Flyer", y: "The Skokie Swift" };
const keyHash = k => { let x = 2166136261; for (const ch of String(k)) x = Math.imul(x ^ ch.charCodeAt(0), 16777619); return x >>> 0; };
function clockOf(t) { const d = new Date(t); return { h: d.getUTCHours() + d.getUTCMinutes() / 60, we: [0, 6].includes(d.getUTCDay()), mo: d.getUTCMonth() }; }
function filmNear(lon, lat, m = 220) {                            // the film location this vehicle is passing, if any
  if (lon == null || typeof FILMS === "undefined") return -1;
  let best = -1, bd = m; FILMS.forEach((f, i) => { const d = Math.hypot((f[1] - lon) * KX, f[2] - lat) * MPD; if (d < bd) { bd = d; best = i; } }); return best;
}
function trainName(v) {
  const { h, we } = clockOf(simT), night = h >= 21 || h < 5, rush = !we && ((h >= 7 && h < 9.3) || (h >= 16 && h < 18.5));
  const fi = filmNear(v.lon != null ? v.lon : v.b && v.b.lon, v.lat != null ? v.lat : v.b && v.b.lat), film = fi >= 0 && FILM_NAMES[fi] ? FILM_NAMES[fi][night ? 1 : 0] : "";
  if (v.type === "train" || v.type === "live") {
    const tr = v.tr, line = v.line || (tr && tr.prof.route.line), rid = tr && tr.prof.route.id, dest = (v.type === "live" ? v.t.dest : tr && destOf(tr, v.st.e)) || "";
    if (rid === "p-exp") return "The Express";
    if (v.type === "live" && v.t.dly) return "The Straggler";
    if (tr) { const list = tripsAround(tr.prof, simT).flat().filter(x => x.dep < tr.dep + DAY / 2 && x.dep > tr.dep - DAY / 2).sort((a, b) => a.dep - b.dep);
      if (list.length && list[0] === tr) return "The Early Bird"; if (list.length && list[list.length - 1] === tr) return "The Last Call"; }
    if (film) return film;
    const c = [LINE_NAMES[line] || "The Regular"];                // everything that fits this run; the vehicle's id picks one, so neighbours differ
    if (h >= 1 && h < 4.5) c.push("The Night Owl", "The Night Owl");
    else if (h >= 21 || h < 1) c.push("The Moonlighter");
    else if (h >= 4.5 && h < 6) c.push("The Dawn Patrol");
    if (rush && /Loop|Howard|95th|Forest Park|O'Hare/.test(dest) && ["red", "blue", "brn"].includes(line)) c.push("The Sardine Can");
    if (rush) c.push("The Rush Hour Regular");
    if (/O'Hare|Midway/.test(dest)) c.push("The Airport Runner");
    if (/Loop/.test(dest)) c.push("The Loop Circler");
    if (we && h >= 10 && h < 17) c.push("The Weekend Wanderer");
    if (tr && tr.T > 75 * 60) c.push("The Long Haul");
    if (["red", "blue"].includes(line) && h >= 5) c.push("The Subway Surfer");
    return c[keyHash(v.key) % c.length];
  }
  if (v.type === "metra") { const P = v.t.P, ag = MAG(P.rid);
    if (ag === "amtrak") return SUPERLINER.test(MNAME(P.rid)) ? "The Long-Distance Sleeper" : "The Midwest Hopper";
    if (ag === "ss") return night ? "The Dune Night Run" : "The Dune Runner";
    const max = Math.max(...M_PAT.filter(x => x.rid === P.rid).map(x => x.n)); if (P.n <= max * .55) return "The Express";
    if (film) return film;
    const c = [/BNSF|UP-W|UP-N|UP-NW/.test(P.rid) ? "The Double-Decker" : "The Suburban", "The Bi-Level"];
    if (h >= 22 || h < 5) c.push("The Night Owl", "The Last Ride Home"); if (rush) c.push("The Commuter", "The Briefcase Express"); if (we) c.push("The Weekend Getaway");
    return c[keyHash(v.key) % c.length];
  }
  if (v.type === "bus") { const rt = String(v.b && (v.b.raw ? v.b.raw.rt : v.b.rt) || v.label || "");
    if (film) return film;
    if (h >= 1 && h < 4.5) return "The Night Owl";
    if (/^(X|J)/.test(rt)) return "The Express";
    if (["146", "147", "148", "135", "136", "151", "6"].includes(rt)) return "The Lakefront Cruiser";
    if (["29", "65", "66", "124"].includes(rt)) return "The Pier Hopper";
    const c = ["The Neighborhood Hopper", "The Corner Stopper"]; if (rush) c.push("The Rush Hour Regular"); if (night) c.push("The Moonlighter");
    return c[keyHash(v.key) % c.length];
  }
  if (v.type === "boat") return v.kind === "taxi" ? "The River Ferry" : v.kind === "tour" ? "The Sightseer" : "";
  return "";
}

/* ---------- rider stories (Vehicles → Rider stories, off by default): one made-up rider per vehicle ---------- */
const RIDER_NAMES = ["Maria", "James", "Aisha", "Tomás", "Mei", "Darnell", "Priya", "Kevin", "Sofia", "Andre", "Hana", "Luis", "Grace", "Omar", "Elena", "Marcus", "Yuki", "Fatima", "Ben", "Rosa", "Wei", "Nadia", "Jamal", "Ingrid", "Diego", "Keisha", "Arjun", "Chloe"];
// [stop name pattern, [ [what they're doing there, who they might be], ... ], optional month range when it applies]
const RIDER_TRIPS = [
  [/^Addison$/, [["catching a Cubs game at Wrigley Field", ["a lifelong Cubs fan", "a stadium usher", "a kid with a glove"]]], [3, 9]],
  [/^Addison$/, [["seeing a band at the Metro", ["a college student", "a drummer"]]]],
  [/Sox-35th/, [["going to a White Sox game", ["a season-ticket holder", "a dad with two kids"]]], [3, 8]],
  [/^Lawrence$|^Wilson$/, [["catching late jazz at the Green Mill", ["a saxophonist", "a jazz fan"]], ["seeing a concert at the Aragon Ballroom", ["a teenager in a band shirt"]]]],
  [/^Sedgwick$/, [["seeing a comedy show at Second City", ["an improv student", "a couple on a date"]]]],
  [/^Fullerton$/, [["walking over to the Lincoln Park Zoo", ["a parent with a stroller", "a zookeeper"]], ["heading to class at DePaul", ["a DePaul freshman"]]]],
  [/^Armitage$|^Southport$/, [["browsing the boutiques on the way to brunch", ["a designer", "a stylist"]]]],
  [/^Chicago$|^Grand$/, [["shopping on the Magnificent Mile", ["a visitor from Ohio", "a personal shopper"]]]],
  [/^Merchandise Mart$/, [["visiting a design showroom at the Merchandise Mart", ["an interior designer", "an architect"]]]],
  [/^State\/Lake$|^Lake$/, [["seeing a show at the Chicago Theatre", ["a theater lover", "a stagehand"]]]],
  [/Washington\/Wabash|^Monroe$|^Adams\/Wabash$/, [["spending the afternoon at the Art Institute", ["an art student", "a retired teacher"]], ["meeting friends at the Bean in Millennium Park", ["a tourist from Taipei", "a photographer"]]]],
  [/^Quincy$/, [["going up the Willis Tower Skydeck", ["a family on vacation", "a nervous first-timer"]]]],
  [/^Clark\/Lake$|^LaSalle|^Washington$|^Jackson$/, [["heading to a meeting in the Loop", ["an accountant", "a lawyer", "a trader"]], ["picking up a coffee before work", ["a barista", "an office manager"]]]],
  [/^Roosevelt$|^Harrison$/, [["visiting the Field Museum to see Sue the T. rex", ["a dinosaur-obsessed kid", "a paleontology student"]], ["going to the Shedd Aquarium", ["a marine biology student", "a grandmother with grandkids"]]]],
  [/Cermak-Chinatown/, [["having dim sum in Chinatown", ["a food blogger", "a family of five"]]]],
  [/^Ashland$/, [["going to a Bulls game at the United Center", ["a Bulls fan in a vintage jersey"]]], [9, 3]],
  [/^18th$/, [["visiting the National Museum of Mexican Art in Pilsen", ["a muralist", "a history teacher"]]]],
  [/^Damen$/, [["looking for vinyl in Wicker Park", ["a DJ", "a record collector"]], ["meeting friends for brunch", ["a musician", "a chef"]]]],
  [/Logan Square/, [["going to the farmers market in Logan Square", ["a home cook", "a florist"]], ["meeting friends at a cocktail bar", ["a bartender on her night off"]]]],
  [/UIC-Halsted|^Polk$|Illinois Medical/, [["starting a shift at the hospital", ["a nurse", "a resident doctor", "a lab technician"]], ["heading to class at UIC", ["a grad student", "a professor"]]]],
  [/O'Hare|Midway/, [["catching a flight", ["a traveler with a carry-on", "a flight attendant", "a pilot", "a student flying home"]]]],
  [/^Linden$/, [["visiting the Baháʼí House of Worship", ["an architecture fan", "a photographer"]]]],
  [/^Davis$|^Foster$|^Noyes$/, [["going to class at Northwestern", ["a Northwestern sophomore", "a visiting lecturer"]]]],
  [/^Loyola$/, [["going to class at Loyola", ["a nursing student"]]]],
  [/^Garfield$/, [["visiting the DuSable Black History Museum", ["a history buff", "a school group chaperone"]]]],
  [/^Howard$|^Kimball$|^95th/, [["going home after a long day", ["a teacher", "a bus driver", "a retiree"]]]],
];
const RIDER_DOING = ["doing the crossword", "listening to a podcast about space", "texting a friend about dinner plans", "reading a mystery novel", "watching the skyline go by",
  "sketching the other passengers", "rehearsing a presentation under their breath", "eating a Chicago-style hot dog, no ketchup", "learning Spanish on their phone", "holding a bouquet of flowers",
  "carrying a cake box very carefully", "half asleep with headphones on", "planning a weekend trip to Milwaukee", "knitting a scarf", "trying to finish a work email", "people-watching", "reading the CTA map out of habit",
  "humming along to a song only they can hear", "scrolling through photos from last night", "with a cello case taking up a seat"];
const RIDER_EARLY = [["opening a bakery before sunrise", ["a baker"]], ["starting an early shift at a hospital", ["a nurse"]], ["going to open a coffee shop", ["a barista"]]];
const RIDER_LATE = [["going home after closing a restaurant", ["a line cook", "a server"]], ["heading home after a late show", ["a stand-up comedian", "a stagehand"]], ["finishing a night shift", ["a security guard", "a nurse"]]];
function riderStory(v) {
  if (!SET.stories) return "";
  const { h, mo } = clockOf(simT);
  let seed = keyHash(v.key) % 2147483646 + 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
  rnd(); rnd(); const name = pick(RIDER_NAMES), doing = pick(RIDER_DOING), inSeason = r => !r || (r[0] <= r[1] ? mo >= r[0] && mo <= r[1] : mo >= r[0] || mo <= r[1]);
  const stops = v.type === "train" && v.tr ? v.tr.prof.stops.slice(v.st.atStop ? v.st.idx : v.st.nextIdx, v.tr.i1 + 1).map(s => s.name)
    : v.type === "live" ? [v.t.next, v.t.dest].filter(Boolean) : v.type === "metra" ? v.t.P.stops.map(s => METRA.stops[s] ? METRA.stops[s][0] : "") : [];
  const say = (what, who, where) => `${name}, ${pick(who)}, is ${what}${where ? `, getting off at ${where}` : ""}. Right now: ${doing}.`;
  if (h >= 4 && h < 6.5) { const [w, who] = pick(RIDER_EARLY); return say(w, who, stops[Math.floor(rnd() * stops.length)]); }
  if (h >= 23 || h < 4) { const [w, who] = pick(RIDER_LATE); return say(w, who, stops[stops.length - 1]); }
  const hits = [];
  stops.forEach((stop, k) => { for (const [re, opts, season] of RIDER_TRIPS) if (re.test(stop || "") && inSeason(season)) for (const o of opts) hits.push([o, stop, k]); });
  if (hits.length) { const [[w, who], stop] = hits[Math.floor(rnd() * Math.min(hits.length, 4))]; return say(w, who, stop); }
  if (v.type === "bus") { const b = v.b && (v.b.raw || v.b), dest = b && b.des; return `${name} is riding the #${String(b && b.rt || v.label || "")} bus${dest ? " toward " + dest : ""}, ${doing}.`; }
  if (v.type === "boat") return v.kind === "tour" ? `${name} is on the architecture tour, trying to photograph every bridge.` : `${name} is taking the water taxi instead of walking, ${doing}.`;
  return stops.length ? `${name} is riding to ${stops[stops.length - 1]}, ${doing}.` : "";
}
