import type { Metadata } from 'next';
import { AcquisitionPage } from '@/components/marketing/acquisition';
export const metadata: Metadata = { title:'Fleet transportation software · HatidOne' };
export default function FleetsPage() { return <AcquisitionPage eyebrow="Fleet operations" title="Put your fleet’s next day in order." description="Coordinate drivers, vehicles and scheduled demand with a shared transport calendar. Business subscriptions support HatidOne’s driver-first network." points={['Drivers and vehicle records','Manual dispatch and scheduled demand','Booking calendar and revenue summaries','Free, Starter, Business and Enterprise plans']} cta="Create a fleet account" />; }
