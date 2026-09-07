import { useState } from "react";
import { Alert, Platform, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Screen,
  Heading,
  Muted,
  Card,
  Button,
  Field,
  Notice,
  Row,
  Chip,
  RideChat,
} from "@hatidone/mobile";
import { canTransitionRide, type RideRequestStatus } from "@hatidone/types";
import { useDriver } from "../../src/driver-context";
import { Feedback, RideCard, Empty } from "../../src/components";
import { label } from "../../src/format";
const next: Partial<
  Record<
    RideRequestStatus,
    { action: string; target: RideRequestStatus; label: string }
  >
> = {
  assigned: {
    action: "heading",
    target: "driver_en_route",
    label: "Start heading to pickup",
  },
  driver_en_route: {
    action: "arrived",
    target: "driver_arrived",
    label: "I have arrived",
  },
  driver_arrived: {
    action: "start",
    target: "trip_started",
    label: "Validate PIN and start trip",
  },
  trip_started: {
    action: "complete",
    target: "trip_completed",
    label: "Complete trip",
  },
};
const stages = [
  "assigned",
  "driver_en_route",
  "driver_arrived",
  "trip_started",
  "trip_completed",
];
export default function TripScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, reload, busy, run, locate } = useDriver();
  const [pin, setPin] = useState("");
  const assignment = data?.assignments.find((item) => item.ride.id === id);
  const ride = assignment?.ride;
  const advance = next[ride?.status ?? "draft"];
  const action = async (name: string) => {
    const ok = await run(
      "advance_trip",
      {
        p_ride_request_id: id,
        p_action: name,
        ...(name === "start" ? { p_pin: pin } : {}),
      },
      name === "start" ? "PIN verified. Trip started." : "Trip updated.",
      name === "start" ? "trip_started" : undefined,
    );
    if (ok) setPin("");
  };
  const confirm = (name: string, title: string, message: string) => {
    const perform = () => void action(name);
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) perform();
    } else
      Alert.alert(title, message, [
        { text: "Keep trip", style: "cancel" },
        { text: "Confirm", style: "destructive", onPress: perform },
      ]);
  };
  return (
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      <Button label="Back to Trips" variant="secondary" onPress={() => router.replace("/(tabs)/trips")} />
      <Feedback />
      {!ride ? (
        <Empty title={loading ? "Loading trip…" : "Trip unavailable"}>
          Pull to refresh. Only trips assigned to your driver account can be
          opened.
        </Empty>
      ) : (
        <>
          <Heading>{label(ride.status)}</Heading>
          <RideCard ride={ride} />
          <Card>
            <Heading>Pickup plan</Heading>
            <Muted>Pickup: {ride.pickup_address}</Muted>
            <Muted>Destination: {ride.dropoff_address}</Muted>
            <Muted>
              Use your preferred navigation app or follow your agreed route.
              Distances and times here are estimates.
            </Muted>
            <Button
              label="Update GPS"
              variant="secondary"
              onPress={() => void locate()}
            />
          </Card>
          <Card>
            <Heading>Trip progress</Heading>
            <Row>
              {stages.map((stage, index) => (
                <Chip
                  key={stage}
                  label={`${index + 1}. ${label(stage)}`}
                  selected={stage === ride.status}
                />
              ))}
            </Row>
            {assignment?.confirmed_at ? (
              <Notice tone="success">
                Pickup confirmed{" "}
                {new Date(assignment.confirmed_at).toLocaleString("en-PH")}.
              </Notice>
            ) : (
              ride.status === "assigned" && (
                <Button
                  label="Confirm scheduled pickup"
                  loading={busy}
                  onPress={() =>
                    void run(
                      "confirm_ride_assignment",
                      { p_ride_request_id: id },
                      "Pickup confirmed.",
                    )
                  }
                />
              )
            )}
            <Muted>
              Primary driver assignment. Operations manages backup readiness.
            </Muted>
            {ride.status === "driver_arrived" && (
              <>
                <Field
                  label="Passenger pickup PIN (6 digits)"
                  value={pin}
                  onChangeText={(value) =>
                    setPin(value.replace(/\D/g, "").slice(0, 6))
                  }
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  placeholder="Ask the passenger for their PIN"
                />
                <Muted>
                  The passenger can find the PIN in their booking. The server
                  checks it before the trip starts.
                </Muted>
              </>
            )}
            {advance && canTransitionRide(ride.status, advance.target) && (
              <Button
                label={advance.label}
                loading={busy}
                disabled={
                  ride.status === "driver_arrived" && !/^\d{6}$/.test(pin)
                }
                onPress={() =>
                  advance.action === "complete"
                    ? confirm(
                        "complete",
                        "Complete this trip?",
                        "Confirm that you have reached the destination and the passenger has safely exited.",
                      )
                    : void action(advance.action)
                }
              />
            )}{" "}
            {canTransitionRide(ride.status, "driver_cancelled") && (
              <Button
                label="Cancel trip"
                variant="danger"
                disabled={busy}
                onPress={() =>
                  confirm(
                    "cancel",
                    "Cancel this trip?",
                    "The passenger and operations will see the cancellation. This action is recorded.",
                  )
                }
              />
            )}{" "}
            {canTransitionRide(ride.status, "no_show") && (
              <Button
                label="Report passenger no-show"
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  confirm(
                    "no_show",
                    "Report passenger no-show?",
                    "Contact the passenger and allow the required pickup waiting time before reporting. Operations can review this event.",
                  )
                }
              />
            )}
          </Card>
          <RideChat rideRequestId={id} />
          <Card>
            <Heading>Safety</Heading>
            <Text style={{ fontSize: 16, lineHeight: 24 }}>
              For an immediate emergency, use your phone’s emergency calling
              feature. Stop somewhere safe before using trip controls or
              messaging.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}
