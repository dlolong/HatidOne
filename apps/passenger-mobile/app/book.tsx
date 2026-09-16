import { parseManilaSchedule } from "@hatidone/core";
import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card, Chip, Field, Heading, Muted, Notice, Row, Screen, useAuth, pendingOperation, clearOperation, readOperation } from "@hatidone/mobile";
import { getBooking } from "../src/data";

function manilaDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
export default function Book() {
  const { client, session } = useAuth();
  const params = useLocalSearchParams<{ rebook?: string; pickup?: string; destination?: string }>();
  const [pickup, setPickup] = useState(params.pickup ?? "");
  const [destination, setDestination] = useState(params.destination ?? "");
  const [date, setDate] = useState(manilaDate(new Date(Date.now() + 86400000)));
  const [time, setTime] = useState("09:00");
  const [vehicle, setVehicle] = useState("sedan");
  const [count, setCount] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    let live = true;
    if (session) void readOperation(session.user.id, "booking").then((operation) => {
      if (live && operation) setPending(operation.id);
    }).catch(() => { if (live) setError("Saved request could not be read. Check your booking history before submitting."); });
    if (params.rebook && client) void getBooking(client, params.rebook).then((booking) => {
      if (!live) return;
      setPickup(booking.pickup_address); setDestination(booking.dropoff_address);
      setVehicle(booking.vehicle_type); setCount(String(booking.passenger_count)); setNotes(booking.passenger_notes ?? "");
    }).catch(() => { if (live) setError("This route could not be loaded. Enter your addresses."); });
    return () => { live = false; };
  }, [client, session, params.rebook]);
  async function submit(recover = false) {
    if (!client || !session || submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      let payload: Record<string, unknown>;
      if (recover) {
        const operation = await readOperation(session.user.id, "booking");
        if (!operation) throw new Error("No saved request found. Refresh your bookings.");
        // Query first: a successful booking may exist even when its response was lost.
        const existing = await client.from("ride_requests").select("id").eq("passenger_id", session.user.id).eq("client_request_id", operation.id).maybeSingle();
        if (existing.error) throw new Error("Could not check the previous request. Reconnect and try again.");
        if (existing.data) { await clearOperation(session.user.id, "booking"); router.replace(`/booking/${existing.data.id}`); return; }
        payload = JSON.parse(operation.signature) as Record<string, unknown>;
      } else {
        if (!pickup.trim() || !destination.trim()) throw new Error("Enter both addresses and meeting landmarks.");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Use YYYY-MM-DD and 24-hour HH:MM in Manila time.");
        const scheduled = parseManilaSchedule(`${date}T${time}`);
        if (!scheduled || scheduled.getTime() < Date.now() + 30 * 60000 || scheduled.getTime() > Date.now() + 180 * 86400000) throw new Error("Choose a valid date, at least 30 minutes ahead and within 180 days.");
        const capacity: Record<string, number> = { motorcycle: 1, sedan: 4, suv: 6, van: 12 };
        if (!Number.isInteger(Number(count)) || Number(count) < 1 || Number(count) > capacity[vehicle]) throw new Error(`Choose 1–${capacity[vehicle]} passengers.`);
        payload = { pickup_address: pickup.trim(), dropoff_address: destination.trim(), scheduled_at: scheduled.toISOString(), vehicle_type: vehicle, passenger_count: Number(count), service_type: "scheduled", passenger_notes: notes.trim() || null, route_preference: "fastest" };
      }
      const operationId = await pendingOperation(session.user.id, "booking", payload);
      setPending(operationId);
      const result = await client.rpc("create_transport_request", { p_payload: { ...payload, client_request_id: operationId } });
      if (result.error && result.error.code === "P0001") {
        await clearOperation(session.user.id, "booking"); setPending(null);
        throw new Error("Request rejected. Check the schedule, passenger count and service availability with operations before trying again.");
      }
      if (result.error) throw new Error("Request outcome is unresolved. Use Check previous request to reconcile safely. If it was rejected, operations can help review the details.");
      await clearOperation(session.user.id, "booking");
      router.replace(`/booking/${String(result.data)}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit. Check your bookings before retrying."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Screen bottomInset footer={<Button label={pending ? "Check previous request" : "Request operator review"} loading={busy} onPress={() => void submit(!!pending)} />}>
    <Button label="Back" variant="secondary" onPress={() => router.back()} />
    <Heading>Schedule your ride</Heading>
    <Notice>Operations reviews your addresses, route and fare. A request is not a confirmed ride. Accept the written quote before driver assignment.</Notice>
    {pending && <Notice>Your previous request may have reached the server. Check it before making another request. This uses the same request reference.</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <Card>
      <Field label="Pickup address and landmark" value={pickup} onChangeText={setPickup} maxLength={240} editable={!pending} />
      <Field label="Destination address and landmark" value={destination} onChangeText={setDestination} maxLength={240} editable={!pending} />
      <Muted>Addresses are not automatically map-validated. Operations must verify the meeting points and route; no precise travel time is promised.</Muted>
    </Card>
    <Card>
      <Field label="Date · Asia/Manila (YYYY-MM-DD)" value={date} onChangeText={setDate} maxLength={10} editable={!pending} />
      <Field label="Time · Asia/Manila (HH:MM, 24 hour)" value={time} onChangeText={setTime} maxLength={5} editable={!pending} />
      <Row>{["motorcycle", "sedan", "suv", "van"].map(value => <Chip key={value} label={value.toUpperCase()} selected={vehicle === value} onPress={() => { if (!pending) setVehicle(value); }} />)}</Row>
      <Field label="Passengers" value={count} onChangeText={setCount} keyboardType="number-pad" editable={!pending} />
      <Field label="Pickup instructions and trip notes" value={notes} onChangeText={setNotes} multiline maxLength={500} editable={!pending} />
    </Card>
    <Card><Heading size="section">Fare awaiting review</Heading><Muted>No charge or price acceptance occurs when you submit. Review the amount and breakdown in Bookings when operations provides a quote. Cash collection is recorded separately after the trip.</Muted></Card>
    <Muted>Keep the app open or refresh Bookings for updates. Human confirmation is required; closed-app notifications are not verified.</Muted>
  </Screen>;
}
