import type {SqlClient} from './sql.ts';
import {heavyUsageCapSql} from './usage.ts';

/** Consume the reservation once, using the immutable payer and original UTC day. */
export async function refundJobReservation(sql:SqlClient,id:number,workerId?:string){
 const {rows}=await sql.query<{billing_installation_id:unknown;billing_user_id:string|null;usage_day:unknown}>(`
 UPDATE jobs SET usage_reserved=false WHERE id=$1 AND usage_reserved
 AND ($2::text IS NULL OR locked_by=$2) RETURNING billing_installation_id,billing_user_id,usage_day`,[id,workerId??null]);
 const row=rows[0];if(!row)return;
 await refundBillingPayer(sql,row,row.usage_day);
}

export async function refundBillingPayer(sql:SqlClient,row:{billing_installation_id:unknown;billing_user_id:string|null},day?:unknown){
 if(row.billing_installation_id!=null)await sql.query("UPDATE hosted_usage_days SET heavy_jobs=GREATEST(0,heavy_jobs-1) WHERE installation_id=$1 AND day=COALESCE($2::date,(timezone('utc',now()))::date)",[row.billing_installation_id,day??null]);
 else if(row.billing_user_id!==null)await sql.query("UPDATE personal_scan_usage SET scans=GREATEST(0,scans-1) WHERE user_id=$1 AND day=COALESCE($2::date,(timezone('utc',now()))::date)",[row.billing_user_id,day??null]);
}

/** Retry charging uses saved ownership, never a mutable source mapping or actor. */
export async function reserveJobRetry(sql:SqlClient,id:number){
 const {rows}=await sql.query<{billing_installation_id:unknown;billing_user_id:string|null}>(
  'SELECT billing_installation_id,billing_user_id FROM jobs WHERE id=$1',[id]);
 const row=rows[0];if(!row)return false;
 return reserveBillingPayer(sql,row,true);
}

/** Used inside the enqueue/claim transaction, before persisting its reservation. */
export async function reserveBillingPayer(sql:SqlClient,row:{billing_installation_id:unknown;billing_user_id:string|null},requireActive=true){
 if(row.billing_installation_id!=null){
  const reserved=await sql.query(`INSERT INTO hosted_usage_days(installation_id,day,heavy_jobs)
   SELECT b.installation_id,(timezone('utc',now()))::date,1 FROM billing_accounts b
   WHERE b.installation_id=$1 AND (NOT $2 OR b.plan IN ('solo','team') OR b.trial_ends_at>now())
   ON CONFLICT(installation_id,day) DO UPDATE SET heavy_jobs=hosted_usage_days.heavy_jobs+1
   WHERE hosted_usage_days.heavy_jobs<(SELECT ${heavyUsageCapSql()} FROM billing_accounts b WHERE b.installation_id=$1)
   RETURNING installation_id`,[row.billing_installation_id,requireActive]);
  return reserved.rows.length>0;
 }
 if(row.billing_user_id===null)return false;
 const reserved=await sql.query(`INSERT INTO personal_scan_usage(user_id,day,scans)
  SELECT b.id,(timezone('utc',now()))::date,1 FROM users b
  WHERE b.id=$1 AND (NOT $2 OR b.plan IN ('solo','team') OR b.trial_ends_at>now())
  ON CONFLICT(user_id,day) DO UPDATE SET scans=personal_scan_usage.scans+1
  WHERE personal_scan_usage.scans<(SELECT ${heavyUsageCapSql()} FROM users b WHERE b.id=$1)
  RETURNING user_id`,[row.billing_user_id,requireActive]);
 return reserved.rows.length>0;
}
