import { useEffect, useState } from "react";
import { Share, Text } from "react-native";
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
  dateTime,
  money,
  useAuth,
  useResource,
} from "@hatidone/mobile";
import { getBooking, statusLabel, terminalStatuses } from "../../src/data";
interface Driver {
  driver_id: string;
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
  const [report, setReport] = useState(false);
  const [category, setCategory] = useState("safety");
  const [details, setDetails] = useState("");
  const [success, setSuccess] = useState("");
  const resource = useResource(async () => {
    const booking = await getBooking(client, id);
    if (!client) throw new Error("Sign in first.");
    const [driver, events, reads, messages] = await Promise.all([
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
    ]);
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
      .subscribe();
    const timer = setInterval(() => void reload(), 15000);
    return () => {
      clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [client, id, reload]);
  async function cancel() {
    if (!client) return;
    setBusy(true);
    setError("");
    const result = await client.rpc("cancel_own_ride_request", {
      p_ride_request_id: id,
    });
    if (result.error) setError(result.error.message);
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
    if (result.error) setError(result.error.message);
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
        reason instanceof Error ? reason.message : "Could not open sharing.",
      );
    }
  }
  const data = resource.data;
  return (
    <Screen refreshing={resource.loading} onRefresh={() => void reload()}>
      <Button
        label="Back to bookings"
        variant="secondary"
        onPress={() => router.replace("/(tabs)/bookings")}
      />
      {resource.loading && !data && <Muted>Loading your booking…</Muted>}
      {(resource.error || error) && (
        <Notice tone="error">{error || resource.error}</Notice>
      )}
      {success && <Notice tone="success">{success}</Notice>}
      {data && (
        <>
          <Chip label={statusLabel(data.booking.status)} selected />
          <Heading>{data.booking.pickup_address}</Heading>
          <Muted>to</Muted>
          <Heading>{data.booking.dropoff_address}</Heading>
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
            <Muted>
              Local route estimate ·{" "}
              {(data.booking.estimated_distance_meters / 1000).toFixed(1)} km ·{" "}
              {Math.ceil(data.booking.estimated_duration_seconds / 60)} min.
              Road distance and traffic may differ.
            </Muted>
            <Muted>Cash payment · No payment is collected in this app.</Muted>
            {data.booking.passenger_notes && (
              <Text>{data.booking.passenger_notes}</Text>
            )}
          </Card>
          {data.driver ? (
            <Card>
              <Heading>Your driver</Heading>
              <Text style={{ fontSize: 20 }}>{data.driver.name}</Text>
              <Chip
                label={
                  data.driver.verification_status === "verified"
                    ? "Verified driver"
                    : `Verification: ${data.driver.verification_status}`
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
                  : "New to the network · not enough trips for a rating"}
              </Muted>
              {data.pin && (
                <Notice>
                  Pickup PIN: {data.pin}
                  {"\n"}Share this PIN with your driver only when you are at the
                  vehicle and ready to start.
                </Notice>
              )}
              <Button
                label={
                  showChat
                    ? "Hide conversation"
                    : `Message driver${data.unread ? ` · ${data.unread} unread` : ""}`
                }
                variant="secondary"
                onPress={() => {
                  setShowChat(!showChat);
                  if (showChat) void reload();
                }}
              />
            </Card>
          ) : (
            !terminalStatuses.has(data.booking.status) && (
              <Notice>
                We’re finding a driver. Keep this booking open for updates, or
                check Activity later.
              </Notice>
            )
          )}
          {showChat && data.driver && <RideChat rideRequestId={id} />}
          <Card>
            <Heading>Booking timeline</Heading>
            {data.events.map((event) => (
              <Row key={event.id}>
                <Chip label={statusLabel(event.to_status)} />
                <Muted>{dateTime(event.created_at)}</Muted>
              </Row>
            ))}
          </Card>
          <Button
            label="Share trip summary"
            variant="secondary"
            onPress={() => void share()}
          />
          <Muted>
            Share your pickup, destination and schedule with a trusted contact.
            The booking link requires authorization and does not provide public tracking.
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
                <Heading>Cancel this booking?</Heading>
                <Muted>
                  Your driver assignment and pending offers will be cancelled by
                  the server.
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
              <Heading>Tell us what happened</Heading>
              <Muted>
                Reports are private to authorized operations staff. For urgent
                danger, contact local emergency services directly.
              </Muted>
              <Row>
                {["safety", "driver", "vehicle", "payment", "other"].map(
                  (value) => (
                    <Chip
                      key={value}
                      label={value}
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
