import { useEffect, useRef, useState } from "react";
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
  userError,
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastLocationId = useRef(value.id);
  useEffect(() => {
    if (lastLocationId.current !== value.id) {
      setLatitude(value.coordinates?.latitude.toString() ?? "");
      setLongitude(value.coordinates?.longitude.toString() ?? "");
      lastLocationId.current = value.id;
    }
  }, [value.id, value.coordinates?.latitude, value.coordinates?.longitude]);
  function select(location: ServiceLocation) {
    onChange(location);
    setLatitude(location.coordinates?.latitude.toString() ?? "");
    setLongitude(location.coordinates?.longitude.toString() ?? "");
    setError("");
    setShowSuggestions(false);
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
      if (!permission.granted) {
        setError(
          "Location access is off. Choose a suggested place or enable location in your device settings.",
        );
        return;
      }
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
      setManual(false);
    } catch (reason) {
      setError(
        userError(
          reason,
          "We couldn’t find your location. Choose a suggested place or try again.",
        ),
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
        placeholder={
          allowGps ? "Pickup address or landmark" : "Where are you going?"
        }
        value={value.label}
        maxLength={240}
        onChangeText={(label) => {
          onChange({ id: "manual", label });
          setLatitude("");
          setLongitude("");
          setShowSuggestions(true);
        }}
      />
      <Row>
        {(showSuggestions || !value.coordinates
          ? (suggestions.length ? suggestions : DEMO_LOCATIONS).slice(
              0,
              showSuggestions ? undefined : 2,
            )
          : []
        ).map((location) => (
          <Chip
            key={location.id}
            label={location.label}
            selected={value.id === location.id}
            onPress={() => select(location)}
          />
        ))}
      </Row>
      {value.coordinates ? (
        <Muted>
          Location selected. Add your exact meeting point in trip notes.
        </Muted>
      ) : (
        <Muted>Choose a suggested place for a fare estimate.</Muted>
      )}
      <Row>
        <Chip
          label={showSuggestions ? "Fewer places" : "Browse places"}
          onPress={() => setShowSuggestions(!showSuggestions)}
        />
        <Chip
          label={manual ? "Hide coordinates" : "Map coordinates"}
          onPress={() => setManual(!manual)}
        />
      </Row>
      {manual && (
        <>
          <Muted>
            Use latitude and longitude from your map app for places outside our
            suggestions.
          </Muted>
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
