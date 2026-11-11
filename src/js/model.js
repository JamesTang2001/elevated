/* ===== Elevated v2 — data model (timetables, positions). Ported from v9. ===== */
const DATA=/*__DATA__*/null, BUSDATA=/*__BUS__*/null, RIDER=/*__RIDER__*/null, CTA_TT=/*__CTATT__*/null, METRA=/*__METRA__*/null;
/* ================= service model =================
   Typical CTA frequencies (minutes) by hour of the Chicago day: [fromHour, toHour, minutes].
   Hours past 24 run after midnight. Keys are route ids, falling back to the line. */
const SERVICE = {
  red:   {wk:[[0,5,15],[5,6,10],[6,9,5],[9,15,7],[15,19,5],[19,22,10],[22,24,12]], we:[[0,6,15],[6,10,10],[10,20,8],[20,24,12]]},
  blue:  {wk:[[0,5,15],[5,6,10],[6,9,6],[9,15,8],[15,19,6],[19,22,10],[22,24,12]], we:[[0,6,15],[6,10,10],[10,20,9],[20,24,12]]},
  brn:   {wk:[[4,6,10],[6,9,5],[9,15,8],[15,19,5],[19,22,10],[22,25.5,15]], we:[[5,8,15],[8,20,10],[20,25.5,15]]},
  g:     {wk:[[3.75,6,12],[6,9,8],[9,15,10],[15,19,8],[19,22,12],[22,25.25,15]], we:[[4.75,8,15],[8,20,12],[20,25.25,15]]},
  o:     {wk:[[3.5,6,10],[6,9,7],[9,15,10],[15,19,7],[19,22,12],[22,25,15]], we:[[4.5,8,15],[8,20,10],[20,25,15]]},
  pnk:   {wk:[[4,6,12],[6,9,8],[9,15,10],[15,19,8],[19,22,12],[22,25,15]], we:[[5,8,15],[8,20,12],[20,25,15]]},
  p:     {wk:[[4.5,5.5,12],[9.5,14.5,12],[19,25.5,15]], we:[[5,8,15],[8,20,12],[20,25.5,15]]},   // Linden–Howard shuttle
  "p-exp":{wk:[[5.5,9.5,8],[14.5,19,8]], we:[]},                                                // weekday rush only
  y:     {wk:[[5,6,15],[6,9,10],[9,15,15],[15,19,10],[19,23.25,15]], we:[[6.5,23.25,15]]},
};
const VMAX = {red:19, blue:20.5, brn:14.5, g:16.5, o:19.5, pnk:15.5, p:16.5, y:24};
const ACC = 1.0, DEC = 1.15;
const LOOP_IDS = new Set(["40380","40260","41700","40680","40850","40160","40040","40730"]);
const RUN_BASE = {red:800, blue:100, brn:400, g:0, o:700, pnk:300, p:500, y:590};
const LINES = ["red","blue","brn","g","o","pnk","p","y"];
const LNAME = {red:"Red",blue:"Blue",brn:"Brown",g:"Green",o:"Orange",pnk:"Pink",p:"Purple",y:"Yellow"};
const LCOL = {red:"#C60C30",blue:"#00A1DE",brn:"#62361B",g:"#009B3A",o:"#F9461C",pnk:"#E27EA6",p:"#522398",y:"#F9E300"};
const OFFSET = {red:1, blue:0, brn:-1, g:0, o:1, pnk:-2, p:-2.2, y:0};
const LOOP_EXIT = {brn:"40380", o:"40680", pnk:"40730", "p-exp":"40730"};
const TERM = {"40890":"O'Hare","40390":"Forest Park","40900":"Howard","40450":"95th/Dan Ryan","41290":"Kimball","40020":"Harlem/Lake",
  "40290":"Ashland/63rd","40720":"Cottage Grove","40930":"Midway","40580":"54th/Cermak","41050":"Linden","40140":"Skokie"};
const ST = DATA.stations, ROUTES = DATA.routes;
const dk = l => l==="y";

