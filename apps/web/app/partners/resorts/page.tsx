import type { Metadata } from 'next';
import { AcquisitionPage } from '@/components/marketing/acquisition';
export const metadata: Metadata = { title:'Guest transportation for resorts and hotels · HatidOne' };
export default function ResortsPage() { return <AcquisitionPage eyebrow="Resorts and hotels" title="Help every guest arrive with a plan." description="Create guest transport requests, save pickup locations, track schedules and connect reservation references to a transport booking. Your guests use the same transparent booking flow." points={['Airport and resort transfers','Guest transport schedule and status','Booking links ready for QR distribution','Reservation references and referral records']} cta="Become a transportation partner" />; }
