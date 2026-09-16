import { expect, it } from 'vitest';
import { driverQueueFilters, isUuid, parseConfiguration } from './validation';
function config() {
  const form = new FormData();
  for (const [key,value] of Object.entries({ driver_commission_percent:0, default_matching_radius_km:25, offer_timeout_seconds:60, scheduled_confirmation_hours:2, mock_route_speed_kph:30, weight_distance:50, weight_reliability:20, weight_going_home:10, weight_return_trip:10, weight_idle:5, weight_preferences:5 })) form.set(key,String(value));
  return form;
}
it('normalizes queue filters and removes PostgREST filter operators from searches', () => {
  expect(driverQueueFilters({status:'pending',page:'-1'})).toEqual({status:'under_review',page:1,query:''});
  const result = driverQueueFilters({q:'José,(id.neq.*)@example.test',status:'all',page:'2'});
  expect(result).toEqual({status:'all',page:2,query:'Joséid.neq.@example.test'});
  expect(driverQueueFilters({q:'test_name+driver@example.test'}).query).toBe('test_name+driver@example.test');
  expect(driverQueueFilters({q:'a'.repeat(100)}).query).toHaveLength(80);
});
it('accepts complete supported settings and rejects omission, out-of-range and zero matching weights', () => {
  expect(parseConfiguration(config())).toMatchObject({driver_commission_percent:0,default_matching_radius_km:25,backup_driver_enabled:false});
  for (const [key, value] of [['default_matching_radius_km',''],['offer_timeout_seconds','29'],['driver_commission_percent','1'],['weight_distance','1001'],['weight_distance','1.5']]) {
    const form = config(); form.set(key,value); expect(parseConfiguration(form)).toBeNull();
  }
  const missing = config(); missing.delete('weight_idle'); expect(parseConfiguration(missing)).toBeNull();
  const zero = config(); for (const key of [...zero.keys()]) if (key.startsWith('weight_')) zero.set(key,'0');
  expect(parseConfiguration(zero)).toBeNull();
});
it('validates the UUID structure, not merely the string length', () => {
  expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
  expect(isUuid('-'.repeat(36))).toBe(false);
});
