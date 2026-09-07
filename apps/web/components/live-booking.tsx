'use client';
import { markMessagesRead } from '@/lib/communication/actions';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
export function LiveBooking({id}:{id:string}) {
 const router=useRouter();
 useEffect(()=>{void markMessagesRead(id);const client=createClient();const channel=client.channel(`web-ride-${id}`).on('postgres_changes',{event:'*',schema:'public',table:'ride_requests',filter:`id=eq.${id}`},()=>router.refresh()).on('postgres_changes',{event:'INSERT',schema:'public',table:'ride_messages',filter:`ride_request_id=eq.${id}`},()=>router.refresh()).subscribe();const timer=setInterval(()=>{if(document.visibilityState==='visible')router.refresh();},30000);return()=>{clearInterval(timer);void client.removeChannel(channel);};},[id,router]);
 return <p className="muted">Booking updates refresh in-app. Keep this page open for status changes.</p>;
}
