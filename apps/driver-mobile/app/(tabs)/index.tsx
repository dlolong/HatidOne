import { useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Heading,
  Muted,
  Card,
  Row,
  Chip,
  Button,
  Notice,
} from "@hatidone/mobile";
import { useDriver } from "../../src/driver-context";
import { Feedback, RideCard, Empty } from "../../src/components";
import { suggestedJobs } from "../../src/matching";
import { ACTIVE_STATUSES } from "../../src/data";
const filters = [
  "Best for you",
  "Available",
  "Scheduled",
  "Going Home",
  "Return rides",
] as const;
type Filter = (typeof filters)[number];
export default function JobsScreen() {
  const { data, reload, loading, run, busy, location, locate } = useDriver();
  const [filter, setFilter] = useState<Filter>("Best for you");
  const ranked = useMemo(
    () => (data ? suggestedJobs(data, location) : []),
    [data, location],
  );
  const scores = new Map(ranked.map((job) => [job.id, job]));
  const offers = [...(data?.offers ?? [])]
    .filter((offer) =>
      filter === "Going Home"
        ? scores.get(offer.ride.id)?.goingHome
        : filter === "Return rides"
          ? scores.get(offer.ride.id)?.returnMatch
          : filter === "Scheduled"
            ? Boolean(offer.ride.scheduled_at)
            : true,
    )
    .sort(
      (a, b) =>
        (scores.get(b.ride.id)?.score ?? -1) -
        (scores.get(a.ride.id)?.score ?? -1),
    );
  const active = data?.assignments.some(
    (assignment) =>
      ACTIVE_STATUSES.includes(assignment.ride.status) &&
      assignment.ride.status !== "assigned",
  );
  const toggleAvailability = async () => {
    if (data?.driver?.online) {
      await run(
        "set_driver_availability",
        { p_online: false },
        "You are offline.",
      );
      return;
    }
    const point = location ?? (await locate());
    if (point)
      await run(
        "set_driver_availability",
        {
          p_online: true,
          p_latitude: point.latitude,
          p_longitude: point.longitude,
        },
        "You are available for eligible jobs.",
      );
  };
  const decline = (id: string) => {
    const perform = () =>
      void run("decline_ride_offer", { p_offer_id: id }, "Offer declined.");
    if (Platform.OS === "web") {
      if (window.confirm("Decline this job?")) perform();
    } else
      Alert.alert("Decline this job?", "The offer will be released.", [
        { text: "Keep offer", style: "cancel" },
        { text: "Decline", style: "destructive", onPress: perform },
      ]);
  };
  return (
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      <Muted>HATIDONE DRIVER</Muted>
      <Heading>Best jobs for you</Heading>
      <Muted>Know the route. Know your earnings.</Muted>
      <Feedback />
      <Card>
        <Row>
          <Chip
            label={
              active
                ? "Busy · trip in progress"
                : data?.driver?.online
                  ? "Available"
                  : "Offline"
            }
            selected={Boolean(data?.driver?.online)}
          />
          {data?.driver && <Chip label={data.driver.verification_status} />}
        </Row>
        <Button
          label={data?.driver?.online ? "Go offline" : "Go available"}
          onPress={() => void toggleAvailability()}
          loading={busy}
          disabled={
            !data?.driver || data.driver.verification_status !== "verified"
          }
        />
        <Button
          label="Update GPS"
          variant="secondary"
          onPress={() => void locate()}
        />
        {location && (
          <Muted>
            Current position: {location.latitude.toFixed(4)},{" "}
            {location.longitude.toFixed(4)}. Sharing only while this app is open
            and available.
          </Muted>
        )}
      </Card>
      <Row>
        {filters.map((value) => (
          <Chip
            key={value}
            label={value}
            selected={filter === value}
            onPress={() => setFilter(value)}
          />
        ))}
      </Row>
      {filter === "Going Home" && (
        <Card>
          <Heading>Trips going your way</Heading>
          <Muted>
            {data?.preferences.going_home_enabled
              ? `Towards ${data.preferences.home_address ?? "your saved destination"}.`
              : "Set your destination and departure time in Account."}
          </Muted>
          <Button
            label="Set Going Home"
            variant="secondary"
            onPress={() => router.push("/(tabs)/account")}
          />
        </Card>
      )}
      {filter === "Return rides" && (
        <Notice>
          Suggestions use your accepted outbound trip, a pickup buffer and
          return direction. Availability is verified again when you accept.
        </Notice>
      )}
      {!location && (filter === "Going Home" || filter === "Return rides") && (
        <Notice>
          Update GPS to calculate route compatibility. You can always review
          offers in Available.
        </Notice>
      )}
      {!loading && !offers.length && (
        <Empty
          title={
            filter === "Going Home" || filter === "Return rides"
              ? "No compatible offers yet"
              : "No available offers"
          }
        >
          {data?.driver?.verification_status !== "verified"
            ? "Complete driver verification in Account to receive offers."
            : "Stay available and pull down to refresh. Eligible offers appear here when dispatch finds a match."}
        </Empty>
      )}
      {offers.map((offer) => (
        <RideCard
          key={offer.id}
          ride={offer.ride}
          badge={
            scores.get(offer.ride.id)?.goingHome
              ? "Going your way"
              : scores.get(offer.ride.id)?.returnMatch
                ? "Return opportunity"
                : undefined
          }
        >
          <Muted>
            {offer.distance_meters === null
              ? ""
              : `Pickup approx. ${(offer.distance_meters / 1000).toFixed(1)} km away · `}
            Offer expires{" "}
            {new Date(offer.expires_at).toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Muted>
          {scores.get(offer.ride.id)?.reasons.map((reason) => (
            <Muted key={reason}>{reason}</Muted>
          ))}
          <Button
            label="Accept job"
            loading={busy}
            disabled={
              !data?.driver?.online ||
              Date.parse(offer.expires_at) <= Date.now()
            }
            onPress={() =>
              void run(
                "accept_ride_offer",
                { p_offer_id: offer.id },
                "Job accepted. Open Trips for pickup details.",
              ).then((ok) => {
                if (ok) router.push(`/trip/${offer.ride.id}`);
              })
            }
          />
          <Button
            label="Decline"
            variant="secondary"
            disabled={busy}
            onPress={() => decline(offer.id)}
          />
        </RideCard>
      ))}
    </Screen>
  );
}