/* ---------- run profiles ---------- */
function trap(L, vmax){
  let v=vmax, ta=v/ACC, tb=v/DEC, da=v*v/(2*ACC), db=v*v/(2*DEC);
  if (da+db > L){ v=Math.sqrt(2*L*ACC*DEC/(ACC+DEC)); ta=v/ACC; tb=v/DEC; da=v*v/(2*ACC); db=v*v/(2*DEC); }
  const tc=(L-da-db)/v; return {L,v,ta,tc,tb,da,T:ta+tc+tb};
}
function trapS(p,t){
  if (t<=0) return [0,0];
  if (t<p.ta) return [0.5*ACC*t*t, ACC*t];
  if (t<p.ta+p.tc) return [p.da+p.v*(t-p.ta), p.v];
  if (t<p.T){ const u=p.T-t; return [p.L-0.5*DEC*u*u, DEC*u]; }
  return [p.L,0];
}
function buildProfile(r, dir){
  const len=r.length;
  let stops=r.stops.map(s=>({id:s.id,name:s.name,d:s.d}));
  if (dir===1) stops=stops.slice().reverse().map(s=>({...s,d:len-s.d}));
  const vm=VMAX[r.line]; let t=0; const arr=[],dep=[],seg=[];
  for (let i=0;i<stops.length;i++){
    arr.push(t);
    const term = i===0||i===stops.length-1;
    t += term ? 0 : (LOOP_IDS.has(stops[i].id) ? 45 : 33); dep.push(t);
    if (i<stops.length-1){
      const L=Math.max(30, stops[i+1].d-stops[i].d);
      const inLoop = LOOP_IDS.has(stops[i].id)&&LOOP_IDS.has(stops[i+1].id);
      const p=trap(L, inLoop?9:vm); seg.push(p); t+=p.T;
    }
  }
  let exitIdx=-1;
  const ex = LOOP_EXIT[r.id] || LOOP_EXIT[r.line];
  if (r.loop && ex){ for (let i=stops.length-1;i>=0;i--) if (stops[i].id===ex){ exitIdx=i; break; } }
  return {route:r, dir, stops, arr, dep, seg, T:t, exitIdx, key:r.id+"/"+dir};
}
const PROFILES=[];
for (const r of ROUTES){ PROFILES.push(buildProfile(r,0)); if (!r.loop) PROFILES.push(buildProfile(r,1)); }

/* ---------- trips ---------- */
const DAY=86400000, tripCache=new Map();
function svc(r){ return SERVICE[r.id] || SERVICE[r.line]; }
/* real CTA timetable: each pattern is a profile + first stop + scheduled minutes at every station it serves */
const dayType=day0=>{ const w=new Date(day0).getUTCDay(); return w===0?"su":w===6?"sa":"wk"; };
const PAT=CTA_TT.pats.map(([key,i0,offs])=>{
  const prof=PROFILES.find(p=>p.key===key), n=prof.stops.length, A=new Array(n), D=new Array(n), i1=i0+offs.length-1;
  for (let i=i0;i<=i1;i++){ const t=offs[i-i0]; D[i]=t; A[i]= i===i0 ? 0 : i===i1 ? t : t-Math.min(25,.2*(t-offs[i-i0-1])); }
  return {prof,A,D,i0,i1,T:D[i1],len:prof.stops[i1].d-prof.stops[i0].d};
});
const BY_PROF=new Map();                     // day type → profile key → trips (sorted by start)
for (const dt of ["wk","sa","su"]){ const m=new Map(); for (const [pi,st] of CTA_TT.trips[dt]){ const k=PAT[pi].prof.key; if (!m.has(k)) m.set(k,[]); m.get(k).push([pi,st]); } BY_PROF.set(dt,m); }
function tripsFor(prof, day0){
  const key=prof.key+":"+day0; if (tripCache.has(key)) return tripCache.get(key);
  const list=(BY_PROF.get(dayType(day0)).get(prof.key)||[]), line=prof.route.line;
  const out=list.map(([pi,st],n)=>{ const P=PAT[pi]; return {dep:day0+st*1000, prof, run:RUN_BASE[line]+((n*7+prof.dir*3+(prof.route.id==="g-cg"?50:0)+(prof.route.id==="p-exp"?40:0))%(line==="y"?9:99)),
    n, A:P.A, D:P.D, i0:P.i0, i1:P.i1, T:P.T, len:P.len}; });
  tripCache.set(key,out); return out;
}
function tripsAround(prof, now){ const d0=Math.floor(now/DAY)*DAY; return [tripsFor(prof,d0-DAY), tripsFor(prof,d0)]; }
function activeTrains(now, all){
  const res=[];
  for (const prof of PROFILES){
    if (!all && !visible(prof.route.line)) continue;
    for (const ts of tripsAround(prof, now)) for (const tr of ts){ if (tr.dep>now) break; if (now<tr.dep+tr.T*1000) res.push(tr); }
  }
  return res;
}
/* where a scheduled trip is: dwell at stations, then accelerate–cruise–brake to arrive on time */
function runState(A,D,ds,i0,i1,e){
  let lo=i0, hi=i1; while (lo<hi){ const m=(lo+hi+1)>>1; if (A[m]<=e) lo=m; else hi=m-1; }
  const i=lo;
  if (e<D[i]||i===i1) return {d:ds(i), v:0, a:0, atStop:true, idx:i, nextIdx:Math.min(i+1,i1), done:i===i1&&e>=A[i1]};
  const Tr=Math.max(1,A[i+1]-D[i]), L=ds(i+1)-ds(i), t=Math.min(Tr,e-D[i]), ta=Tr*.3, vm=L/(Tr-ta), ac=vm/ta;
  let x, v, a=0; if (t<ta){ x=.5*ac*t*t; v=ac*t; a=ac; } else if (t<Tr-ta){ x=.5*ac*ta*ta+vm*(t-ta); v=vm; } else { const u=Tr-t; x=L-.5*ac*u*u; v=ac*u; a=-ac; }
  return {d:ds(i)+x, v, a, atStop:false, idx:i, nextIdx:i+1, done:false};
}
function stateOf(tr, now){
  const p=tr.prof, e=(now-tr.dep)/1000, r=runState(tr.A,tr.D,i=>p.stops[i].d,tr.i0,tr.i1,e);
  r.e=e; r.along=p.dir===0?r.d:p.route.length-r.d; return r;
}
function destOf(tr, e){
  const p=tr.prof, last=p.stops[tr.i1].id;
  if (p.route.loop && p.exitIdx>=tr.i0 && p.exitIdx<tr.i1 && e<tr.D[p.exitIdx]) return "Loop";
  return TERM[last] || p.stops[tr.i1].name;
}
const trainKey = tr => tr.prof.key+"/"+tr.dep+"/"+tr.i0;
function findTrip(key){
  const [rid,dir,dep,i0]=key.split("/"); const prof=PROFILES.find(p=>p.key===rid+"/"+dir); if (!prof) return null;
  for (const ts of tripsAround(prof, +dep)) for (const tr of ts) if (tr.dep===+dep && tr.i0===+(i0||0)) return tr;
  return null;
}

