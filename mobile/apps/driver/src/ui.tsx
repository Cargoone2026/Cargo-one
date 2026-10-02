/**
 * ui.tsx — Cargo One Driver mobile design-system primitives.
 *
 * Mirrors `mobile/apps/customer/src/ui.tsx` so Driver mobile looks
 * like the same CargoOne product as Customer. Where Customer uses
 * `lucide-react-native` icons, Driver renders equivalent glyphs via
 * `View`/`Text` nodes — this keeps the Driver autolinking exclude
 * list intact (no react-native-svg / lucide dependency).
 *
 * Screens MUST compose these primitives instead of writing raw
 * StyleSheet blocks. Add new primitives here before using them.
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
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useShellMenu } from "./components/AppShell";
import {
  CARGO,
  STATUS_COLOR,
  STATUS_LABELS,
  colors,
  radius,
  shadow,
  space,
  typography,
} from "./theme";

export { CARGO, STATUS_COLOR, STATUS_LABELS, colors, radius, space, shadow, typography };

export type IconName = React.ComponentProps<typeof Feather>["name"];

/* -------------------------------------------------------------------- */
/* Glyphs — thin Feather wrappers so screens never import vector-icons   */
/* directly. Keeps the icon system swappable in one place.               */
/* -------------------------------------------------------------------- */

export function Icon({
  name, size = 20, color = colors.ink,
}: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

export function ChevronRight({ size = 18, color = colors.inkFaint }: { size?: number; color?: string }) {
  return <Feather name="chevron-right" size={size} color={color} />;
}

export function MapPin({ size = 14, color = colors.brand }: { size?: number; color?: string }) {
  return <Feather name="map-pin" size={size} color={color} />;
}

/* -------------------------------------------------------------------- */
/* Layout                                                               */
/* -------------------------------------------------------------------- */

/** Page — matches `bg-white min-h-screen pb-6` + top safe-area. */
export function Page({
  children,
  scroll = true,
  testID,
  bg = colors.bg,
  contentPadding = false,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  testID?: string;
  bg?: string;
  contentPadding?: boolean;
  refreshControl?: React.ReactElement<any>;
}) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: contentPadding ? space[4] : 0,
        paddingBottom: space[8],
      }}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, paddingHorizontal: contentPadding ? space[4] : 0 }}>{children}</View>
  );
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: bg }} testID={testID}>
      {inner}
    </SafeAreaView>
  );
}

/** Section — vertical rhythm with 16-px horizontal padding by default. */
export function Section({
  children,
  style,
  gap = space[3],
  padHorizontal = space[4],
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  padHorizontal?: number;
}) {
  return <View style={[{ paddingHorizontal: padHorizontal, gap }, style]}>{children}</View>;
}

/* -------------------------------------------------------------------- */
/* Header                                                               */
/* -------------------------------------------------------------------- */

/** PageHeader — matches Customer's PageHeader. Title left, actions right.
 *  When mounted inside an `AppShell` (bottom breakpoint, drawer mode),
 *  a 44×44 hamburger button opens the drawer. If `onBack` is given the
 *  back button takes precedence over the menu button.
 */
export function PageHeader({
  title,
  subtitle,
  right,
  onBack,
  testID,
  large,
  style,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
  testID?: string;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { openDrawer, showMenu } = useShellMenu();
  return (
    <View style={[headerStyles.row, style]} testID={testID}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          testID="page-header-back"
          style={headerStyles.menuBtn}
          hitSlop={8}
        >
          <Feather name="chevron-left" size={22} />
        </Pressable>
      ) : showMenu ? (
        <Pressable
          onPress={openDrawer}
          testID="page-header-menu"
          accessibilityLabel="Open menu"
          style={headerStyles.menuBtn}
          hitSlop={8}
        >
          <Feather name="menu" size={22} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === "string" ? (
          <Text style={large ? typography.h1Large : typography.pageTitle} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <Text style={[typography.caption, { marginTop: 2 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {right ? (
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>{right}</View>
      ) : null}
    </View>
  );
}

/** IconButton — 44×44 round soft-grey button, matches Customer's. */
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
  const bg =
    variant === "solid" ? colors.ink :
    variant === "ghost" ? "transparent" :
    colors.bgSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        {
          width: 44, height: 44, borderRadius: 22,
          alignItems: "center", justifyContent: "center",
          backgroundColor: pressed ? colors.bgTertiary : bg,
        },
      ]}
    >
      {children}
      {badged ? (
        <View
          style={{
            position: "absolute", top: 10, right: 10,
            width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand,
          }}
          testID="icon-button-badge"
        />
      ) : null}
    </Pressable>
  );
}

/* -------------------------------------------------------------------- */
/* Typography helpers                                                   */
/* -------------------------------------------------------------------- */

export function H1({ children, large, style }: { children: React.ReactNode; large?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[large ? typography.h1Large : typography.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[typography.h2, style]}>{children}</Text>;
}
export function SectionTitle({
  children, right, style,
}: { children: React.ReactNode; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, style]}>
      <Text style={typography.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}
export function Body({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[muted ? typography.bodyMuted : typography.body, style]}>{children}</Text>;
}
export function Caption({
  children, style, numberOfLines,
}: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text style={[typography.caption, style]} numberOfLines={numberOfLines}>{children}</Text>;
}
export function Micro({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[typography.micro, style]}>{children}</Text>;
}
export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 6, marginTop: 12 }, style]}>
      {children}
    </Text>
  );
}

