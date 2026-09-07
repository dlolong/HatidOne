export const RIDE_REQUEST_STATUSES = [
  'draft',
  'requested',
  'searching',
  'offered',
  'assigned',
  'driver_en_route',
  'driver_arrived',
  'trip_started',
  'trip_completed',
  'passenger_cancelled',
  'driver_cancelled',
  'operator_cancelled',
  'expired',
  'no_driver_found',
  'no_show'
] as const;

export type RideRequestStatus = (typeof RIDE_REQUEST_STATUSES)[number];

export const ACTIVE_RIDE_TRANSITIONS: Record<RideRequestStatus, readonly RideRequestStatus[]> = {
  draft: ['requested', 'passenger_cancelled'],
  requested: ['searching', 'offered', 'assigned', 'passenger_cancelled', 'operator_cancelled', 'expired'],
  searching: ['offered', 'assigned', 'no_driver_found', 'passenger_cancelled', 'operator_cancelled', 'expired'],
  offered: ['assigned', 'searching', 'passenger_cancelled', 'operator_cancelled', 'expired'],
  assigned: ['driver_en_route', 'driver_cancelled', 'passenger_cancelled', 'operator_cancelled'],
  driver_en_route: ['driver_arrived', 'driver_cancelled', 'passenger_cancelled', 'operator_cancelled'],
  driver_arrived: ['trip_started', 'no_show', 'driver_cancelled', 'passenger_cancelled', 'operator_cancelled'],
  trip_started: ['trip_completed', 'operator_cancelled'],
  trip_completed: [],
  passenger_cancelled: [],
  driver_cancelled: [],
  operator_cancelled: [],
  expired: [],
  no_driver_found: [],
  no_show: []
};

export function canTransitionRide(from: RideRequestStatus, to: RideRequestStatus): boolean {
  return ACTIVE_RIDE_TRANSITIONS[from].includes(to);
}

export const SERVICE_TYPES = ['scheduled', 'transfer', 'local', 'instant'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];
export type VehicleType = 'sedan' | 'suv' | 'van' | 'motorcycle';
export type RoutePreference = 'fastest' | 'cheapest' | 'avoid_tolls' | 'preferred_route';
export type TripAction = 'heading' | 'arrived' | 'start' | 'complete' | 'cancel' | 'no_show';
export type OrganizationKind = 'fleet' | 'partner' | 'corporate';
export type OrganizationMemberRole = 'owner' | 'manager' | 'rider';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'expired' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface DriverPreferences {
  driver_id: string;
  service_types: ServiceType[];
  preferred_areas: string[];
  destination_areas: string[];
  going_home_enabled: boolean;
  home_address: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  going_home_departure: string | null;
  updated_at: string;
}

/** Values are returned by the server; clients must never submit authoritative financial amounts. */
export interface FareBreakdown {
  gross_fare: number;
  commission_percent: number;
  platform_commission: number;
  driver_earnings: number;
  estimated_toll_amount: number | null;
}

export interface TransportRequestInput {
  client_request_id: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  scheduled_at?: string;
  vehicle_type: VehicleType;
  service_type: ServiceType;
  passenger_count: number;
  passenger_notes?: string;
  route_preference?: RoutePreference;
  organization_id?: string;
  passenger_id?: string;
  ride_purpose?: string;
  external_reference?: string;
  partner_id?: string;
}

export interface RideMessage {
  id: string;
  ride_request_id: string;
  sender_user_id: string;
  body: string;
  client_message_id: string;
  created_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  ride_request_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  kind: OrganizationKind;
  name: string;
  owner_user_id: string;
  partner_type: 'resort' | 'hotel' | 'travel_agent' | 'transport_operator' | 'corporate' | 'other' | null;
  external_reference: string | null;
  fleet_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  audience: OrganizationKind;
  display_name: string;
  features: string[];
  monthly_price_php: number | null;
  active: boolean;
}

/** Backups require manual activation; readiness is not a running scheduler. */
export interface BackupAssignment {
  id: string;
  ride_request_id: string;
  driver_id: string;
  vehicle_id: string;
  status: 'ready' | 'activated' | 'cancelled';
  created_at: string;
}
