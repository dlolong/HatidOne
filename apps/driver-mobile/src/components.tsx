import { Text, View, StyleSheet } from "react-native";
import { Card, Heading, Muted, Notice, Row, Chip } from "@hatidone/mobile";
import type { ReactNode } from "react";
import { useDriver } from "./driver-context";
import { peso, schedule, label } from "./format";
import type { Ride } from "./data";

export function Feedback() {
  const { error, actionError, feedback, locationError, loading, data } =
    useDriver();
  return (
    <>
      {loading && !data && <Notice>Loading your driver account…</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {actionError && <Notice tone="error">{actionError}</Notice>}
      {feedback && <Notice tone="success">{feedback}</Notice>}
      {locationError && <Notice>{locationError}</Notice>}
    </>
  );
}
export function RideCard({
  ride,
  children,
  badge,
}: {
  ride: Ride;
  children?: ReactNode;
  badge?: string;
}) {
  return (
    <Card>
      {badge && <Chip label={badge} />}
      <Muted>{schedule(ride.scheduled_at)}</Muted>
      <Text style={styles.route}>{ride.pickup_address}</Text>
      <Text style={styles.arrow}>↓</Text>
      <Text style={styles.route}>{ride.dropoff_address}</Text>
      <Row>
        <Chip label={label(ride.service_type)} />
        <Chip
          label={`${label(ride.vehicle_type)} · ${ride.passenger_count} passenger${ride.passenger_count === 1 ? "" : "s"}`}
        />
      </Row>
      <Muted>
        {ride.estimated_distance_meters === null
          ? "Distance pending"
          : `Approx. ${(ride.estimated_distance_meters / 1000).toFixed(1)} km`}
        {ride.estimated_duration_seconds === null
          ? ""
          : ` · ${Math.ceil(ride.estimated_duration_seconds / 60)} min`}
      </Muted>
      <View style={styles.breakdown}>
        <MoneyLine
          label="Ride fare"
          value={ride.gross_fare ?? ride.estimated_fare}
        />
        <MoneyLine
          label="HatidOne commission"
          value={ride.platform_commission}
        />
        <MoneyLine
          label="Estimated driver earnings"
          value={ride.driver_earnings}
          strong
        />
      </View>
      <Muted>
        {label(ride.route_preference)} ·{" "}
        {ride.route_source === "local_estimate"
          ? "Locally estimated route"
          : label(ride.route_source)}
        . Toll:{" "}
        {ride.estimated_toll_amount === null
          ? "unknown; confirm before departure"
          : peso(ride.estimated_toll_amount)}
        .
      </Muted>
      <Muted>
        Known platform deduction shown above. Tolls, taxes or payment costs may
        affect the final amount.
      </Muted>
      {children}
    </Card>
  );
}
export function MoneyLine({
  label: text,
  value,
  strong,
}: {
  label: string;
  value: number | null;
  strong?: boolean;
}) {
  return (
    <View style={styles.money}>
      <Text style={strong ? styles.moneyStrong : styles.moneyText}>{text}</Text>
      <Text style={strong ? styles.moneyStrong : styles.moneyText}>
        {peso(value)}
      </Text>
    </View>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <Heading>{title}</Heading>
      <Muted>{children}</Muted>
    </Card>
  );
}
const styles = StyleSheet.create({
  route: { fontSize: 18, fontWeight: "600", color: "#162c2c" },
  arrow: { color: "#578078", fontSize: 20 },
  breakdown: {
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e1e9e7",
  },
  money: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  moneyText: { fontSize: 14, color: "#445b58", flexShrink: 1 },
  moneyStrong: {
    fontSize: 16,
    fontWeight: "600",
    color: "#125c4b",
    flexShrink: 1,
  },
});
