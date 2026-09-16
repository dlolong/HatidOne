import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Button,
  Card,
  Chip,
  Heading,
  EmptyState,
  LoadingSkeleton,
  theme,
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
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "600" }}>
            HatidOne
          </Text>
          <Muted>Hello, {profile?.first_name ?? "traveler"}</Muted>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your account"
          onPress={() => router.push("/(tabs)/account")}
          style={({ pressed }) => ({
            minWidth: 48,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            backgroundColor: pressed ? theme.border : theme.surface,
          })}
        >
          <Ionicons name="person-outline" size={22} color={theme.text} />
        </Pressable>
      </View>
      <Card>
        <Heading>Where are you going?</Heading>
        <Muted>Airport, resort or around town. Plan your next ride.</Muted>
        <Button
          label="Add pickup & destination"
          onPress={() => router.push("/book")}
        />
        <Muted>Scheduled pickup · Operator quote before confirmation</Muted>
      </Card>
      <Row>
        {[
          ["Airport", "airport"],
          ["Resort", "resort"],
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
      {resource.error && (
        <>
          <Notice tone="error">
            We couldn’t load your rides. Check your connection and try again.
          </Notice>
          <Button
            label="Retry rides"
            variant="secondary"
            onPress={() => void reload()}
          />
        </>
      )}
      <Heading size="section">Your next ride</Heading>
      {resource.loading && !resource.data ? (
        <LoadingSkeleton lines={4} />
      ) : upcoming ? (
        <BookingCard booking={upcoming} />
      ) : (
        <EmptyState
          title="No upcoming rides"
          description="Your next booking will appear here. Book ahead for a smoother pickup."
        />
      )}
      {recent && (
        <Card>
          <Heading size="section">Go again</Heading>
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
      {process.env.EXPO_PUBLIC_DEMO_MODE === "true" && (
        <Muted>Isolated demo · Fictional software tests only.</Muted>
      )}
    </Screen>
  );
}
