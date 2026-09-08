import {it,expect} from 'vitest';
import {filterDeskAlerts,type DeskAlert} from '../src/watch/verdict.ts';
import {countOpenAlerts} from '../src/watch/view-models.ts';
it('uses stable identity for mine filters despite renamed or matching display names',()=>{
 const base:DeskAlert={id:1,kind:'release_scan',title:'Issue',body:'Evidence',findings:null,created_at:'2026-09-06'};
 const own={...base,assigned_to_user_id:'person',assigned_to_login:'old-name'};
 const other={...base,id:2,assigned_to_user_id:'another',assigned_to_login:'new-name'};
 const unknown={...base,id:3,assigned_to_login:'new-name'};
 expect(filterDeskAlerts([own,other,unknown],'mine','new-name',false,'person')).toEqual([own]);
 expect(countOpenAlerts([own,other,unknown],'new-name','person').assigned).toBe(1);
 expect(filterDeskAlerts([own,other,unknown],'open','new-name',true,'person')).toEqual([own]);
 expect(filterDeskAlerts([{...own,resolved_at:'2026-09-06'}],'done','new-name',true,'person')).toHaveLength(1);
});
