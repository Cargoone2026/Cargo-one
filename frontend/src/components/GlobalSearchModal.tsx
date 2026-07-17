import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, font, radius, spacing, weight } from "@/src/theme";

export type SearchScope = "all" | "marketing" | "catalog" | "jobs";

type Row = {
  kind: string;
  id?: string;
  key?: string;
  title: string;
  subtitle?: string;
  icon?: string;
  href: string;
};

type SearchResponse = {
  query: string;
  total: number;
  pages: Row[];
  categories: Row[];
  vehicles: Row[];
  capabilities: Row[];
  jobs: Row[];
  users: Row[];
};

const EMPTY: SearchResponse = {
  query: "",
  total: 0,
  pages: [],
  categories: [],
  vehicles: [],
  capabilities: [],
  jobs: [],
  users: [],
};

const GROUP_META: Record<string, { label: string; iconFallback: string; color: string }> = {
  pages: { label: "Pages", iconFallback: "document-text", color: colors.info },
  categories: { label: "Service Categories", iconFallback: "cube", color: colors.brand },
  vehicles: { label: "Vehicles", iconFallback: "car", color: colors.accent },
  capabilities: { label: "Capabilities", iconFallback: "options", color: "#7C3AED" },
  jobs: { label: "Jobs", iconFallback: "clipboard", color: colors.success },
  users: { label: "Users", iconFallback: "person", color: colors.textSecondary },
};

const GROUP_ORDER: (keyof SearchResponse)[] = [
  "categories",
  "vehicles",
  "capabilities",
  "jobs",
  "users",
  "pages",
] as any;

