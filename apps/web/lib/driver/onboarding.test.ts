import { describe, expect, it } from 'vitest';
import {
  isAllowedDocument,
  isDriverDocumentType,
  isExpirationCurrent,
  isVehicleDocumentType,
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
