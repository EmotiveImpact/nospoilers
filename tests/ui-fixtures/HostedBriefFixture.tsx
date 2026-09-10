import {useEffect,useMemo,useState} from 'react';
import {WatchReleaseBrief} from '../../src/components/watch/WatchReleaseBrief';
import {WatchScreenProvider,type WatchScreenContext} from '../../src/components/watch/WatchScreenContext';
import {Button} from '../../src/components/ui/button';
import {watchHref,watchPath} from '../../src/watch/routes';
import {navigate} from '../../src/nav';
import type {ReleaseRevision} from '../../src/watch/types';
const baseRelease:ReleaseRevision={id:1,receiptId:1,channel:'stable',coordinate:'npm:@example/long-release-package-name@2.0.0',artifactSha256:'a'.repeat(64),artifactBytes:2048,mediaType:'application/gzip',sourceRevision:'fixture-revision',ciRunUrl:null,mismatch:false,receiptStatus:'failed-policy',createdAt:'2026-09-09T12:00:00Z',locations:[],approval:null,legalHold:null,publicPage:null,attestations:[]};
export function HostedBriefFixture({mode}:{mode:string}){
 const release=useMemo<ReleaseRevision>(()=>({...baseRelease,receiptStatus:mode==='brief'?'failed-policy':'passed',legalHold:mode==='brief-blocked'?{active:true,actorLogin:'fixture-owner',reason:'Fixture legal hold',createdAt:baseRelease.createdAt}:null}),[mode]);
 const [search,setSearch]=useState('?workspace=fixture&releaseFinding=0');
 const [receiptError,setReceiptError]=useState<string|null>(null);
 const [downloadingReceiptId,setDownloadingReceiptId]=useState<number|null>(null);
 useEffect(()=>{const update=()=>setSearch(location.search);window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[]);
 // Only properties consumed by this read-only component are supplied. API actions fail locally.
 const context={Button,activeInstallId:1,selectedInstallId:1,attachingReleaseId:null,canGovernReleases:false,canPublishVerify:false,confirming:null,confirmForm:()=>null,deliveryError:null,deliveryUrlByRelease:{},downloadingReceiptId,formatSealedBytes:(n:number)=>`${n} bytes`,governanceReasonByRelease:{},installAdmin:false,loadJson:async()=>{throw new Error('Fixture: downloads disabled.');},locked:true,navigate,receiptError,refreshSignedIn:async()=>{},releases:[release],search,setDownloadingReceiptId,setReceiptError,verifyingLocationId:null,watchHref,watchPath} as unknown as WatchScreenContext;
 return <WatchScreenProvider value={context}><WatchReleaseBrief release={release}/></WatchScreenProvider>;
}
