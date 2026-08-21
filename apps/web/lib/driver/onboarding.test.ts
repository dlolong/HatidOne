import { describe, expect, it } from 'vitest';
import {
  isAllowedDocument,
  isDriverDocumentType,
  isExpirationCurrent,
  isVehicleDocumentType,
  matchesDocumentSignature,
  onboardingProgress,
  parseExpirationDate,
} from './onboarding';

describe('driver onboarding authorization helpers', () => {
  it('accepts only allowlisted document types', () => {
    expect(isDriverDocumentType('drivers_license')).toBe(true);
    expect(isDriverDocumentType('verification_status')).toBe(false);
    expect(isVehicleDocumentType('registration')).toBe(true);
    expect(isVehicleDocumentType('verified')).toBe(false);
  });

  it('rejects oversized and unexpected document content types', () => {
    expect(isAllowedDocument({ size: 1024, type: 'application/pdf' })).toBe(true);
    expect(isAllowedDocument({ size: 6 * 1024 * 1024, type: 'application/pdf' })).toBe(false);
    expect(isAllowedDocument({ size: 1024, type: 'text/html' })).toBe(false);
  });

  it('requires the uploaded bytes to match the declared document type', () => {
    expect(matchesDocumentSignature('application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
    expect(matchesDocumentSignature('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(matchesDocumentSignature('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(matchesDocumentSignature('image/png', new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]))).toBe(false);
    expect(matchesDocumentSignature('text/html', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(false);
  });

  it('validates real ISO calendar dates', () => {
    expect(parseExpirationDate('2028-02-29')).toBe('2028-02-29');
    expect(parseExpirationDate('2027-02-29')).toBeUndefined();
    expect(parseExpirationDate('')).toBeNull();
    expect(isExpirationCurrent('2028-02-29', '2028-02-28')).toBe(true);
    expect(isExpirationCurrent('2028-02-27', '2028-02-28')).toBe(false);
    expect(isExpirationCurrent(null, '2028-02-28')).toBe(true);
  });

  it('requires personal, vehicle, and both required documents before submission', () => {
    expect(onboardingProgress({
      hasPersonalDetails: true,
      hasVehicle: true,
      hasDriverLicense: true,
      hasVehicleRegistration: false,
    })).toEqual({ completedSteps: 2, totalSteps: 3, percentage: 67, canSubmit: false });
  });
});
