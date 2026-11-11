/* ===== Elevated v2 — zone-out mode (auto camera) and generated ambient music ===== */
const zone = { on: false, card: load("v2zonecard", true), mode: load("v2zone", "follow"), key: null, picked: 0, groupC: null, lastMove: performance.now(), theatre: false, bear: 0 };
function enterZone() {
  zone.on = true; zone.key = null; zone.groupC = null; zone.lastMove = performance.now();
  document.body.classList.add("zone"); closeSettings();
  try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  if (SET.music) music.start();
  syncZoneUI();
}
function exitZone() {
  if (!zone.on) return; zone.on = false; zone.theatre = false;
  document.body.classList.remove("zone", "theatre");
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  if (zone.mode === "follow" && zone.key) { selected = { type: (findVeh(zone.key) || {}).type || "train", key: zone.key }; following = true; locked = true; openTrainCard(); setLockUI(); }
  syncZoneUI();
}
function setZoneMode(m) { zone.mode = m; save("v2zone", m); zone.key = null; zone.groupC = null; syncZoneUI(); }
function pickZoneTrain() {
  const list = vehPool(true); if (!list.length) return null;               // follows the top filter; elevated stretches preferred
  const v = findVeh(list[Math.floor(Math.random() * list.length)]); if (!v) return null;
  zone.key = v.key; zone.picked = performance.now(); selected = { type: v.type, key: v.key }; openTrainCard(true);
  return v;
}
function zoneStep(now) {
  if (!zone.theatre && now - zone.lastMove > 6000) { zone.theatre = true; document.body.classList.add("theatre"); }
  const dtb = Math.min(50, now - (zone._t || now)); zone._t = now;
  if (zone.mode === "free") { if (following && locked) followStep(); return; }   // free: the camera is yours, controls stay hidden
  const tp = SET.mapAngle === "top" ? 0 : null;
  if (zone.mode === "follow") {
    let v = zone.key && findVeh(zone.key);
    if (!v || (v.kind === "sub" && now - zone.picked > 20000)) v = pickZoneTrain();
    if (!v) return;
    const nb = followCamera(v, map.getBearing(), .6);
    const z = map.getZoom(), p = map.getPitch();
    map.jumpTo({ center: [v.lon, v.lat], bearing: nb, zoom: z + (15.9 - z) * .02, pitch: p + ((tp ?? 64) - p) * .04, padding: { left: 0, top: 0, right: 0, bottom: 0 } });
  } else {
    if (!zone.groupC || now - zone.picked > 45000) { zone.groupC = busiestSpot(); zone.picked = now; }
    if (!zone.groupC) return;
    const c = map.getCenter(), z = map.getZoom(), p = map.getPitch();
    map.jumpTo({ center: [c.lng + (zone.groupC[0] - c.lng) * .015, c.lat + (zone.groupC[1] - c.lat) * .015], bearing: map.getBearing() + dtb * .0015 * 60 / 16,
      zoom: z + (14.6 - z) * .015, pitch: p + ((tp ?? 58) - p) * .03 });
  }
}
function busiestSpot() {                                   // the 1.2 km cell with the most trains right now
  const cells = new Map();
  for (const v of VEH.l.concat(VEH.m)) { const k = Math.round(v.lon * KX / .011) + ":" + Math.round(v.lat / .011); const c = cells.get(k) || { n: 0, x: 0, y: 0 }; c.n++; c.x += v.lon; c.y += v.lat; cells.set(k, c); }
  let best = null; for (const c of cells.values()) if (!best || c.n > best.n) best = c;
  return best ? [best.x / best.n, best.y / best.n] : null;
}
["pointermove"].forEach(ev => addEventListener(ev, () => { zone.lastMove = performance.now(); if (zone.theatre) { zone.theatre = false; document.body.classList.remove("theatre"); } }));
/* in Zone out, moving the map yourself never leaves it: Follow and Group hand the camera to you (Free), and Leave exits */
function zoneUserMove(e) {
  if (!zone.on || !e.originalEvent) return;
  if (zone.mode !== "free") { const k = zone.mode === "follow" ? zone.key : null; zone.mode = "free"; zone.groupC = null;
    if (k) { selected = { type: (findVeh(k) || {}).type || "train", key: k }; following = true; locked = true; }
    syncZoneUI(); toast("Free camera. Tap Follow or Group to hand it back.", 2600); }
  if (following && locked) unlock();
}
/* the auto camera moves the map every frame, which cancels MapLibre's own gestures, so watch the raw input instead */
(() => { const el = document.getElementById("map"); let down = null;
  el.addEventListener("pointerdown", e => { down = e.target.closest(".zone-keep, .maplibregl-marker") ? null : { x: e.clientX, y: e.clientY }; }, true);
  el.addEventListener("pointermove", e => { if (down && e.buttons && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; zoneUserMove({ originalEvent: e }); } }, true);
  addEventListener("pointerup", () => down = null);
  el.addEventListener("wheel", e => zoneUserMove({ originalEvent: e }), { capture: true, passive: true });
})();

