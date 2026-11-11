/* ===== Elevated v2 — film locations (Map → Film locations, off by default)
   Famous scenes shot in Chicago. Each place was checked in at least two independent sources;
   the scene lines are written in our own words. ===== */
const FILMS = [
  ["Willis Tower", -87.63591, 41.87888, [["The Dark Knight", 2008, "Batman stands at the edge of the roof, looking out over Gotham."], ["Ferris Bueller's Day Off", 1986, "Ferris, Cameron and Sloane lean against the Skydeck glass, 103 floors up."]]],
  ["Chicago Board of Trade", -87.63235, 41.87785, [["Batman Begins", 2005, "The art deco tower plays Wayne Enterprises headquarters."], ["The Untouchables", 1987, "The view down the LaSalle Street canyon toward the tower."]]],
  ["Daley Plaza and the Picasso", -87.63021, 41.88409, [["The Blues Brothers", 1980, "The final car chase ends here, with the police in pursuit."], ["The Fugitive", 1993, "Dr. Kimble slips through the plaza past the Picasso."], ["The Dark Knight", 2008, "The Daley Center stands in for Wayne Enterprises."]]],
  ["330 North Wabash", -87.62686, 41.88845, [["The Dark Knight", 2008, "Mies van der Rohe's black tower is home to Wayne Enterprises' offices."]]],
  ["Lower Wacker Drive", -87.6317, 41.88685, [["The Dark Knight", 2008, "The armored-truck convoy and the Joker's chase run beneath the city."], ["Batman Begins", 2005, "The Tumbler races the police through the lower level."]]],
  ["Jewelers Building, 35 East Wacker", -87.62635, 41.88655, [["Transformers: Dark of the Moon", 2011, "The Decepticons set up their pillars on the domed rooftop."]]],
  ["Trump Tower", -87.62646, 41.88888, [["Transformers: Dark of the Moon", 2011, "Dylan Gould's glassy penthouse high above the river."]]],
  ["Art Institute of Chicago", -87.62367, 41.87957, [["Ferris Bueller's Day Off", 1986, "Cameron stares into Seurat's Sunday on La Grande Jatte."]]],
  ["Dearborn Street", -87.6295, 41.8820, [["Ferris Bueller's Day Off", 1986, "Ferris takes over a parade float and sings Twist and Shout."]]],
  ["Wrigley Field", -87.65557, 41.94815, [["Ferris Bueller's Day Off", 1986, "Ferris catches a foul ball at a Cubs day game."]]],
  ["Union Station", -87.64041, 41.87867, [["The Untouchables", 1987, "The slow-motion shootout as a baby carriage rolls down the grand staircase."]]],
  ["Michigan Avenue Bridge", -87.62455, 41.88855, [["The Untouchables", 1987, "Eliot Ness meets the beat cop Jim Malone on the bridge."]]],
  ["The Rookery", -87.63215, 41.87915, [["The Untouchables", 1987, "The Untouchables' offices inside the light-filled lobby."]]],
  ["Blackstone Hotel", -87.62468, 41.8728, [["The Untouchables", 1987, "Al Capone's banquet speech about teamwork."]]],
  ["Randolph/Wabash station", -87.62605, 41.8847, [["While You Were Sleeping", 1995, "Lucy works the token booth at this L station. It closed in 2017; Washington/Wabash replaced it."]]],
  ["Biograph Theater", -87.64965, 41.92635, [["Public Enemies", 2009, "John Dillinger's last night, filmed where it really happened in 1934."]]],
  ["Milwaukee and Honore, Wicker Park", -87.6735, 41.9097, [["High Fidelity", 2000, "Rob's record shop, Championship Vinyl."]]],
];
const filmMk = [];
function drawFilms() {
  for (const m of filmMk) m.remove(); filmMk.length = 0;
  if (!SET.films || !map) return;
  FILMS.forEach(([name, lon, lat, list], i) => {
    const el = document.createElement("button"); el.type = "button"; el.className = "film"; el.title = name;
    el.innerHTML = `<i><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6.5h12v6.2a1.3 1.3 0 0 1-1.3 1.3H3.3A1.3 1.3 0 0 1 2 12.7z" fill="currentColor"/><path d="M1.7 4.3 13 2l.5 2.4L2.2 6.7z" fill="currentColor"/><path d="m4 3.8 1.8 2M7.3 3.1l1.8 2M10.6 2.4l1.8 2" stroke="#16191d" stroke-width="1.1"/></svg>${list.length > 1 ? `<b>${list.length}</b>` : ""}</i><span>${esc(name)}</span>`;
    el.addEventListener("click", e => { e.stopPropagation(); openFilm(i); });
    filmMk.push(new maplibregl.Marker({ element: el, anchor: "left", offset: [-14, 0] }).setLngLat([lon, lat]).addTo(map));
  });
  if (!drawFilms.hooked) { drawFilms.hooked = true; const z = () => document.body.classList.toggle("films-near", map.getZoom() >= 16.2); map.on("zoomend", z); z(); }
}
function openFilm(i) {
  if (zone.on && !zone.card) return;
  stopFollow(); selected = { type: "film", i }; $("card").hidden = false; refreshPanel();
  const f = FILMS[i]; map.easeTo({ center: [f[1], f[2]], zoom: Math.max(map.getZoom(), 15.4), duration: 900, padding: panelPadding() });
}
function renderFilm() {
  const [name, , , list] = FILMS[selected.i];
  let h = cardHead("◉", "#3d4450", name, list.length > 1 ? `${list.length} films shot here` : "Film location") + `<div class="cb">`;
  for (const [film, yr, scene] of list) h += `<div class="filmrow"><b>${esc(film)}</b> <small>${yr}</small><p>${esc(scene)}</p></div>`;
  $("card").innerHTML = h + `<div class="note">Scenes checked in at least two sources. Many shots also use sets and other cities.</div></div>`;
}
