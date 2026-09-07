import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  Button,
  Card,
  Muted,
  StatusPill,
  dateTime,
  money,
  theme,
} from "@hatidone/mobile";
import { statusLabel, type Booking } from "./data";

export function bookingTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" {
  if (
    status.includes("cancelled") ||
    ["no_show", "expired", "no_driver_found"].includes(status)
  )
    return "danger";
  if (["assigned", "driver_arrived", "trip_completed"].includes(status))
    return "success";
  if (["requested", "searching", "offered"].includes(status)) return "warning";
  return "neutral";
}
export function RouteSummary({
  pickup,
  destination,
}: {
  pickup: string;
  destination: string;
}) {
  return (
    <View style={styles.route}>
      <View style={styles.routeRow}>
        <Ionicons
          name="radio-button-on-outline"
          size={18}
          color={theme.muted}
          accessible={false}
        />
        <View style={styles.routeText}>
          <Muted>Pickup</Muted>
          <Text style={styles.place}>{pickup}</Text>
        </View>
      </View>
      <View style={styles.routeRow}>
        <Ionicons
          name="location-outline"
          size={19}
          color={theme.text}
          accessible={false}
        />
        <View style={styles.routeText}>
          <Muted>Destination</Muted>
          <Text style={styles.place}>{destination}</Text>
        </View>
      </View>
    </View>
  );
}
export function BookingCard({ booking }: { booking: Booking }) {
  return (
    <Card>
      <StatusPill
        label={statusLabel(booking.status)}
        tone={bookingTone(booking.status)}
      />
      <RouteSummary
        pickup={booking.pickup_address}
        destination={booking.dropoff_address}
      />
      <Muted>
        {dateTime(booking.scheduled_at)} ·{" "}
        {booking.vehicle_type === "suv"
          ? "SUV"
          : booking.vehicle_type[0].toUpperCase() +
            booking.vehicle_type.slice(1)}
      </Muted>
      <View style={styles.fare}>
        <Muted>Estimated ride fare</Muted>
        <Text style={styles.price}>{money(booking.estimated_fare)}</Text>
      </View>
      <Button
        label="View booking"
        variant="secondary"
        onPress={() =>
          router.push({ pathname: "/booking/[id]", params: { id: booking.id } })
        }
      />
    </Card>
  );
}
const styles = StyleSheet.create({
  route: { gap: 14 },
  routeRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  routeText: { flex: 1, gap: 2 },
  place: { color: theme.text, fontSize: 17, lineHeight: 24, fontWeight: "500" },
  fare: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  price: { color: theme.text, fontSize: 18, fontWeight: "600" },
});