export function GlobalSearchModal({
  visible,
  onClose,
  scope = "all",
  placeholder = "Search categories, vehicles, jobs…",
  autoFocus = true,
  testID = "global-search-modal",
}: {
  visible: boolean;
  onClose: () => void;
  scope?: SearchScope;
  placeholder?: string;
  autoFocus?: boolean;
  testID?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<any>(null);
  const abortRef = useRef<any>(null);

  const runSearch = useCallback(
    async (query: string) => {
      setError(null);
      setLoading(true);
      // Cancel prior
      if (abortRef.current) abortRef.current.aborted = true;
      const guard = { aborted: false } as { aborted: boolean };
      abortRef.current = guard;
      try {
        const url = `/search?q=${encodeURIComponent(query)}&scope=${scope}&limit=6`;
        const res = await api<SearchResponse>(url).catch((err) => {
          throw err;
        });
        if (!guard.aborted) setData(res);
      } catch (e: any) {
        if (!guard.aborted) setError(e?.message || "Search failed");
      } finally {
        if (!guard.aborted) setLoading(false);
      }
    },
    [scope],
  );

  useEffect(() => {
    if (!visible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, visible, runSearch]);

  useEffect(() => {
    if (visible && autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 220);
      return () => clearTimeout(t);
    }
  }, [visible, autoFocus]);

  const groups = useMemo(() => {
    return GROUP_ORDER
      .map((k) => ({ key: k, rows: (data as any)[k] as Row[] }))
      .filter((g) => g.rows && g.rows.length > 0);
  }, [data]);

  const handlePick = useCallback(
    (row: Row) => {
      onClose();
      // Small delay so the modal closes before navigation.
      setTimeout(() => {
        const href = row.href;
        try {
          router.push(href as any);
        } catch {
          // no-op — swallow bad hrefs so UI never crashes
        }
      }, 100);
    },
    [onClose, router],
  );

  const totalHits = data.total;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView style={styles.sheet} edges={["top"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <View style={styles.searchRow}>
              <Ionicons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                ref={inputRef}
                value={q}
                onChangeText={setQ}
                placeholder={placeholder}
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                testID="global-search-input"
              />
              {q.length > 0 && (
                <Pressable onPress={() => setQ("")} testID="global-search-clear">
                  <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                </Pressable>
              )}
              <Pressable onPress={onClose} style={styles.closeBtn} testID="global-search-close">
                <Text style={styles.closeText}>Cancel</Text>
              </Pressable>
            </View>

            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={styles.loadingText}>Searching…</Text>
              </View>
            )}

            {!loading && error && (
              <View style={styles.emptyBox}>
                <Ionicons name="warning" size={28} color={colors.warning} />
                <Text style={styles.emptyTitle}>Couldn&apos;t complete search</Text>
                <Text style={styles.emptySub}>{error}</Text>
              </View>
            )}

            {!loading && !error && q.length > 0 && totalHits === 0 && (
              <View style={styles.emptyBox} testID="global-search-empty">
                <Ionicons name="search" size={28} color={colors.textTertiary} />
                <Text style={styles.emptyTitle}>No results for &quot;{q}&quot;</Text>
                <Text style={styles.emptySub}>
                  Try &quot;furniture&quot;, &quot;luton&quot;, &quot;pallets&quot;, or a town name.
                </Text>
              </View>
            )}

            <FlatList
              data={groups}
              keyExtractor={(g) => g.key as string}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              renderItem={({ item: g }) => (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {GROUP_META[g.key as string]?.label || g.key}
                  </Text>
                  {g.rows.map((row) => (
                    <Pressable
                      key={`${g.key}-${row.id || row.key || row.title}`}
                      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSecondary }]}
                      onPress={() => handlePick(row)}
                      testID={`search-row-${g.key}-${row.id || row.key || row.title}`}
                    >
                      <View
                        style={[
                          styles.rowIcon,
                          { backgroundColor: (GROUP_META[g.key as string]?.color || colors.text) + "22" },
                        ]}
                      >
                        <Ionicons
                          name={(row.icon as any) || (GROUP_META[g.key as string]?.iconFallback as any) || "search"}
                          size={18}
                          color={GROUP_META[g.key as string]?.color || colors.text}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{row.title}</Text>
                        {row.subtitle ? (
                          <Text style={styles.rowSub} numberOfLines={1}>{row.subtitle}</Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </Pressable>
                  ))}
                </View>
              )}
              ListFooterComponent={
                !loading && q.length === 0 ? (
                  <View style={styles.hintBox}>
                    <Text style={styles.hintTitle}>Try searching for…</Text>
                    <View style={styles.chipRow}>
                      {["furniture", "pallets", "house move", "luton van", "same day"].map((tag) => (
                        <Pressable
                          key={tag}
                          onPress={() => setQ(tag)}
                          style={styles.suggChip}
                          testID={`search-suggestion-${tag}`}
                        >
                          <Ionicons name="search" size={12} color={colors.textSecondary} />
                          <Text style={styles.suggChipText}>{tag}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null
              }
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    flex: 1,
    marginTop: Platform.OS === "web" ? 60 : 40,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({ maxWidth: 720, marginLeft: "auto", marginRight: "auto", width: "100%" } as any)
      : {}),
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    flex: 1,
    fontSize: font.lg,
    color: colors.text,
    padding: 0,
    ...(Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as any) : {}),
  },
  closeBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  closeText: { color: colors.brand, fontWeight: weight.semibold, fontSize: font.base },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  loadingText: { color: colors.textSecondary, fontSize: font.sm },
  emptyBox: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyTitle: { fontSize: font.lg, fontWeight: weight.semibold, color: colors.text, marginTop: spacing.sm },
  emptySub: { fontSize: font.base, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  section: { gap: spacing.xs },
  sectionTitle: {
    fontSize: font.sm,
    fontWeight: weight.bold,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: font.base, fontWeight: weight.semibold, color: colors.text },
  rowSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 2 },
  hintBox: { padding: spacing.lg, gap: spacing.sm },
  hintTitle: {
    fontSize: font.sm,
    fontWeight: weight.bold,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  suggChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary,
  },
  suggChipText: { color: colors.text, fontSize: font.sm, fontWeight: weight.medium },
});
