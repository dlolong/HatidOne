export const DRIVER_DOCUMENT_TYPES = ['drivers_license', 'professional_license', 'nbi_clearance', 'medical_certificate'] as const;
export const VEHICLE_DOCUMENT_TYPES = ['registration', 'insurance', 'franchise', 'inspection_certificate'] as const;
export const VEHICLE_TYPES = ['sedan', 'suv', 'van', 'motorcycle'] as const;
export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export type DriverDocumentType = (typeof DRIVER_DOCUMENT_TYPES)[number];
export type VehicleDocumentType = (typeof VEHICLE_DOCUMENT_TYPES)[number];
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export function isDriverDocumentType(value: unknown): value is DriverDocumentType {
  return typeof value === 'string' && DRIVER_DOCUMENT_TYPES.some((type) => type === value);
}

export function isVehicleDocumentType(value: unknown): value is VehicleDocumentType {
  return typeof value === 'string' && VEHICLE_DOCUMENT_TYPES.some((type) => type === value);
}

export function isVehicleType(value: unknown): value is VehicleType {
  return typeof value === 'string' && VEHICLE_TYPES.some((type) => type === value);
}

export function isAllowedDocument(file: Pick<File, 'size' | 'type'>): boolean {
  return file.size > 0
    && file.size <= MAX_DOCUMENT_BYTES
    && DOCUMENT_MIME_TYPES.some((mimeType) => mimeType === file.type);
}

export function parseExpirationDate(value: unknown): string | null | undefined {
  if (value === '' || value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
}

export function isExpirationCurrent(expiration: string | null, today = new Date().toISOString().slice(0, 10)): boolean {
  return expiration === null || expiration >= today;
}

type ProgressInput = {
  hasPersonalDetails: boolean;
  hasVehicle: boolean;
  hasDriverLicense: boolean;
  hasVehicleRegistration: boolean;
};

export function onboardingProgress(input: ProgressInput) {
  const steps = [
    input.hasPersonalDetails,
    input.hasVehicle,
    input.hasDriverLicense && input.hasVehicleRegistration,
  ];
  const completedSteps = steps.filter(Boolean).length;
  return {
    completedSteps,
    totalSteps: steps.length,
    percentage: Math.round((completedSteps / steps.length) * 100),
    canSubmit: completedSteps === steps.length,
  };
}

export function safeDocumentExtension(file: Pick<File, 'type'>): string {
  const extensions: Record<(typeof DOCUMENT_MIME_TYPES)[number], string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
  };
  return DOCUMENT_MIME_TYPES.some((mimeType) => mimeType === file.type)
    ? extensions[file.type as (typeof DOCUMENT_MIME_TYPES)[number]]
    : 'bin';
}