/* -------------------------------------------------------------------- */
/* Inputs                                                               */
/* -------------------------------------------------------------------- */

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={colors.inkMuted} style={styles.input} {...props} />;
}

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
          flexDirection: "row", alignItems: "center", gap: space[2],
          borderRadius: radius.base,
          backgroundColor: pressed ? colors.bgTertiary : colors.bgSecondary,
          paddingHorizontal: 14, paddingVertical: space[3],
        },
      ]}
    >
      <Feather name="search" size={18} color={colors.inkMuted} />
      <Text style={{ flex: 1, fontSize: 14, color: colors.inkMuted }}>{placeholder}</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------- */
/* Buttons                                                              */
/* -------------------------------------------------------------------- */

export function PrimaryButton({
  title, onPress, loading, disabled, testID, variant = "primary", style,
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

/* -------------------------------------------------------------------- */
/* Cards / rows                                                         */
/* -------------------------------------------------------------------- */

export function Card({
  children, style, onPress, testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.card,
          pressed ? { borderColor: colors.ink } : null,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: space[2] }, style]}>{children}</View>;
}

export function MenuRow({
  label, onPress, testID, danger, right, subtitle, leftGlyph,
}: {
  label: string;
  onPress?: () => void;
  testID?: string;
  danger?: boolean;
  right?: React.ReactNode;
  subtitle?: string;
  leftGlyph?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          paddingHorizontal: space[4], paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: colors.hairline,
          backgroundColor: pressed ? "#F9FAFB" : colors.bg,
          flexDirection: "row", alignItems: "center", gap: space[3],
        },
      ]}
    >
      {leftGlyph ?? null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, color: danger ? colors.errorInk : colors.ink, fontWeight: "500" }}>{label}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: colors.inkMuted, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right != null ? right : <ChevronRight size={18} color={colors.inkFaint} />}
    </Pressable>
  );
}

/* -------------------------------------------------------------------- */
/* StatusPill — matches Customer StatusPill 1:1                         */
/* -------------------------------------------------------------------- */

export function StatusPill({ status, testID }: { status: string; testID?: string }) {
  const c = STATUS_COLOR[status] || { bg: colors.bgSecondary, fg: colors.ink };
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row", alignItems: "center", gap: 6,
        paddingHorizontal: space[3], paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: c.bg,
      }}
      testID={testID}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.fg }} />
      <Text style={{ fontSize: 12, fontWeight: "600", color: c.fg }}>
        {STATUS_LABELS[status] || status}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* EmptyState — polished placeholder for Coming Soon / empty lists      */
/* -------------------------------------------------------------------- */

