import { useState } from "react";
import * as Location from "expo-location";
import { DEMO_LOCATIONS, type ServiceLocation } from "@hatidone/core";
import {
  Button,
  Card,
  Chip,
  Field,
  Muted,
  Notice,
  Row,
} from "@hatidone/mobile";
export function LocationField({
  label,
  value,
  onChange,
  allowGps = false,
}: {
  label: string;
  value: ServiceLocation;
  onChange: (location: ServiceLocation) => void;
  allowGps?: boolean;
}) {
  const [latitude, setLatitude] = useState(
    value.coordinates?.latitude.toString() ?? "",
  );
  const [longitude, setLongitude] = useState(
    value.coordinates?.longitude.toString() ?? "",
  );
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function select(location: ServiceLocation) {
    onChange(location);
    setLatitude(location.coordinates?.latitude.toString() ?? "");
    setLongitude(location.coordinates?.longitude.toString() ?? "");
    setError("");
  }
  function coordinates(lat: string, lng: string) {
    setLatitude(lat);
    setLongitude(lng);
    const point =
      lat.trim() &&
      lng.trim() &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng)) &&
      Math.abs(Number(lat)) <= 90 &&
      Math.abs(Number(lng)) <= 180
        ? { latitude: Number(lat), longitude: Number(lng) }
        : undefined;
    onChange({ ...value, coordinates: point });
  }
  async function gps() {
    setBusy(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Location permission was declined. Choose a reference point or enter coordinates.",
        );
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      select({
        id: "current",
        label: value.label || "Current location — add pickup landmark",
        coordinates: {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        },
      });
      setManual(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Location unavailable. Enter coordinates manually.",
      );
    } finally {
      setBusy(false);
    }
  }
  const suggestions = DEMO_LOCATIONS.filter(
    (location) =>
      !value.label ||
      location.label.toLowerCase().includes(value.label.toLowerCase()) ||
      location.id === value.id,
  );
  return (
    <Card>
      <Field
        label={label}
        placeholder="Address or known service location"
        value={value.label}
        maxLength={240}
        onChangeText={(label) => {
          onChange({ id: "manual", label });
          setLatitude("");
          setLongitude("");
        }}
      />
      <Row>
        {(suggestions.length ? suggestions : DEMO_LOCATIONS).map((location) => (
          <Chip
            key={location.id}
            label={location.label}
            selected={value.id === location.id}
            onPress={() => select(location)}
          />
        ))}
      </Row>
      <Muted>
        Reference points are approximate. Add exact building, terminal, or
        landmark details in your trip notes.
      </Muted>
      {value.coordinates && (
        <Muted>
          Coordinates: {value.coordinates.latitude.toFixed(5)},{" "}
          {value.coordinates.longitude.toFixed(5)}
        </Muted>
      )}
      <Button
        label={manual ? "Hide coordinate fields" : "Enter exact coordinates"}
        variant="secondary"
        onPress={() => setManual(!manual)}
      />
      {manual && (
        <>
          <Field
            label={`${label} latitude`}
            keyboardType="numbers-and-punctuation"
            value={latitude}
            onChangeText={(lat) => coordinates(lat, longitude)}
          />
          <Field
            label={`${label} longitude`}
            keyboardType="numbers-and-punctuation"
            value={longitude}
            onChangeText={(lng) => coordinates(latitude, lng)}
          />
        </>
      )}
      {allowGps && (
        <Button
          label="Use my current location"
          variant="secondary"
          loading={busy}
          onPress={() => void gps()}
        />
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
