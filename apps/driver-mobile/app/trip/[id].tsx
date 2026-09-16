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
  Row,
  Chip,
  RideChat,
  StatusPill,
  theme,
  Notice,
} from "@hatidone/mobile";
import { canTransitionRide, type RideRequestStatus } from "@hatidone/types";
import { useDriver } from "../../src/driver-context";
import { Feedback, RideCard, RideRoute, Empty } from "../../src/components";
import { CashCollection } from "../../src/CashCollection";
import { label, schedule, statusTone } from "../../src/format";
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
  const { data, loading, reload, busy, run, locate, stale } = useDriver();
  const [pin, setPin] = useState("");
  const [section, setSection] = useState("Trip");
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
  const primaryAction = ride && advance && canTransitionRide(ride.status, advance.target) ? (
    <Button label={advance.label} loading={busy}
      disabled={stale || (ride.status === "assigned" && !assignment?.confirmed_at) || (ride.status === "driver_arrived" && !/^\d{6}$/.test(pin))}
      onPress={() => advance.action === "complete" ? confirm("complete", "Complete this trip?", "Confirm that you have reached the destination and the passenger has safely exited.") : void action(advance.action)} />
  ) : null;
  return (
    <Screen bottomInset scrollKey={section} refreshing={loading} onRefresh={() => void reload()} footer={section === "Trip" ? primaryAction : undefined}>
      <Feedback />
      {!ride ? !loading && <Empty title="Trip unavailable" action={<Button label="Back to Trips" variant="secondary" onPress={() => router.replace("/(tabs)/trips")} />}>Refresh to try again. Only trips assigned to your driver account can be opened.</Empty> : <>
        {ride.status === "assigned" && !assignment?.confirmed_at && <Notice>Reconfirm this scheduled pickup before heading to the passenger.</Notice>}
        <StatusPill label={label(ride.status)} tone={statusTone(ride.status)} />
        <Heading>{ride.status === "trip_completed" ? "Trip completed" : "Your trip"}</Heading>
        <Row>{["Trip", "Details", "Messages", "Help"].map((value) => <Chip key={value} label={value} selected={section === value} onPress={() => setSection(value)} />)}</Row>
        {section === "Trip" && <>
          <Card>
            <Muted>{schedule(ride.scheduled_at)}</Muted>
            <RideRoute ride={ride} />
            {ride.status === "driver_arrived" && <>
              <Field label="Passenger pickup PIN" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="6 digits" />
              <Muted>Ask the passenger for the PIN in their booking before starting the trip.</Muted>
            </>}
            {ride.status === "assigned" && (assignment?.confirmed_at ? <Muted>Pickup confirmed.</Muted> : <Button label="Confirm scheduled pickup" variant="secondary" loading={busy} onPress={() => void run("confirm_ride_assignment", { p_ride_request_id: id }, "Pickup confirmed.")} />)}
            {ride.status === "trip_completed" && <CashCollection rideId={id} />}
            {ride.status === "trip_completed" && <Button label="View earnings" onPress={() => router.replace("/(tabs)/earnings")} />}
          </Card>
          <Card>
            <Heading size="section">Trip progress</Heading>
            {stages.map((stage, index) => <Text key={stage} accessibilityLabel={`${index + 1}. ${label(stage)}${stage === ride.status ? ", current step" : ""}`} style={{ color: stage === ride.status ? theme.text : theme.muted, fontWeight: stage === ride.status ? "600" : "400", fontSize: 15, lineHeight: 24 }}>{index + 1}. {label(stage)}{stage === ride.status ? " · Now" : ""}</Text>)}
          </Card>
          <Button label="Message passenger" variant="secondary" onPress={() => setSection("Messages")} />
        </>}
        {section === "Details" && <>
          <RideCard ride={ride} />
          <Card><Heading size="section">Navigation and location</Heading><Muted>Use your preferred navigation app or agreed route. Distance and travel time are estimates.</Muted><Button label="Update GPS" variant="secondary" onPress={() => void locate()} /></Card>
          <Muted>Operations manages backup driver readiness.</Muted>
        </>}
        {section === "Messages" && <RideChat rideRequestId={id} />}
        {section === "Help" && <>
          <Card><Heading size="section">Stay safe</Heading><Muted>For an immediate emergency, use your phone’s emergency calling feature. Stop somewhere safe before using trip controls or messaging.</Muted></Card>
          {canTransitionRide(ride.status, "no_show") && <Card><Heading size="section">Passenger not here?</Heading><Muted>Contact the passenger first. Allow the required pickup waiting time before reporting a no-show.</Muted><Button label="Report passenger no-show" variant="secondary" disabled={busy} onPress={() => confirm("no_show", "Report passenger no-show?", "Contact the passenger and allow the required pickup waiting time before reporting. Operations can review this event.")} /></Card>}
          {canTransitionRide(ride.status, "driver_cancelled") && <Card><Heading size="section">Unable to make this trip?</Heading><Muted>The passenger and operations will be notified if you cancel.</Muted><Button label="Cancel trip" variant="danger" disabled={busy} onPress={() => confirm("cancel", "Cancel this trip?", "The passenger and operations will see the cancellation. This action is recorded.")} /></Card>}
        </>}
        <Button label="Back to Trips" variant="secondary" onPress={() => router.replace("/(tabs)/trips")} />
      </>}
    </Screen>
  );
}
