import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { useAuth, useResource } from "@hatidone/mobile";
import type { Coordinates } from "@hatidone/core";
import { loadDriverData, rpc, type DriverData } from "./data";

type DriverContext = {
  data: DriverData | null;
  loading: boolean;
  stale: boolean;
  updatedAt: number | null;
  locationUpdatedAt: number | null;
  error: string | null;
  reload: () => Promise<void>;
  run: (
    name: string,
    args: Record<string, unknown>,
    success: string,
    expectedStatus?: string,
  ) => Promise<boolean>;
  busy: boolean;
  feedback: string | null;
  actionError: string | null;
  location: Coordinates | null;
  setManualLocation: (point: Coordinates) => void;
  locate: () => Promise<Coordinates | null>;
  locationError: string | null;
};
const Context = createContext<DriverContext | null>(null);
export function DriverProvider({ children }: { children: ReactNode }) {
  const { client, session } = useAuth();
  const loader = useCallback(async () => {
    if (!client || !session)
      throw new Error("Sign in to load your driver account.");
    return loadDriverData(client, session.user.id);
  }, [client, session]);
  const resource = useResource(loader, [client, session?.user.id]);
  const { reload } = resource;
  const userId = session?.user.id;
  const activeMutation = useRef(false);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<number | null>(null);
  const [gpsReady, setGpsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const run = async (
    name: string,
    args: Record<string, unknown>,
    success: string,
    expectedStatus?: string,
  ) => {
    if (!client || activeMutation.current) return false;
    if (resource.stale) { setActionError("Updates unavailable. Refresh authoritative trip details before trying this action."); await resource.reload(); return false; }
    activeMutation.current = true;
    setBusy(true);
    setFeedback(null);
    setActionError(null);
    try {
      const result = await rpc(client, name, args);
      if (expectedStatus && result !== expectedStatus)
        throw new Error(
          "Incorrect passenger PIN. Ask the passenger to check their booking. Repeated incorrect attempts temporarily lock pickup validation.",
        );
      setFeedback(success);
      await resource.reload();
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The request could not be completed. Refresh and try again.",
      );
      await resource.reload();
      return false;
    } finally {
      activeMutation.current = false;
      setBusy(false);
    }
  };
  const locate = async () => {
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted")
        throw new Error(
          "Location permission is off. Enter your current coordinates in Account to go online, or enable permission in device settings.",
        );
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const point = {
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
      };
      setLocation(point);
      setLocationUpdatedAt(fix.timestamp);
      setGpsReady(true);
      return point;
    } catch (error) {
      setLocationError(
        error instanceof Error
          ? error.message
          : "GPS is unavailable. You can still review trips and earnings.",
      );
      return null;
    }
  };
  useEffect(() => {
    if (!client || !userId) return;
    const channel = client
      .channel(`driver-updates-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_offers" },
        () => {
          void reload();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_requests" },
        () => {
          void reload();
        },
      )
      .subscribe((status) => { if (status === "SUBSCRIBED") void reload(); });
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, userId, reload]);
  useEffect(() => {
    if (!client || !resource.data?.driver?.online || !gpsReady) return;
    let subscription: Location.LocationSubscription | undefined;
    let stopped = false;
    let generation = 0;
    const start = async () => {
      const currentGeneration = ++generation;
      if (AppState.currentState !== "active") return;
      try {
        const watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 50,
          },
          async (fix) => {
            if (stopped || currentGeneration !== generation || AppState.currentState !== "active") return;
            const point = {
              latitude: fix.coords.latitude,
              longitude: fix.coords.longitude,
            };
            setLocation(point);
            setLocationUpdatedAt(fix.timestamp);
            const { error } = await client.rpc("publish_driver_location", {
              p_latitude: point.latitude,
              p_longitude: point.longitude,
            });
            if (error)
              setLocationError(
                "Location sharing could not update. Your trip controls remain available.",
              );
          },
        );
        if (stopped || currentGeneration !== generation || AppState.currentState !== "active") watcher.remove();
        else subscription = watcher;
      } catch {
        setLocationError(
          "Live foreground location is unavailable. Use Update GPS to retry.",
        );
      }
    };
    void start();
    const listener = AppState.addEventListener("change", (state) => {
      generation++;
      subscription?.remove();
      subscription = undefined;
      if (state === "active" && !stopped) void start();
    });
    return () => {
      stopped = true;
      generation++;
      subscription?.remove();
      listener.remove();
    };
  }, [client, resource.data?.driver?.online, gpsReady]);
  return (
    <Context.Provider
      value={{
        ...resource,
        busy,
        feedback,
        actionError,
        run,
        location,
        locationUpdatedAt,
        setManualLocation: (point) => { setLocation(point); setLocationUpdatedAt(null); setGpsReady(false); },
        locate,
        locationError,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDriver() {
  const value = useContext(Context);
  if (!value) throw new Error("DriverProvider is required");
  return value;
}
