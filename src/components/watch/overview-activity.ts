import type {TimelineEntry} from '@/watch/types';

export function overviewActivityBuckets(entries:TimelineEntry[],days:number,until:string){
 const end=new Date(until);end.setUTCHours(24,0,0,0);
 const bucketDays=days===7?1:5,count=days===7?7:6,start=end.getTime()-days*86400000;
 const buckets=Array.from({length:count},(_,i)=>({at:new Date(start+i*bucketDays*86400000),opened:0,responded:0}));
 for(const entry of entries){const at=Date.parse(entry.at),index=Math.floor((at-start)/(bucketDays*86400000));if(!Number.isFinite(at)||at>=end.getTime()||index<0||index>=count)continue;if(entry.type==='alert')buckets[index].opened++;else if(entry.type==='alert_event')buckets[index].responded++;}
 return buckets;
}
