import { useEffect, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ACTIVE_RIDE_TRANSITIONS } from "@hatidone/types";
import {
  Button,
  Card,
  Chip,
  Field,
  Heading,
  Muted,
  Notice,
  RideChat,
  Row,
  Screen,
  StatusPill,
  LoadingSkeleton,
  userError,
  theme,
  dateTime,
  money,
  useAuth,
  useResource,
} from "@hatidone/mobile";
import { bookingTone, RouteSummary } from "../../src/components";
import { getBooking, statusLabel, terminalStatuses } from "../../src/data";
interface Driver {
  driver_id: string;
  confirmed_at: string | null;
  name: string;
  verification_status: string;
  rating: number;
  rating_count: number;
  vehicle_type: string;
  brand: string;
  model: string;
  color: string;
  plate_number: string;
  capacity: number;
}
interface RideEvent {
  id: number;
  to_status: string;
  created_at: string;
}
export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client, session } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [report, setReport] = useState(false);
  const [category, setCategory] = useState("safety");
  const [details, setDetails] = useState("");
  const [success, setSuccess] = useState("");
  const resource = useResource(async () => {
    const booking = await getBooking(client, id);
    if (!client) throw new Error("Sign in first.");
    const [driver, events, reads, messages, quotes, collections] = await Promise.all([
      client.rpc("get_assigned_driver", { p_ride_request_id: id }),
      client
        .from("ride_request_events")
        .select("id,to_status,created_at")
        .eq("ride_request_id", id)
        .order("created_at"),
      client
        .from("ride_message_reads")
        .select("last_read_at")
        .eq("ride_request_id", id)
        .eq("user_id", session!.user.id)
        .maybeSingle(),
      client
        .from("ride_messages")
        .select("id,created_at,sender_user_id")
        .eq("ride_request_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      client.from("ride_quotes").select("version,amount,currency,breakdown,reason,created_at").eq("ride_request_id", id).eq("version", booking.quote_version).maybeSingle(),
      client.from("cash_collection_events").select("id,kind,amount,currency,note,created_at").eq("ride_request_id", id).order("created_at"),
    ]);
    if (quotes.error) throw new Error(quotes.error.message);
    if (collections.error) throw new Error(collections.error.message);
    if (events.error) throw new Error(events.error.message);
    if (driver.error) throw new Error(driver.error.message);
    if (reads.error) throw new Error(reads.error.message);
    if (messages.error) throw new Error(messages.error.message);
    const unread = messages.data.filter(
      (message) =>
        message.sender_user_id !== session?.user.id &&
        (!reads.data?.last_read_at ||
          message.created_at > reads.data.last_read_at),
    ).length;
    let pin: string | null = null;
    if (
      ["assigned", "driver_en_route", "driver_arrived"].includes(booking.status)
    ) {
      const result = await client.rpc("get_passenger_trip_pin", {
        p_ride_request_id: id,
      });
      if (result.error) throw new Error(result.error.message);
      pin = result.data;
    }
    return {
      booking,
      quote: quotes.data,
      collections: collections.data ?? [],
      driver: driver.data as Driver | null,
      events: events.data as RideEvent[],
      unread,
      pin,
    };
  }, [client, id, session?.user.id]);
  const { reload } = resource;
  useEffect(() => {
    if (!client) return;
    const channel = client
      .channel(`passenger-trip:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
          filter: `id=eq.${id}`,
        },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ride_messages",
          filter: `ride_request_id=eq.${id}`,
        },
        () => void reload(),
      )
      .subscribe((status) => { if (status === "SUBSCRIBED") void reload(); });
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, id, reload]);
  async function acceptQuote() {
    if (!client || !resource.data || busy) return;
    setBusy(true); setError("");
    try {
      const result = await client.rpc("accept_ride_quote", { p_ride_request_id: id, p_version: resource.data.booking.quote_version });
      if (result.error) throw result.error;
      setSuccess("Quote accepted. Driver assignment and reconfirmation are still required.");
    } catch { setError("Quote acceptance could not be confirmed. Refresh to see whether it was accepted before trying again."); }
    finally { await reload(); setBusy(false); }
  }
  async function cancel() {
    if (!client) return;
    setBusy(true);
    setError("");
    const result = await client.rpc("cancel_own_ride_request", {
      p_ride_request_id: id,
    });
    if (result.error)
      setError(
        userError(
          result.error,
          "We couldn’t complete this request. Refresh your booking and try again.",
        ),
      );
    else {
      setConfirmCancel(false);
      setSuccess("Booking cancelled.");
      await reload();
    }
    setBusy(false);
  }
  async function submitReport() {
    if (!client) return;
    setBusy(true);
    setError("");
    const result = await client.rpc("report_ride_safety", {
      p_ride_request_id: id,
      p_category: category,
      p_details: details.trim(),
    });
    if (result.error)
      setError(
        userError(
          result.error,
          "We couldn’t complete this request. Refresh your booking and try again.",
        ),
      );
    else {
      setReport(false);
      setDetails("");
      setSuccess(
        "Your report was saved for the operations team. This is not an emergency dispatch service.",
      );
    }
    setBusy(false);
  }
  async function share() {
    try {
      const booking = resource.data?.booking;
      if (!booking) return;
      await Share.share({
        message: `My HatidOne trip: ${booking.pickup_address} → ${booking.dropoff_address}.\nPickup: ${dateTime(booking.scheduled_at)}. Status: ${statusLabel(booking.status)}.\nBooking reference: ${id.slice(0, 8)}. Private trip link: hatidone-passenger://booking/${id}\nSign-in and booking authorization are required to open this link. No live location or passenger PIN is included.`,
      });
    } catch (reason) {
      setError(
        userError(reason, "We couldn’t open sharing. Please try again."),
      );
    }
  }
  const data = resource.data;
  const stages = [
    "requested",
    "searching",
    "assigned",
    "driver_en_route",
    "driver_arrived",
    "trip_started",
    "trip_completed",
  ];
  const currentStage = stages.indexOf(
    data?.booking.status === "offered"
      ? "searching"
      : (data?.booking.status ?? "requested"),
  );
  return (
    <Screen
      bottomInset
      refreshing={resource.loading}
      onRefresh={() => void reload()}
    >
      <Button
        label="Back to bookings"
        variant="secondary"
        onPress={() => router.replace("/(tabs)/bookings")}
      />
      {resource.loading && !data && <LoadingSkeleton lines={6} />}
      {(resource.error || error) && (
        <Notice tone="error">
          {error ||
            "We couldn’t load this booking. Check your connection and try again."}
        </Notice>
      )}
      {resource.error && (
        <Button label="Retry booking" onPress={() => void reload()} />
      )}
      {success && <Notice tone="success">{success}</Notice>}
      {data && (
        <>
          {resource.stale && <Notice>Updates unavailable. Showing saved details; refresh before taking an action.</Notice>}
          <Card>
            <Heading size="section">{data.booking.quote_status === "accepted" ? "Agreed fare" : data.booking.quote_status === "offered" ? "Review your quote" : "Fare awaiting operator review"}</Heading>
            {data.quote ? <>
              <Text>{money(Number(data.quote.amount))} {data.quote.currency} · Version {data.quote.version}</Text>
              <Muted>{data.quote.reason}</Muted>
              {Object.entries(data.quote.breakdown as Record<string, unknown>).map(([key, value]) => <Text key={key}>{key.replaceAll("_", " ")}: {typeof value === "object" ? JSON.stringify(value) : String(value)}</Text>)}
              {data.booking.quote_status === "offered" && <Button label="Accept this quote" loading={busy} disabled={resource.stale || terminalStatuses.has(data.booking.status)} onPress={() => void acceptQuote()} />}
            </> : <Muted>Operations must validate the route and supply a quote. No fare or precise arrival time is confirmed.</Muted>}
            <Muted>Quote acceptance, driver confirmation and cash collection are separate steps.</Muted>
          </Card>
          <StatusPill
            label={statusLabel(data.booking.status)}
            tone={bookingTone(data.booking.status)}
          />
          <RouteSummary
            pickup={data.booking.pickup_address}
            destination={data.booking.dropoff_address}
          />
          <Muted>{dateTime(data.booking.scheduled_at)}</Muted>
          {data.driver ? (
            <Card>
              <View style={styles.driverHeader}>
                <View style={styles.avatar} accessible={false}>
                  <Text style={styles.initials}>
                    {data.driver.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Muted>{data.driver.confirmed_at ? "Driver reconfirmed pickup" : "Assigned · awaiting driver reconfirmation"}</Muted>
                  <Heading size="section">{data.driver.name}</Heading>
                </View>
              </View>
              <StatusPill
                tone={
                  data.driver.verification_status === "verified"
                    ? "success"
                    : "warning"
                }
                label={
                  data.driver.verification_status === "verified"
                    ? "Verified driver"
                    : "Verification in progress"
                }
              />
              <Text>
                {data.driver.color} {data.driver.brand} {data.driver.model} ·{" "}
                {data.driver.vehicle_type}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: "600" }}>
                {data.driver.plate_number}
              </Text>
              <Muted>
                {data.driver.rating_count > 0
                  ? `${Number(data.driver.rating).toFixed(1)} rating · ${data.driver.rating_count} reviews`
                  : "New to HatidOne · No rating yet"}
              </Muted>
              {data.pin && (
                <View style={styles.pin}>
                  <Muted>Your pickup PIN</Muted>
                  <Text
                    accessibilityLabel={`Pickup PIN ${data.pin.split("").join(" ")}`}
                    style={styles.pinText}
                  >
                    {data.pin}
                  </Text>
                  <Muted>
                    Share only when you’re at the vehicle and ready to start.
                  </Muted>
                </View>
              )}
              <Button
                label={
                  showChat
                    ? "Hide conversation"
                    : `Message driver${data.unread ? ` · ${data.unread} unread` : ""}`
                }
                onPress={() => {
                  setShowChat(!showChat);
                  if (showChat) void reload();
                }}
              />
            </Card>
          ) : (
            !terminalStatuses.has(data.booking.status) && (
              <Notice>
                Operations will arrange a driver after your quote is accepted. Refresh here for assignment and reconfirmation updates.
              </Notice>
            )
          )}
          {showChat && data.driver && <RideChat rideRequestId={id} />}
          <Card>
            <Heading size="section">Ride progress</Heading>
            {currentStage >= 0 && (
              <View
                style={styles.progress}
                accessibilityLabel={`Ride progress: ${statusLabel(data.booking.status)}`}
              >
                {stages.map((stage, index) => (
                  <View
                    key={stage}
                    style={[
                      styles.segment,
                      index === currentStage && {
                        backgroundColor: theme.primary,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
            <Text style={styles.body}>{statusLabel(data.booking.status)}</Text>
            {currentStage >= 0 && currentStage < 6 && (
              <Muted>Next: {statusLabel(stages[currentStage + 1])}</Muted>
            )}
            <Button
              label={showTimeline ? "Hide timeline" : "View timeline"}
              variant="secondary"
              onPress={() => setShowTimeline(!showTimeline)}
            />
            {showTimeline &&
              stages.map((stage, index) => {
                const event = data.events.find(
                  (item) =>
                    item.to_status === stage ||
                    (stage === "searching" && item.to_status === "offered"),
                );
                return (
                  <View key={stage} style={styles.timelineRow}>
                    <View
                      style={[
                        styles.timelineDot,
                        index === currentStage && {
                          backgroundColor: theme.primary,
                        },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.body,
                          index === currentStage && { fontWeight: "600" },
                        ]}
                      >
                        {statusLabel(stage)}
                        {index === currentStage ? " · Current" : ""}
                      </Text>
                      <Muted>{event ? dateTime(event.created_at) : "—"}</Muted>
                    </View>
                  </View>
                );
              })}
            {showTimeline &&
              currentStage < 0 &&
              data.events
                .filter((event) => !stages.includes(event.to_status))
                .map((event) => (
                  <Muted key={event.id}>
                    {statusLabel(event.to_status)} ·{" "}
                    {dateTime(event.created_at)}
                  </Muted>
                ))}
          </Card>
          <Button
            label={
              showDetails ? "Hide fare & ride details" : "Fare & ride details"
            }
            variant="secondary"
            onPress={() => setShowDetails(!showDetails)}
          />
          {showDetails && (
            <>
              <Card>
                <Muted>{dateTime(data.booking.scheduled_at)}</Muted>
                <Text>
                  {data.booking.passenger_count} passenger(s) ·{" "}
                  {data.booking.vehicle_type} · {data.booking.service_type}
                </Text>
                <Text>
                  Ride fare estimate: {money(data.booking.estimated_fare)}
                </Text>
                <Text>
                  Toll estimate:{" "}
                  {data.booking.estimated_toll_amount === null
                    ? "Unknown; confirm with driver"
                    : money(data.booking.estimated_toll_amount)}
                </Text>
                <Muted>Route reviewed manually. Map validation and live traffic ETA are unavailable.</Muted>
                <Muted>Cash collection is recorded separately; completing a trip does not mark it paid.</Muted>
                {data.booking.passenger_notes && (
                  <Text>{data.booking.passenger_notes}</Text>
                )}
              </Card>
            </>
          )}
          {data.booking.status === "trip_completed" && <Card>
            <Heading size="section">Cash collection history</Heading>
            {!data.collections.length && <Muted>No cash collection recorded. Trip completion does not mean payment was received.</Muted>}
            {data.collections.map(event => <Muted key={event.id}>{event.kind === "reported" ? "Driver reported cash · awaiting reconciliation" : event.kind === "reconciled" ? "Operations reconciled cash" : "Cash disputed"}: {money(Number(event.amount))} {event.currency} · {dateTime(event.created_at)}</Muted>)}
          </Card>}
          <Button
            label="Share trip summary"
            variant="secondary"
            onPress={() => void share()}
          />
          <Muted>
            Share your pickup, destination and schedule with a trusted contact.
            The booking link requires authorization and does not provide public
            tracking.
          </Muted>
          {data.booking.status === "trip_completed" && (
            <Button
              label="Book this route again"
              onPress={() =>
                router.push({ pathname: "/book", params: { rebook: id } })
              }
            />
          )}
          {ACTIVE_RIDE_TRANSITIONS[data.booking.status].includes(
            "passenger_cancelled",
          ) &&
            (confirmCancel ? (
              <Card>
                <Heading size="section">Cancel this booking?</Heading>
                <Muted>
                  {data.driver ? 'Your driver assignment will be released. ' : 'Your ride request will be cancelled. '}
                  You can book another ride whenever you’re ready.
                </Muted>
                <Button
                  label="Confirm cancellation"
                  variant="danger"
                  loading={busy}
                  onPress={() => void cancel()}
                />
                <Button
                  label="Keep my booking"
                  variant="secondary"
                  onPress={() => setConfirmCancel(false)}
                />
              </Card>
            ) : (
              <Button
                label="Cancel booking"
                variant="secondary"
                onPress={() => setConfirmCancel(true)}
              />
            ))}
          <Button
            label={report ? "Close report form" : "Report a trip concern"}
            variant="secondary"
            onPress={() => setReport(!report)}
          />
          {report && (
            <Card>
              <Heading size="section">Tell us what happened</Heading>
              <Muted>
                Reports are private to authorized operations staff. For urgent
                danger, contact local emergency services directly.
              </Muted>
              <Row>
                {["safety", "driver", "vehicle", "payment", "other"].map(
                  (value) => (
                    <Chip
                      key={value}
                      label={value[0].toUpperCase() + value.slice(1)}
                      selected={category === value}
                      onPress={() => setCategory(value)}
                    />
                  ),
                )}
              </Row>
              <Field
                label="Details"
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={2000}
              />
              <Button
                label="Submit report"
                loading={busy}
                disabled={details.trim().length < 10}
                onPress={() => void submitReport()}
              />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  driverHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.background,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontSize: 19, fontWeight: "500", color: theme.text },
  pin: {
    padding: 14,
    backgroundColor: theme.background,
    borderRadius: 10,
    gap: 5,
  },
  pinText: {
    fontSize: 32,
    letterSpacing: 6,
    fontWeight: "600",
    color: theme.text,
  },
  progress: { flexDirection: "row", gap: 5 },
  segment: {
    height: 5,
    borderRadius: 3,
    flex: 1,
    backgroundColor: theme.border,
  },
  timelineRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: theme.border,
  },
  body: { fontSize: 16, lineHeight: 23, color: theme.text },
});
