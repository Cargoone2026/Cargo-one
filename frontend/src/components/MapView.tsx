import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type Marker = { lat: number; lng: number; color?: string; label?: string };

type Props = {
  pickup?: { lat: number; lng: number; label?: string };
  dropoff?: { lat: number; lng: number; label?: string };
  driver?: { lat: number; lng: number };
  trail?: { lat: number; lng: number }[];
  center?: { lat: number; lng: number };
  height?: number | string;
  showRoute?: boolean;
};

// Leaflet + OSM inside WebView. Works everywhere (Expo Go / native / web).
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
  const markers: Marker[] = [];
  if (pickup) markers.push({ ...pickup, color: "#16A34A", label: pickup.label || "Pickup" });
  if (dropoff) markers.push({ ...dropoff, color: "#D62828", label: dropoff.label || "Dropoff" });
  if (driver) markers.push({ ...driver, color: "#FF6A00", label: "Driver" });

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#F4F4F4}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map', { zoomControl: false, attributionControl: false })
    .setView([${c.lat}, ${c.lng}], 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
  const bounds = [];
  const markers = ${JSON.stringify(markers)};
  markers.forEach(m => {
    const icon = L.divIcon({
      className: 'pin',
      html: '<div style="width:28px;height:28px;border-radius:14px;background:'+m.color+';border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-family:-apple-system,sans-serif;font-size:12px;font-weight:700;">'+(m.label?m.label.charAt(0):'')+'</div>',
      iconSize: [28,28], iconAnchor: [14,14]
    });
    L.marker([m.lat, m.lng], { icon }).addTo(map).bindTooltip(m.label);
    bounds.push([m.lat, m.lng]);
  });
  const trail = ${JSON.stringify(trail || [])};
  if (trail.length > 1) {
    L.polyline(trail.map(t => [t.lat, t.lng]), { color: '#FF6A00', weight: 4, opacity: 0.8 }).addTo(map);
  }
  ${showRoute && pickup && dropoff ? `
  L.polyline([[${pickup.lat}, ${pickup.lng}], [${dropoff.lat}, ${dropoff.lng}]], {
    color: '#D62828', weight: 3, opacity: 0.6, dashArray: '8, 8'
  }).addTo(map);
  ` : ""}
  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
</script>
</body></html>`;

  return (
    <View style={[styles.wrap, { height: height as any }]} testID="map-view">
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden", backgroundColor: "#F4F4F4" },
  web: { flex: 1, backgroundColor: "transparent" },
});
