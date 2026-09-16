import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Linking, Switch, Text, View } from "react-native";
import {
  Screen,
  Heading,
  Muted,
  Card,
  Row,
  Chip,
  Button,
  AccountDeletionRequest,
  Field,
  Notice,
  useAuth,
  StatusPill,
  theme,
  userError,
} from "@hatidone/mobile";
import { DEMO_LOCATIONS, validCoordinates } from "@hatidone/core";
import { useDriver } from "../../src/driver-context";
import { Feedback, Empty } from "../../src/components";
import { label, localDateInput, statusTone } from "../../src/format";
import type { Document, Preferences } from "../../src/data";
function DocumentCard({ document }: { document: Document }) {
  const daysRemaining =
    document.expires_on === null
      ? null
      : Math.ceil(
          (Date.parse(`${document.expires_on}T23:59:59+08:00`) - Date.now()) /
            86400000,
        );
  const expired = daysRemaining !== null && daysRemaining < 0;
  const dueSoon =
    daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30;
  return (
    <Card>
      <Text style={{ fontSize: 17, fontWeight: "600" }}>
        {label(document.document_type)}
      </Text>
      <StatusPill
        tone={expired ? "danger" : dueSoon ? "warning" : statusTone(document.verification_status)}
        label={
          expired
            ? "Expired · needs attention"
            : dueSoon
              ? "Expiring soon · renew now"
              : label(document.verification_status)
        }
      />
      <Muted>
        {document.expires_on
          ? `Expires ${document.expires_on}`
          : "No expiration recorded"}
      </Muted>
      {document.rejection_reason && (
        <Notice tone="error">{document.rejection_reason}</Notice>
      )}
    </Card>
  );
}
export default function AccountScreen() {
  const { profile, signOut } = useAuth();
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState("Profile");
  useEffect(() => {
    if (["Profile", "Going Home", "Preferences", "Location", "Documents"].includes(params.section ?? "")) setSection(params.section!);
  }, [params.section]);
  const {
    data,
    loading,
    reload,
    run,
    busy,
    location,
    locate,
    setManualLocation,
  } = useDriver();
  const [areas, setAreas] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [home, setHome] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [departure, setDeparture] = useState(
    localDateInput(new Date(Date.now() + 3600000)),
  );
  const [currentLat, setCurrentLat] = useState("");
  const [currentLng, setCurrentLng] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Initialise once per profile/preferences update, without discarding unsaved edits on polling.
  const persistedPreferences = data?.preferences;
  const lastSavedPreferences = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!persistedPreferences) return;
    const preferenceKey = JSON.stringify(persistedPreferences);
    if (lastSavedPreferences.current === preferenceKey) return;
    lastSavedPreferences.current = preferenceKey;
    const p = persistedPreferences;
    setAreas(p.preferred_areas.join(", "));
    setServices(p.service_types);
    setEnabled(p.going_home_enabled);
    setHome(p.home_address ?? "");
    setLatitude(p.home_latitude === null ? "" : String(p.home_latitude));
    setLongitude(p.home_longitude === null ? "" : String(p.home_longitude));
    if (p.going_home_departure)
      setDeparture(localDateInput(new Date(p.going_home_departure)));
  }, [persistedPreferences]);
  useEffect(() => {
    if (location) {
      setCurrentLat(String(location.latitude));
      setCurrentLng(String(location.longitude));
    }
  }, [location]);
  async function save() {
    setError(null);
    if (!services.length) {
      setError("Choose at least one service type to receive jobs.");
      return;
    }
    const coordinates = {
      latitude: Number(latitude),
      longitude: Number(longitude),
    };
    if (
      enabled &&
      (!home.trim() ||
        !latitude.trim() ||
        !longitude.trim() ||
        !validCoordinates(coordinates) ||
        !Number.isFinite(Date.parse(`${departure}+08:00`)))
    ) {
      setError(
        "For Going Home, enter a destination, valid coordinates and a departure time.",
      );
      return;
    }
    const payload: Preferences = {
      service_types: services,
      preferred_areas: areas
        .split(",")
        .map((area) => area.trim())
        .filter(Boolean),
      destination_areas: data?.preferences.destination_areas ?? [],
      going_home_enabled: enabled,
      home_address: home.trim() || null,
      home_latitude:
        latitude.trim() && validCoordinates(coordinates)
          ? coordinates.latitude
          : null,
      home_longitude:
        longitude.trim() && validCoordinates(coordinates)
          ? coordinates.longitude
          : null,
      going_home_departure: Number.isFinite(Date.parse(`${departure}+08:00`))
        ? new Date(`${departure}+08:00`).toISOString()
        : null,
    };
    await run(
      "save_driver_preferences",
      { p_payload: payload },
      "Your preferences have been saved.",
    );
  }
  async function openOnboarding() {
    setError(null);
    const base = process.env.EXPO_PUBLIC_WEB_URL;
    if (!base) {
      setError(
        "Document upload is temporarily unavailable in this app. Open your HatidOne web account to continue your application.",
      );
      return;
    }
    try {
      const url = new URL("/driver/onboarding", base);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("Invalid web URL");
      await Linking.openURL(url.toString());
    } catch {
      setError(
        "We couldn’t open document upload. Try again or open your HatidOne web account.",
      );
    }
  }
  async function manualAvailability() {
    const point = {
      latitude: Number(currentLat),
      longitude: Number(currentLng),
    };
    if (!currentLat.trim() || !currentLng.trim() || !validCoordinates(point)) {
      setError("Enter valid current latitude and longitude.");
      return;
    }
    setError(null);
    const saved = await run(
      "set_driver_availability",
      {
        p_online: true,
        p_latitude: point.latitude,
        p_longitude: point.longitude,
      },
      "You are available at the entered position. Use GPS when possible.",
    );
    if (saved) setManualLocation(point);
  }
  return (
    <Screen scrollKey={section} refreshing={loading} onRefresh={() => void reload()}>
      <Muted>DRIVER ACCOUNT</Muted>
      <Heading>{profile?.first_name ?? "Your account"}</Heading>
      <Feedback />
      {error && <Notice tone="error">{error}</Notice>}
      <Row>{["Profile", "Going Home", "Preferences", "Location", "Documents"].map((value) => <Chip key={value} label={value} selected={section === value} onPress={() => setSection(value)} />)}</Row>
      {section === "Profile" && <><AccountDeletionRequest /><Card>
        <Muted>{profile?.email}</Muted>
        <Muted>{profile?.phone ?? "Phone not provided"}</Muted>
        <Row>
          <StatusPill label={label(profile?.account_status ?? "pending")} tone={statusTone(profile?.account_status ?? "pending")} />
          <StatusPill label={label(data?.driver?.verification_status ?? "Application needed")} tone={statusTone(data?.driver?.verification_status ?? "pending")} />
        </Row>
        {data?.driver && (
          <Muted>
            {data.driver.rating_count > 0
              ? `${data.driver.rating} rating · ${data.driver.rating_count} reviews`
              : "Rating builds after completed trips."}
          </Muted>
        )}
        <Button
          label="Manage application and documents"
          variant="secondary"
          onPress={() => void openOnboarding()}
        />
      </Card>
      <Button label="Going Home · find trips your way" variant="secondary" onPress={() => setSection("Going Home")} />
      <Button label="Review vehicle and documents" variant="secondary" onPress={() => setSection("Documents")} />
      </>}
      {section === "Going Home" && <Card>
        <Heading size="section">Going Home</Heading>
        <Muted>
          Find trips going your way. Set your destination and the time you want to leave.
        </Muted>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 16 }}>Enable Going Home</Text>
          <Switch
            accessibilityLabel="Enable Going Home"
            value={enabled}
            onValueChange={setEnabled}
            thumbColor={theme.surface} trackColor={{ true: theme.primary, false: theme.border }}
          />
        </View>
        <Field
          label="Destination (required when enabled)"
          value={home}
          onChangeText={setHome}
          placeholder="Address or operating base"
        />
        <Muted>
          Choose an approximate service reference point, or enter coordinates
          for your address.
        </Muted>
        <Row>
          {DEMO_LOCATIONS.map((place) => (
            <Chip
              key={place.id}
              label={place.label}
              selected={home === place.label}
              onPress={() => {
                setHome(place.label);
                setLatitude(String(place.coordinates?.latitude ?? ""));
                setLongitude(String(place.coordinates?.longitude ?? ""));
              }}
            />
          ))}
        </Row>
        <Button label={showCoordinates ? "Hide coordinates" : "Use custom coordinates"} variant="secondary" onPress={() => setShowCoordinates(!showCoordinates)} />
        {showCoordinates && <><Field
          label="Destination latitude"
          value={latitude}
          onChangeText={setLatitude}
          keyboardType="numbers-and-punctuation"
        />
        <Field
          label="Destination longitude"
          value={longitude}
          onChangeText={setLongitude}
          keyboardType="numbers-and-punctuation"
        />
        </>}
        <Field label="Departure date" value={departure.split("T")[0] ?? ""} onChangeText={(value) => setDeparture(`${value}T${departure.split("T")[1] ?? "17:00"}`)} autoCapitalize="none" keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" hint="Use your local date." />
        <Field label="Departure time" value={departure.split("T")[1] ?? ""} onChangeText={(value) => setDeparture(`${departure.split("T")[0] ?? ""}T${value}`)} keyboardType="numbers-and-punctuation" placeholder="17:00" hint="24-hour local time, for example 17:00 for 5 PM." />
        <Muted>
          Return ride suggestions also consider where and when your accepted
          outbound trip is expected to end.
        </Muted>
        <Button label="Save Going Home" loading={busy} disabled={!data?.driver} onPress={() => void save()} />
        <Button label="View matching jobs" variant="secondary" onPress={() => router.push({ pathname: "/(tabs)", params: { filter: "Going Home" } })} />
      </Card>}
      {section === "Preferences" && <Card>
        <Heading size="section">Job preferences</Heading>
        <Field
          label="Preferred areas, separated by commas"
          value={areas}
          onChangeText={setAreas}
          placeholder="Makati, Tagaytay, Batangas"
        />
        <Row>
          {[
            { id: "scheduled", text: "Scheduled / long distance" },
            { id: "transfer", text: "Airport / resort transfers" },
            { id: "local", text: "Local rides" },
            { id: "instant", text: "Immediate rides" },
          ].map((service) => (
            <Chip
              key={service.id}
              label={service.text}
              selected={services.includes(service.id)}
              onPress={() =>
                setServices((previous) =>
                  previous.includes(service.id)
                    ? previous.filter((value) => value !== service.id)
                    : [...previous, service.id],
                )
              }
            />
          ))}
        </Row>
        <Muted>
          Preferences help rank jobs. Vehicle capacity, verification and
          schedule eligibility are checked separately.
        </Muted>
        <Button
          label="Save job preferences"
          loading={busy}
          disabled={!data?.driver}
          onPress={() => void save()}
        />
      </Card>}
      {section === "Location" && <Card>
        <Heading size="section">Location and availability</Heading>
        <Muted>
          Foreground GPS works while the app is open. If GPS is unavailable,
          enter your actual position to become available.
        </Muted>
        <Button
          label="Use current GPS position"
          variant="secondary"
          onPress={() => void locate()}
        />
        <Field
          label="Current latitude"
          value={currentLat}
          onChangeText={setCurrentLat}
          keyboardType="numbers-and-punctuation"
        />
        <Field
          label="Current longitude"
          value={currentLng}
          onChangeText={setCurrentLng}
          keyboardType="numbers-and-punctuation"
        />
        <Button
          label="Go available at this position"
          loading={busy}
          disabled={data?.driver?.verification_status !== "verified"}
          onPress={() => void manualAvailability()}
        />
        {data?.driver?.online && (
          <Button
            label="Go offline"
            variant="secondary"
            loading={busy}
            onPress={() =>
              void run(
                "set_driver_availability",
                { p_online: false },
                "You are offline.",
              )
            }
          />
        )}
      </Card>}
      {section === "Documents" && data && <>
      <Heading size="section">Vehicle</Heading>
      {data?.vehicle ? (
        <Card>
          <Muted>
            {data.vehicle.brand} {data.vehicle.model} ·{" "}
            {data.vehicle.plate_number}
          </Muted>
          <Muted>
            {label(data.vehicle.vehicle_type)} · {data.vehicle.capacity} seats ·{" "}
            {data.vehicle.verified ? "Verified" : "Verification pending"}
          </Muted>
        </Card>
      ) : (
        <Empty title="No primary vehicle">
          Complete your application on the web to register a vehicle.
        </Empty>
      )}
      <Heading size="section">Driver documents</Heading>
      {data?.documents.map((document) => (
        <DocumentCard key={document.document_type} document={document} />
      ))}
      {!data?.documents.length && (
        <Muted>
          No documents recorded. Open onboarding to upload your documents.
        </Muted>
      )}
      <Heading size="section">Vehicle documents</Heading>
      {data?.vehicleDocuments.map((document) => (
        <DocumentCard key={document.document_type} document={document} />
      ))}
      {!data?.vehicleDocuments.length && (
        <Muted>No vehicle documents recorded.</Muted>
      )}
      <Button label="Upload or update documents" onPress={() => void openOnboarding()} />
      </>}
      {section === "Profile" && <Button
        label="Sign out"
        variant="secondary"
        onPress={() => {
          setError(null);
          void signOut().catch((reason) =>
            setError(
              userError(reason, "Unable to sign out. Please try again."),
            ),
          );
        }}
      />}
    </Screen>
  );
}
