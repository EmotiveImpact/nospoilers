import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import './quiet.css';

export function QuietPanel({className,...props}:ComponentPropsWithoutRef<'section'>){
 return <section className={cn('quiet-panel',className)} {...props}/>;
}
export function QuietEmptyState({title,children}: {title:string;children?:ReactNode}){
 return <div className="quiet-empty-state"><h3>{title}</h3>{children?<div>{children}</div>:null}</div>;
}
export function QuietToolGroup({title,description,children,className,...props}:Omit<ComponentPropsWithoutRef<'section'>,'title'>&{title:string;description?:string}){
 return <section className={cn('ns-intelligence__toolgroup',className)} {...props}>
  <h4>{title}</h4>{description?<p>{description}</p>:null}{children}
 </section>;
}
export function QuietStatus({tone='neutral',className,...props}:ComponentPropsWithoutRef<'span'>&{tone?:'passed'|'review'|'failed'|'warning'|'neutral'}){
 return <span className={cn('quiet-status',className)} data-tone={tone} {...props}/>;
}
export function QuietAction({tone='secondary',className,type='button',...props}:ComponentPropsWithoutRef<'button'>&{tone?:'primary'|'secondary'}){
 return <button type={type} className={cn('quiet-action',className)} data-tone={tone} {...props}/>;
}

export function QuietSettingRow({label,description,checked,disabled,onChange}:{label:string;description:ReactNode;checked:boolean;disabled?:boolean;onChange:(checked:boolean)=>void}){
 const descriptionId=useId();
 return <div className="policy-choice"><label className="flex min-h-11 items-start gap-3 py-2 font-medium text-snow"><input className="mt-0.5 size-4 shrink-0" type="checkbox" checked={checked} disabled={disabled} aria-describedby={descriptionId} onChange={event=>onChange(event.target.checked)}/>{label}</label><p id={descriptionId} className="text-sm leading-relaxed text-mute">{description}</p></div>;
}
