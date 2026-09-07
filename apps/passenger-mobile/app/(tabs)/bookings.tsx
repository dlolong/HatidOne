import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  Button,
  Chip,
  Heading,
  Muted,
  Notice,
  Row,
  Screen,
  useAuth,
  useResource,
} from "@hatidone/mobile";
import { getBookings, terminalStatuses } from "../../src/data";
import { BookingCard } from "../../src/components";
export default function Bookings() {
  const { client, session } = useAuth();
  const [filter, setFilter] = useState("upcoming");
  const resource = useResource(
    () => getBookings(client, session?.user.id),
    [client, session?.user.id],
  );
  const { reload } = resource;
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  useEffect(() => {
    if (!client || !session) return;
    const channel = client
      .channel("passenger-bookings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
          filter: `passenger_id=eq.${session.user.id}`,
        },
        () => void reload(),
      )
      .subscribe();
    const timer = setInterval(() => void reload(), 20000);
    return () => {
      clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [client, session, reload]);
  const bookings = resource.data?.filter((b) =>
    filter === "upcoming"
      ? !terminalStatuses.has(b.status)
      : filter === "completed"
        ? b.status === "trip_completed"
        : terminalStatuses.has(b.status) && b.status !== "trip_completed",
  );
  return (
    <Screen refreshing={resource.loading} onRefresh={() => void reload()}>
      <Heading>Your bookings</Heading>
      <Row>
        {["upcoming", "completed", "cancelled"].map((item) => (
          <Chip
            key={item}
            label={item[0].toUpperCase() + item.slice(1)}
            selected={item === filter}
            onPress={() => setFilter(item)}
          />
        ))}
      </Row>
      {resource.error && <Notice tone="error">{resource.error}</Notice>}
      {resource.loading && !resource.data && <Muted>Loading bookings…</Muted>}
      {bookings?.length === 0 && <Muted>No {filter} bookings yet.</Muted>}
      {bookings?.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
      <Button label="Plan a ride" onPress={() => router.push("/book")} />
    </Screen>
  );
}
