import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardPeriod } from '../../src/lib/dashboard-period';
import { fetchCrmFinance, summarizeCrmFinance, fetchCrmAppointments } from '../../src/lib/mcp/crm';
import { fetchStudioPaymentsForClient } from '../../src/lib/mcp/payments';
import { resolveDashboardScope } from '../../src/lib/dashboard-scope';
import type { SupabaseClient } from '@supabase/supabase-js';

beforeEach(()=>vi.stubEnv('GHL_TOKEN','fictional'));
describe('Brussels civil dates and DST',()=>{
 it('spring transition is 23 hours',()=>{const p=dashboardPeriod('2026-03-29','2026-03-29');expect(p.startUtc).toBe('2026-03-28T23:00:00.000Z');expect(p.endExclusiveUtc).toBe('2026-03-29T22:00:00.000Z');});
 it('autumn transition is 25 hours',()=>{const p=dashboardPeriod('2026-10-25','2026-10-25');expect(p.startUtc).toBe('2026-10-24T22:00:00.000Z');expect(p.endExclusiveUtc).toBe('2026-10-25T23:00:00.000Z');});
 it('rejects impossible dates and long periods',()=>{expect(()=>dashboardPeriod('2026-02-30','2026-03-01')).toThrow();expect(()=>dashboardPeriod('2026-01-01','2026-12-31')).toThrow();});
});
it('CRM assignment filter is enforced locally even if provider ignores it',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input)=>Response.json(String(input).includes('pipelines')?{pipelines:[]}:{opportunities:[
  {id:'A',createdAt:'2026-10-25T10:00:00Z',assignedTo:'user-A',monetaryValue:100,status:'won'},
  {id:'B',createdAt:'2026-10-25T10:00:00Z',assignedTo:'user-B',monetaryValue:999,status:'won'}],meta:{total:2}})));
 const result=await fetchCrmFinance('2026-10-25','2026-10-25',new Map([['user-A','A']]),'user-A');
 expect(result.rows.map(r=>r.crm_opportunity_id)).toEqual(['A']);expect(result.truncated).toBe(false);
});
it('reads all cursor pages without assuming creation sort order',async()=>{
 let page=0;vi.stubGlobal('fetch',vi.fn(async(input)=>{
 if(String(input).includes('pipelines'))return Response.json({pipelines:[]});
 page++;return Response.json(page===1?{opportunities:[{id:'old',createdAt:'2020-01-01',monetaryValue:1}],meta:{nextPage:2,startAfter:1,startAfterId:'old'}}:{opportunities:[{id:'current',createdAt:'2026-10-25T10:00:00Z',monetaryValue:321,status:'won'}],meta:{total:2}});
 }));
 const result=await fetchCrmFinance('2026-10-25','2026-10-25',new Map());expect(result.rows).toHaveLength(1);expect(result.truncated).toBe(false);
 expect(summarizeCrmFinance(result.rows,'2026-10-25','2026-10-25',false).total_ganho_eur).toBe(321);
});
it('missing pagination proof suppresses totals instead of summing a sample',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input)=>Response.json(String(input).includes('pipelines')?{pipelines:[]}:{opportunities:Array.from({length:100},(_,i)=>({id:String(i),createdAt:'2026-10-25T10:00:00Z',monetaryValue:1,status:'won'}))})));
 const r=await fetchCrmFinance('2026-10-25','2026-10-25',new Map());expect(r.truncated).toBe(true);expect(summarizeCrmFinance(r.rows,'2026-10-25','2026-10-25',true).total_ganho_eur).toBeNull();
});
it('calendar queries use local boundaries and reject foreign calendar events',async()=>{
 const mock=vi.fn(async()=>Response.json({events:[{id:'other',calendarId:'B',startTime:'2026-10-25T10:00:00Z',endTime:'2026-10-25T11:00:00Z'}]}));vi.stubGlobal('fetch',mock);
 const r=await fetchCrmAppointments([{calendarId:'A',artistName:'A'}],'2026-10-25','2026-10-25');expect(r.rows).toEqual([]);expect(r.partial).toBe(true);
 const url=new URL(String(mock.mock.calls[0]?.[0]));expect(url.searchParams.get('startTime')).toBe(String(Date.parse('2026-10-24T22:00:00Z')));
});
it('payments aggregate beyond the 1000-row Data API default',async()=>{
 let offset=0;const q:any={select:()=>q,is:()=>q,gte:()=>q,lte:()=>q,order:()=>q,range:(start:number)=>{offset=start;return q;},abortSignal:async()=>({data:Array.from({length:Math.min(500,1201-offset)},(_,i)=>({id:String(offset+i),artist_id:'A',total:2,valor_cartao:2})),error:null,count:1201})};
 const r=await fetchStudioPaymentsForClient({from:()=>q} as unknown as SupabaseClient,'2026-10-25','2026-10-25',new Map());expect(r.registos).toBe(1201);expect(r.total_recebido_eur).toBe(2402);expect(r.truncado).toBe(false);
});
it('unknown or unlinked users never query global artists',async()=>{
 for(const profile of [{role:'unknown'},{role:'artist',artist_id:null},null]){
 const from=vi.fn(()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:profile,error:null})})})}));
 await expect(resolveDashboardScope({from} as unknown as SupabaseClient,'user')).rejects.toMatchObject({status:403});expect(from).toHaveBeenCalledTimes(1);
 }
});
