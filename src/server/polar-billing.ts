import type {SqlClient} from './sql.ts';
import {polarSubscriptionCovers,polarSubscriptionEnded,type PolarBillingPatch} from './polar.ts';

/**
 * Migration 125. Polar columns sit beside the dormant Stripe columns, which
 * never went live; nothing is copied across, so no Stripe identifier can be
 * mistaken for a Polar one.
 */
export const polarBillingSchema=`
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS polar_status TEXT;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS polar_product_id TEXT;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS polar_current_period_end TIMESTAMPTZ;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS polar_modified_at TIMESTAMPTZ;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS polar_retired_subscription_ids JSONB NOT NULL DEFAULT '[]';
CREATE UNIQUE INDEX IF NOT EXISTS billing_accounts_polar_subscription_uidx
  ON billing_accounts (polar_subscription_id) WHERE polar_subscription_id IS NOT NULL;
ALTER TABLE personal_organization_billing ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;
ALTER TABLE personal_organization_billing ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;
ALTER TABLE personal_organization_billing ADD COLUMN IF NOT EXISTS polar_status TEXT;
ALTER TABLE personal_organization_billing ADD COLUMN IF NOT EXISTS polar_product_id TEXT;
ALTER TABLE personal_organization_billing ADD COLUMN IF NOT EXISTS polar_current_period_end TIMESTAMPTZ;
ALTER TABLE personal_organization_billing ADD COLUMN IF NOT EXISTS polar_modified_at TIMESTAMPTZ;
ALTER TABLE personal_organization_billing ADD COLUMN IF NOT EXISTS polar_retired_subscription_ids JSONB NOT NULL DEFAULT '[]';
CREATE UNIQUE INDEX IF NOT EXISTS personal_organization_billing_polar_subscription_uidx
  ON personal_organization_billing (polar_subscription_id) WHERE polar_subscription_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS polar_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export type BillingAccount={organizationId:string;installationId:number|null};

export type PolarBillingState={
  trialEndsAt:string|null;
  plan:string|null;
  polarCustomerId:string|null;
  polarSubscriptionId:string|null;
  polarStatus:string|null;
  periodEnd:string|null;
};

const iso=(value:unknown)=>value instanceof Date?value.toISOString():typeof value==='string'?value:null;

export async function polarBillingState(sql:SqlClient,account:BillingAccount):Promise<PolarBillingState|null>{
  const {rows}=account.installationId===null
    ?await sql.query<Record<string,unknown>>(`SELECT u.trial_ends_at AS trial_ends_at,u.plan,b.polar_customer_id,b.polar_subscription_id,b.polar_status,b.polar_current_period_end
      FROM personal_organization_billing b JOIN users u ON u.id=b.user_id WHERE b.organization_id=$1`,[account.organizationId])
    :await sql.query<Record<string,unknown>>(`SELECT b.trial_ends_at,b.plan,b.polar_customer_id,b.polar_subscription_id,b.polar_status,b.polar_current_period_end
      FROM billing_accounts b WHERE b.installation_id=$1`,[account.installationId]);
  const row=rows[0];
  if(!row)return null;
  return {
    trialEndsAt:iso(row.trial_ends_at),
    plan:(row.plan as string|null)??null,
    polarCustomerId:(row.polar_customer_id as string|null)??null,
    polarSubscriptionId:(row.polar_subscription_id as string|null)??null,
    polarStatus:(row.polar_status as string|null)??null,
    periodEnd:iso(row.polar_current_period_end),
  };
}

/** Records a delivery once. Run inside the same transaction as the patch so a failed write stays retryable. */
export async function claimPolarWebhook(sql:SqlClient,id:string,type:string):Promise<boolean>{
  const {rows}=await sql.query('INSERT INTO polar_webhook_events(id,type) VALUES($1,$2) ON CONFLICT (id) DO NOTHING RETURNING id',[id,type]);
  return rows.length>0;
}

export type PolarAccountRow={subscriptionId:string|null;status:string|null;retired:string[];stale:boolean};

/**
 * The rules every subscription event passes before it can change entitlement.
 * `stale` means Polar has already told us about a newer version of this subscription.
 */
export function polarPatchDecision(row:PolarAccountRow,patch:PolarBillingPatch):{apply:boolean;replacement:boolean}{
  const reject={apply:false,replacement:false};
  if(row.retired.includes(patch.subscriptionId))return reject;
  if(row.subscriptionId===patch.subscriptionId){
    if(row.stale)return reject;
    // An ended subscription cannot be revived by a late delivery.
    if(polarSubscriptionEnded(row.status)&&patch.status!==row.status)return reject;
    return {apply:true,replacement:false};
  }
  if(!row.subscriptionId)return {apply:true,replacement:false};
  // A second subscription only takes over once the first has ended for good.
  if(polarSubscriptionEnded(row.status)&&polarSubscriptionCovers(patch.status)&&patch.plan&&!patch.clearPlan)return {apply:true,replacement:true};
  return reject;
}

type Target={kind:'installation';installationId:number}|{kind:'personal';organizationId:string};

async function boundTarget(sql:SqlClient,subscriptionId:string):Promise<Target|null|'conflict'>{
  const installation=await sql.query<{installation_id:unknown}>('SELECT installation_id FROM billing_accounts WHERE polar_subscription_id=$1 OR polar_retired_subscription_ids ? $1',[subscriptionId]);
  const personal=await sql.query<{organization_id:string}>('SELECT organization_id FROM personal_organization_billing WHERE polar_subscription_id=$1 OR polar_retired_subscription_ids ? $1',[subscriptionId]);
  if(installation.rows.length+personal.rows.length>1)return 'conflict';
  if(installation.rows[0])return {kind:'installation',installationId:Number(installation.rows[0].installation_id)};
  if(personal.rows[0])return {kind:'personal',organizationId:personal.rows[0].organization_id};
  return null;
}

function metadataTarget(patch:PolarBillingPatch):Target|null{
  // Checkout writes installationId for GitHub-installation billing and only organizationId for personal organisations.
  if(patch.installationId!==null)return {kind:'installation',installationId:patch.installationId};
  if(patch.organizationId)return {kind:'personal',organizationId:patch.organizationId};
  return null;
}

const sameTarget=(a:Target,b:Target)=>a.kind==='installation'&&b.kind==='installation'?a.installationId===b.installationId
  :a.kind==='personal'&&b.kind==='personal'?a.organizationId===b.organizationId:false;

/**
 * Applies a verified subscription event. The subscription is bound to the
 * billing account named in the checkout metadata the first time it is seen,
 * and only that account can be changed by it afterwards.
 */
export async function applyPolarPatch(sql:SqlClient,patch:PolarBillingPatch):Promise<{applied:boolean;target:Target|null}>{
  return sql.transaction(async tx=>{
    const bound=await boundTarget(tx,patch.subscriptionId);
    if(bound==='conflict')return {applied:false,target:null};
    const named=metadataTarget(patch);
    if(bound&&named&&!sameTarget(bound,named))return {applied:false,target:null};
    const target=bound??named;
    if(!target)return {applied:false,target:null};

    const {rows}=target.kind==='installation'
      ?await tx.query<{subscription_id:string|null;status:string|null;retired:string[];stale:boolean}>(`SELECT polar_subscription_id AS subscription_id,polar_status AS status,
          polar_retired_subscription_ids AS retired,(polar_modified_at IS NOT NULL AND ($2::timestamptz IS NULL OR $2::timestamptz<polar_modified_at)) AS stale
        FROM billing_accounts WHERE installation_id=$1 FOR UPDATE`,[target.installationId,patch.modifiedAt])
      :await tx.query<{subscription_id:string|null;status:string|null;retired:string[];stale:boolean}>(`SELECT polar_subscription_id AS subscription_id,polar_status AS status,
          polar_retired_subscription_ids AS retired,(polar_modified_at IS NOT NULL AND ($2::timestamptz IS NULL OR $2::timestamptz<polar_modified_at)) AS stale
        FROM personal_organization_billing WHERE organization_id=$1 FOR UPDATE`,[target.organizationId,patch.modifiedAt]);
    const row=rows[0];
    if(!row)return {applied:false,target:null};
    const retired=Array.isArray(row.retired)?row.retired.filter((id):id is string=>typeof id==='string'):[];
    const decision=polarPatchDecision({subscriptionId:row.subscription_id,status:row.status,retired,stale:Boolean(row.stale)},patch);
    if(!decision.apply)return {applied:false,target:null};
    // A replacement must come from a checkout this account started, not from a stray binding.
    if(decision.replacement&&!(named&&sameTarget(named,target)))return {applied:false,target:null};

    const params=[patch.customerId,patch.subscriptionId,patch.status,patch.productId,patch.periodEnd,patch.modifiedAt,decision.replacement];
    const columns=`polar_customer_id=COALESCE($2,polar_customer_id),polar_subscription_id=$3,polar_status=COALESCE($4,polar_status),
      polar_product_id=COALESCE($5,polar_product_id),polar_current_period_end=COALESCE($6::timestamptz,polar_current_period_end),
      polar_modified_at=COALESCE($7::timestamptz,polar_modified_at),
      polar_retired_subscription_ids=CASE WHEN $8 THEN polar_retired_subscription_ids||jsonb_build_array(polar_subscription_id) ELSE polar_retired_subscription_ids END`;
    if(target.kind==='installation'){
      await tx.query(`UPDATE billing_accounts SET ${columns},
        plan=CASE WHEN $9 THEN NULL ELSE COALESCE($10,plan) END,
        trial_ends_at=CASE WHEN $9 THEN LEAST(trial_ends_at,now()) ELSE trial_ends_at END
        WHERE installation_id=$1`,[target.installationId,...params,patch.clearPlan,patch.plan]);
    }else{
      const {rows:owner}=await tx.query<{user_id:string}>(`UPDATE personal_organization_billing SET ${columns} WHERE organization_id=$1 RETURNING user_id`,[target.organizationId,...params]);
      // The owner's user row carries the plan every personal workspace already reads; a new workspace cannot reset it.
      await tx.query(`UPDATE users SET plan=CASE WHEN $2 THEN NULL ELSE COALESCE($3,plan) END,
        trial_ends_at=CASE WHEN $2 THEN LEAST(trial_ends_at,now()) ELSE trial_ends_at END WHERE id=$1`,[owner[0].user_id,patch.clearPlan,patch.plan]);
    }
    return {applied:true,target};
  });
}
