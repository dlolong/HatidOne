import type { SupabaseClient } from "@supabase/supabase-js";
import type { RideRequestStatus } from "@hatidone/types";
export interface Booking {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  scheduled_at: string | null;
  vehicle_type: string;
  service_type: string;
  passenger_count: number;
  passenger_notes: string | null;
  status: RideRequestStatus;
  estimated_fare: number;
  estimated_distance_meters: number;
  estimated_duration_seconds: number;
  route_preference: string;
  estimated_toll_amount: number | null;
  created_at: string;
}
const bookingColumns =
  "id,pickup_address,dropoff_address,pickup_lat:pickup_latitude,pickup_lng:pickup_longitude,dropoff_lat:dropoff_latitude,dropoff_lng:dropoff_longitude,scheduled_at,vehicle_type,service_type,passenger_count,passenger_notes,status,estimated_fare,estimated_distance_meters,estimated_duration_seconds,route_preference,estimated_toll_amount,created_at";
export async function getBookings(
  client: SupabaseClient | null,
  userId: string | undefined,
): Promise<Booking[]> {
  if (!client || !userId) return [];
  const { data, error } = await client
    .from("ride_requests")
    .select(bookingColumns)
    .eq("passenger_id", userId)
    .order("scheduled_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data as Booking[];
}
export async function getBooking(
  client: SupabaseClient | null,
  id: string,
): Promise<Booking> {
  if (!client) throw new Error("Sign in to view your booking.");
  const { data, error } = await client
    .from("ride_requests")
    .select(bookingColumns)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as Booking;
}
export const terminalStatuses = new Set<string>([
  "trip_completed",
  "passenger_cancelled",
  "driver_cancelled",
  "operator_cancelled",
  "expired",
  "no_driver_found",
  "no_show",
]);
export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    requested: "Finding your driver",
    searching: "Searching",
    offered: "Driver offer sent",
    assigned: "Driver assigned",
    driver_en_route: "Driver heading to pickup",
    driver_arrived: "Driver has arrived",
    trip_started: "On your way",
    trip_completed: "Completed",
    passenger_cancelled: "Cancelled by you",
    driver_cancelled: "Cancelled by driver",
    operator_cancelled: "Cancelled by operations",
    no_driver_found: "No driver available",
    no_show: "No-show recorded",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}
export interface Notification {
  id: string;
  title: string;
  body: string;
  ride_request_id: string | null;
  read_at: string | null;
  created_at: string;
}
export async function getNotifications(
  client: SupabaseClient | null,
  userId: string | undefined,
): Promise<Notification[]> {
  if (!client || !userId) return [];
  const result = await client
    .from("notifications")
    .select("id,title,body,ride_request_id,read_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
