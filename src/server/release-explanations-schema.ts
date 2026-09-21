import type {SqlClient} from './sql.ts';
export async function migrateReleaseExplanations(sql:SqlClient){await sql.transaction(async tx=>{
 await tx.query('SELECT pg_advisory_xact_lock($1)',[1857679437]);
 if((await tx.query("SELECT id FROM schema_migrations WHERE id='ra_010_release_explanations'")).rows.length)return;
 await tx.exec(`CREATE TABLE release_explanation_budgets(workspace_id UUID PRIMARY KEY REFERENCES product_workspaces(id) ON DELETE CASCADE,day DATE NOT NULL,calls INTEGER NOT NULL CHECK(calls BETWEEN 0 AND 10),currency TEXT NOT NULL,reserved_cost INTEGER NOT NULL CHECK(reserved_cost>=0));
 CREATE TABLE release_explanations(
 id UUID PRIMARY KEY,stream_id UUID NOT NULL REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
 snapshot_id UUID NOT NULL,FOREIGN KEY(snapshot_id,stream_id) REFERENCES release_intelligence_snapshots(id,stream_id) ON DELETE CASCADE,
 actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,provider_id TEXT NOT NULL,model TEXT NOT NULL,currency TEXT NOT NULL,max_cost_minor INTEGER NOT NULL,consent_key TEXT NOT NULL,request_key UUID NOT NULL,UNIQUE(stream_id,snapshot_id,request_key),
 state TEXT NOT NULL CHECK(state IN ('started','pending','accepted','rejected','failed','cancelled')),
 text TEXT,reviewed_text TEXT,reviewer TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),reviewed_at TIMESTAMPTZ,
 CHECK(text IS NULL OR length(text)<=4000),CHECK(reviewed_text IS NULL OR length(reviewed_text) BETWEEN 8 AND 1000)
 );
 CREATE INDEX release_explanations_stream ON release_explanations(stream_id,snapshot_id,created_at DESC);
 CREATE FUNCTION protect_release_explanation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (to_jsonb(NEW)-'state'-'text'-'reviewed_text'-'reviewer'-'reviewed_at') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'text'-'reviewed_text'-'reviewer'-'reviewed_at')
 OR NOT ((OLD.state='started' AND NEW.state IN ('pending','failed','cancelled') AND NEW.reviewed_text IS NULL AND NEW.reviewer IS NULL AND NEW.reviewed_at IS NULL
 AND ((NEW.state='pending' AND NEW.text IS NOT NULL) OR (NEW.state<>'pending' AND NEW.text IS NULL)))
 OR (OLD.state='pending' AND NEW.state IN ('accepted','rejected') AND NEW.text IS NOT DISTINCT FROM OLD.text AND NEW.reviewer IS NOT NULL AND NEW.reviewed_at IS NOT NULL
 AND ((NEW.state='accepted' AND NEW.reviewed_text IS NOT NULL) OR (NEW.state='rejected' AND NEW.reviewed_text IS NULL))))
 THEN RAISE EXCEPTION 'explanation audit and completed review are immutable'; END IF; RETURN NEW; END $$;
 CREATE TRIGGER release_explanation_guard BEFORE UPDATE ON release_explanations FOR EACH ROW EXECUTE FUNCTION protect_release_explanation();
 CREATE FUNCTION protect_release_explanation_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF pg_trigger_depth()<=1 THEN RAISE EXCEPTION 'explanation audit deletes require owning record retention'; END IF; RETURN OLD; END $$;
 CREATE TRIGGER release_explanation_delete_guard BEFORE DELETE ON release_explanations FOR EACH ROW EXECUTE FUNCTION protect_release_explanation_delete();`);
 await tx.query("INSERT INTO schema_migrations(id) VALUES('ra_010_release_explanations')");
});}
