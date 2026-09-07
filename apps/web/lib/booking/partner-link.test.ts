import { describe,it,expect } from 'vitest';
import { parseBookingIntent } from './partner-link';
describe('external booking intent',()=>{
 it('accepts only bounded intent and keeps financial/role values out',()=>{const result=parseBookingIntent({partner_id:'bad',destination_latitude:'999',guest_count:'NaN',service_type:'admin',fare:'1',role:'admin'});expect(result.partnerId).toBeUndefined();expect(result.destinationLat).toBeUndefined();expect(result.guestCount).toBeUndefined();expect(result).not.toHaveProperty('fare');expect(result).not.toHaveProperty('role');});
 it('accepts web and mobile coordinate aliases consistently',()=>{expect(parseBookingIntent({destination_latitude:'13.76',destination_longitude:'121.05'}).destinationLat).toBe(parseBookingIntent({destination_lat:'13.76',destination_lng:'121.05'}).destinationLat);});
});
