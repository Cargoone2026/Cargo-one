/**
 * BookingChatTab — Chat UI rendered inside BookingDetail when
 * `tab === "chat"`. Replaces the previous placeholder that only
 * offered an "Open Messages" button looping back to the inbox.
 *
 * Uses the existing `CustomerAPI.listMessages` + `CustomerAPI.sendMessage`
 * endpoints (packages/core/src/endpoints.ts, lines 100-103). Chat is
 * gated backend-side on `booking.payment_status == "paid"` — the
 * backend returns 403 before deposit; this component surfaces that
 * state with a clear gated message so the user is not left wondering.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Send } from "lucide-react-native";
import { CustomerAPI } from "@cargoone/core";
import { useAuth } from "../AuthContext";
import { colors, radius, typography } from "../theme";

type Msg = {
  id: string;
  booking_id: string;
  sender_id: string;
  text?: string | null;
  photo?: string | null;
  read?: boolean;
  created_at?: string;
  delivered_at?: string;
  read_at?: string | null;
};

const POLL_INTERVAL_MS = 5000;

export function BookingChatTab({
  bookingId,
  chatUnlocked,
}: {
  bookingId: string;
  chatUnlocked: boolean;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const prevCountRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const list = await CustomerAPI.listMessages(bookingId);
      const sorted = Array.isArray(list)
        ? [...list].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
        : [];
      setMessages(sorted);
      setErrorMsg(null);
    } catch {
      // listMessages already .catch(() => []) in core — reaching here means
      // a wrapper error. Keep whatever we had; show a non-fatal error.
      setErrorMsg("Couldn't refresh chat. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  // Focus-triggered load + lightweight polling while this tab is focused.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      load();
      const iv = setInterval(() => {
        if (active) load();
      }, POLL_INTERVAL_MS);
      return () => {
        active = false;
        clearInterval(iv);
      };
    }, [load]),
  );

  // Auto-scroll to the end whenever the message count grows.
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      // Defer so layout settles before scrolling.
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending || !chatUnlocked) return;
    setSending(true);
    setErrorMsg(null);
    // Optimistic — show the message immediately with a temp id.
    const tempId = `temp-${Date.now()}`;
    const optimistic: Msg = {
      id: tempId,
      booking_id: bookingId,
      sender_id: user?.id || "me",
      text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    try {
      const saved = await CustomerAPI.sendMessage(bookingId, text);
      // Replace the optimistic row with the server row.
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? ({ ...optimistic, ...saved } as Msg) : m)),
      );
    } catch (e: any) {
      // Roll back the optimistic row + surface the error.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      const msg = e?.message || "Couldn't send. Please try again.";
      setErrorMsg(msg);
    } finally {
      setSending(false);
    }
  }, [draft, sending, chatUnlocked, bookingId, user?.id]);

  // ─── Gated: chat only unlocks after deposit paid. ────────────────────
  if (!chatUnlocked) {
    return (
      <View style={styles.gated} testID="tab-chat-gated">
        <Text style={typography.cardTitle}>Chat is locked</Text>
        <Text style={[typography.caption, { marginTop: 6 }]}>
          Pay the deposit to unlock messaging with the driver.
        </Text>
      </View>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <View style={styles.loading} testID="tab-chat-loading">
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="tab-chat">
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 ? (
          <View style={styles.empty} testID="tab-chat-empty">
            <Text style={typography.caption}>No messages yet. Say hello to your driver.</Text>
          </View>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} m={m} meId={user?.id} />)
        )}
      </ScrollView>
      {errorMsg ? (
        <View style={styles.errorBar} testID="tab-chat-error">
          <Text style={styles.errorTxt}>{errorMsg}</Text>
        </View>
      ) : null}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message driver…"
          placeholderTextColor={colors.inkMuted}
          multiline
          maxLength={1000}
          editable={!sending}
          testID="tab-chat-input"
        />
        <Pressable
          onPress={onSend}
          disabled={!draft.trim() || sending}
          style={({ pressed }) => [
            styles.sendBtn,
            (!draft.trim() || sending) && styles.sendBtnDisabled,
            pressed && { opacity: 0.8 },
          ]}
          testID="tab-chat-send"
          accessibilityLabel="Send message"
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Send size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function MessageBubble({ m, meId }: { m: Msg; meId?: string }) {
  const mine = !!meId && m.sender_id === meId;
  return (
    <View
      style={[
        styles.bubbleRow,
        { justifyContent: mine ? "flex-end" : "flex-start" },
      ]}
      testID={mine ? "chat-bubble-mine" : "chat-bubble-theirs"}
    >
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        {m.text ? (
          <Text style={[styles.bubbleText, mine && { color: "#FFFFFF" }]}>{m.text}</Text>
        ) : m.photo ? (
          <Text style={[styles.bubbleText, mine && { color: "#FFFFFF" }]}>📷 Photo</Text>
        ) : null}
        <Text
          style={[
            styles.bubbleTime,
            mine ? { color: "rgba(255,255,255,0.75)" } : { color: colors.inkMuted },
          ]}
        >
          {formatTime(m.created_at)}
        </Text>
      </View>
    </View>
  );
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const styles = {
  wrap: {
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    overflow: "hidden" as const,
  },
  gated: {
    padding: 16,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  loading: {
    padding: 24,
    alignItems: "center" as const,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  list: { maxHeight: 420 },
  empty: { padding: 16, alignItems: "center" as const },
  bubbleRow: { flexDirection: "row" as const },
  bubble: {
    maxWidth: "80%" as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  bubbleMine: {
    backgroundColor: colors.brand,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.bgSecondary,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, color: colors.ink },
  bubbleTime: { fontSize: 10, marginTop: 4, textAlign: "right" as const },
  errorBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FEF2F2",
    borderTopWidth: 1,
    borderTopColor: "#FCA5A5",
  },
  errorTxt: { fontSize: 12, color: "#991B1B" },
  composer: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    color: colors.ink,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  sendBtnDisabled: { opacity: 0.4 },
} as const;
