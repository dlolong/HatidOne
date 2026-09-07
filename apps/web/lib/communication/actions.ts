'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
function text(form:FormData,key:string){const value=form.get(key);return typeof value==='string'?value.trim():'';}
export async function sendMessage(form:FormData){const profile=await requireProfile();const id=text(form,'ride_id');const client=await createClient();const {error}=await client.rpc('send_ride_message',{p_ride_request_id:id,p_body:text(form,'body'),p_client_message_id:text(form,'message_id')});const path=profile.role==='driver'?'/driver':`/booking/${id}`;revalidatePath(path);if(error)redirect(`${path}?error=Message%20could%20not%20be%20sent.`);}
export async function reportSafety(form:FormData){const profile=await requireProfile();const id=text(form,'ride_id');const client=await createClient();const {error}=await client.rpc('report_ride_safety',{p_ride_request_id:id,p_category:text(form,'category'),p_details:text(form,'details')});const path=profile.role==='driver'?'/driver':`/booking/${id}`;revalidatePath(path);redirect(`${path}?${error?'error=Report%20could%20not%20be%20saved.':'message=Report%20sent%20to%20operations.'}`);}

export async function markMessagesRead(id:string){await requireProfile();const client=await createClient();await client.rpc('mark_ride_messages_read',{p_ride_request_id:id});}
