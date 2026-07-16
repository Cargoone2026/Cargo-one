import React from "react";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { StyleSheet, View } = require("react-native");

type Point = { lat: number; lng: number; label?: string };

type Props = {
  pickup?: Point;
  dropoff?: Point;
  driver?: { lat: number; lng: number; heading?: number };
  trail?: { lat: number; lng: number }[];
  center?: { lat: number; lng: number };
  height?: number | string;
  showRoute?: boolean;
};

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Web version: renders the same HTML inside a native <iframe srcdoc>.
export default function MapView({
  pickup,
  dropoff,
  driver,
  trail,
  center,
  height = "100%",
  showRoute = true,
}: Props) {
  const c = center || pickup || dropoff || driver || { lat: 51.5074, lng: -0.1278 };
  const html = GOOGLE_KEY
    ? googleHtml({ apiKey: GOOGLE_KEY, center: c, pickup, dropoff, driver, trail, showRoute })
    : leafletHtml({ center: c, pickup, dropoff, driver, trail, showRoute });

  return (
    <View style={[styles.wrap, { height: height as any }]} testID="map-view">
      {React.createElement("iframe", {
        srcDoc: html,
        style: {
          border: 0,
          width: "100%",
          height: "100%",
          display: "block",
          backgroundColor: "#F4F4F4",
        },
        sandbox: "allow-scripts allow-same-origin allow-popups",
      })}
    </View>
  );
}

function googleHtml({
  apiKey, center, pickup, dropoff, driver, trail, showRoute,
}: any): string {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#F4F4F4}</style>
</head><body>
<div id="map"></div>
<script>
  const CFG = ${JSON.stringify({ center, pickup, dropoff, driver, trail: trail || [], showRoute })};
  function initMap(){
    const map = new google.maps.Map(document.getElementById("map"), {
      center: CFG.center, zoom: 11, disableDefaultUI:true, gestureHandling:"greedy",
      styles:[{elementType:"labels.icon",stylers:[{visibility:"off"}]},{featureType:"poi",stylers:[{visibility:"off"}]}]
    });
    const bounds = new google.maps.LatLngBounds();
    function pin(color){return {path:"M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z",fillColor:color,fillOpacity:1,strokeColor:"#fff",strokeWeight:3,scale:1.2,anchor:new google.maps.Point(12,32)};}
    if(CFG.pickup){new google.maps.Marker({position:CFG.pickup,map,icon:pin("#16A34A")});bounds.extend(CFG.pickup);}
    if(CFG.dropoff){new google.maps.Marker({position:CFG.dropoff,map,icon:pin("#D62828")});bounds.extend(CFG.dropoff);}
    if(CFG.driver){new google.maps.Marker({position:CFG.driver,map,icon:{path:google.maps.SymbolPath.FORWARD_CLOSED_ARROW,fillColor:"#FF6A00",fillOpacity:1,strokeColor:"#fff",strokeWeight:3,scale:6,rotation:CFG.driver.heading||0},zIndex:999});bounds.extend(CFG.driver);}
    if(CFG.trail.length>1) new google.maps.Polyline({path:CFG.trail,map,strokeColor:"#FF6A00",strokeOpacity:0.85,strokeWeight:4});
    if(CFG.showRoute && CFG.pickup && CFG.dropoff){
      const svc = new google.maps.DirectionsService();
      const r = new google.maps.DirectionsRenderer({map,suppressMarkers:true,polylineOptions:{strokeColor:"#D62828",strokeOpacity:0.85,strokeWeight:5}});
      svc.route({origin:CFG.driver||CFG.pickup,destination:CFG.dropoff,waypoints:CFG.driver&&CFG.pickup?[{location:CFG.pickup,stopover:true}]:[],travelMode:google.maps.TravelMode.DRIVING},(res,st)=>{if(st==="OK")r.setDirections(res);});
    }
    if(!bounds.isEmpty()) map.fitBounds(bounds,60);
  }
  window.initMap = initMap;
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&libraries=geometry"></script>
</body></html>`;
}

function leafletHtml({
  center, pickup, dropoff, driver, trail, showRoute,
}: any): string {
  const markers: any[] = [];
  if (pickup) markers.push({ ...pickup, color: "#16A34A", label: pickup.label || "Pickup" });
  if (dropoff) markers.push({ ...dropoff, color: "#D62828", label: dropoff.label || "Dropoff" });
  if (driver) markers.push({ ...driver, color: "#FF6A00", label: "Driver" });
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#F4F4F4}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${center.lat},${center.lng}],12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
  const bounds=[];
  ${JSON.stringify(markers)}.forEach(m=>{
    const icon=L.divIcon({className:'pin',html:'<div style="width:28px;height:28px;border-radius:14px;background:'+m.color+';border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-family:-apple-system,sans-serif;font-size:12px;font-weight:700;">'+(m.label?m.label.charAt(0):'')+'</div>',iconSize:[28,28],iconAnchor:[14,14]});
    L.marker([m.lat,m.lng],{icon}).addTo(map).bindTooltip(m.label);
    bounds.push([m.lat,m.lng]);
  });
  const trail = ${JSON.stringify(trail || [])};
  if(trail.length>1) L.polyline(trail.map(t=>[t.lat,t.lng]),{color:'#FF6A00',weight:4,opacity:0.8}).addTo(map);
  ${showRoute && pickup && dropoff ? `L.polyline([[${pickup.lat},${pickup.lng}],[${dropoff.lat},${dropoff.lng}]],{color:'#D62828',weight:3,opacity:0.6,dashArray:'8,8'}).addTo(map);` : ""}
  if(bounds.length>1) map.fitBounds(bounds,{padding:[40,40]});
</script></body></html>`;
}

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden", backgroundColor: "#F4F4F4" },
});
