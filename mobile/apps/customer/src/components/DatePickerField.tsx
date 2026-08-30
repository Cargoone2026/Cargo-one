/**
 * DatePickerField — small tappable date field that opens a modal listing
 * the next 14 days for selection. Zero native dependencies (no
 * DateTimePicker pod required). Matches the way the web `<Input type="date">`
 * behaves — you can only pick a real, upcoming day and the value round-trips
 * as `YYYY-MM-DD` (the same wire format the backend already accepts).
 */
import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar as CalendarIcon, Check } from "lucide-react-native";
import { colors, radius, typography } from "../theme";
import { Label } from "../ui";

interface Props {
  label: string;
  value: string;                       // "YYYY-MM-DD" or ""
  onChange: (isoDate: string) => void;
  minDate?: string;                    // inclusive lower bound, defaults to today
  days?: number;                       // how many upcoming days to offer, default 14
  testID?: string;
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toIsoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DatePickerField({ label, value, onChange, minDate, days = 14, testID }: Props) {
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    const base = minDate ? new Date(`${minDate}T00:00:00`) : new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [minDate, days]);

  const label2 = (d: Date) => {
    const iso = toIsoDate(d);
    const today = toIsoDate(new Date());
    if (iso === today) return "Today";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (iso === toIsoDate(tomorrow)) return "Tomorrow";
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  const displayValue = value
    ? (() => {
        const [y, m, dd] = value.split("-").map(Number);
        if (!y || !m || !dd) return value;
        const d = new Date(y, m - 1, dd);
        return isNaN(d.getTime()) ? value : label2(d);
      })()
    : "Select a date";

  return (
    <View>
      <Label>{label}</Label>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.field}
        testID={testID}
        accessibilityRole="button"
      >
        <CalendarIcon size={16} color={colors.inkMuted} />
        <Text style={[styles.fieldTxt, !value && { color: colors.inkMuted }]}>{displayValue}</Text>
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} testID={testID ? `${testID}-sheet` : undefined}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <View style={{ marginTop: 8 }}>
              {options.map((d) => {
                const iso = toIsoDate(d);
                const active = iso === value;
                return (
                  <Pressable
                    key={iso}
                    onPress={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    style={[styles.dayRow, active && styles.dayRowActive]}
                    testID={testID ? `${testID}-opt-${iso}` : undefined}
                  >
                    <Text style={[styles.dayLabel, active && { color: colors.brand }]}>{label2(d)}</Text>
                    <Text style={styles.dayIso}>{iso}</Text>
                    {active ? <Check size={16} color={colors.brand} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  fieldTxt: { fontSize: 14, color: colors.ink, flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.4)",
    justifyContent: "flex-end" as const,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: "80%",
  },
  sheetTitle: { ...typography.cardTitle, marginBottom: 4 },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  dayRowActive: { backgroundColor: "#FEF2F2" },
  dayLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  dayIso: { fontSize: 12, color: colors.inkMuted, letterSpacing: 0.5 },
});
