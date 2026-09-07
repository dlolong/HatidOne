// Only booking intent is accepted from external links. Authorization and attribution are validated in SQL.
export type BookingIntent = { partnerId?:string; externalReference?:string; pickup?:string; destination?:string; scheduledAt?:string; guestCount?:number; serviceType?:string; destinationLat?:number; destinationLng?:number };
export function parseBookingIntent(query: Record<string,string|undefined>):BookingIntent {
  const number = (key:string,min:number,max:number) => { const raw=query[key]; const value=raw?.trim() ? Number(raw) : NaN; return Number.isFinite(value)&&value>=min&&value<=max ? value:undefined; };
  const limited=(key:string,max:number)=>query[key]?.trim().slice(0,max)||undefined;
  return {partnerId:/^[0-9a-f-]{36}$/i.test(query.partner_id??'')?query.partner_id:undefined,externalReference:limited('external_reference',120),pickup:limited('pickup',240),destination:limited('destination',240),scheduledAt:query.scheduled_at&&Number.isFinite(Date.parse(query.scheduled_at))?query.scheduled_at:undefined,guestCount:number('guest_count',1,30),serviceType:['scheduled','transfer','local'].includes(query.service_type??'')?query.service_type:undefined,destinationLat:number('destination_latitude',-90,90)??number('destination_lat',-90,90),destinationLng:number('destination_longitude',-180,180)??number('destination_lng',-180,180)};
}