/* ================= clock (Chicago wall time as pseudo-UTC ms) ================= */
const tzFmt=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
function chicagoNow(){ const p=Object.fromEntries(tzFmt.formatToParts(new Date()).map(x=>[x.type,x.value]));
  return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)+(Date.now()%1000); }
function hm(ms){ const d=new Date(ms), h=d.getUTCHours(), m=d.getUTCMinutes(); return `${((h+11)%12)+1}:${String(m).padStart(2,"0")}${h<12?"a":"p"}`; }
function hmLong(ms){ const d=new Date(ms), h=d.getUTCHours(), m=d.getUTCMinutes(); return `${((h+11)%12)+1}:${String(m).padStart(2,"0")} ${h<12?"AM":"PM"}`; }
const DOW=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SPEEDS=[1,2,3,5,8,10,15,20,30,40,50,60];
let simT=chicagoNow(), speed=1, playing=true, live=true, lastFrame=performance.now();

/* ================= storage (per browser) ================= */
function load(k,d){ try{ const v=localStorage.getItem("elevated:"+k); return v?JSON.parse(v):d; }catch(e){ return d; } }
function save(k,v){ try{ localStorage.setItem("elevated:"+k, JSON.stringify(v)); }catch(e){} }
let favs=load("favs",[]), passport=load("passport",{rides:[]});
const LAT0=41.88, KX=Math.cos(LAT0*Math.PI/180), MPD=111320;
function along(coords,cum,d){
  d=Math.max(0,Math.min(cum[cum.length-1],d)); let lo=0, hi=cum.length-1;
  while (lo<hi-1){ const m=(lo+hi)>>1; if (cum[m]<=d) lo=m; else hi=m; }
  const f=(d-cum[lo])/((cum[hi]-cum[lo])||1), a=coords[lo], b=coords[hi];
  return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f];
}
/* where a vehicle is: world point + travel direction (world) */
function vehPos(coords,cum,d,dir){
  const p=along(coords,cum,d), q=along(coords,cum,d+(dir===1?-15:15));
  return {lon:p[0], lat:p[1], dx:(q[0]-p[0])*KX, dy:-(q[1]-p[1])};   // dx east, dy south (flat screen axes)
}
/* ================= buses (CTA bus routes, simulated frequencies) ================= */
const BSA=/*__BSTOPALL__*/null, BSTOP_ALL=BSA.stops, BSTOP_RT=BSA.routes;   // every CTA bus stop: [lon, lat, name, NB/SB/EB/WB, route indexes, stop id]
const BUS=BUSDATA.routes, BSTOPS=BUSDATA.stops, BUS_V=4.3;   // ≈9.6 mph average including stops
const FREQ=new Set(["3","4","8","9","12","20","22","34","47","49","53","54","55","60","63","66","72","77","79","81","82","95","J14"]);
const OWL=new Set(["4","9","20","22","34","49","53","55","60","62","66","77","79","81","87"]);
const RUSH=new Set(["1","2","10","19","26","100","120","121","124","125","128","134","135","136","143","148","192","X4","X9","X49"]);
const ROUTE_STOPS=BUS.map(()=>[]);
BSTOPS.forEach((s,si)=>s[4].forEach(([ri,d,f])=>ROUTE_STOPS[ri].push({si,d,f})));
ROUTE_STOPS.forEach(a=>a.sort((x,y)=>x.d-y.d));
function busTable(R,dow){
  const sat=dow===6, sun=dow===0, we=sat||sun;
  if ((sat&&!R.sa)||(sun&&!R.su)||(!we&&!R.wk)) return [];
  if (RUSH.has(R.r)) return we?[]:[[6,9,12],[15.5,18.5,12]];
  const f=FREQ.has(R.r), owl=OWL.has(R.r), end=owl?24:24.5;
  const t = we ? (f?[[5.5,9,15],[9,20,12],[20,end,20]]:[[6,9,20],[9,20,20],[20,23,30]])
               : (f?[[5,6,15],[6,9,8],[9,15,10],[15,19,8],[19,22,12],[22,end,20]]:[[5,6,20],[6,9,12],[9,15,15],[15,19,12],[19,23,20]]);
  return owl ? [[0,5,30],...t] : t;
}
const busCache=new Map();
function busTrips(ri,dir,day0){
  const key=ri+"/"+dir+":"+day0; if (busCache.has(key)) return busCache.get(key);
  const R=BUS[ri], out=[]; let n=0;
  for (const [h0,h1,hw] of busTable(R,new Date(day0).getUTCDay())){
    const step=hw*60000; let t=day0+h0*3600000+((ri*7)%hw)*60000+(dir?step/2:0);
    while (t<day0+h1*3600000){ out.push({ri,dir,dep:t,no:1000+((ri*389+n*17+dir*5)%7900)}); n++; t+=step; }
  }
  busCache.set(key,out); return out;
}
const busT=R=>R.L/BUS_V*1000;
function activeBuses(now){
  const res=[], d0=Math.floor(now/DAY)*DAY;
  for (let ri=0;ri<BUS.length;ri++){ const T=busT(BUS[ri]);
    for (const dir of [0,1]) for (const day of [d0-DAY,d0]){ const ts=busTrips(ri,dir,day);
      let lo=0, hi=ts.length; while (lo<hi){ const m=(lo+hi)>>1; if (ts[m].dep<now-T) lo=m+1; else hi=m; }
      for (let i=lo;i<ts.length&&ts[i].dep<=now;i++) res.push(ts[i]); } }
  return res;
}
const busKey=b=>`bus/${b.ri}/${b.dir}/${b.dep}`;
function findBus(key){ const [,ri,dir,dep]=key.split("/"); const d0=Math.floor(+dep/DAY)*DAY;
  for (const day of [d0-DAY,d0]) for (const b of busTrips(+ri,+dir,day)) if (b.dep===+dep) return b; return null; }
