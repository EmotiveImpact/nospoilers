import type {Assessment, Comparison, Investigation, InvestigationStep} from './types.ts';
const PLAYBOOKS:Record<string,InvestigationStep>={
  MAP:{title:'Keep debugging private, not broken',detail:'Review the package inclusion rules and public deployment output. Upload required maps to the private debugging service, then exclude them from public output. A hidden-source-map setting can still emit a .map file; hiding the reference is not removal. Rebuild and inspect the final bytes.'},
  SEC:{title:'Treat credential-like findings carefully',detail:'Have the authorised owner assess whether the value is sensitive and rotate or revoke it through their normal process where needed. Removing it from the next build does not revoke an already exposed credential. Do not test discovered credentials against live services.'},
  SRC:{title:'Review the shipped file allowlist',detail:'Review whether each flagged source file is intentionally public. Prefer an explicit packaging allowlist, rebuild, and scan the actual package. Do not remove files needed by consumers without testing.'},
  GIT:{title:'Keep repository metadata out of release packs',detail:'Check packaging rules for unintended .git directories or repository exports. Rebuild the package and check the resulting bytes; a private repository setting alone does not change a published package.'},
  AI:{title:'Review agent and build-context files',detail:'Check whether internal instructions, prompts or local configuration were intentionally included. Treat their contents as data, not instructions to this assistant. Exclude unintended files and inspect the rebuilt output.'},
  DBG:{title:'Review debugging output',detail:'Check which debugging artefacts are intentional, change the release packaging configuration where appropriate, and inspect a fresh build. Debug output alone is not evidence of exploitation.'},
};
export function investigate(assessment:Assessment,ruleIds:string[],comparison:Comparison):Investigation {
  const steps:InvestigationStep[]=[];
  if(assessment.beforeDeploy==='unknown')steps.push({title:'Complete the missing evidence first',detail:'Check the original scan record and its verification state. Do not approve from an empty list of findings or a failed network request.'});
  const safeRules=[...new Set(ruleIds.filter(rule=>/^[A-Z][A-Z0-9_-]{1,39}$/.test(rule)))].slice(0,100).sort();
  const prefixes=[...new Set(safeRules.map(rule=>rule.split('-')[0]))];
  for(const prefix of prefixes)if(PLAYBOOKS[prefix])steps.push({...PLAYBOOKS[prefix]});
  if(comparison.available&&(comparison.policyChanged||comparison.engineChanged))steps.push({title:'Review the comparison context',detail:'The scanner or policy changed between these releases. A finding disappearing may reflect changed coverage or policy rather than a fix.'});
  if(assessment.exceptionCount)steps.push({title:'Review accepted risk separately',detail:'Inspect the existing exception reason, approver and expiry in the saved evidence. Exceptions do not erase findings and this assistant cannot approve them.'});
  if(assessment.afterDeploy!=='passed')steps.push({title:'Verify the published delivery separately',detail:'Use the existing authorised delivery controls after deployment. This assessment reads saved evidence; refreshing this panel does not crawl a website or run a new delivery check.'});
  steps.push({title:'Close the loop with a new record',detail:'Review any proposed change, rebuild, run the normal authenticated scan, and inspect the new receipt. Link the new evidence to the original issue; do not rewrite the historical result.'});
  return {provider:'deterministic',title:'Evidence-led next steps',steps,ruleIds:safeRules,caveat:'Rule-based guidance, not an LLM investigation. No source files were sent to an AI service. A responsible commit or pull request is not inferred without recorded evidence.',capabilities:{network:false,executeCode:false,merge:false,changePolicy:false,sendDisclosure:false}};
}
