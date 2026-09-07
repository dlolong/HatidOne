import { Text } from "react-native";
import { router } from "expo-router";
import { Button, Card, Chip, Muted, dateTime, money } from "@hatidone/mobile";
import { statusLabel, type Booking } from "./data";
export function BookingCard({ booking }: { booking: Booking }) {
  return (
    <Card>
      <Chip label={statusLabel(booking.status)} />
      <Text style={{ fontSize: 18, fontWeight: "500" }}>
        {booking.pickup_address} → {booking.dropoff_address}
      </Text>
      <Muted>
        {dateTime(booking.scheduled_at)} · {booking.vehicle_type}
      </Muted>
      <Muted>Estimated ride fare {money(booking.estimated_fare)}</Muted>
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
