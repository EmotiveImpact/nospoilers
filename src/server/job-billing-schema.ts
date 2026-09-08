/** Separate the source a job operates on from the account which paid for it. */
export const jobBillingSchema=`
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS billing_installation_id BIGINT REFERENCES billing_accounts(installation_id) ON DELETE RESTRICT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS billing_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT;
UPDATE jobs SET billing_installation_id=installation_id WHERE installation_id IS NOT NULL AND billing_installation_id IS NULL AND billing_user_id IS NULL;
UPDATE jobs j SET billing_user_id=COALESCE(s.billing_user_id,s.user_id)
 FROM uploaded_scans s WHERE j.kind='uploaded_scan' AND s.id=j.payload->>'uploadId' AND j.billing_installation_id IS NULL AND j.billing_user_id IS NULL;
UPDATE jobs j SET usage_reserved=false FROM uploaded_scans s
 WHERE j.kind='uploaded_scan' AND s.id=j.payload->>'uploadId' AND s.usage_refunded;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_one_billing_owner;
ALTER TABLE jobs ADD CONSTRAINT jobs_one_billing_owner CHECK(NOT(billing_installation_id IS NOT NULL AND billing_user_id IS NOT NULL));
CREATE OR REPLACE FUNCTION bind_job_billing_owner() RETURNS trigger AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.billing_installation_id IS DISTINCT FROM OLD.billing_installation_id OR NEW.billing_user_id IS DISTINCT FROM OLD.billing_user_id) THEN
  RAISE EXCEPTION 'Job billing ownership is immutable';
 END IF;
 IF TG_OP='INSERT' AND NEW.billing_installation_id IS NULL AND NEW.billing_user_id IS NULL THEN
  NEW.billing_installation_id=NEW.installation_id;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS job_billing_owner ON jobs;
CREATE TRIGGER job_billing_owner BEFORE INSERT OR UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION bind_job_billing_owner();
CREATE INDEX IF NOT EXISTS jobs_billing_running ON jobs(billing_installation_id,billing_user_id,priority) WHERE status='running';
`;
