import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';
import './evidence-table.css';

/** Named, wrapping table surface; callers retain the domain-specific columns. */
export function EvidenceTable({caption,className,children,...props}:ComponentPropsWithoutRef<'table'>&{caption:string}){
 return <table className={cn('quiet-evidence-table',className)} {...props}>
  <caption className="sr-only">{caption}</caption>{children}
 </table>;
}
