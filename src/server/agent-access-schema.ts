import type {SqlClient} from './sql.ts';
export async function migrateAgentAccess(sql:SqlClient){await sql.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock($1)',[1857679437]);
  if((await tx.query("SELECT id FROM schema_migrations WHERE id='ra_008_agent_access'")).rows.length)return;
  await tx.exec(`CREATE TABLE release_agent_grants(
    id UUID PRIMARY KEY,stream_id UUID NOT NULL REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
    seed_snapshot UUID NOT NULL REFERENCES release_intelligence_snapshots(id) ON DELETE CASCADE,
    actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,
    token_hash TEXT NOT NULL,proposals BOOLEAN NOT NULL,source_generation TEXT,
    expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ,calls INTEGER NOT NULL DEFAULT 0 CHECK(calls>=0 AND calls<=100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE release_agent_calls(
    id UUID PRIMARY KEY,grant_id UUID NOT NULL REFERENCES release_agent_grants(id) ON DELETE CASCADE,
    tool TEXT NOT NULL,outcome TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE release_agent_proposals(
    id UUID PRIMARY KEY,grant_id UUID NOT NULL REFERENCES release_agent_grants(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES release_remediation_cases(id) ON DELETE CASCADE,
    case_revision INTEGER NOT NULL,note TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','rejected')),
    reviewer TEXT,reviewed_note TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),reviewed_at TIMESTAMPTZ,
    CHECK ((state='pending' AND reviewer IS NULL AND reviewed_at IS NULL AND reviewed_note IS NULL)
      OR (state='rejected' AND reviewer IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_note IS NULL)
      OR (state='accepted' AND reviewer IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_note IS NOT NULL AND length(reviewed_note) BETWEEN 8 AND 1000))
  );
  CREATE INDEX release_agent_grants_stream ON release_agent_grants(stream_id,created_at DESC);
  CREATE INDEX release_agent_calls_grant ON release_agent_calls(grant_id,created_at DESC);
  CREATE INDEX release_agent_proposals_grant ON release_agent_proposals(grant_id,created_at DESC);
  CREATE FUNCTION protect_release_agent_grant() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF (to_jsonb(NEW)-'calls'-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'calls'-'revoked_at')
      OR NEW.calls<OLD.calls OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
    THEN RAISE EXCEPTION 'agent grant identity and revocation are immutable'; END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER release_agent_grant_guard BEFORE UPDATE ON release_agent_grants FOR EACH ROW EXECUTE FUNCTION protect_release_agent_grant();
  CREATE FUNCTION protect_release_agent_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF (to_jsonb(NEW)-'state'-'reviewer'-'reviewed_at'-'reviewed_note') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'reviewer'-'reviewed_at'-'reviewed_note')
      OR OLD.state<>'pending' OR NEW.state='pending'
    THEN RAISE EXCEPTION 'agent proposal and completed review are immutable'; END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER release_agent_proposal_guard BEFORE UPDATE ON release_agent_proposals FOR EACH ROW EXECUTE FUNCTION protect_release_agent_proposal();
  CREATE FUNCTION protect_release_agent_call() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF (to_jsonb(NEW)-'outcome') IS DISTINCT FROM (to_jsonb(OLD)-'outcome')
      OR OLD.outcome<>'started' OR NEW.outcome NOT IN ('completed','failed','cancelled')
    THEN RAISE EXCEPTION 'completed agent call audit is immutable'; END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER release_agent_call_guard BEFORE UPDATE ON release_agent_calls FOR EACH ROW EXECUTE FUNCTION protect_release_agent_call();`);
  await tx.query("INSERT INTO schema_migrations(id) VALUES('ra_008_agent_access')");
});}
