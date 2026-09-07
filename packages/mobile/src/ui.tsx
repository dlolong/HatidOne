import { useId, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export const theme = {
  background: "#F7F7F5", surface: "#FFFFFF", text: "#111111", muted: "#6B6B67",
  primary: "#111111", pressed: "#000000", border: "#E5E5E2", subtle: "#F2F2F0",
  danger: "#A32929", success: "#21633D", warning: "#805C12",
  radius: 12, controlHeight: 50,
};
export function Screen({ children, refreshing = false, onRefresh, footer, scrollKey, bottomInset = false }: {
  children: ReactNode; refreshing?: boolean; onRefresh?: () => void; footer?: ReactNode; scrollKey?: string | number; bottomInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView key={scrollKey} contentContainerStyle={[styles.screen, !footer && bottomInset && { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} /> : undefined}>
        {children}
      </ScrollView>
      {footer && <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}><View style={styles.footerContent}>{footer}</View></View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function Card({ children }: { children: ReactNode }) { return <View style={styles.card}>{children}</View>; }
export function Heading({ children, size = "page" }: { children: ReactNode; size?: "page" | "section" }) {
  return <Text accessibilityRole="header" style={[styles.heading, size === "section" && styles.sectionHeading]}>{children}</Text>;
}
export function Muted({ children }: { children: ReactNode }) { return <Text style={styles.muted}>{children}</Text>; }
export function Row({ children }: { children: ReactNode }) { return <View style={styles.row}>{children}</View>; }
export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "error" | "success" | "info" }) {
  return <View style={[styles.notice, tone === "error" && { backgroundColor: "#FFF1F0" }, tone === "success" && { backgroundColor: "#EDF6EF" }]}>
    <Text accessibilityRole={tone === "error" ? "alert" : undefined} accessibilityLiveRegion="polite"
      style={{ color: tone === "error" ? theme.danger : tone === "success" ? theme.success : theme.text, fontSize: 15, lineHeight: 22 }}>{children}</Text>
  </View>;
}
export function Button({ label, onPress, disabled = false, loading = false, variant = "primary" }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: "primary" | "secondary" | "danger";
}) {
  const [focused, setFocused] = useState(false);
  const secondary = variant === "secondary";
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || loading, busy: loading }}
    disabled={disabled || loading} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.button, {
      backgroundColor: secondary ? pressed ? theme.subtle : theme.surface : variant === "danger" ? theme.danger : pressed ? theme.pressed : theme.primary,
      borderColor: focused ? theme.text : secondary ? theme.border : "transparent", borderWidth: focused ? 2 : 1,
      opacity: disabled || loading ? 0.5 : 1,
    }]}>
    {loading ? <ActivityIndicator color={secondary ? theme.text : "#fff"} /> : <Text style={{ color: secondary ? theme.text : "#fff", fontWeight: "600", fontSize: 16, textAlign: "center" }}>{label}</Text>}
  </Pressable>;
}
export function Field({ label, style, hint, error, onFocus, onBlur, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} accessibilityHint={error || hint} placeholderTextColor={theme.muted} {...props}
      aria-describedby={error || hint ? id : undefined} aria-invalid={!!error}
      onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }}
      style={[styles.input, focused && { borderColor: theme.text, borderWidth: 2 }, !!error && { borderColor: theme.danger }, style]} />
    {(error || hint) && <Text nativeID={id} accessibilityRole={error ? "alert" : undefined} style={{ color: error ? theme.danger : theme.muted, fontSize: 14, lineHeight: 20 }}>{error || hint}</Text>}
  </View>;
}
export function Chip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole={onPress ? "button" : "text"} accessibilityState={{ selected }} onPress={onPress} disabled={!onPress}
    style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && { opacity: 0.75 }]}>
    <Text style={{ color: selected ? "#fff" : theme.text, fontSize: 14, fontWeight: selected ? "600" : "400" }}>{label}</Text>
  </Pressable>;
}
const statusColors = {
  neutral: [theme.subtle, theme.text], success: ["#EDF6EF", theme.success], warning: ["#FFF6DF", theme.warning], danger: ["#FFF1F0", theme.danger],
};
export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: keyof typeof statusColors }) {
  const [backgroundColor, color] = statusColors[tone];
  return <View style={[styles.badge, { backgroundColor }]}><Text style={{ color, fontSize: 13, fontWeight: "500", lineHeight: 19 }}>{label}</Text></View>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <View style={styles.empty}><Heading size="section">{title}</Heading><Muted>{description}</Muted>{action}</View>;
}
export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return <View accessibilityLabel="Loading" accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.card}>
    {Array.from({ length: lines }, (_, index) => <View key={index} style={{ height: index === 0 ? 24 : 16, width: index % 2 ? "72%" : "92%", borderRadius: 4, backgroundColor: theme.subtle }} />)}
  </View>;
}
export function money(value: number | string | null) { return value === null ? "Not available" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value)); }
export function dateTime(iso: string | null) { return iso ? new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }) : "Unscheduled"; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  screen: { flexGrow: 1, padding: 20, paddingBottom: 28, gap: 16, width: "100%", maxWidth: 740, alignSelf: "center" },
  footer: { backgroundColor: theme.surface, borderTopWidth: 1, borderColor: theme.border, paddingHorizontal: 20, paddingTop: 12 },
  footerContent: { width: "100%", maxWidth: 700, alignSelf: "center", gap: 8 },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, padding: 18, borderRadius: 14, gap: 12 },
  heading: { color: theme.text, fontSize: 26, lineHeight: 33, fontWeight: "600" },
  sectionHeading: { fontSize: 19, lineHeight: 26 },
  muted: { color: theme.muted, fontSize: 15, lineHeight: 22 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  notice: { backgroundColor: theme.subtle, borderRadius: 10, padding: 14 },
  button: { minHeight: 50, padding: 13, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  field: { gap: 7 }, label: { fontSize: 15, color: theme.text, fontWeight: "500" },
  input: { minHeight: 50, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 10, color: theme.text, fontSize: 16 },
  chip: { minHeight: 46, justifyContent: "center", paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  selected: { backgroundColor: theme.primary, borderColor: theme.primary },
  badge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5 },
  empty: { gap: 12, paddingVertical: 24 },
});