function busAlong(b,now){ const R=BUS[b.ri], d=Math.min(R.L,(now-b.dep)/1000*BUS_V); return b.dir?R.L-d:d; }
const busDirName=b=>b.dir?BUS[b.ri].bw:BUS[b.ri].fw;
/* ================= phase 1: sun, ridership, crowding, nicknames, power, grid, commuters ================= */
const RAD=Math.PI/180, TZOFF=chicagoNow()-Date.now();          // Chicago wall clock minus real UTC
function sunPos(){                                                // NOAA-style solar position for central Chicago
  const d=(simT-TZOFF)/86400000-10957.5, g=(357.529+0.98560028*d)*RAD, q=280.459+0.98564736*d;
  const L=(q+1.915*Math.sin(g)+0.020*Math.sin(2*g))*RAD, e=(23.439-0.00000036*d)*RAD;
  const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)), dec=Math.asin(Math.sin(e)*Math.sin(L));
  const gmst=((18.697374558+24.06570982441908*d)%24+24)%24, H=(gmst*15-87.63)*RAD-ra, la=41.88*RAD;
  const el=Math.asin(Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(H));
  const az=Math.atan2(-Math.sin(H),Math.tan(dec)*Math.cos(la)-Math.sin(la)*Math.cos(H));
  return {el, az:(az+2*Math.PI)%(2*Math.PI)};
}
let SUN={el:.5,az:Math.PI};
const nightLevel=()=>{ const t=Math.max(0,Math.min(1,(-SUN.el/RAD+1)/9)); return t*t*(3-2*t); };   // 0 day … 1 after civil dusk

