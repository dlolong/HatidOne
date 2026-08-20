import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isExpirationCurrent, onboardingProgress } from './onboarding';

export type OnboardingDocument = {
  document_type: string;
  expires_on: string | null;
  rejection_reason: string | null;
  storage_path: string;
  verification_status: string;
};

export type OnboardingVehicle = {
  id: string;
  vehicle_type: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  plate_number: string;
  capacity: number;
  verified: boolean;
};

export async function getDriverOnboarding() {
  const profile = await requireRole('driver');
  const supabase = await createClient();
  const { data: personal } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone')
    .eq('id', profile.id)
    .single();
  const { data: driver } = await supabase
    .from('driver_profiles')
    .select('id, preferred_area, verification_status')
    .eq('user_id', profile.id)
    .maybeSingle();

  let vehicle: OnboardingVehicle | null = null;
  let driverDocuments: OnboardingDocument[] = [];
  let vehicleDocuments: OnboardingDocument[] = [];

  if (driver) {
    const { data: link } = await supabase
      .from('driver_vehicles')
      .select('vehicle_id')
      .eq('driver_id', driver.id)
      .eq('is_primary', true)
      .maybeSingle();
    const [{ data: driverDocumentRows }, vehicleResult] = await Promise.all([
      supabase
        .from('driver_documents')
        .select('document_type, expires_on, rejection_reason, storage_path, verification_status')
        .eq('driver_id', driver.id),
      link
        ? supabase
            .from('vehicles')
            .select('id, vehicle_type, brand, model, year, color, plate_number, capacity, verified')
            .eq('id', link.vehicle_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    driverDocuments = (driverDocumentRows ?? []) as OnboardingDocument[];
    vehicle = vehicleResult.data as OnboardingVehicle | null;

    if (vehicle) {
      const { data } = await supabase
        .from('vehicle_documents')
        .select('document_type, expires_on, rejection_reason, storage_path, verification_status')
        .eq('vehicle_id', vehicle.id);
      vehicleDocuments = (data ?? []) as OnboardingDocument[];
    }
  }

  const progress = onboardingProgress({
    hasPersonalDetails: Boolean(personal?.first_name && personal.last_name && personal.phone && driver?.preferred_area),
    hasVehicle: Boolean(vehicle),
    hasDriverLicense: driverDocuments.some((document) => document.document_type === 'drivers_license' && isExpirationCurrent(document.expires_on)),
    hasVehicleRegistration: vehicleDocuments.some((document) => document.document_type === 'registration' && isExpirationCurrent(document.expires_on)),
  });

  return {
    profile,
    personal,
    driver,
    vehicle,
    driverDocuments,
    vehicleDocuments,
    progress,
  };
}
