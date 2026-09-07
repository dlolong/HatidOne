import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  LocalRouteProvider,
  type RouteEstimate,
  type RoutePreference,
  type ServiceLocation,
} from "@hatidone/core";
import {
  Button,
  Card,
  Chip,
  Field,
  Heading,
  Muted,
  Notice,
  Row,
  Screen,
  dateTime,
  money,
  useAuth,
} from "@hatidone/mobile";
import { getBooking } from "../src/data";
import { LocationField } from "../src/LocationField";
const provider = new LocalRouteProvider();
interface FareQuote {
  distance_meters: number;
  duration_seconds: number;
  estimated_fare: number;
}
function tomorrow() {
  const date = new Date(Date.now() + 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export default function Book() {
  const { client } = useAuth();
  const params = useLocalSearchParams<{
    service?: string;
    rebook?: string;
    pickup?: string;
    destination?: string;
    pickup_lat?: string;
    pickup_lng?: string;
    destination_lat?: string;
    destination_lng?: string;
    scheduled_at?: string;
    guest_count?: string;
    service_type?: string;
    partner_id?: string;
    external_reference?: string;
  }>();
  const [step, setStep] = useState(0);
  const [pickup, setPickup] = useState<ServiceLocation>({
    id: "manual",
    label: params.pickup ?? "",
  });
  const [destination, setDestination] = useState<ServiceLocation>({
    id: "manual",
    label: params.destination ?? "",
  });
  const [preference, setPreference] = useState<RoutePreference>("fastest");
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("09:00");
  const [service, setService] = useState(
    params.service ?? params.service_type ?? "scheduled",
  );
  const [count, setCount] = useState(params.guest_count ?? "1");
  const [vehicle, setVehicle] = useState("sedan");
  const [notes, setNotes] = useState("");
  const [route, setRoute] = useState<RouteEstimate | null>(null);
  const [fare, setFare] = useState<FareQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ signature: string; id: string } | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    if (!params.rebook || !client) return;
    let live = true;
    getBooking(client, params.rebook)
      .then((booking) => {
        if (!live) return;
        setPickup({
          id: "rebook-pickup",
          label: booking.pickup_address,
          coordinates: {
            latitude: booking.pickup_lat,
            longitude: booking.pickup_lng,
          },
        });
        setDestination({
          id: "rebook-destination",
          label: booking.dropoff_address,
          coordinates: {
            latitude: booking.dropoff_lat,
            longitude: booking.dropoff_lng,
          },
        });
        setVehicle(booking.vehicle_type);
        setService(booking.service_type);
        setCount(String(booking.passenger_count));
        setNotes(booking.passenger_notes ?? "");
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load previous route",
        ),
      );
    return () => {
      live = false;
    };
  }, [params.rebook, client]);
  useEffect(() => {
    const coordinates = (lat?: string, lng?: string) =>
      lat &&
      lng &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng)) &&
      Math.abs(Number(lat)) <= 90 &&
      Math.abs(Number(lng)) <= 180
        ? { latitude: Number(lat), longitude: Number(lng) }
        : undefined;
    const from = coordinates(params.pickup_lat, params.pickup_lng);
    const to = coordinates(params.destination_lat, params.destination_lng);
    if (from) setPickup((value) => ({ ...value, coordinates: from }));
    if (to) setDestination((value) => ({ ...value, coordinates: to }));
    if (
      params.scheduled_at &&
      Number.isFinite(Date.parse(params.scheduled_at))
    ) {
      const scheduled = new Date(params.scheduled_at);
      setDate(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(scheduled),
      );
      setTime(
        scheduled.toLocaleTimeString("en-GB", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      );
    }
  }, []);
  function schedule() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
      throw new Error("Enter a date as YYYY-MM-DD and time as HH:MM.");
    const value = new Date(`${date}T${time}:00+08:00`);
    if (
      !Number.isFinite(value.getTime()) ||
      value.getTime() < Date.now() + 30 * 60000 ||
      value.getTime() > Date.now() + 180 * 86400000
    )
      throw new Error(
        "Schedule at least 30 minutes ahead, within the next 180 days.",
      );
    return value.toISOString();
  }
  async function next() {
    setError("");
    setBusy(true);
    try {
      if (step === 0) {
        if (!pickup.label.trim() || !destination.label.trim())
          throw new Error("Enter both pickup and destination.");
        if (!pickup.coordinates || !destination.coordinates)
          throw new Error(
            "Choose known service locations or enter coordinates so we can estimate this route. No maps key is needed.",
          );
        setRoute(
          await provider.estimateRoute({ pickup, destination, preference }),
        );
      }
      if (step === 1) {
        schedule();
        setRoute(
          await provider.estimateRoute({ pickup, destination, preference }),
        );
      }
      if (step === 2) {
        if (!client || !pickup.coordinates || !destination.coordinates)
          throw new Error("Sign in and choose locations first.");
        const passengers = Number(count);
        const capacity: Record<string, number> = {
          motorcycle: 1,
          sedan: 4,
          suv: 6,
          van: 12,
        };
        if (
          !Number.isInteger(passengers) ||
          passengers < 1 ||
          passengers > capacity[vehicle]
        )
          throw new Error(
            `Choose between 1 and ${capacity[vehicle]} passengers for this vehicle.`,
          );
        const result = await client.rpc("placeholder_scheduled_fare", {
          p_pickup_lat: pickup.coordinates.latitude,
          p_pickup_lng: pickup.coordinates.longitude,
          p_dropoff_lat: destination.coordinates.latitude,
          p_dropoff_lng: destination.coordinates.longitude,
          p_vehicle_type: vehicle,
        });
        if (result.error) throw new Error(result.error.message);
        const quote = result.data?.[0] as FareQuote | undefined;
        if (!quote)
          throw new Error("No server quote is available. Please retry.");
        setFare(quote);
      }
      setStep((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Please check your booking.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (
      !client ||
      !pickup.coordinates ||
      !destination.coordinates ||
      submitting.current
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        pickup_address: pickup.label,
        pickup_lat: pickup.coordinates.latitude,
        pickup_lng: pickup.coordinates.longitude,
        dropoff_address: destination.label,
        dropoff_lat: destination.coordinates.latitude,
        dropoff_lng: destination.coordinates.longitude,
        scheduled_at: schedule(),
        vehicle_type: vehicle,
        passenger_notes: notes.trim() || null,
        passenger_count: Number(count),
        service_type: ["airport", "resort", "transfer"].includes(service)
          ? "transfer"
          : service === "local"
            ? "local"
            : "scheduled",
        route_preference: preference,
        ...(params.partner_id ? { partner_id: params.partner_id } : {}),
        ...(params.external_reference
          ? { external_reference: params.external_reference }
          : {}),
      };
      const signature = JSON.stringify(payload);
      if (request.current?.signature !== signature)
        request.current = { signature, id: randomUUID() };
      const result = await client.rpc("create_transport_request", {
        p_payload: { ...payload, client_request_id: request.current.id },
      });
      if (result.error) throw new Error(result.error.message);
      if (typeof result.data !== "string")
        throw new Error(
          "Booking response was incomplete. Retry with the same details.",
        );
      router.replace({
        pathname: "/booking/[id]",
        params: { id: result.data },
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Booking could not be confirmed. Retry safely.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Row>
        <Chip label={`Step ${step + 1} of 4`} selected />
        <Chip label="Close" onPress={() => router.back()} />
      </Row>
      <Heading>
        {
          [
            "Where are you going?",
            "Route & schedule",
            "Your ride",
            "Review your booking",
          ][step]
        }
      </Heading>
      {params.partner_id && (
        <Notice>
          Partner transport request · Review all imported details before
          confirming.
        </Notice>
      )}
      {step === 0 && (
        <>
          <LocationField
            label="Pickup"
            value={pickup}
            onChange={setPickup}
            allowGps
          />
          <LocationField
            label="Destination"
            value={destination}
            onChange={setDestination}
          />
        </>
      )}
      {step === 1 && (
        <>
          <Card>
            <Heading>Route preference</Heading>
            <Row>
              <Chip
                label="Fastest"
                selected={preference === "fastest"}
                onPress={() => setPreference("fastest")}
              />
              <Chip
                label="Avoid tolls"
                selected={preference === "avoid_tolls"}
                onPress={() => setPreference("avoid_tolls")}
              />
            </Row>
            <Muted>
              This is a preference for your driver. Local estimates cannot
              verify the fastest road or a toll-free route.
            </Muted>
          </Card>
          <Card>
            <Heading>When do you need pickup?</Heading>
            <Field
              label="Date · YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
              placeholder="2026-09-08"
            />
            <Field
              label="Time · HH:MM (24-hour)"
              value={time}
              onChangeText={setTime}
              placeholder="09:00"
            />
            <Muted>
              Philippine time (UTC+8). Book 30 minutes to 180 days ahead.
            </Muted>
            <Button
              label="Tomorrow at 9:00 AM"
              variant="secondary"
              onPress={() => {
                setDate(tomorrow());
                setTime("09:00");
              }}
            />
          </Card>
        </>
      )}
      {step === 2 && (
        <>
          <Card>
            <Heading>Service</Heading>
            <Row>
              {[
                ["scheduled", "Scheduled"],
                ["airport", "Airport"],
                ["resort", "Resort"],
                ["local", "Local"],
              ].map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  selected={service === value}
                  onPress={() => setService(value)}
                />
              ))}
            </Row>
            <Field
              label="Passengers"
              keyboardType="number-pad"
              value={count}
              onChangeText={setCount}
              maxLength={2}
            />
            <Heading>Vehicle</Heading>
            <Row>
              {[
                ["sedan", "Sedan · up to 4"],
                ["suv", "SUV · up to 6"],
                ["van", "Van · up to 12"],
                ["motorcycle", "Motorcycle · 1"],
              ].map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  selected={vehicle === value}
                  onPress={() => setVehicle(value)}
                />
              ))}
            </Row>
            <Field
              label="Pickup landmark or trip notes"
              value={notes}
              onChangeText={setNotes}
              maxLength={500}
              multiline
              placeholder="Terminal, resort gate, luggage or accessibility needs"
            />
          </Card>
        </>
      )}
      {step === 3 && (
        <>
          <Card>
            <Heading>{pickup.label}</Heading>
            <Muted>to</Muted>
            <Heading>{destination.label}</Heading>
            <Muted>
              {dateTime(new Date(`${date}T${time}:00+08:00`).toISOString())}
            </Muted>
            <Muted>
              {count} passenger(s) · {vehicle} · {service} ·{" "}
              {preference.replaceAll("_", " ")}
            </Muted>
            {notes && <Text>{notes}</Text>}
          </Card>
          <Card>
            <Heading>Transparent estimate</Heading>
            <Text>Ride fare: {money(fare?.estimated_fare ?? null)}</Text>
            <Text>
              Estimated toll:{" "}
              {route?.estimatedToll === null
                ? "Unknown · confirm with your driver"
                : money(route?.estimatedToll ?? null)}
            </Text>
            <Text>Discounts: None applied</Text>
            <Text style={{ fontSize: 21, fontWeight: "600" }}>
              Estimated total: {money(fare?.estimated_fare ?? null)} + any
              agreed toll
            </Text>
            <Muted>Cash payment. No payment is collected in the app.</Muted>
            <Notice>
              LOCAL ESTIMATE · The server calculates the ride fare and
              recalculates it when you confirm. Actual road distance, traffic
              and tolls are unverified.
            </Notice>
            {route && (
              <Muted>
                Approx. {((route.distanceMeters ?? 0) / 1000).toFixed(1)} km
                straight-line · {Math.ceil((route.durationSeconds ?? 0) / 60)}{" "}
                min using local speed assumptions. {route.disclaimer}
              </Muted>
            )}
          </Card>
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {step < 3 ? (
        <Button
          label={step === 2 ? "Get server fare estimate" : "Continue"}
          loading={busy}
          onPress={() => void next()}
        />
      ) : (
        <Button
          label="Confirm booking"
          loading={busy}
          onPress={() => void confirm()}
        />
      )}
      {step > 0 && (
        <Button
          label="Back"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setStep((value) => value - 1);
            setError("");
          }}
        />
      )}
    </Screen>
  );
}
