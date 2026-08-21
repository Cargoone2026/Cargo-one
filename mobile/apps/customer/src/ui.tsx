/**
 * ui.tsx — Cargo One native design-system primitives.
 *
 * Every primitive here mirrors an existing web component from
 * frontend/src/components/ui-portal/*.jsx or a repeated pattern in
 * the customer web portal pages. Screens must compose these instead
 * of writing raw StyleSheet blocks. Adding a new primitive requires
 * finding its counterpart in the web portal first.
 */
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  StyleProp,
  TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, MapPin, LucideIcon } from "lucide-react-native";
import { CARGO, STATUS_COLOR, STATUS_LABELS, colors, radius, shadow, typography } from "./theme";

export { CARGO };

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/** Page — matches web `bg-white min-h-screen pb-6`. Includes safe-area top. */
export function Page({
  children,
  scroll = true,
  testID,
  bg = colors.bg,
  contentPadding = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  testID?: string;
  bg?: string;
  contentPadding?: boolean;
}) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: contentPadding ? 16 : 0,
        paddingBottom: 32,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, paddingHorizontal: contentPadding ? 16 : 0 }}>{children}</View>
  );
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: bg }} testID={testID}>
      {inner}
    </SafeAreaView>
  );
}

/** Screen — legacy alias used by older screens; treats children as ScrollView-safe. */
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, backgroundColor: colors.bg, padding: 20 }, style]}>{children}</View>;
}

/** Section — column with 16px vertical rhythm, 16 px horizontal padding by default. */
export function Section({
  children,
  style,
  gap = 12,
  padHorizontal = 16,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  padHorizontal?: number;
}) {
  return <View style={[{ paddingHorizontal: padHorizontal, gap }, style]}>{children}</View>;
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

/**
 * PageHeader — top-level header used on Home / Bookings / Messages /
 * Profile and other Cargo One customer pages.
 * Left side:  title (+ optional subtitle).
 * Right side: up to 2 circular 44px action buttons (search, bell,
 *             back, etc.) using the exact web treatment
 *             `bg-[#F4F4F4]` → `bg-[#E5E7EB]` on press.
 */
export function PageHeader({
  title,
  subtitle,
  right,
  onMenuPress,
  showMenu,
  testID,
  large,
  style,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onMenuPress?: () => void;
  showMenu?: boolean;
  testID?: string;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[headerStyles.row, style]} testID={testID}>
      {showMenu ? (
        <Pressable onPress={onMenuPress} testID="page-header-menu" style={headerStyles.menuBtn} hitSlop={8}>
          <MenuGlyph />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {typeof title === "string" ? (
          <Text style={large ? typography.h1Large : typography.pageTitle}>{title}</Text>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <Text style={[typography.caption, { marginTop: 2 }]}>{subtitle}</Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>{right}</View> : null}
    </View>
  );
}

/**
 * IconButton — 44 × 44 rounded-full soft-grey button, matching web
 * `bg-[#F4F4F4] hover:bg-[#E5E7EB]` from Dashboard.jsx. Ships an
 * optional red badge dot at top-right when `badged` is true.
 */
export function IconButton({
  onPress,
  testID,
  accessibilityLabel,
  children,
  badged,
  variant = "soft",
}: {
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  children: React.ReactNode;
  badged?: boolean;
  variant?: "soft" | "ghost" | "solid";
}) {
  const bg = variant === "solid" ? colors.ink : variant === "ghost" ? "transparent" : colors.bgSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.bgTertiary : bg,
        },
      ]}
    >
      {children}
      {badged ? (
        <View
          style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand }}
          testID="icon-button-badge"
        />
      ) : null}
    </Pressable>
  );
}

/** Menu glyph — three horizontal lines used by the collapsible-sidebar toggle. */
function MenuGlyph() {
  return (
    <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
      <View style={{ gap: 4 }}>
        <View style={{ width: 18, height: 2, backgroundColor: colors.ink, borderRadius: 2 }} />
        <View style={{ width: 18, height: 2, backgroundColor: colors.ink, borderRadius: 2 }} />
        <View style={{ width: 18, height: 2, backgroundColor: colors.ink, borderRadius: 2 }} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Typography helpers                                                  */
/* ------------------------------------------------------------------ */

export function H1({ children, large, style }: { children: React.ReactNode; large?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[large ? typography.h1Large : typography.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[typography.h2, style]}>{children}</Text>;
}
export function SectionTitle({ children, style, right }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; right?: React.ReactNode }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, style]}>
      <Text style={typography.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}
export function Body({ children, muted, style, onPress }: { children: React.ReactNode; muted?: boolean; style?: StyleProp<TextStyle>; onPress?: () => void }) {
  return (
    <Text onPress={onPress} style={[muted ? typography.bodyMuted : typography.body, style]}>
      {children}
    </Text>
  );
}
export function Caption({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[typography.caption, style]}>{children}</Text>;
}
export function Micro({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[typography.micro, style]}>{children}</Text>;
}
export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 6, marginTop: 12 }, style]}>{children}</Text>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={colors.inkMuted} style={styles.input} {...props} />;
}

