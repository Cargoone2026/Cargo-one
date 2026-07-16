import React, { useCallback, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import { colors, font, radius, spacing, weight } from "@/src/theme";

type Props = {
  onChange?: (base64: string | null) => void;
  height?: number;
};

const SIGN_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
  html,body{margin:0;padding:0;height:100%;background:#F4F4F4;overflow:hidden;touch-action:none;}
  #wrap{height:100%;display:flex;flex-direction:column;}
  #pad{flex:1;background:#fff;touch-action:none;}
  canvas{display:block;width:100%;height:100%;touch-action:none;background:#fff;}
  #line{position:absolute;bottom:60px;left:24px;right:24px;height:1px;background:#E5E7EB;pointer-events:none;}
  #hint{position:absolute;bottom:36px;left:24px;color:#9CA3AF;font-family:-apple-system,sans-serif;font-size:12px;pointer-events:none;letter-spacing:1px;text-transform:uppercase;font-weight:600;}
</style>
</head><body>
<div id="wrap">
  <canvas id="pad"></canvas>
  <div id="line"></div>
  <div id="hint">✕ Sign above</div>
</div>
<script>
  const c = document.getElementById('pad');
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  function resize() {
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr; c.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  }
  resize(); window.addEventListener('resize', resize);
  let drawing = false, hasStroke = false, last = null;
  function pos(e) {
    const t = e.touches ? e.touches[0] : e;
    const rect = c.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
  function start(e) { e.preventDefault(); drawing = true; hasStroke = true; last = pos(e); }
  function move(e) {
    if (!drawing) return; e.preventDefault();
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
  }
  function end(e) {
    if (!drawing) return; e.preventDefault(); drawing = false;
    if (hasStroke) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stroke', dataUrl: c.toDataURL('image/png') }));
  }
  ['touchstart','mousedown'].forEach(ev => c.addEventListener(ev, start, { passive: false }));
  ['touchmove','mousemove'].forEach(ev => c.addEventListener(ev, move, { passive: false }));
  ['touchend','mouseup','mouseleave','touchcancel'].forEach(ev => c.addEventListener(ev, end, { passive: false }));
  window.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.cmd === 'clear') {
        ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,c.width,c.height); resize(); hasStroke = false;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cleared' }));
      }
    } catch (e) {}
  });
  document.addEventListener('message', (e) => window.dispatchEvent(new MessageEvent('message', { data: e.data })));
</script>
</body></html>`;

export function SignaturePad({ onChange, height = 220 }: Props) {
  const wvRef = useRef<any>(null);
  const [hasSig, setHasSig] = useState(false);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "stroke") {
        setHasSig(true);
        onChange?.(msg.dataUrl);
      } else if (msg.type === "cleared") {
        setHasSig(false);
        onChange?.(null);
      }
    } catch { /* ignore */ }
  }, [onChange]);

  function clear() {
    wvRef.current?.postMessage(JSON.stringify({ cmd: "clear" }));
  }

  const Pad = Platform.OS === "web"
    ? React.createElement("iframe", {
        srcDoc: SIGN_HTML,
        style: { border: 0, width: "100%", height: "100%", display: "block", background: "#F4F4F4" },
        sandbox: "allow-scripts allow-same-origin",
      } as any)
    : (
      <WebView
        ref={wvRef}
        originWhitelist={["*"]}
        source={{ html: SIGN_HTML }}
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: "transparent" }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
      />
    );

  return (
    <View style={styles.wrap}>
      <View style={[styles.pad, { height }]}>{Pad as any}</View>
      <View style={styles.foot}>
        <Text style={styles.footHint}>
          {hasSig ? "Signature captured ✓" : "Ask the customer to sign above"}
        </Text>
        <Pressable onPress={clear} style={styles.clearBtn} testID="sig-clear-button">
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden", backgroundColor: colors.bg,
  },
  pad: { backgroundColor: "#fff" },
  foot: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.bgSecondary,
  },
  footHint: { fontSize: font.sm, color: colors.textSecondary, fontWeight: weight.medium },
  clearBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  clearText: { fontSize: font.sm, fontWeight: weight.semibold, color: colors.text },
});
