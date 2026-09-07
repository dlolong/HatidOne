import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Text } from "react-native";
import {
  Button,
  Card,
  Chip,
  Heading,
  Muted,
  Notice,
  Row,
  Screen,
  useAuth,
  useResource,
} from "@hatidone/mobile";
import { BookingCard } from "../../src/components";
import { getBookings, terminalStatuses } from "../../src/data";
export default function Home() {
  const { client, session, profile } = useAuth();
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
  const upcoming = resource.data
    ?.filter((b) => !terminalStatuses.has(b.status))
    .sort((a, b) =>
      (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""),
    )[0];
  const recent = resource.data?.find((b) => b.status === "trip_completed");
  return (
    <Screen refreshing={resource.loading} onRefresh={() => void reload()}>
      <Muted>HATIDONE</Muted>
      <Heading>Hello, {profile?.first_name ?? "traveler"}.</Heading>
      {process.env.EXPO_PUBLIC_DEMO_MODE === "true" && (
        <Notice>
          DEMO / PILOT MODE · Routes use local estimates. Your bookings are
          saved to your configured Supabase project.
        </Notice>
      )}
      <Card>
        <Heading>Where are you going?</Heading>
        <Muted>
          Choose your pickup and destination. We’ll help arrange a reliable
          ride.
        </Muted>
        <Button label="Plan a ride" onPress={() => router.push("/book")} />
      </Card>
      <Row>
        {[
          ["Airport Transfer", "airport"],
          ["Resort Transfer", "resort"],
          ["Local Ride", "local"],
        ].map(([label, service]) => (
          <Chip
            key={service}
            label={label}
            onPress={() =>
              router.push({ pathname: "/book", params: { service } })
            }
          />
        ))}
      </Row>
      {resource.error && <Notice tone="error">{resource.error}</Notice>}
      <Heading>Next ride</Heading>
      {upcoming ? (
        <BookingCard booking={upcoming} />
      ) : (
        <Card>
          <Text>No upcoming rides</Text>
          <Muted>
            Book ahead for airport pickups, resort visits, and everyday
            journeys.
          </Muted>
        </Card>
      )}
      {recent && (
        <Card>
          <Muted>YOUR RECENT DESTINATION</Muted>
          <Text>{recent.dropoff_address}</Text>
          <Button
            label="Book this route again"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: "/book", params: { rebook: recent.id } })
            }
          />
        </Card>
      )}
      <Muted>Clear fares. Reliable scheduling. A driver-first network.</Muted>
    </Screen>
  );
}
