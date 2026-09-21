// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {radixUiTestSupport} from './helpers/radix-ui';
import {RetentionScreen} from '../src/components/watch/screens/RetentionScreen';
radixUiTestSupport();afterEach(cleanup);
it('changes a draft through the shared selector without saving before review',async()=>{
 const onDraft=vi.fn(),onSave=vi.fn();
 const props={previewing:false,ended:false,retention:{status:'ready' as const,days:90 as const},draft:90 as const,canChange:true,busy:false,confirmation:null,onDraft,onSave};
 const view=render(<RetentionScreen {...props}/>);
 await userEvent.click(screen.getByRole('combobox',{name:'Operational history window'}));
 await userEvent.click(screen.getByRole('option',{name:'180 days'}));
 expect(onDraft).toHaveBeenCalledWith(180);expect(onSave).not.toHaveBeenCalled();
 view.rerender(<RetentionScreen {...props} draft={180}/>);
 await userEvent.click(screen.getByRole('button',{name:'Review changes'}));expect(onSave).toHaveBeenCalledTimes(1);
});
it('keeps retained evidence readable and hides the save action without administrator authority',()=>{
 render(<RetentionScreen previewing={false} ended={false} retention={{status:'ready',days:90}} draft={90} canChange={false} busy={false} confirmation={null} onDraft={vi.fn()} onSave={vi.fn()}/>);
 expect(screen.getByRole('combobox',{name:'Operational history window'})).toHaveProperty('disabled',true);
 expect(screen.queryByRole('button',{name:'Review changes'})).toBeNull();expect(screen.getByText('Retained')).toBeTruthy();
});
