export type Capability = { name: string; mode: 'real' | 'manual' | 'demo' | 'unavailable'; detail: string };
export function isIsolatedDemoEnvironment() {
  return ['demo', 'test'].includes(process.env.HATIDONE_ENVIRONMENT ?? '') && process.env.HATIDONE_DEMO_MODE === 'true';
}
export function releaseCapabilities(integrationsEnabled: boolean, demoPaymentEnabled = false): Capability[] {
  return [
    { name: 'Scheduled requests and trip state', mode: 'real', detail: 'Authenticated database functions; deployed end-to-end verification is a separate gate.' },
    { name: 'Addresses, route and quote', mode: 'manual', detail: 'Operator checks addresses, route uncertainty, occupied duration and quote. No verified maps or exact ETA.' },
    { name: 'Dispatch and reminders', mode: 'manual', detail: 'Operator assigns and processes expiry. Driver must reconfirm in app. No deployed scheduler verified.' },
    { name: 'Cash collection', mode: 'manual', detail: 'Driver report and operations reconciliation are separate events; completion alone is unpaid.' },
    { name: 'In-app updates', mode: 'real', detail: 'Refresh while connected. Operator confirms by an agreed contact channel when apps are closed.' },
    { name: 'Push, SMS and payment gateway', mode: 'unavailable', detail: integrationsEnabled ? 'No tested live provider configured. Enabling integrations does not provision a provider.' : 'Integration switch is off.' },
    { name: 'Demo payments', mode: isIsolatedDemoEnvironment() && integrationsEnabled && demoPaymentEnabled ? 'demo' : 'unavailable', detail: 'Requires isolated demo/test server environment and database demo/payment flags. Never real collection.' },
    { name: 'Safety monitoring', mode: 'manual', detail: 'Reports enter the operator queue. No automatic emergency response or guaranteed coverage.' },
  ];
}
