import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Heading,
  Muted,
  Card,
  Row,
  Chip,
  Button,
  Notice,
  StatusPill,
  theme,
} from "@hatidone/mobile";
import { useDriver } from "../../src/driver-context";
import { Feedback, RideCard, Empty } from "../../src/components";
import { suggestedJobs } from "../../src/matching";
import { label, statusTone } from "../../src/format";
import { ACTIVE_STATUSES } from "../../src/data";
const filters = [
  "Best for you",
  "Scheduled",
  "Going Home",
  "Return rides",
] as const;
type Filter = (typeof filters)[number];
export default function JobsScreen() {
  const { data, reload, loading, run, busy, location, locate } = useDriver();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<Filter>("Best for you");
  useEffect(() => { if (params.filter && filters.includes(params.filter as Filter)) setFilter(params.filter as Filter); }, [params.filter]);
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
    <Screen scrollKey={filter} refreshing={loading} onRefresh={() => void reload()}>
      <Muted>HATIDONE DRIVER</Muted>
      <Heading>Jobs</Heading>
      <Feedback />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: "600" }}>{active ? "Busy · on a trip" : data?.driver?.online ? "You’re available" : "You’re offline"}</Text>
            <Muted>{data?.driver?.online ? "Ready for eligible jobs nearby." : "Go available to accept a job."}</Muted>
          </View>
          <Switch accessibilityLabel="Available for jobs" value={Boolean(data?.driver?.online)} disabled={busy || !data?.driver || data.driver.verification_status !== "verified"} onValueChange={() => void toggleAvailability()} trackColor={{ true: theme.primary, false: theme.border }} />
        </View>
        {data?.driver?.verification_status !== "verified" && <StatusPill label={label(data?.driver?.verification_status ?? "Application needed")} tone={statusTone(data?.driver?.verification_status ?? "pending")} />}
        <Button label={data?.preferences.going_home_enabled ? `Going Home · ${data.preferences.home_address ?? "On"}` : "Going Home · find trips your way"} variant="secondary" onPress={() => router.push({ pathname: "/(tabs)/account", params: { section: "Going Home" } })} />
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
          <Heading size="section">Trips going your way</Heading>
          <Muted>
            {data?.preferences.going_home_enabled
              ? `Towards ${data.preferences.home_address ?? "your saved destination"}.`
              : "Choose where and when you want to head home."}
          </Muted>
          <Button
            label="Set Going Home"
            variant="secondary"
            onPress={() => router.push({ pathname: "/(tabs)/account", params: { section: "Going Home" } })}
          />
        </Card>
      )}
      {filter === "Return rides" && (
        <Notice>
          Find a ride near your outbound destination that fits your arrival time and return direction. Jobs are checked again when you accept.
        </Notice>
      )}
      {!location && (filter === "Going Home" || filter === "Return rides") && (
        <Card><Muted>Update your location to find compatible routes. You can still review all offers in Best for you.</Muted><Button label="Update GPS" variant="secondary" onPress={() => void locate()} /></Card>
      )}
      {!loading && !offers.length && (
        <Empty
          action={<Button label={data?.driver?.verification_status !== "verified" ? "Review your application" : "Refresh jobs"} variant="secondary" onPress={() => data?.driver?.verification_status !== "verified" ? router.push("/(tabs)/account") : void reload()} />}
          title={
            filter === "Going Home" || filter === "Return rides"
              ? "No compatible offers yet"
              : "No available jobs right now"
          }
        >
          {data?.driver?.verification_status !== "verified"
            ? "Complete driver verification in Account to receive offers."
            : "Stay available. Jobs appear here when a ride matches your vehicle and schedule."}
        </Empty>
      )}
      {!!offers.length && <Heading size="section">{filter === "Best for you" ? "Best jobs for you" : filter}</Heading>}
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
          {!data?.driver?.online && <Muted>Go available above to accept this job.</Muted>}
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
