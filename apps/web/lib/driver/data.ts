import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/session';
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

export async function getDriverApplication() {
  const profile = await requireProfile();
  const client = await createClient();
  const { data: driver, error } = await client.from('driver_profiles')
    .select('id, verification_status, online').eq('user_id', profile.id).maybeSingle();
  return { profile, driver, error: error ? 'Your application could not be loaded. Please retry.' : null };
}

export async function requireDriverApplicant() {
  const { profile, driver, error } = await getDriverApplication();
  if (error) redirect('/driver-application?error=Your%20application%20could%20not%20be%20loaded.%20Please%20retry.');
  if (!['passenger', 'driver'].includes(profile.role) || !driver) redirect('/driver-application');
  return profile;
}

export async function getDriverOnboarding() {
  const profile = await requireDriverApplicant();
  const supabase = await createClient();
  const { data: personal, error: personalError } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone')
    .eq('id', profile.id)
    .single();
  const { data: driver, error: driverError } = await supabase
    .from('driver_profiles')
    .select('id, preferred_area, verification_status, online')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (personalError || driverError) throw new Error('Application details could not be loaded. Please retry.');

  let vehicle: OnboardingVehicle | null = null;
  let driverDocuments: OnboardingDocument[] = [];
  let vehicleDocuments: OnboardingDocument[] = [];

  if (driver) {
    const { data: link, error: linkError } = await supabase
      .from('driver_vehicles')
      .select('vehicle_id')
      .eq('driver_id', driver.id)
      .eq('is_primary', true)
      .maybeSingle();
    if (linkError) throw new Error('Saved vehicle could not be loaded. Please retry.');
    const [{ data: driverDocumentRows, error: documentError }, vehicleResult] = await Promise.all([
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
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (documentError || vehicleResult.error) throw new Error('Saved application documents could not be loaded. Please retry.');
    driverDocuments = (driverDocumentRows ?? []) as OnboardingDocument[];
    vehicle = vehicleResult.data as OnboardingVehicle | null;

    if (vehicle) {
      const { data, error: vehicleDocumentError } = await supabase
        .from('vehicle_documents')
        .select('document_type, expires_on, rejection_reason, storage_path, verification_status')
        .eq('vehicle_id', vehicle.id);
      if (vehicleDocumentError) throw new Error('Saved vehicle documents could not be loaded. Please retry.');
      vehicleDocuments = (data ?? []) as OnboardingDocument[];
    }
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const progress = onboardingProgress({
    hasPersonalDetails: Boolean(personal?.first_name && personal.last_name && personal.phone && driver?.preferred_area),
    hasVehicle: Boolean(vehicle),
    hasDriverLicense: driverDocuments.some((document) => document.document_type === 'drivers_license' && !['rejected', 'suspended'].includes(document.verification_status) && isExpirationCurrent(document.expires_on, today)),
    hasVehicleRegistration: vehicleDocuments.some((document) => document.document_type === 'registration' && !['rejected', 'suspended'].includes(document.verification_status) && isExpirationCurrent(document.expires_on, today)),
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
