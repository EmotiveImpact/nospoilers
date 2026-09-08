import {it,expect} from 'vitest';
import {buildPaletteItems} from '../src/watch/command.ts';
it('only offers supported artifact routes regardless of connection permissions or stale entities',()=>{
 const base={search:'?workspace=one',teamOnly:true,adminOnly:true,artifactOnly:true,alerts:[{id:1,title:'Alert'}],sources:[{key:'repo-1',name:'Repo'}],releases:[{id:1,coordinate:'Legacy release'}]};
 const items=buildPaletteItems({...base,query:''});
 expect(items.map(item=>item.id).sort()).toEqual(['page-overview','page-alerts','page-sources','page-releases','page-team','page-policy','page-retention','page-audit','page-tokens','page-notifications','page-workspaces','do-new-scan'].sort());
 for(const item of items)expect(item.href).toContain('workspace=one');
 for(const query of ['health','setup','Repo','Legacy'])expect(buildPaletteItems({...base,query})).toEqual([]);
 expect(buildPaletteItems({...base,query:'notifications'}).map(item=>item.id)).toEqual(['page-notifications']);
 expect(buildPaletteItems({...base,query:'token'}).map(item=>item.id)).toEqual(['page-tokens']);
 expect(buildPaletteItems({...base,query:'Alerts'}).map(item=>item.id)).toEqual(['page-alerts']);
 expect(buildPaletteItems({...base,query:'Coverage'}).map(item=>item.id)).toEqual(['page-sources']);
 expect(buildPaletteItems({...base,query:'policy'}).some(item=>item.id==='page-policy')).toBe(true);
 expect(buildPaletteItems({...base,query:'audit'}).map(item=>item.id)).toEqual(['page-audit']);
});
