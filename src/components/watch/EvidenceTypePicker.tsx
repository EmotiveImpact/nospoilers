import {Box,GitBranch,Globe2,ShieldCheck} from 'lucide-react';
import {cn} from '@/lib/utils';
export type EvidenceType='github'|'package'|'website'|'receipt';
export function EvidenceTypePicker({id,mode,onChange}:{id:string;mode:EvidenceType;onChange:(mode:EvidenceType)=>void}){
 return (
      <div className="scan-mode-grid" role="tablist" aria-label="Evidence type" onKeyDown={event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
        const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
        const index=tabs.indexOf(event.target as HTMLButtonElement)
        if(index<0)return
        event.preventDefault()
        const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length
        tabs[next].focus();tabs[next].click()
      }}>
        <button type="button" role="tab" id={`${id}-github`} aria-controls={`${id}-panel`} tabIndex={mode === "github"?0:-1} aria-selected={mode === "github"} className={cn(mode === "github" && "is-selected")} onClick={() => onChange("github")}>
          <GitBranch aria-hidden />
          <strong>GitHub repository</strong>
          <span>Connect a repo and keep watching releases.</span>
        </button>
        <button type="button" role="tab" id={`${id}-package`} aria-controls={`${id}-panel`} tabIndex={mode === "package"?0:-1} aria-selected={mode === "package"} className={cn(mode === "package" && "is-selected")} onClick={() => onChange("package")}>
          <Box aria-hidden />
          <strong>Package or build</strong>
          <span>Upload npm, archive, installer, or CI output.</span>
        </button>
        <button type="button" role="tab" id={`${id}-website`} aria-controls={`${id}-panel`} tabIndex={mode === "website"?0:-1} aria-selected={mode === "website"} className={cn(mode === "website" && "is-selected")} onClick={() => onChange("website")}>
          <Globe2 aria-hidden />
          <strong>Production website</strong>
          <span>Inspect the assets a browser can download.</span>
        </button>
        <button type="button" role="tab" id={`${id}-receipt`} aria-controls={`${id}-panel`} tabIndex={mode === "receipt"?0:-1} aria-selected={mode === "receipt"} className={cn(mode === "receipt" && "is-selected")} onClick={() => onChange("receipt")}>
          <ShieldCheck aria-hidden />
          <strong>Verify release proof</strong>
          <span>Check proof shared by a supplier or teammate.</span>
        </button>
      </div>
 );
}
