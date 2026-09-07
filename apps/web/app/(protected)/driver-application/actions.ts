'use server';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
export async function beginApplication(){await requireProfile();const client=await createClient();const {error}=await client.rpc('request_driver_application');if(error)redirect('/driver-application?error=Application%20could%20not%20be%20started.%20Complete%20or%20cancel%20active%20passenger%20bookings%20first.');redirect('/driver/onboarding');}
