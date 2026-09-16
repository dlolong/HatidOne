import type { Metadata } from 'next';
import { AcquisitionPage } from '@/components/marketing/acquisition';
export const metadata: Metadata = { title: 'Apply to drive with HatidOne', description: 'Create your account, complete your driver application and track its review.' };
export default function DriversPage() {
  return <AcquisitionPage eyebrow="Drive with HatidOne" title="Your driver application starts here." description="Create your account or use your existing HatidOne login. Complete your details and documents, then submit for review. You can accept trips only after approval." points={['Create or sign in to one HatidOne account', 'Complete personal, vehicle and document details', 'Submit your application and track its review']} cta="Apply to drive" href="/signup?intent=driver" />;
}
