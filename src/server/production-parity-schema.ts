import type {SqlClient} from './sql.ts';
export async function migrateProductionParity(sql:SqlClient){
  await sql.transaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock($1)',[1857679437]);
    if((await tx.query("SELECT id FROM schema_migrations WHERE id='ra_004_production_parity'")).rows.length)return;
    await tx.exec(`CREATE TABLE release_production_observations (
      id UUID PRIMARY KEY, request_key UUID NOT NULL UNIQUE,
      stream_id UUID NOT NULL REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
      snapshot_id UUID NOT NULL REFERENCES release_intelligence_snapshots(id) ON DELETE CASCADE,
      baseline_revision INTEGER NOT NULL, receipt_fingerprint TEXT NOT NULL,
      origin_id BIGINT NOT NULL REFERENCES watched_origins(id) ON DELETE CASCADE,
      origin_url TEXT NOT NULL, origin_generation TEXT NOT NULL,
      deployment_id TEXT NOT NULL, deployed_at TIMESTAMPTZ NOT NULL,
      actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mappings JSONB NOT NULL, job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','stopped','cancelled','failed')),
      result JSONB, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),completed_at TIMESTAMPTZ
    );
    CREATE INDEX release_production_recent ON release_production_observations(stream_id,created_at DESC);
    CREATE FUNCTION protect_production_observation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP='DELETE' THEN
        IF pg_trigger_depth()>1 THEN RETURN OLD; END IF;
        RAISE EXCEPTION 'Production observations follow original evidence deletion';
      END IF;
      IF NEW.job_id IS NULL AND pg_trigger_depth()>1 AND (to_jsonb(NEW)-'job_id')=(to_jsonb(OLD)-'job_id') THEN RETURN NEW; END IF;
      IF ROW(NEW.id,NEW.request_key,NEW.stream_id,NEW.snapshot_id,NEW.baseline_revision,NEW.receipt_fingerprint,NEW.origin_id,NEW.origin_url,NEW.origin_generation,NEW.deployment_id,NEW.deployed_at,NEW.actor_user_id,NEW.mappings,NEW.created_at)
        IS DISTINCT FROM ROW(OLD.id,OLD.request_key,OLD.stream_id,OLD.snapshot_id,OLD.baseline_revision,OLD.receipt_fingerprint,OLD.origin_id,OLD.origin_url,OLD.origin_generation,OLD.deployment_id,OLD.deployed_at,OLD.actor_user_id,OLD.mappings,OLD.created_at)
      THEN RAISE EXCEPTION 'Production observation binding is immutable'; END IF;
      IF OLD.status IN ('completed','cancelled','stopped') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Finished production observations are immutable'; END IF;
      IF OLD.job_id IS NOT NULL AND NEW.job_id IS DISTINCT FROM OLD.job_id THEN RAISE EXCEPTION 'Production observation job is immutable'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER production_observation_integrity BEFORE UPDATE OR DELETE ON release_production_observations
      FOR EACH ROW EXECUTE FUNCTION protect_production_observation();`);
    await tx.query("INSERT INTO schema_migrations(id) VALUES('ra_004_production_parity')");
  });
}
