import {assessRelease} from './decision.ts';
import {compareReleases,unavailableComparison} from './history.ts';
import {investigate} from './assistant.ts';
import {releasePassport} from './passport.ts';
import type {AssuranceView,EvidenceSnapshot} from './types.ts';
export function buildAssuranceView(current:EvidenceSnapshot,previous:EvidenceSnapshot|null,now=Date.now(),source:AssuranceView['source']='hosted-release'):AssuranceView{
  const assessment=assessRelease(current,now);
  const comparison=previous?compareReleases(current,previous,now):unavailableComparison();
  const investigation=investigate(assessment,current.signature==='verified'?current.receipt?.findingRuleIds??[]:[],comparison);
  return {schema:'nospoilers.assurance-view/v1',assessment,comparison,investigation,passport:releasePassport(current,assessment,comparison),strictPreview:assessRelease(current,now,{strictReview:true}),source};
}
