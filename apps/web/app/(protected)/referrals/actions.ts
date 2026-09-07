'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireProfile,requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
function field(form:FormData,key:string){const value=form.get(key);return typeof value==='string'?value.trim():'';}
async function run(name:string,args:Record<string,string|null>){await requireProfile();const client=await createClient();const {error}=await client.rpc(name,args);revalidatePath('/referrals');redirect(`/referrals?${error?'error=Referral%20action%20could%20not%20be%20completed.':'message=Referral%20record%20saved.'}`);}
export async function createReferral(form:FormData){return run('create_referral_code',{p_referral_type:field(form,'type'),p_organization_id:field(form,'organization_id')||null});}
export async function redeemReferral(form:FormData){return run('redeem_referral_code',{p_code:field(form,'code')});}
export async function reviewReferral(form:FormData){await requireRole('admin');return run('admin_review_referral',{p_referral_code_id:field(form,'code_id'),p_referred_user_id:field(form,'user_id'),p_status:field(form,'status'),p_note:field(form,'note')});}
