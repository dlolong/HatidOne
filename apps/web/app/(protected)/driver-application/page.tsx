import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/session';
import { ConfirmForm } from '@/components/confirm-form';
import { SubmitButton } from '@/components/submit-button';
import { Dashboard,DashboardCard } from '@/components/dashboard';
import { beginApplication } from './actions';
export default async function DriverApplication({searchParams}:{searchParams:Promise<{error?:string}>}){const profile=await requireProfile();if(profile.role==='driver')redirect('/driver/onboarding');const query=await searchParams;return <Dashboard eyebrow="Join the driver network" title="Start your driver application" description="Set up your driver account, add a vehicle and submit your documents for operations review.">{query.error&&<p role="alert">{query.error}</p>}<DashboardCard title="Use this account for driving"><p>This changes your account to a driver account. Complete or cancel any active passenger bookings first. Use a separate passenger account if you also need to book rides.</p><p>You will remain unverified and offline until operations reviews your license and vehicle documents.</p><ConfirmForm action={beginApplication} message="Use this account as a driver account and begin document onboarding?"><SubmitButton pendingLabel="Starting application…">Start driver application</SubmitButton></ConfirmForm></DashboardCard></Dashboard>;}
