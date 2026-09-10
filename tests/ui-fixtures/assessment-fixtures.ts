import {sample,warning,NOW} from '../assurance-fixtures.ts';
import {buildAssuranceView} from '../../src/assurance/index.ts';
export function assessmentFixture(mode:string){
 const snapshot=mode==='brief-review'?warning():sample();
 snapshot.release.coordinate='npm:@example/long-release-package-name@2.0.0';
 if(snapshot.receipt)snapshot.receipt.coordinate=snapshot.release.coordinate;
 snapshot.release.id=1;snapshot.release.receiptId=1;
 if(mode==='brief-blocked')snapshot.release.legalHold={active:true};
 return buildAssuranceView(snapshot,null,NOW);
}
