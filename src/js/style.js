/* ===== Elevated v2 — basemap styles (our own palettes over OpenFreeMap / OpenMapTiles vector tiles) ===== */
const OFM = "https://tiles.openfreemap.org/planet", GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const PALETTES = {
  light: { bg:"#f3f1ec", resid:"#efece6", park:"#e2e8d8", wood:"#dbe3d0", water:"#c4d4df", waterLine:"#b3c6d3",
    road:"#ffffff", roadCase:"#e4e0d8", major:"#ffffff", majorCase:"#dcd6cb", motor:"#fbf6ec", motorCase:"#d8cfbf",
    rail:"#cfc9be", bldgFlat:"#e4e0d8", bldgEdge:"#d6d1c7", bldg:[0,"#e7e3db",30,"#dedad1",120,"#d3cfc6",300,"#c9c6bf"],
    label:"#5b5f66", labelHalo:"#f3f1ec", place:"#30343a", waterLabel:"#6d8aa0", boundary:"#c9c2b6" },
  dark: { bg:"#0e131b", resid:"#111722", park:"#132019", wood:"#122017", water:"#0a1824", waterLine:"#0f2233",
    road:"#1c2431", roadCase:"#141b26", major:"#232d3c", majorCase:"#161e2a", motor:"#2a3546", motorCase:"#1a2230",
    rail:"#28313f", bldgFlat:"#192130", bldgEdge:"#212b3b", bldg:[0,"#253043",30,"#2b3850",120,"#34425d",300,"#3d4d6b"],
    label:"#8b95a5", labelHalo:"#0e131b", place:"#c3cad5", waterLabel:"#4f6c86", boundary:"#2c3544" },
};
const nameField = ["coalesce", ["get","name_en"], ["get","name"]];
const poly = ["match", ["geometry-type"], ["MultiPolygon","Polygon"], true, false];
const lineG = ["match", ["geometry-type"], ["LineString","MultiLineString"], true, false];
const cls = (...c) => ["match", ["get","class"], c, true, false];
const notTunnel = ["!=", ["get","brunnel"], "tunnel"];
function baseStyle(theme){
  const P = PALETTES[theme];
  const roadW = (a,b,c) => ["interpolate",["exponential",1.5],["zoom"],10,a,14,b,18,c];
  return { version:8, glyphs:GLYPHS,
    sources:{ omt:{ type:"vector", url:OFM, attribution:'<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>' } },
    layers:[
      { id:"bg", type:"background", paint:{ "background-color":P.bg } },
      { id:"resid", type:"fill", source:"omt", "source-layer":"landuse", filter:["all",poly,cls("residential","suburb","neighbourhood")], paint:{ "fill-color":P.resid } },
      { id:"park", type:"fill", source:"omt", "source-layer":"park", filter:poly, paint:{ "fill-color":P.park } },
      { id:"wood", type:"fill", source:"omt", "source-layer":"landcover", filter:["all",poly,cls("wood","grass")], paint:{ "fill-color":P.wood, "fill-opacity":.7 } },
      { id:"water", type:"fill", source:"omt", "source-layer":"water", filter:["all",poly,notTunnel], paint:{ "fill-color":P.water } },
      { id:"waterway", type:"line", source:"omt", "source-layer":"waterway", filter:lineG, paint:{ "line-color":P.waterLine, "line-width":["interpolate",["linear"],["zoom"],10,.6,16,2.5] } },
      { id:"aeroway", type:"fill", source:"omt", "source-layer":"aeroway", filter:["all",poly,cls("runway","taxiway")], minzoom:11, paint:{ "fill-color":P.road, "fill-opacity":.8 } },
      { id:"road-minor-case", type:"line", source:"omt", "source-layer":"transportation", minzoom:13, filter:["all",lineG,cls("minor","service"),notTunnel], layout:{"line-join":"round","line-cap":"round"}, paint:{ "line-color":P.roadCase, "line-width":roadW(.5,3,14) } },
      { id:"road-minor", type:"line", source:"omt", "source-layer":"transportation", minzoom:12, filter:["all",lineG,cls("minor","service"),notTunnel], layout:{"line-join":"round","line-cap":"round"}, paint:{ "line-color":P.road, "line-width":roadW(.4,2,11) } },
      { id:"road-major-case", type:"line", source:"omt", "source-layer":"transportation", minzoom:10, filter:["all",lineG,cls("primary","secondary","tertiary","trunk"),notTunnel], layout:{"line-join":"round","line-cap":"round"}, paint:{ "line-color":P.majorCase, "line-width":roadW(.8,5,20) } },
      { id:"road-major", type:"line", source:"omt", "source-layer":"transportation", minzoom:8, filter:["all",lineG,cls("primary","secondary","tertiary","trunk"),notTunnel], layout:{"line-join":"round","line-cap":"round"}, paint:{ "line-color":P.major, "line-width":roadW(.5,3.6,17) } },
      { id:"road-motor-case", type:"line", source:"omt", "source-layer":"transportation", minzoom:7, filter:["all",lineG,cls("motorway"),notTunnel], layout:{"line-join":"round","line-cap":"round"}, paint:{ "line-color":P.motorCase, "line-width":roadW(1.2,6,24) } },
      { id:"road-motor", type:"line", source:"omt", "source-layer":"transportation", minzoom:6, filter:["all",lineG,cls("motorway"),notTunnel], layout:{"line-join":"round","line-cap":"round"}, paint:{ "line-color":P.motor, "line-width":roadW(.8,4.4,20) } },
      { id:"rail", type:"line", source:"omt", "source-layer":"transportation", minzoom:11, filter:["all",lineG,cls("rail"),["!",["has","service"]],notTunnel], paint:{ "line-color":P.rail, "line-width":["interpolate",["linear"],["zoom"],11,.6,16,1.6] } },
      { id:"boundary", type:"line", source:"omt", "source-layer":"boundary", filter:["all",["==",["get","admin_level"],4],["!=",["get","maritime"],1]], paint:{ "line-color":P.boundary, "line-dasharray":[2,2], "line-width":1 } },
      { id:"bldg-flat", type:"fill", source:"omt", "source-layer":"building", minzoom:13, maxzoom:15, paint:{ "fill-color":P.bldgFlat, "fill-outline-color":P.bldgEdge, "fill-opacity":["interpolate",["linear"],["zoom"],13,0,13.6,1] } },
      { id:"bldg-3d", type:"fill-extrusion", source:"omt", "source-layer":"building", minzoom:13,
        paint:{ "fill-extrusion-color":["interpolate",["linear"],["to-number",["coalesce",["get","render_height"],8]],...P.bldg],
          "fill-extrusion-height":["interpolate",["linear"],["zoom"],13,0,14.2,["to-number",["coalesce",["get","render_height"],["get","height"]],8]],
          "fill-extrusion-base":["to-number",["coalesce",["get","render_min_height"],["get","min_height"]],0],
          "fill-extrusion-opacity":1, "fill-extrusion-vertical-gradient":true } },
      { id:"water-label", type:"symbol", source:"omt", "source-layer":"water_name", filter:["match",["geometry-type"],["Point","MultiPoint"],true,false],
        layout:{ "text-field":nameField, "text-font":["Noto Sans Italic"], "text-size":["interpolate",["linear"],["zoom"],7,11,12,15], "text-letter-spacing":.2, "text-max-width":6 },
        paint:{ "text-color":P.waterLabel, "text-halo-color":P.labelHalo, "text-halo-width":1 } },
      { id:"road-label", type:"symbol", source:"omt", "source-layer":"transportation_name", minzoom:13.5, filter:cls("primary","secondary","tertiary","trunk","minor"),
        layout:{ "symbol-placement":"line", "text-field":nameField, "text-font":["Noto Sans Regular"], "text-size":["interpolate",["linear"],["zoom"],14,10.5,18,13], "text-rotation-alignment":"map" },
        paint:{ "text-color":P.label, "text-halo-color":P.labelHalo, "text-halo-width":1.2 } },
      { id:"place-minor", type:"symbol", source:"omt", "source-layer":"place", minzoom:11, filter:cls("neighbourhood","suburb","quarter"),
        layout:{ "text-field":nameField, "text-font":["Noto Sans Regular"], "text-size":["interpolate",["linear"],["zoom"],11,10,15,12.5], "text-transform":"uppercase", "text-letter-spacing":.12, "text-max-width":7 },
        paint:{ "text-color":P.label, "text-halo-color":P.labelHalo, "text-halo-width":1.2, "text-opacity":.85 } },
      { id:"place-town", type:"symbol", source:"omt", "source-layer":"place", minzoom:8, maxzoom:14, filter:cls("town","village"),
        layout:{ "text-field":nameField, "text-font":["Noto Sans Regular"], "text-size":["interpolate",["linear"],["zoom"],8,10.5,12,13], "text-max-width":7 },
        paint:{ "text-color":P.place, "text-halo-color":P.labelHalo, "text-halo-width":1.4, "text-opacity":.9 } },
      { id:"place-city", type:"symbol", source:"omt", "source-layer":"place", maxzoom:12, filter:cls("city"),
        layout:{ "text-field":nameField, "text-font":["Noto Sans Bold"], "text-size":["interpolate",["linear"],["zoom"],7,13,11,18], "text-letter-spacing":.04 },
        paint:{ "text-color":P.place, "text-halo-color":P.labelHalo, "text-halo-width":1.6 } },
    ] };
}