/* ridership: average weekday entries per station and year (city data portal) */
const RID_YEARS=RIDER._years, RID_LAST=RID_YEARS.indexOf(2025)>=0?RID_YEARS.indexOf(2025):RID_YEARS.length-2;
const rides=id=>{ const r=RIDER[id]; return r ? (r[RID_LAST]||0) : 0; };
const RID_MAX=Math.max(...Object.keys(ST).map(rides));
const ridScale=id=>.8+.75*Math.sqrt(rides(id)/RID_MAX);

/* track type along each route: elevated, subway or at grade */
for (const r of ROUTES){ r._k=r.cum.map(d=>{ for (const [a,b,k] of r.kind) if (d>=a&&d<=b) return k; return "grade"; }); }
const kindAt=(r,d)=>{ for (const [a,b,k] of r.kind) if (d>=a&&d<=b) return k; return "grade"; };
for (const [id,s] of Object.entries(ST)){ const ks=new Set(); for (const r of ROUTES){ const st=r.stops.find(x=>x.id===id); if (st) ks.add(kindAt(r,st.d)); }
  s.kinds=[...ks]; s.kind=ks.has("elev")?"elev":ks.has("sub")?"sub":"grade"; }
/* ================= Metra: lines, stations and trains from Metra's published timetable ================= */
const M_PAT=METRA.pats.map(([rid,si,stops,ds,offs,head,dir])=>{
  const n=stops.length, A=new Array(n), D=new Array(n);
  for (let i=0;i<n;i++){ D[i]=offs[i]; A[i]= i===0 ? 0 : i===n-1 ? offs[i] : offs[i]-Math.min(40,.2*(offs[i]-offs[i-1])); }
  return {rid,si,stops,ds,A,D,head,dir,T:offs[n-1],n};
});
const M_COL=rid=>METRA.routes[rid][1], M_NAME=rid=>METRA.routes[rid][0];
const mCache=new Map();
function metraTrips(day0){
  const k=day0; if (mCache.has(k)) return mCache.get(k);
  const out=(METRA.trips[dayType(day0)]||[]).map(([pi,st,num])=>({P:M_PAT[pi],pi,dep:day0+st*1000,num}));
  mCache.set(k,out); return out;
}
function activeMetra(now){ const d0=Math.floor(now/DAY)*DAY, res=[];
  for (const day of [d0-DAY,d0]) for (const t of metraTrips(day)){ if (t.dep>now) break; if (now<t.dep+t.P.T*1000) res.push(t); }
  return res; }
const metraKey=t=>`metra/${t.pi}/${t.dep}`;
function findMetra(key){ const [,pi,dep]=key.split("/"); const d0=Math.floor(+dep/DAY)*DAY;
  for (const day of [d0-DAY,d0]) for (const t of metraTrips(day)) if (t.pi===+pi&&t.dep===+dep) return t; return null; }
function metraState(t,now){ const P=t.P, e=(now-t.dep)/1000, r=runState(P.A,P.D,i=>P.ds[i],0,P.n-1,e); r.e=e; return r; }
function metraPos(t,now){ const sh=METRA.shapes[t.P.si], st=metraState(t,now); return {st, v:vehPos(sh.c,sh.cum,st.d,0)}; }

function metraLeftAt(t,i){ return t.dep+t.P.D[i]*1000; }
function metraDepartures(id,horizon=90){
  const rows=[], d0=Math.floor(simT/DAY)*DAY;
  for (const day of [d0-DAY,d0]) for (const t of metraTrips(day)){ const i=t.P.stops.indexOf(id); if (i<0||i===t.P.n-1) continue;
    const tm=metraLeftAt(t,i); if (tm>=simT-15000&&tm<simT+horizon*60000) rows.push({tm,t}); }
  return rows.sort((a,b)=>a.tm-b.tm);
}
