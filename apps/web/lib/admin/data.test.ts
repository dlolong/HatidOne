import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminDashboard from '@/app/(protected)/admin/page';
const mocks = vi.hoisted(() => ({ role: vi.fn(), from: vi.fn() }));
vi.mock('server-only',()=>({}));
vi.mock('next/link', async () => {
  const { createElement } = await import('react');
  return { default: ({ href, children }: { href: string; children: ReactNode }) => createElement('a', { href }, children) };
});
vi.mock('@/lib/auth/session',()=>({requireRole:mocks.role}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:mocks.from})}));
import { getAdminDriverQueue, getAdminOverview } from './data';
beforeEach(()=>{vi.clearAllMocks();mocks.role.mockResolvedValue({id:'admin'});});
it('filters drafts and review status on the server before paging, even when drafts outnumber the page limit', async () => {
  const rows = Array.from({length:120},(_,index)=>({id:String(index),user_id:'applicant',verification_status:'pending'}));
  rows.push({id:'submitted',user_id:'applicant',verification_status:'under_review'});
  let matching = [...rows]; let total = 0;
  const query = {
    select:vi.fn().mockReturnThis(),
    neq:vi.fn((key:string,value:string)=>{ matching=matching.filter(row=>row[key as keyof typeof row]!==value);return query;}),
    eq:vi.fn((key:string,value:string)=>{matching=matching.filter(row=>row[key as keyof typeof row]===value);return query;}),
    order:vi.fn().mockReturnThis(),
    range:vi.fn((from:number,to:number)=>{total=matching.length;return Promise.resolve({data:matching.slice(from,to+1),count:total,error:null});}),
  };
  const profiles={select:()=>({in:async()=>({data:[{id:'applicant',first_name:'Test',last_name:'Applicant'}],error:null})})};
  mocks.from.mockImplementation((table:string)=>table==='driver_profiles'?query:profiles);
  const result=await getAdminDriverQueue({});
  expect(mocks.role).toHaveBeenCalledWith('admin');
  expect(result.total).toBe(1);expect(result.drivers[0].id).toBe('submitted');
  expect(result.drivers[0].person?.first_name).toBe('Test');
  expect(query.select).toHaveBeenCalledWith(expect.any(String),{count:'exact'});
});
it('rejects unauthorized overview and driver queue access before querying private records', async () => {
  mocks.role.mockRejectedValue(new Error('access denied'));
  await expect(getAdminDriverQueue({})).rejects.toThrow('access denied');
  await expect(getAdminOverview()).rejects.toThrow('access denied');
  expect(mocks.from).not.toHaveBeenCalled();
});

it('recovers to page one when a saved queue page is outside the current result set', async () => {
  const query={select:vi.fn().mockReturnThis(),neq:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),range:vi.fn().mockResolvedValueOnce({data:null,error:{code:'PGRST103'},count:null}).mockResolvedValueOnce({data:[],error:null,count:0})};
  mocks.from.mockReturnValue(query);
  const result=await getAdminDriverQueue({page:'9999'});
  expect(result.page).toBe(1);expect(result.pageReset).toBe(true);expect(result.drivers).toEqual([]);
  expect(query.range).toHaveBeenLastCalledWith(0,24);
});

type OverviewResult = { count: number | null; error: { code: string; message?: string } | null };
function overviewQueries(results: (OverviewResult | Error)[]) {
  mocks.from.mockImplementation(() => {
    const result = results.shift();
    const query = {
      select: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(),
      then: (resolve: (value: OverviewResult) => unknown, reject: (reason: Error) => unknown) =>
        result instanceof Error ? Promise.reject(result).then(resolve, reject) : Promise.resolve(result as OverviewResult).then(resolve, reject),
    };
    return query;
  });
}
it('loads exact overview counts without fetching any ride or applicant rows', async () => {
  overviewQueries([3,2,1,5,4,6,7].map(count=>({count,error:null})));
  await expect(getAdminOverview()).resolves.toMatchObject({unassigned:3,quotes:2,safety:1,reviews:5,active:4,upcoming:6,overdue:7,unavailable:[]});
  for (const call of mocks.from.mock.results) {
    expect(call.value.select).toHaveBeenCalledWith('id',{count:'exact'});
    expect(call.value.limit).toHaveBeenCalledWith(0);
  }
});
it('keeps available counts when quote_status is missing and reports the database update requirement', async () => {
  overviewQueries([0,0,0,0,0,0,0].map((count,index)=>index===1?{count:null,error:{code:'42703',message:'private provider diagnostic'}}:{count,error:null}));
  const result=await getAdminOverview();
  expect(result.quotes).toBeNull();expect(result.unassigned).toBe(0);
  expect(result.unavailable).toEqual([{metric:'quotes',label:'Operator quotes needed',reason:'schema'}]);
  expect(JSON.stringify(result)).not.toContain('private provider diagnostic');
});
it('does not interpret rejected requests, access errors or missing counts as zero', async () => {
  overviewQueries([new Error('private network details'),{count:null,error:{code:'42501'}},{count:null,error:null},...[0,0,0,0].map(count=>({count,error:null}))]);
  const result=await getAdminOverview();
  expect(result.unassigned).toBeNull();expect(result.quotes).toBeNull();expect(result.safety).toBeNull();
  expect(result.unavailable.map(item=>item.reason)).toEqual(['unavailable','unavailable','unavailable']);
});
it('renders unavailable counts without claiming that all attention queues are empty', async () => {
  overviewQueries([0,0,0,0,0,0,0].map((count,index)=>index===1?{count:null,error:{code:'42703'}}:{count,error:null}));
  const html=renderToStaticMarkup(await AdminDashboard());
  expect(html).toContain('Some overview counts are unavailable.');
  expect(html).toContain('A database update is required for this count.');
  expect(html).toContain('Unavailable');expect(html).not.toContain('No work waiting');
});
it('shows an empty overview only when the relevant queues were successfully counted', async () => {
  overviewQueries(Array.from({length:7},()=>({count:0,error:null})));
  expect(renderToStaticMarkup(await AdminDashboard())).toContain('No work waiting');
});
