import {it,expect} from 'vitest';
import {buildPaletteItems} from '../src/watch/command.ts';
it('only offers supported artifact routes regardless of connection permissions or stale entities',()=>{
 const base={search:'?workspace=one',teamOnly:true,adminOnly:true,artifactOnly:true,alerts:[{id:1,title:'Alert'}],sources:[{key:'repo-1',name:'Repo'}],releases:[{id:1,coordinate:'Legacy release'}]};
 const items=buildPaletteItems({...base,query:''});
 expect(items.map(item=>item.id).sort()).toEqual(['page-overview','page-alerts','page-sources','page-releases','page-team','page-policy','page-retention','page-audit','page-tokens','page-notifications','page-workspaces','page-billing','do-new-scan'].sort());
 for(const item of items)expect(item.href).toContain('workspace=one');
 for(const query of ['health','setup','Legacy'])expect(buildPaletteItems({...base,query})).toEqual([]);
 expect(buildPaletteItems({...base,query:'Repo'}).map(item=>item.id)).toEqual(['page-sources']);
 expect(buildPaletteItems({...base,query:'notifications'}).map(item=>item.id)).toEqual(['page-notifications']);
 expect(buildPaletteItems({...base,query:'token'}).map(item=>item.id)).toEqual(['page-tokens']);
 expect(buildPaletteItems({...base,query:'Alerts'}).map(item=>item.id)).toEqual(['page-alerts']);
 expect(buildPaletteItems({...base,query:'Coverage'}).map(item=>item.id)).toEqual(['page-sources']);
 expect(buildPaletteItems({...base,query:'policy'}).some(item=>item.id==='page-policy')).toBe(true);
 expect(buildPaletteItems({...base,query:'audit'}).map(item=>item.id)).toEqual(['page-audit']);
});

const base={search:'?workspace=one&install=7',teamOnly:false,adminOnly:false,alerts:[],sources:[],releases:[]};
it('finds common page names and opens the existing billing section in the current workspace',()=>{
 expect(buildPaletteItems({...base,query:'repositories'})[0].id).toBe('page-sources');
 expect(buildPaletteItems({...base,query:'people'})[0].id).toBe('page-team');
 const billing=buildPaletteItems({...base,query:'PLÀN billing'})[0];
 expect(billing.id).toBe('page-billing');
 const url=new URL(billing.href,'https://example.com');
 expect(url.pathname).toBe('/watch/workspaces');
 expect(url.searchParams.get('workspaceTab')).toBe('billing');
 expect(url.searchParams.get('workspace')).toBe('one');
 expect(url.searchParams.get('install')).toBe('7');
});
it('matches multiple words across repository punctuation in either order and ranks exact names first',()=>{
 const sources=[{key:'repo-1',name:'indigo helpers'},{key:'repo-2',name:'indigo'},{key:'repo-3',name:'EmotiveImpact/indigo'}];
 expect(buildPaletteItems({...base,sources,query:'indigo'})[0].id).toBe('source-repo-2');
 expect(buildPaletteItems({...base,sources,query:'indigo EMOTIVE'}).map(item=>item.id)).toEqual(['source-repo-3']);
});
it('keeps real result categories together and permission-limited routes unavailable',()=>{
 const items=buildPaletteItems({...base,query:'artifact',alerts:[{id:1,title:'Artifact exposed'}],sources:[{key:'repo-1',name:'artifact'}],releases:[{id:1,coordinate:'artifact@1.0'}]});
 expect(items[0].id).toBe('source-repo-1');
 for(const group of new Set(items.map(item=>item.group))){const indexes=items.map((item,index)=>item.group===group?index:-1).filter(index=>index>=0);expect(indexes.at(-1)!-indexes[0]+1).toBe(indexes.length);}
 expect(buildPaletteItems({...base,query:'registry'})).toEqual([]);
 expect(buildPaletteItems({...base,query:'audit'})).toEqual([]);
 expect(buildPaletteItems({...base,query:'not a saved record'})).toEqual([]);
});
