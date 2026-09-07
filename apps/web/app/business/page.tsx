import type { Metadata } from 'next';
import { AcquisitionPage } from '@/components/marketing/acquisition';
export const metadata: Metadata = { title:'Corporate mobility and employee travel · HatidOne' };
export default function BusinessPage() { return <AcquisitionPage eyebrow="Corporate mobility" title="Keep employee travel organized." description="Arrange scheduled transportation and airport trips for authorized employees. Keep ride purposes, centralized records and monthly planning summaries in your company workspace." points={['Approved employee riders','Scheduled office and airport trips','Ride purposes and central records','Manual billing and business subscriptions']} cta="Create a business account" />; }
