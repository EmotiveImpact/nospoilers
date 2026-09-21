import type {SqlClient} from './sql.ts';
export async function migrateReleaseGateAccess(sql:SqlClient){await sql.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock($1)',[1857679437]);
  if((await tx.query("SELECT id FROM schema_migrations WHERE id='ra_006_gate_ci_access'")).rows.length)return;
  await tx.exec(`ALTER TABLE release_gate_decisions ADD COLUMN capability_key TEXT;
    ALTER TABLE installations ADD COLUMN gate_connection_generation BIGINT NOT NULL DEFAULT 1;
    CREATE FUNCTION advance_gate_installation_generation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.suspended IS DISTINCT FROM OLD.suspended OR NEW.disconnected_at IS DISTINCT FROM OLD.disconnected_at
      THEN NEW.gate_connection_generation:=OLD.gate_connection_generation+1;
      ELSE NEW.gate_connection_generation:=OLD.gate_connection_generation; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER gate_installation_generation BEFORE UPDATE ON installations
      FOR EACH ROW EXECUTE FUNCTION advance_gate_installation_generation();
    CREATE TABLE release_gate_ci_grants (
      stream_id UUID NOT NULL REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
      token_id BIGINT NOT NULL REFERENCES scan_api_tokens(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL CHECK(revision>0),enabled BOOLEAN NOT NULL,
      actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seed_release_id BIGINT NOT NULL REFERENCES release_revisions(id) ON DELETE CASCADE,
      source_binding TEXT NOT NULL,selector TEXT NOT NULL,source_generation TEXT NOT NULL,installation_generation BIGINT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(stream_id,token_id)
    );`);
  await tx.query("INSERT INTO schema_migrations(id) VALUES('ra_006_gate_ci_access')");
});}
