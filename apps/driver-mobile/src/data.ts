import type { SupabaseClient } from "@supabase/supabase-js";
import type { RideRequestStatus } from "@hatidone/types";

export type Ride = {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  scheduled_at: string | null;
  status: RideRequestStatus;
  service_type: string;
  vehicle_type: string;
  passenger_count: number;
  estimated_distance_meters: number | null;
  estimated_duration_seconds: number | null;
  estimated_fare: number | null;
  gross_fare: number | null;
  platform_commission: number | null;
  driver_earnings: number | null;
  commission_percent: number | null;
  route_source: string;
  route_preference: string;
  estimated_toll_amount: number | null;
};
export type Offer = {
  id: string;
  expires_at: string;
  distance_meters: number | null;
  ride: Ride;
};
export type Assignment = {
  id: string;
  confirmed_at: string | null;
  assignment_type: string;
  ride: Ride;
};
export type Driver = {
  id: string;
  verification_status: string;
  online: boolean;
  preferred_area: string | null;
  rating: number;
  rating_count: number;
};
export type Preferences = {
  service_types: string[];
  preferred_areas: string[];
  destination_areas: string[];
  going_home_enabled: boolean;
  home_address: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  going_home_departure: string | null;
};
export type Document = {
  document_type: string;
  expires_on: string | null;
  verification_status: string;
  rejection_reason: string | null;
};
export type Vehicle = {
  id: string;
  vehicle_type: string;
  brand: string | null;
  model: string | null;
  plate_number: string;
  capacity: number;
  verified: boolean;
};
export type Earning = {
  id: string;
  ride_request_id: string;
  gross_fare: number | null;
  platform_commission: number | null;
  driver_earnings: number | null;
  final_fare: number | null;
  completed_at: string;
};
export type DriverData = {
  driver: Driver | null;
  offers: Offer[];
  assignments: Assignment[];
  preferences: Preferences;
  documents: Document[];
  vehicleDocuments: Document[];
  vehicle: Vehicle | null;
  earnings: Earning[];
};
export const DEFAULT_PREFERENCES: Preferences = {
  service_types: ["scheduled", "transfer", "local", "instant"],
  preferred_areas: [],
  destination_areas: [],
  going_home_enabled: false,
  home_address: null,
  home_latitude: null,
  home_longitude: null,
  going_home_departure: null,
};
const RIDE_FIELDS =
  "id,pickup_address,dropoff_address,pickup_latitude,pickup_longitude,dropoff_latitude,dropoff_longitude,scheduled_at,status,service_type,vehicle_type,passenger_count,estimated_distance_meters,estimated_duration_seconds,estimated_fare,gross_fare,platform_commission,driver_earnings,commission_percent,route_source,route_preference,estimated_toll_amount";
const DOCUMENT_FIELDS =
  "document_type,expires_on,verification_status,rejection_reason";
export const ACTIVE_STATUSES: readonly string[] = [
  "assigned",
  "driver_en_route",
  "driver_arrived",
  "trip_started",
];

export async function loadDriverData(
  client: SupabaseClient,
  userId: string,
): Promise<DriverData> {
  const profile = await client
    .from("driver_profiles")
    .select("id,verification_status,online,preferred_area,rating,rating_count")
    .eq("user_id", userId)
    .maybeSingle<Driver>();
  if (profile.error) throw new Error(profile.error.message);
  const driver = profile.data;
  const empty: DriverData = {
    driver,
    offers: [],
    assignments: [],
    preferences: DEFAULT_PREFERENCES,
    documents: [],
    vehicleDocuments: [],
    vehicle: null,
    earnings: [],
  };
  if (!driver) return empty;
  const [offers, assignments, prefs, docs, link, earnings] = await Promise.all([
    client
      .from("ride_offers")
      .select("id,ride_request_id,expires_at,distance_meters")
      .eq("driver_id", driver.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at"),
    client
      .from("ride_assignments")
      .select("id,ride_request_id,confirmed_at,assignment_type")
      .eq("driver_id", driver.id)
      .order("assigned_at", { ascending: false }),
    client
      .from("driver_preferences")
      .select(
        "service_types,preferred_areas,destination_areas,going_home_enabled,home_address,home_latitude,home_longitude,going_home_departure",
      )
      .eq("driver_id", driver.id)
      .maybeSingle<Preferences>(),
    client
      .from("driver_documents")
      .select(DOCUMENT_FIELDS)
      .eq("driver_id", driver.id)
      .returns<Document[]>(),
    client
      .from("driver_vehicles")
      .select("vehicle_id")
      .eq("driver_id", driver.id)
      .eq("active", true)
      .eq("is_primary", true)
      .maybeSingle(),
    client
      .from("trips")
      .select(
        "id,ride_request_id,gross_fare,platform_commission,driver_earnings,final_fare,completed_at",
      )
      .eq("driver_id", driver.id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .returns<Earning[]>(),
  ]);
  for (const result of [offers, assignments, prefs, docs, link, earnings])
    if (result.error) throw new Error(result.error.message);
  const rideIds = [
    ...new Set(
      [...(offers.data ?? []), ...(assignments.data ?? [])].map((row) =>
        String(row.ride_request_id),
      ),
    ),
  ];
  const [rides, vehicle, vehicleDocs] = await Promise.all([
    rideIds.length
      ? client
          .from("ride_requests")
          .select(RIDE_FIELDS)
          .in("id", rideIds)
          .returns<Ride[]>()
      : Promise.resolve({ data: [] as Ride[], error: null }),
    link.data
      ? client
          .from("vehicles")
          .select("id,vehicle_type,brand,model,plate_number,capacity,verified")
          .eq("id", link.data.vehicle_id)
          .maybeSingle<Vehicle>()
      : Promise.resolve({ data: null, error: null }),
    link.data
      ? client
          .from("vehicle_documents")
          .select(DOCUMENT_FIELDS)
          .eq("vehicle_id", link.data.vehicle_id)
          .returns<Document[]>()
      : Promise.resolve({ data: [] as Document[], error: null }),
  ]);
  for (const result of [rides, vehicle, vehicleDocs])
    if (result.error) throw new Error(result.error.message);
  const rideMap = new Map((rides.data ?? []).map((ride) => [ride.id, ride]));
  return {
    driver,
    preferences: prefs.data ?? DEFAULT_PREFERENCES,
    documents: docs.data ?? [],
    vehicle: vehicle.data,
    vehicleDocuments: vehicleDocs.data ?? [],
    earnings: earnings.data ?? [],
    offers: (offers.data ?? []).flatMap((row) => {
      const ride = rideMap.get(String(row.ride_request_id));
      return ride
        ? [
            {
              id: String(row.id),
              expires_at: String(row.expires_at),
              distance_meters:
                row.distance_meters === null
                  ? null
                  : Number(row.distance_meters),
              ride,
            },
          ]
        : [];
    }),
    assignments: (assignments.data ?? []).flatMap((row) => {
      const ride = rideMap.get(String(row.ride_request_id));
      return ride
        ? [
            {
              id: String(row.id),
              confirmed_at:
                row.confirmed_at === null ? null : String(row.confirmed_at),
              assignment_type: String(row.assignment_type),
              ride,
            },
          ]
        : [];
    }),
  };
}
export async function rpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
