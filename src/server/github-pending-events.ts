import {createHash} from 'node:crypto';
import {encryptSecret,decryptSecret} from './secret-box.ts';
import type {SqlClient} from './sql.ts';

export const githubPendingEventsSchema=`
CREATE TABLE IF NOT EXISTS github_pending_events (
 delivery_id TEXT PRIMARY KEY,
 installation_id BIGINT NOT NULL CHECK(installation_id>0),
 event TEXT NOT NULL,
 payload_hash TEXT NOT NULL,
 payload_ciphertext TEXT NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '7 days',
 replayed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS github_pending_events_installation ON github_pending_events(installation_id,received_at,delivery_id);
`;

/** Caller must verify the exact request-body HMAC before entering this inbox.
 * Binding must take this same lock before inserting the installation/mapping. */
export async function stageUnboundGithubEvent(sql:SqlClient,secret:string,event:string,deliveryId:string,payload:Record<string,unknown>):Promise<boolean>{
 const installation=payload.installation as {id?:unknown}|undefined;
 const installationId=installation?.id;
 if(!Number.isSafeInteger(installationId)||Number(installationId)<=0)return false;
 const body=JSON.stringify(payload);
 const hash=createHash('sha256').update(event).update('\n').update(body).digest('hex');
 return sql.transaction(async tx=>{
  await tx.query('LOCK TABLE github_pending_events IN SHARE ROW EXCLUSIVE MODE');
  // Existing sources retain the ordinary webhook/worker path.
  if((await tx.query('SELECT 1 FROM installations WHERE id=$1',[installationId])).rows.length)return false;
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(deliveryId)||!event||event.length>100)throw Object.assign(new Error('Invalid GitHub delivery.'),{status:400});
  const existing=await tx.query<{payload_hash:string}>('SELECT payload_hash FROM github_pending_events WHERE delivery_id=$1',[deliveryId]);
  if(existing.rows.length){
   if(existing.rows[0].payload_hash!==hash)throw Object.assign(new Error('Conflicting GitHub delivery.'),{status:409});
   return true;
  }
  // This is an expiring pre-connection transport inbox, not customer scan history.
  await tx.query('DELETE FROM github_pending_events WHERE expires_at<=now()');
  const {rows}=await tx.query<{bytes:string;count:string}>(`SELECT COALESCE(sum(octet_length(payload_ciphertext)),0)::text AS bytes,
    count(*) FILTER(WHERE installation_id=$1)::text AS count FROM github_pending_events`,[installationId]);
  const encrypted=encryptSecret(body,secret);
  if(Buffer.byteLength(body)>1024*1024||Number(rows[0].bytes)+Buffer.byteLength(encrypted)>64*1024*1024||Number(rows[0].count)>=512)
   throw Object.assign(new Error('Pending GitHub connection inbox is full. Retry after connecting the installation.'),{status:503});
  await tx.query(`INSERT INTO github_pending_events(delivery_id,installation_id,event,payload_hash,payload_ciphertext)
    VALUES($1,$2,$3,$4,$5)`,[deliveryId,installationId,event,hash,encrypted]);
  return true;
 });
}

/** Internal coordinator read, never a customer response. No implicit ownership grant. */
export async function pendingGithubEvents(sql:SqlClient,secret:string,installationId:number){
 const {rows}=await sql.query<{delivery_id:string;event:string;payload_ciphertext:string;received_at:Date|string}>(`SELECT delivery_id,event,payload_ciphertext,received_at
   FROM github_pending_events WHERE installation_id=$1 AND expires_at>now() AND replayed_at IS NULL ORDER BY received_at,delivery_id`,[installationId]);
 return rows.map(row=>({deliveryId:row.delivery_id,event:row.event,receivedAt:new Date(row.received_at).toISOString(),payload:JSON.parse(decryptSecret(row.payload_ciphertext,secret)) as Record<string,unknown>}));
}