/** SearchPill — matches Dashboard.jsx's "Search categories, vehicles or jobs…" pill. */
export function SearchPill({
  placeholder = "Search",
  onPress,
  testID,
}: {
  placeholder?: string;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderRadius: radius.base,
          backgroundColor: pressed ? colors.bgTertiary : colors.bgSecondary,
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
      ]}
    >
      <SearchGlyph />
      <Text style={{ flex: 1, fontSize: 14, color: colors.inkMuted }}>{placeholder}</Text>
    </Pressable>
  );
}

/** Inline search input row — used by Bookings.jsx (rounded-[12px] bg-[#F4F4F4] px-3 py-2). */
export function SearchInputRow({
  value,
  onChangeText,
  placeholder,
  onClear,
  testID,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onClear?: () => void;
  testID?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.base,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <SearchGlyph size={16} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        style={{ flex: 1, fontSize: 14, color: colors.ink, paddingVertical: 4 }}
        testID={testID}
      />
      {value ? (
        <Pressable onPress={onClear} hitSlop={8} testID={`${testID}-clear`}>
          <Text style={{ fontSize: 16, color: colors.inkFaint, lineHeight: 16 }}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SearchGlyph({ size = 18 }: { size?: number }) {
  // Simple SVG-free replacement using two views — a circle + a line — so
  // we don't pull the whole lucide package into a low-level primitive.
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: size * 0.72,
          height: size * 0.72,
          borderWidth: 2,
          borderColor: colors.inkMuted,
          borderRadius: size,
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
      <View
        style={{
          width: 2,
          height: size * 0.35,
          backgroundColor: colors.inkMuted,
          borderRadius: 1,
          position: "absolute",
          bottom: 0,
          right: 0,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  testID,
  variant = "primary",
  style,
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  variant?: "primary" | "secondary" | "danger";
  style?: StyleProp<ViewStyle>;
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const base = isPrimary
    ? { backgroundColor: colors.brand }
    : isDanger
    ? { backgroundColor: "#FEE2E2", borderWidth: 0 }
    : { borderColor: colors.ink, borderWidth: 2, backgroundColor: colors.bg };
  const color = isPrimary ? "#FFFFFF" : isDanger ? colors.errorInk : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [
        styles.btn,
        base,
        (disabled || loading) && { opacity: 0.6 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.btnText, { color }]}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton(props: Omit<React.ComponentProps<typeof PrimaryButton>, "variant">) {
  return <PrimaryButton {...props} variant="secondary" />;
}

/* ------------------------------------------------------------------ */
/* Cards / list rows                                                   */
/* ------------------------------------------------------------------ */

/** Card — plain rounded-[12px] border card matching web. */
export function Card({
  children,
  style,
  onPress,
  testID,
  interactive,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
  interactive?: boolean;
}) {
  const Body = (props: any) => (
    <View {...props} style={[styles.card, style]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.card,
          interactive && pressed ? { borderColor: colors.ink } : null,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <Body testID={testID} />;
}

/** Row — utility flex row wrapper. */
export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, style]}>{children}</View>;
}

/**
 * MenuRow — settings row. Web uses text-[15px] font-medium + right ›.
 */
export function MenuRow({
  label,
  onPress,
  testID,
  danger,
  leftIcon: LeftIcon,
  right,
  subtitle,
}: {
  label: string;
  onPress?: () => void;
  testID?: string;
  danger?: boolean;
  leftIcon?: LucideIcon;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          backgroundColor: pressed ? "#F9FAFB" : colors.bg,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
      ]}
    >
      {LeftIcon ? <LeftIcon size={20} color={danger ? colors.errorInk : colors.ink} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: danger ? colors.errorInk : colors.ink, fontWeight: "500" }}>{label}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: colors.inkMuted, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right != null ? right : <ChevronRight size={18} color={colors.inkFaint} />}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* StatusPill — mirrors frontend StatusPill.jsx exactly.               */
/* ------------------------------------------------------------------ */

export function StatusPill({ status, testID }: { status: string; testID?: string }) {
  const c = STATUS_COLOR[status] || { bg: colors.bgSecondary, fg: colors.ink };
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: c.bg,
      }}
      testID={testID}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }} />
      <Text style={{ fontSize: 12, fontWeight: "600", color: c.fg }}>{STATUS_LABELS[status] || status}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented tabs — matches Bookings.jsx pill segment control.         */
/* ------------------------------------------------------------------ */

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  testIDPrefix,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  testIDPrefix?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.pill,
        padding: 4,
      }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: "center",
              borderRadius: radius.pill,
              backgroundColor: active ? colors.ink : "transparent",
            }}
          >
            <Text style={{ color: active ? "#FFFFFF" : colors.inkMuted, fontSize: 14, fontWeight: "500" }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Progress bar — matches PostJob.jsx step bar.                        */
/* ------------------------------------------------------------------ */

export function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.bgSecondary, overflow: "hidden" }}>
      <View
        style={{
          height: 4,
          width: `${Math.min(100, Math.max(0, progress * 100))}%`,
          backgroundColor: colors.brand,
          borderRadius: 2,
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState — used by Bookings + Messages + Home when list is empty. */
/* ------------------------------------------------------------------ */

export function EmptyState({
  Icon,
  title,
  body,
  testID,
}: {
  Icon?: LucideIcon;
  title: string;
  body?: string;
  testID?: string;
}) {
  return (
    <View
      style={{ alignItems: "center", paddingVertical: 48, gap: 8, paddingHorizontal: 24 }}
      testID={testID}
    >
      {Icon ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.bg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={32} color={colors.inkFaint} />
        </View>
      ) : null}
      <Text style={[typography.cardTitle, { marginTop: 8, textAlign: "center" }]}>{title}</Text>
      {body ? <Text style={[typography.caption, { textAlign: "center", maxWidth: 320 }]}>{body}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* BookingRow — mirrors Bookings.jsx + Dashboard.jsx booking cards.    */
/* ------------------------------------------------------------------ */

export function BookingRow({
  title,
  status,
  pickup,
  dropoff,
  price,
  priceLabel,
  onPress,
  testID,
  cancelled,
}: {
  title: string;
  status: string;
  pickup?: string;
  dropoff?: string;
  price?: number | null;
  priceLabel?: string;
  onPress?: () => void;
  testID?: string;
  cancelled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          padding: 16,
          borderRadius: radius.base,
          borderWidth: 1,
          borderColor: cancelled ? "#FCA5A5" : pressed ? colors.ink : colors.border,
          backgroundColor: cancelled ? "#FEF2F2" : colors.bg,
          marginBottom: 12,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: "600",
            color: cancelled ? "#991B1B" : colors.ink,
            textDecorationLine: cancelled ? "line-through" : "none",
          }}
        >
          {title}
        </Text>
        <StatusPill status={status} />
      </View>
      {pickup || dropoff ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
          <MapPin size={14} color={colors.brand} />
          <Text style={{ fontSize: 14, color: colors.inkMuted, flex: 1 }} numberOfLines={1}>
            {pickup || "—"} → {dropoff || "—"}
          </Text>
        </View>
      ) : null}
      <View
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <View>
          {priceLabel && price != null ? <Text style={typography.small}>{priceLabel}</Text> : null}
          <Text style={[typography.price, cancelled && { color: "#991B1B" }]}>
            {price != null ? `£${Number(price).toFixed(0)}` : "Price pending"}
          </Text>
        </View>
        <ChevronRight size={20} color={colors.inkFaint} />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Summary / info row — used by BookingDetail / Dispatch / JobDetail   */
/* ------------------------------------------------------------------ */

export function SummaryRow({
  label,
  value,
  emphasise,
  big,
  testID,
}: {
  label: string;
  value: React.ReactNode;
  emphasise?: boolean;
  big?: boolean;
  testID?: string;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }} testID={testID}>
      <Text style={{ fontSize: big ? 15 : 13, color: colors.inkMuted, flex: 1 }}>{label}</Text>
      <Text
        style={{
          fontSize: big ? 20 : 14,
          fontWeight: emphasise || big ? "700" : "500",
          color: colors.ink,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Stylesheet                                                          */
/* ------------------------------------------------------------------ */

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
});

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  btn: {
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  btnText: { fontSize: 15, fontWeight: "600" },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    padding: 16,
    backgroundColor: colors.bg,
    ...shadow.card,
  },
});
