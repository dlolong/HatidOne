'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireDriverApplicant } from '@/lib/driver/data';
import { createClient } from '@/lib/supabase/server';
import {
  hasAllowedDocumentSignature,
  isAllowedDocument,
  isDriverDocumentType,
  isVehicleDocumentType,
  isVehicleType,
  parseExpirationDate,
  safeDocumentExtension,
} from '@/lib/driver/onboarding';

const ONBOARDING_PATH = '/driver/onboarding';

function textValue(formData: FormData, key: string, maxLength: number): string | null {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function finish(kind: 'error' | 'message', message: string): never {
  redirect(`${ONBOARDING_PATH}?${kind}=${encodeURIComponent(message)}`);
}

export async function savePersonalDetails(formData: FormData) {
  await requireDriverApplicant();
  const phone = textValue(formData, 'phone', 30);
  const preferredArea = textValue(formData, 'preferredArea', 120);
  if (!phone || !preferredArea) finish('error', 'Enter a valid phone number and preferred service area.');

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_driver_profile', {
    p_phone: phone,
    p_preferred_area: preferredArea,
  });
  if (error) finish('error', 'Personal details could not be saved.');
  revalidatePath(ONBOARDING_PATH);
  finish('message', 'Personal details saved.');
}

export async function saveVehicleDetails(formData: FormData) {
  await requireDriverApplicant();
  const vehicleId = textValue(formData, 'vehicleId', 40);
  const vehicleType = formData.get('vehicleType');
  const brand = textValue(formData, 'brand', 80);
  const model = textValue(formData, 'model', 80);
  const color = textValue(formData, 'color', 50);
  const plateNumber = textValue(formData, 'plateNumber', 30);
  const year = Number(formData.get('year'));
  const capacity = Number(formData.get('capacity'));
  const maximumYear = new Date().getFullYear() + 1;

  if (!isVehicleType(vehicleType) || !brand || !model || !color || !plateNumber
    || !Number.isInteger(year) || year < 1990 || year > maximumYear
    || !Number.isInteger(capacity) || capacity < 1 || capacity > 30) {
    finish('error', 'Review the vehicle details and try again.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_driver_vehicle', {
    p_vehicle_id: vehicleId,
    p_vehicle_type: vehicleType,
    p_brand: brand,
    p_model: model,
    p_year: year,
    p_color: color,
    p_plate_number: plateNumber,
    p_capacity: capacity,
  });
  if (error) finish('error', 'Vehicle details could not be saved. Check that the plate number is unique.');
  revalidatePath(ONBOARDING_PATH);
  finish('message', 'Vehicle details saved.');
}

type UploadTarget = {
  bucket: 'driver-documents' | 'vehicle-documents';
  record: (supabase: Awaited<ReturnType<typeof createClient>>, path: string, expiration: string | null) => Promise<{ error: { message: string } | null }>;
};

async function uploadDocument(formData: FormData, target: UploadTarget) {
  const profile = await requireDriverApplicant();
  const file = formData.get('file');
  const expiration = parseExpirationDate(formData.get('expiresOn'));
  if (!(file instanceof File) || !isAllowedDocument(file)) {
    finish('error', 'Choose a PDF, JPG, or PNG document no larger than 5 MB.');
  }
  if (!(await hasAllowedDocumentSignature(file))) {
    finish('error', 'The file contents do not match the selected PDF, JPG, or PNG format.');
  }
  if (expiration === undefined) finish('error', 'Enter a valid expiration date.');

  const supabase = await createClient();
  const path = `${profile.id}/${crypto.randomUUID()}.${safeDocumentExtension(file)}`;
  const { error: uploadError } = await supabase.storage.from(target.bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) finish('error', 'The private document upload failed.');

  const { error: recordError } = await target.record(supabase, path, expiration);
  if (recordError) {
    await supabase.storage.from(target.bucket).remove([path]);
    if (recordError.message.includes('schema cache') || recordError.message.includes('Could not find the function')) {
      finish('error', 'Document recording is not configured. Apply the latest Supabase migration.');
    }
    finish('error', 'The document record could not be saved.');
  }
  revalidatePath(ONBOARDING_PATH);
  finish('message', 'Document uploaded securely.');
}

export async function uploadDriverDocument(formData: FormData) {
  const documentType = formData.get('documentType');
  if (!isDriverDocumentType(documentType)) finish('error', 'Invalid driver document type.');
  return uploadDocument(formData, {
    bucket: 'driver-documents',
    record: async (supabase, path, expiration) => supabase.rpc('record_driver_document', {
      p_document_type: documentType,
      p_storage_path: path,
      p_expires_on: expiration,
    }),
  });
}

export async function uploadVehicleDocument(formData: FormData) {
  const documentType = formData.get('documentType');
  const vehicleId = textValue(formData, 'vehicleId', 40);
  if (!isVehicleDocumentType(documentType) || !vehicleId) finish('error', 'Save a vehicle before uploading its documents.');
  return uploadDocument(formData, {
    bucket: 'vehicle-documents',
    record: async (supabase, path, expiration) => supabase.rpc('record_vehicle_document', {
      p_vehicle_id: vehicleId,
      p_document_type: documentType,
      p_storage_path: path,
      p_expires_on: expiration,
    }),
  });
}

export async function submitOnboarding() {
  await requireDriverApplicant();
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_driver_onboarding');
  if (error) finish('error', 'Complete personal details, vehicle details, and required documents before submitting.');
  revalidatePath(ONBOARDING_PATH);
  finish('message', 'Onboarding submitted for review.');
}
