import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {parityOrigins,parityOrigin} from '../src/server/production-parity-service.ts';
import type {SqlClient} from '../src/server/sql.ts';
import type {Stream} from '../src/release-intelligence/model.ts';

it('lists only scoped websites with eligibility matching authoritative origin checks',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`CREATE TABLE installations(id integer,suspended boolean,disconnected_at timestamptz);
      CREATE TABLE product_workspace_installations(workspace_id text,installation_id integer);
      CREATE TABLE watched_origins(id integer,origin_url text,workspace_id text,installation_id integer,verified_at timestamptz,verification_token text,paused_at timestamptz,disconnected_at timestamptz,connection_generation text);
      INSERT INTO installations VALUES(1,true,null),(2,false,null);
      INSERT INTO product_workspace_installations VALUES('ours',1),('ours',2);
      INSERT INTO watched_origins SELECT i,'https://site-'||i||'.example','ours',null,now()-interval '1 day','private-token',null,null,'generation' FROM generate_series(1,8) i;
      UPDATE watched_origins SET verification_token=null WHERE id=2;
      UPDATE watched_origins SET verified_at=now()-interval '31 days' WHERE id=3;
      UPDATE watched_origins SET paused_at=now() WHERE id=4;
      UPDATE watched_origins SET disconnected_at=now() WHERE id=5;
      UPDATE watched_origins SET workspace_id=null,installation_id=1 WHERE id=6;
      UPDATE watched_origins SET workspace_id='foreign' WHERE id=7;
      UPDATE watched_origins SET verified_at=now()+interval '1 day' WHERE id=8;`);
    const sql=db as unknown as SqlClient;
    const rows=await parityOrigins(sql,'ours');
    expect(rows.map(r=>[r.id,r.eligibility,r.eligible])).toEqual([[1,'eligible',true],[2,'unverified',false],[3,'verification_expired',false],[4,'paused',false],[5,'disconnected',false],[6,'connection_unavailable',false],[8,'verification_expired',false]]);
    expect(JSON.stringify(rows)).not.toContain('private-token');
    const stream={workspace_id:'ours'} as Stream;
    for(const row of rows){
      if(row.eligible)expect((await parityOrigin(sql,stream,row.id,false)).id).toBe(row.id);
      else await expect(parityOrigin(sql,stream,row.id,false)).rejects.toThrow();
    }
    await db.exec('UPDATE installations SET suspended=false WHERE id=1');
    expect((await parityOrigins(sql,'ours')).find(r=>r.id===6)?.eligible).toBe(true);
    expect((await parityOrigin(sql,stream,6,false)).id).toBe(6);
  }finally{await db.close();}
});
