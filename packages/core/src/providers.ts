export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentResult = { eventId: string; bookingId: string; status: PaymentStatus; source: 'mock'; label: 'DEMO PAYMENT' };
export interface PaymentProvider { simulate(input: { eventId: string; bookingId: string; status: PaymentStatus }): Promise<PaymentResult> }
export type RuntimeMode = { environment: string; demoMode: boolean; mockPaymentEnabled: boolean };
export function mockPaymentsAllowed(mode: RuntimeMode): boolean {
  // The caller must derive this from trusted server configuration, never request input.
  return mode.mockPaymentEnabled && (mode.environment === 'development' || mode.environment === 'test'
    || (mode.environment === 'production' && mode.demoMode));
}
export class MockPaymentProvider implements PaymentProvider {
  constructor(private readonly mode: RuntimeMode) {
    if (!mockPaymentsAllowed(mode)) throw new Error('Demo payments are disabled. Cash is available.');
  }
  async simulate(input: { eventId: string; bookingId: string; status: PaymentStatus }): Promise<PaymentResult> {
    if (!mockPaymentsAllowed(this.mode)) throw new Error('Demo payments are disabled.');
    if (!/^[0-9a-f-]{36}$/i.test(input.eventId) || !/^[0-9a-f-]{36}$/i.test(input.bookingId)
      || !['pending', 'paid', 'failed', 'refunded'].includes(input.status)) throw new Error('Invalid demo payment event.');
    // Durable idempotency and status transitions belong to the transactional database RPC.
    return { ...input, source: 'mock', label: 'DEMO PAYMENT' };
  }
}
export interface NotificationProvider {
  deliver(input: { recipientId: string; type: string; title: string; body: string; relatedEntityId?: string }): Promise<string>;
}
export interface AnalyticsProvider { record(name: string, entityId?: string): Promise<void> }
export interface CrashReporter { capture(error: Error, context?: Record<string, string>): void }
export const localCrashReporter: CrashReporter = { capture(error) { console.error(error.name, error.message); } };