/* ---------- generated ambient music (Web Audio; original, royalty-free by construction) ---------- */
const MUSIC_STYLES = { ambient: "Ambient", lofi: "Lo-fi", jazz: "Late-night jazz", drive: "Night drive" };
const music = (() => {
  let ctx = null, master = null, verb = null, timer = null, on = false, style = "ambient", seed = 1, next = 0, chordI = 0, prog = null, moodName = "";
  const MOODS = {
    dawn: { root: 50, progs: [[[0, 4, 7, 11, 14], [-3, 0, 4, 7, 11], [-7, -3, 0, 4, 7], [-5, -1, 2, 5, 9]], [[0, 4, 9, 14], [5, 9, 12, 16], [-3, 0, 4, 7], [7, 11, 14, 17]]], scale: [0, 2, 4, 7, 9], bpm: 64, cut: 1400 },
    day: { root: 48, progs: [[[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 4]], [[0, 7, 11, 16], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]]], scale: [0, 2, 4, 7, 9], bpm: 72, cut: 2200 },
    dusk: { root: 53, progs: [[[0, 4, 7, 11], [-3, 0, 3, 7, 10], [-7, -3, 0, 4], [-5, -1, 2, 5]], [[0, 4, 7, 14], [-2, 2, 5, 9], [-5, -2, 2, 5], [-7, -3, 0, 7]]], scale: [0, 2, 4, 5, 7, 9], bpm: 60, cut: 1100 },
    night: { root: 45, progs: [[[0, 3, 7, 10, 14], [-4, 0, 3, 7], [-7, -4, 0, 3, 7], [-5, -2, 2, 5]], [[0, 7, 10, 15], [-2, 2, 5, 9], [-4, 0, 3, 7], [-5, -1, 2, 7]]], scale: [0, 3, 5, 7, 10], bpm: 54, cut: 800 },
  };
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const moodNow = () => { const h = new Date(simT).getUTCHours(); return h >= 5 && h < 9 ? "dawn" : h >= 9 && h < 17 ? "day" : h >= 17 && h < 21 ? "dusk" : "night"; };
  function impulse() { const len = ctx.sampleRate * 3.2, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); } return b; }
  function init() { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    verb = ctx.createConvolver(); verb.buffer = impulse(); const wet = ctx.createGain(); wet.gain.value = .55; verb.connect(wet); wet.connect(master); }
  function pad(notes, t, dur, cut) {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(cut * .6, t); f.frequency.linearRampToValueAtTime(cut, t + dur * .5); f.frequency.linearRampToValueAtTime(cut * .6, t + dur); f.Q.value = .4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + 2.2); g.gain.setValueAtTime(.09, t + dur - 2); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
    f.connect(g); g.connect(master); g.connect(verb);
    for (const n of notes) for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = hz(n); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 1.6); }
    const b = ctx.createOscillator(), bg = ctx.createGain(); b.type = "sine"; b.frequency.value = hz(notes[0] - 12);
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(.12, t + 1.5); bg.gain.linearRampToValueAtTime(0, t + dur + 1); b.connect(bg); bg.connect(master); b.start(t); b.stop(t + dur + 1.2);
  }
  function bell(n, t, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = hz(n);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + 2.8); o.connect(g); g.connect(verb); g.connect(master); o.start(t); o.stop(t + 3); }
  /* extra voices for the other styles: soft drums from filtered noise, electric-piano keys, plucked bass, an arpeggiator */
  let noiseBuf = null;
  const noise = () => { if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const n = ctx.createBufferSource(); n.buffer = noiseBuf; return n; };
  function kick(t, v = .5) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + .18);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .35); o.connect(g); g.connect(master); o.start(t); o.stop(t + .4); }
  function hiss(t, dur, v, type, freq) { const n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = type; f.frequency.value = freq; f.Q.value = .7;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); n.connect(f); f.connect(g); g.connect(master); n.start(t, Math.random() * .5); n.stop(t + dur + .05); }
  const snare = (t, v = .16) => { hiss(t, .22, v, "bandpass", 1800); hiss(t, .08, v * .6, "lowpass", 400); };
  const hat = (t, v = .05) => hiss(t, .05, v, "highpass", 7000);
  const ride = (t, v = .04) => hiss(t, .45, v, "highpass", 5200);
  function keys(notes, t, dur, v = .05) { for (const n of notes) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o2.type = "sine"; o.frequency.value = hz(n); o2.frequency.value = hz(n) * 2.01;
    const g2 = ctx.createGain(); g2.gain.value = .25; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master); g.connect(verb); o.start(t); o2.start(t); o.stop(t + dur + .1); o2.stop(t + dur + .1); } }
  function bass(n, t, dur, v = .16) { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = "triangle"; o.frequency.value = hz(n); f.type = "lowpass"; f.frequency.value = 700;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .015); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05); }
  function arp(n, t, dur, cut, v = .035) { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.value = hz(n); f.type = "lowpass"; f.frequency.value = cut; f.Q.value = 4;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(f); f.connect(g); g.connect(master); g.connect(verb); o.start(t); o.stop(t + dur + .05); }
  function crackle(t, dur) { for (let i = 0; i < 6; i++) if (rnd() < .5) hiss(t + rnd() * dur, .02, .02, "highpass", 3000); }
  function schedule() {
    const M = MOODS[moodName];
    while (next < ctx.currentTime + 1.5) {
      const ch = prog[chordI % prog.length], notes = ch.map(i => M.root + 12 + i);
      let bar;
      if (style === "lofi") {                                     // slow hip-hop beat, dusty keys, vinyl crackle
        const beat = 60 / 76; bar = beat * 4;
        keys(notes.slice(0, 4), next, beat * 3.6, .045); keys(notes.slice(1, 4).map(n => n + 12), next + beat * 2.5, beat * 1.2, .025);
        bass(notes[0] - 12, next, beat * 1.4); bass(notes[0] - 12 + (rnd() < .5 ? 7 : 12), next + beat * 2.5, beat);
        kick(next, .45); kick(next + beat * 1.75, .3); kick(next + beat * 2.5, .4); snare(next + beat); snare(next + beat * 3);
        for (let s = 0; s < 8; s++) hat(next + s * beat / 2 + (s % 2 ? beat * .08 : 0), s % 2 ? .03 : .05);
        crackle(next, bar);
      } else if (style === "jazz") {                              // brushed swing: walking bass, ride cymbal, comping chords
        const beat = 60 / 110; bar = beat * 4;
        for (let s = 0; s < 4; s++) { const tone = s === 0 ? notes[0] : notes[Math.floor(rnd() * notes.length)] + (rnd() < .3 ? -1 : 0); bass(tone - 24, next + s * beat, beat * .9, .2);
          ride(next + s * beat); if (s % 2) ride(next + s * beat + beat * .66, .025); }
        keys(notes.slice(1).map(n => n + 12), next + beat * 1.66, beat * .5, .03); keys(notes.slice(1).map(n => n + 12), next + beat * 3, beat * .7, .028);
        hiss(next + beat, .12, .03, "bandpass", 2500); hiss(next + beat * 3, .12, .03, "bandpass", 2500);
      } else if (style === "drive") {                             // night drive: pulsing arpeggio over a steady pulse
        const beat = 60 / 92; bar = beat * 4;
        pad(notes, next, bar, M.cut * .7);
        for (let s = 0; s < 16; s++) arp(notes[[0, 1, 2, 3, 2, 1, 3, 2][s % 8] % notes.length] + 12, next + s * beat / 4, beat / 4.2, 900 + 700 * Math.sin((chordI * 16 + s) / 9));
        for (let s = 0; s < 4; s++) kick(next + s * beat, .35); snare(next + beat, .09); snare(next + beat * 3, .09);
        bass(notes[0] - 12, next, bar * .95, .1);
      } else {                                                    // ambient: slow pads and scattered bells
        const beat = 60 / M.bpm; bar = beat * 8;
        pad(notes, next, bar, M.cut);
        for (let s = 0; s < 8; s++) if (rnd() < .38) { const deg = M.scale[Math.floor(rnd() * M.scale.length)]; bell(M.root + 24 + deg + (rnd() < .3 ? 12 : 0), next + s * beat + (rnd() - .5) * .08, .035 + rnd() * .03); }
      }
      next += bar; chordI++;
      if (chordI % 16 === 0) { const m = moodNow(); if (m !== moodName) { moodName = m; } prog = MOODS[moodName].progs[Math.floor(rnd() * 2)]; }
    }
  }
  return {
    start() { if (!ctx) init(); if (ctx.state === "suspended") ctx.resume(); if (on) return; on = true; style = MUSIC_STYLES[SET.musicStyle] ? SET.musicStyle : "ambient";
      moodName = moodNow(); seed = (Date.now() % 100000) + 1; prog = MOODS[moodName].progs[Math.floor(rnd() * 2)]; chordI = 0; next = ctx.currentTime + .1;
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(.55, ctx.currentTime + 3); timer = setInterval(schedule, 300); schedule(); syncMusicUI(); },
    stop() { if (!on) return; on = false; clearInterval(timer); master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5); syncMusicUI(); },
    setStyle(st) { if (!MUSIC_STYLES[st]) return; style = st; if (!on) return; seed += 7919; prog = MOODS[moodName].progs[Math.floor(rnd() * 2)]; chordI = 0; next = Math.max(next - 1.2, ctx.currentTime + .4);
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(.15, ctx.currentTime, .25); master.gain.setTargetAtTime(.55, ctx.currentTime + .9, .6); },
    skip() { const ks = Object.keys(MUSIC_STYLES), n = ks[(ks.indexOf(style) + 1) % ks.length]; SET.musicStyle = n; saveSet(); this.setStyle(n); if (!on) this.start(); toast("♪ " + MUSIC_STYLES[n], 1800); },
    get on() { return on; }, get style() { return style; }, get mood() { return moodName; },
  };
})();
