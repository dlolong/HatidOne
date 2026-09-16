import { randomUUID } from 'node:crypto';
import { requireProfile } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { dateTime } from '@/lib/operations/data';
import { sendMessage,reportSafety } from '@/lib/communication/actions';
import { SubmitButton } from './submit-button';
export async function RideConversation({id}:{id:string}){
 const profile=await requireProfile();const client=await createClient();const {data,error}=await client.from('ride_messages').select('id,sender_user_id,body,created_at').eq('ride_request_id',id).order('created_at',{ascending:false}).limit(50);
 if(error)throw new Error('Booking messages could not be loaded.');
 return <section className="detail-card dashboard-wide"><h2>Booking conversation</h2><p>Only your assigned trip participants and authorized operations staff can read these messages.</p>{data?.length?<ol className="event-list">{[...data].reverse().map(message=><li key={message.id}><div><strong>{message.sender_user_id===profile.id?'You':'Trip participant'}</strong><p>{message.body}</p><small>{dateTime(message.created_at)}</small></div></li>)}</ol>:<p>No messages yet. Send pickup instructions here.</p>}<form action={sendMessage} className="compact-form"><input name="ride_id" type="hidden" value={id}/><input name="message_id" type="hidden" value={randomUUID()}/><label>Message<textarea name="body" required maxLength={2000}/></label><SubmitButton pendingLabel="Sending…">Send message</SubmitButton></form><details><summary>Report a safety or conduct concern</summary><p>This sends a report to the manual operations queue. It does not call emergency services or guarantee an immediate response. Use your agreed operator contact for urgent trip issues.</p><form action={reportSafety} className="compact-form"><input name="ride_id" type="hidden" value={id}/><label>Category<select name="category">{['safety','driver','vehicle','payment','other'].map(category=><option key={category}>{category}</option>)}</select></label><label>Details<textarea name="details" maxLength={4000} required/></label><SubmitButton pendingLabel="Reporting…">Send report to operations</SubmitButton></form></details></section>;
}
