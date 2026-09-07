import { Text, View, StyleSheet } from "react-native";
import { Card, Heading, Muted, Notice, StatusPill, Button, LoadingSkeleton, theme } from "@hatidone/mobile";
import type { ReactNode } from "react";
import { useDriver } from "./driver-context";
import { peso, schedule, label, driverError, statusTone } from "./format";
import type { Ride } from "./data";

export function Feedback() {
  const { error, actionError, feedback, locationError, loading, data, reload } = useDriver();
  return <>
    {loading && !data && <LoadingSkeleton lines={3} />}
    {error && <><Notice tone="error">{driverError(error)}</Notice><Button label="Try again" variant="secondary" onPress={() => void reload()} /></>}
    {actionError && <Notice tone="error">{driverError(actionError)}</Notice>}
    {feedback && <Notice tone="success">{feedback}</Notice>}
    {locationError && <Notice>{driverError(locationError, "Location is unavailable. Try again or enter your position in Account → Location.")}</Notice>}
  </>;
}
export function RideRoute({ ride }: { ride: Ride }) {
  return <View style={styles.routeBlock}>
    <View style={styles.routeRow}><Text style={styles.routeLabel}>Pickup</Text><Text style={styles.route}>{ride.pickup_address}</Text></View>
    <View style={styles.routeRow}><Text style={styles.routeLabel}>Destination</Text><Text style={styles.route}>{ride.dropoff_address}</Text></View>
  </View>;
}
export function RideCard({ ride, children, badge, compact = false }: { ride: Ride; children?: ReactNode; badge?: string; compact?: boolean }) {
  return <Card>
    {badge && <StatusPill label={badge} tone={statusTone(ride.status)} />}
    <Muted>{schedule(ride.scheduled_at)}</Muted>
    <RideRoute ride={ride} />
    <Muted>{label(ride.vehicle_type)} · {ride.passenger_count} passenger{ride.passenger_count === 1 ? "" : "s"} · {label(ride.service_type)}</Muted>
    {!compact && <Muted>{ride.estimated_distance_meters === null ? "Distance pending" : `Approx. ${(ride.estimated_distance_meters / 1000).toFixed(1)} km`}{ride.estimated_duration_seconds === null ? " · Duration pending" : ` · ${Math.ceil(ride.estimated_duration_seconds / 60)} min`}</Muted>}
    <View style={styles.earnings}><Muted>Estimated earnings</Muted><Text style={styles.total}>{peso(ride.driver_earnings)}</Text></View>
    {!compact && <>
      <View style={styles.breakdown}><MoneyLine label="Ride fare" value={ride.gross_fare ?? ride.estimated_fare} /><MoneyLine label="HatidOne commission" value={ride.platform_commission} /><MoneyLine label="Estimated toll" value={ride.estimated_toll_amount} /></View>
      <Muted>{label(ride.route_preference)}. {ride.estimated_toll_amount === null ? "Toll unknown; confirm before departure. " : ""}Tolls and other costs may affect final earnings.</Muted>
    </>}
    {children}
  </Card>;
}
export function MoneyLine({ label: text, value, strong }: { label: string; value: number | null; strong?: boolean }) {
  return <View style={styles.money}><Text style={[styles.moneyText, styles.moneyLabel, strong && styles.moneyStrong]}>{text}</Text><Text style={[styles.moneyText, styles.moneyValue, strong && styles.moneyStrong]}>{peso(value)}</Text></View>;
}
export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <Card><Heading size="section">{title}</Heading><Muted>{children}</Muted>{action}</Card>;
}
const styles = StyleSheet.create({
  routeBlock: { gap: 12 },
  routeRow: { gap: 3 },
  routeLabel: { fontSize: 12, color: theme.muted },
  route: { fontSize: 17, lineHeight: 23, fontWeight: "500", color: theme.text },
  earnings: { gap: 3 },
  total: { fontSize: 30, lineHeight: 38, fontWeight: "600", color: theme.text },
  breakdown: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderColor: theme.border },
  money: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "baseline" },
  moneyText: { fontSize: 15, lineHeight: 22, color: theme.muted },
  moneyLabel: { flex: 1 },
  moneyValue: { flexShrink: 0, textAlign: "right" },
  moneyStrong: { fontSize: 17, fontWeight: "600", color: theme.text },
});