export function EmptyState({
  glyph, title, body, action, testID,
}: {
  glyph?: IconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View
      style={{ alignItems: "center", paddingVertical: 48, gap: space[2], paddingHorizontal: space[6] }}
      testID={testID}
    >
      {glyph ? (
        <View
          style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.bg,
            borderWidth: 1, borderColor: colors.border,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Feather name={glyph} size={28} color={colors.inkFaint} />
        </View>
      ) : null}
      <Text style={[typography.cardTitle, { marginTop: space[2], textAlign: "center" }]}>{title}</Text>
      {body ? (
        <Text style={[typography.caption, { textAlign: "center", maxWidth: 320, lineHeight: 18 }]}>{body}</Text>
      ) : null}
      {action ? <View style={{ marginTop: space[3], width: "100%", maxWidth: 320 }}>{action}</View> : null}
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* Driver-specific primitives                                           */
/* -------------------------------------------------------------------- */

/**
 * HeroCard — large rounded promo card. Mirrors Customer's "Post a job
 * in under 60 seconds" hero but with Driver-contextual content. Dark
 * ink surface, 20-px radius, 24-px padding.
 */
export function HeroCard({
  eyebrow, title, children, onPress, testID,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const inner = (
    <>
      {eyebrow ? (
        <Text
          style={{
            color: "rgba(255,255,255,0.72)",
            fontSize: 11, fontWeight: "700",
            textTransform: "uppercase", letterSpacing: 1.2,
            marginBottom: 6,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text style={{ color: colors.inkInverse, fontSize: 24, fontWeight: "700", letterSpacing: -0.3, lineHeight: 30 }}>
        {title}
      </Text>
      {children ? <View style={{ marginTop: space[3] }}>{children}</View> : null}
    </>
  );
  const base: ViewStyle = {
    borderRadius: radius.xl,
    backgroundColor: colors.ink,
    padding: space[5],
    overflow: "hidden",
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [base, pressed && { opacity: 0.9 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View testID={testID} style={base}>{inner}</View>;
}

/**
 * StatTile — the small-icon stat card used on Customer Home (Bookings
 * total / Messages unread). Pressable with a tinted icon well.
 */
export function StatTile({
  glyph, tintBg, tintFg, label, value, badge, onPress, testID,
}: {
  glyph: IconName;
  tintBg: string;
  tintFg: string;
  label: string;
  value: string;
  badge?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const Base: any = onPress ? Pressable : View;
  return (
    <Base
      onPress={onPress}
      testID={testID}
      style={({ pressed }: { pressed: boolean }) => [
        styles.card,
        { flex: 1, padding: space[4] },
        onPress && pressed ? { borderColor: colors.ink } : null,
      ]}
    >
      <View style={{ position: "relative", flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View
          style={{
            width: 36, height: 36, borderRadius: radius.md,
            backgroundColor: tintBg, alignItems: "center", justifyContent: "center",
          }}
        >
          <Feather name={glyph} size={18} color={tintFg} />
        </View>
        {badge ? (
          <View
            style={{
              position: "absolute", top: -2, right: -2,
              width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand,
            }}
          />
        ) : null}
      </View>
      <Text style={{ marginTop: space[3], fontSize: 15, fontWeight: "600", color: colors.ink }}>
        {label}
      </Text>
      <Text style={{ marginTop: 2, fontSize: 12, color: colors.inkMuted }}>{value}</Text>
    </Base>
  );
}

export function CardTitleRow({
  glyph, tintBg, tintFg, title, rightLabel, onRight,
}: {
  glyph: IconName;
  tintBg: string;
  tintFg: string;
  title: string;
  rightLabel?: string;
  onRight?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <View
          style={{
            width: 32, height: 32, borderRadius: radius.md,
            backgroundColor: tintBg, alignItems: "center", justifyContent: "center",
          }}
        >
          <Feather name={glyph} size={16} color={tintFg} />
        </View>
        <Text style={typography.cardTitle}>{title}</Text>
      </View>
      {rightLabel && onRight ? (
        <Pressable onPress={onRight} hitSlop={8}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.brand }}>{rightLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * StatCell — simple value-over-label stat used inside cards (Earnings,
 * Fleet mini-stats, Bids, Verification).
 */
export function StatCell({
  label, value, accent,
}: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB", borderRadius: radius.md, padding: space[3] }}>
      <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.3, color: accent || colors.ink }}>
        {value}
      </Text>
      <Text
        style={{
          marginTop: 4, fontSize: 10, fontWeight: "700",
          letterSpacing: 0.6, textTransform: "uppercase", color: colors.inkMuted,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* Stylesheet                                                            */
/* -------------------------------------------------------------------- */

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[3],
  },
  menuBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bgSecondary,
    alignItems: "center", justifyContent: "center",
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
    padding: space[4],
    backgroundColor: colors.bg,
    ...shadow.card,
  },
});
