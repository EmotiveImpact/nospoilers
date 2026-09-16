// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it} from 'vitest';
import {radixUiTestSupport} from './helpers/radix-ui';
import {AuditScreen} from '../src/components/watch/screens/AuditScreen';
radixUiTestSupport();
afterEach(cleanup);
const audit={status:'ready' as const,rows:[{id:1,at:new Date().toISOString(),actorLogin:'Admin',action:'policy_updated',summary:'Strict scan rules enabled'},{id:2,at:'2020-01-01T12:00:00Z',actorLogin:'Owner',action:'member_invited',summary:'Invited Alex'}]};
it('filters actual loaded audit events without losing their details',async()=>{
 render(<AuditScreen previewing={false} audit={audit} installationId={23}/>);
 expect(screen.getByRole('table',{name:'Administrative changes'})).toBeTruthy();
 expect(screen.getByText('Invited Alex')).toBeTruthy();
 await userEvent.click(screen.getByRole('combobox',{name:'Audit date'}));
 await userEvent.click(screen.getByRole('option',{name:'Last 7 days'}));
 expect(screen.queryByText('Invited Alex')).toBeNull();
 expect(screen.getByText('Strict scan rules enabled')).toBeTruthy();
 await userEvent.click(screen.getByRole('combobox',{name:'Audit event'}));
 await userEvent.click(screen.getByRole('option',{name:'member invited'}));
 expect(screen.getByText('No loaded events match these filters.')).toBeTruthy();
});
it('withholds event filters and export authority after a load failure',()=>{
 render(<AuditScreen previewing={false} audit={{status:'error',message:'Access changed'}} installationId={23}/>);
 expect(screen.getByRole('button',{name:'Export audit JSON'})).toHaveProperty('disabled',true);
 expect(screen.queryByRole('combobox')).toBeNull();
 expect(screen.queryByRole('table')).toBeNull();
 expect(screen.getByRole('alert').textContent).toBe('Access changed');
});
