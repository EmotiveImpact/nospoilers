// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Button} from '../src/components/ui/button';
import {NotificationsScreen} from '../src/components/watch/screens/NotificationsScreen';
const state=vi.hoisted(()=>({current:{} as Record<string,unknown>}));
vi.mock('../src/components/watch/useWatchScreenContext',()=>({useWatchScreenContext:()=>state.current}));
afterEach(cleanup);
it('explains unavailable destination flows instead of opening blank configurations',()=>{
 state.current={Button,route:{view:'notifications'},datasetState:{notifications:{status:'ready'}},
 destinations:[],routes:[],deliveries:[],previewing:false,ended:false,installAdmin:true,
 deskCoverage:{plan:'solo'},deskRepos:[],deskPackages:[],members:[],WatchNotificationSummary:()=>null,
 emailAddress:'',setEmailAddress:vi.fn()};
 render(<NotificationsScreen embedded/>);
 expect(screen.getByRole('tablist',{name:'Notification configuration'})).toBeTruthy();
 expect(screen.queryByRole('group',{name:'Notification configuration'})).toBeNull();
 for(const name of ['Slack','SIEM','Jira','PagerDuty','Add route','Test routing'])expect(screen.getByRole('tab',{name,exact:true})).toHaveProperty('disabled',true);
 expect(screen.getByText(/Save a destination before/)).toBeTruthy();
 fireEvent.click(screen.getByRole('tab',{name:'Email',exact:true}));
 expect(screen.getByRole('tab',{name:'Email',exact:true}).getAttribute('aria-selected')).toBe('true');
 expect(screen.getByRole('button',{name:'Save email'})).toBeTruthy();
});
