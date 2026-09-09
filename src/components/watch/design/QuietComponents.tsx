import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';
import './quiet.css';

export function QuietPanel({className,...props}:ComponentPropsWithoutRef<'section'>){
 return <section className={cn('quiet-panel',className)} {...props}/>;
}
export function QuietStatus({tone='neutral',className,...props}:ComponentPropsWithoutRef<'span'>&{tone?:'passed'|'review'|'failed'|'warning'|'neutral'}){
 return <span className={cn('quiet-status',className)} data-tone={tone} {...props}/>;
}
export function QuietAction({tone='secondary',className,type='button',...props}:ComponentPropsWithoutRef<'button'>&{tone?:'primary'|'secondary'}){
 return <button type={type} className={cn('quiet-action',className)} data-tone={tone} {...props}/>;
}
